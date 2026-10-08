// All Kadd event history in ONE HyperRPC request: pool swaps, club deposits, strategy and copy-vault events. Stats and
// the Kadd leaderboard share it (cached 5 min), because Envio's free HyperRPC quota is ~5 requests a minute — one call
// per source each refresh blew through it and left both pages empty.
import "server-only";
import { getAbiItem, parseEventLogs, toEventSelector, type Address, type Hex } from "viem";
import { kaddClubAbi, kaddClubFactoryAbi, kaddCopyAbi, kaddCopyClubsAbi, kaddPoolAbi, kaddReferralsAbi, kaddStrategiesAbi, kaddVenueAbi } from "./abi";
import { CLUB_FACTORY, COPY, COPY_CLUBS, REFERRALS, STRATEGIES, VENUE } from "./addresses";
import { publicClient } from "./chain";
import { swr } from "./cache";
import { DEPLOY_BLOCK, hyperClient } from "./stats";

const EVENTS = [
  getAbiItem({ abi: kaddPoolAbi, name: "Swap" }),
  getAbiItem({ abi: kaddClubAbi, name: "Deposited" }),
  getAbiItem({ abi: kaddStrategiesAbi, name: "Created" }),
  getAbiItem({ abi: kaddStrategiesAbi, name: "Executed" }),
  getAbiItem({ abi: kaddCopyAbi, name: "Followed" }),
  getAbiItem({ abi: kaddCopyAbi, name: "Copied" }),
  getAbiItem({ abi: kaddCopyAbi, name: "Funded" }),
  getAbiItem({ abi: kaddCopyAbi, name: "Closed" }),
];
// Copy clubs and referrals: separate ABIs (some event names repeat with other arguments), parsed per contract.
const CLUB_EVENTS = [
  getAbiItem({ abi: kaddCopyClubsAbi, name: "ClubCreated" }),
  getAbiItem({ abi: kaddCopyClubsAbi, name: "Deposited" }),
  getAbiItem({ abi: kaddCopyClubsAbi, name: "Redeemed" }),
  getAbiItem({ abi: kaddCopyClubsAbi, name: "Copied" }),
];
const REFERRED = getAbiItem({ abi: kaddReferralsAbi, name: "Referred" });
const live = (a: Address) => !/^0x0+$/.test(a);

type Raw = { address: Address; topics: [Hex, ...Hex[]]; data: Hex; blockNumber: Hex; blockTimestamp?: Hex; transactionHash: Hex; logIndex: Hex; blockHash: Hex; transactionIndex: Hex; removed: boolean };

async function read() {
  const token = process.env.ENVIO_API_TOKEN;
  if (!token) return null;
  const [pools, clubCount] = await Promise.all([
    publicClient.readContract({ address: VENUE, abi: kaddVenueAbi, functionName: "allPools" }),
    publicClient.readContract({ address: CLUB_FACTORY, abi: kaddClubFactoryAbi, functionName: "clubCount" }),
  ]);
  const clubs = clubCount
    ? await publicClient.multicall({
        allowFailure: false,
        contracts: Array.from({ length: Number(clubCount) }, (_, i) => ({ address: CLUB_FACTORY, abi: kaddClubFactoryAbi, functionName: "clubs", args: [BigInt(i)] }) as const),
      })
    : [];
  const addresses = [...pools, ...clubs, STRATEGIES, ...[COPY, COPY_CLUBS, REFERRALS].filter(live)];
  const head = await publicClient.getBlock(); // anchors timestamps for logs that come without one
  const raw = (await hyperClient(token).request({
    method: "eth_getLogs",
    params: [{ address: addresses, topics: [[...new Set([...EVENTS, ...CLUB_EVENTS, REFERRED].map((e) => toEventSelector(e)))]], fromBlock: `0x${DEPLOY_BLOCK.toString(16)}`, toBlock: "latest" }],
  })) as Raw[];

  const key = (tx: string, index: string | number) => `${tx}:${Number(index)}`;
  // HyperRPC includes blockTimestamp on some logs, not all: interpolate the rest between the nearest logs that have
  // one (and the head block), since testnet block time isn't constant enough to extrapolate from a fixed rate.
  const anchors = [
    ...raw.filter((l) => l.blockTimestamp).map((l) => [Number(BigInt(l.blockNumber)), Number(BigInt(l.blockTimestamp!))] as const),
    [Number(head.number), Number(head.timestamp)] as const,
  ].sort((x, y) => x[0] - y[0]);
  const ts = new Map(raw.map((l) => [key(l.transactionHash, l.logIndex), l.blockTimestamp ? Number(BigInt(l.blockTimestamp)) : interpolate(anchors, Number(BigInt(l.blockNumber)))]));
  const stamp = <T extends { transactionHash: Hex; logIndex: number }>(l: T) => ({ ...l, timestamp: ts.get(key(l.transactionHash, l.logIndex)) ?? 0 });
  const only = (a: Address) => raw.filter((l) => l.address.toLowerCase() === a.toLowerCase()) as never;
  const logs = parseEventLogs({ abi: EVENTS, logs: raw as never, strict: false }).map(stamp);
  const club = parseEventLogs({ abi: CLUB_EVENTS, logs: only(COPY_CLUBS), strict: false }).map(stamp);
  const ofClub = <N extends (typeof club)[number]["eventName"]>(name: N) => club.filter((l) => l.eventName === name) as Extract<(typeof club)[number], { eventName: N }>[];
  const from = (set: readonly string[]) => new Set(set.map((a) => a.toLowerCase()));
  const poolSet = from(pools);
  const clubSet = from(clubs);
  const at = (name: string, only?: Set<string>) => logs.filter((l) => l.eventName === name && (!only || only.has(l.address.toLowerCase())));
  return {
    pools,
    clubs,
    swaps: at("Swap", poolSet) as Extract<(typeof logs)[number], { eventName: "Swap" }>[],
    deposits: at("Deposited", clubSet) as Extract<(typeof logs)[number], { eventName: "Deposited" }>[],
    created: at("Created", from([STRATEGIES])) as Extract<(typeof logs)[number], { eventName: "Created" }>[],
    executed: at("Executed", from([STRATEGIES])) as Extract<(typeof logs)[number], { eventName: "Executed" }>[],
    followed: at("Followed", from([COPY])) as Extract<(typeof logs)[number], { eventName: "Followed" }>[],
    copied: at("Copied", from([COPY])) as Extract<(typeof logs)[number], { eventName: "Copied" }>[],
    funded: at("Funded", from([COPY])) as Extract<(typeof logs)[number], { eventName: "Funded" }>[],
    closed: at("Closed", from([COPY])) as Extract<(typeof logs)[number], { eventName: "Closed" }>[],
    clubCreated: ofClub("ClubCreated"),
    clubDeposits: ofClub("Deposited"),
    clubRedeemed: ofClub("Redeemed"),
    clubCopied: ofClub("Copied"),
    referred: parseEventLogs({ abi: [REFERRED], logs: only(REFERRALS), strict: false }).map(stamp),
  };
}

/** Timestamp for `block` by linear interpolation between (block, timestamp) anchors sorted by block. */
export function interpolate(anchors: readonly (readonly [number, number])[], block: number): number {
  const after = anchors.findIndex((a) => a[0] >= block);
  if (after === 0) {
    // Before every anchor: extrapolate with the rate of the first two (or 0.4 s/block if there's only one).
    const [b0, t0] = anchors[0];
    const rate = anchors[1] ? (anchors[1][1] - t0) / (anchors[1][0] - b0 || 1) : 0.4;
    return t0 - (b0 - block) * rate;
  }
  const [b1, t1] = anchors[after === -1 ? anchors.length - 1 : after];
  const [b0, t0] = anchors[(after === -1 ? anchors.length : after) - 1];
  if (after === -1 || b1 === b0) return t1;
  return t0 + ((t1 - t0) * (block - b0)) / (b1 - b0);
}

export type KaddLogs = NonNullable<Awaited<ReturnType<typeof read>>>;

/** Every Kadd event since the venue deploy, each with its real block timestamp. Null without an Envio token. */
export const kaddLogs = () => swr("kaddLogs", 5 * 60_000, read);

export type CopyStat = { copiers: number; depositedUsd: number; copies: number };

/** Who is being copied: per leader, active vaults, tUSDC put into them, and trades copied. From the cached logs. */
export function copyStatsFrom(logs: Pick<KaddLogs, "followed" | "funded" | "closed" | "copied">): Map<string, CopyStat> {
  const closed = new Set(logs.closed.map((l) => l.args.id!));
  const vault = new Map(logs.followed.map((l) => [l.args.id!, { leader: l.args.leader!.toLowerCase(), deposit: Number(l.args.deposit!) / 1e6 }]));
  for (const f of logs.funded) {
    const v = vault.get(f.args.id!);
    if (v) v.deposit += Number(f.args.amount!) / 1e6;
  }
  const out = new Map<string, CopyStat>();
  const get = (leader: string) => out.get(leader) ?? out.set(leader, { copiers: 0, depositedUsd: 0, copies: 0 }).get(leader)!;
  for (const [id, v] of vault) {
    if (closed.has(id)) continue;
    const s = get(v.leader);
    s.copiers += 1;
    s.depositedUsd += v.deposit;
  }
  for (const c of logs.copied) {
    const v = vault.get(c.args.id!);
    if (v) get(v.leader).copies += 1;
  }
  return out;
}

/** Copy stats per leader (lowercase address), or an empty map when history isn't available. */
export async function copyStats(): Promise<Map<string, CopyStat>> {
  const logs = await kaddLogs().catch(() => null);
  return logs ? copyStatsFrom(logs) : new Map();
}

export type ReferralStat = { invited: string[]; active: string[] };

/** Per referrer: wallets they invited onchain, and which of those then traded, copied or joined a club. */
export function referralsFrom(logs: Pick<KaddLogs, "referred" | "swaps" | "deposits" | "followed" | "clubDeposits">): Map<string, ReferralStat> {
  const acted = new Set([
    ...logs.swaps.map((l) => l.args.trader!),
    ...logs.deposits.map((l) => l.args.member!),
    ...logs.followed.map((l) => l.args.owner!),
    ...logs.clubDeposits.map((l) => l.args.member!),
  ].map((a) => a.toLowerCase()));
  const out = new Map<string, ReferralStat>();
  for (const l of logs.referred) {
    const r = l.args.referrer!.toLowerCase();
    const u = l.args.user!.toLowerCase();
    const s = out.get(r) ?? out.set(r, { invited: [], active: [] }).get(r)!;
    s.invited.push(u);
    if (acted.has(u)) s.active.push(u);
  }
  return out;
}
