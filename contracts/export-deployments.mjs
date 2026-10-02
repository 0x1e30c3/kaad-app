// Builds deployment.json: every Kadd contract on Monad testnet with its deploy transaction, plus the mirror pools
// opened by SeedMirrors. Sources: forge broadcast records (txs + receipts) and a few live reads (contracts created
// inside the venue constructor, Sourcify status). Re-run after any deploy:  node export-deployments.mjs
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";

const RPC = "https://testnet-rpc.monad.xyz";
const EXPLORER = "https://testnet.monadexplorer.com";
const dir = new URL("./broadcast/", import.meta.url);

const rpc = async (method, params) => {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
};
const call = async (to, selector) => "0x" + (await rpc("eth_call", [{ to, data: selector }, "latest"])).slice(26);
const sourcify = async (a) => {
  const r = await fetch(`https://sourcify.dev/server/v2/contract/10143/${a}`).catch(() => null);
  const j = r?.ok ? await r.json() : null;
  return j?.match ?? null;
};
const hex = (h) => (h == null ? null : Number(BigInt(h)));
const mon = (wei) => Number(wei) / 1e18;

// Every non-dry-run broadcast run, oldest first.
const runs = [];
for (const script of existsSync(dir) ? readdirSync(dir) : []) {
  const chainDir = new URL(`${script}/10143/`, dir);
  if (!existsSync(chainDir)) continue;
  for (const f of readdirSync(chainDir)) {
    if (!/^run-\d+\.json$/.test(f)) continue;
    runs.push({ script, ...JSON.parse(readFileSync(new URL(f, chainDir))) });
  }
}
runs.sort((a, b) => a.timestamp - b.timestamp);

const transactions = [];
for (const run of runs) {
  for (const [i, tx] of run.transactions.entries()) {
    const rc = run.receipts.find((r) => r.transactionHash === tx.hash) ?? run.receipts[i];
    transactions.push({
      script: run.script,
      type: tx.transactionType,
      contract: tx.contractName ?? null,
      function: tx.function ?? null,
      arguments: tx.arguments ?? null,
      address: tx.contractAddress,
      from: tx.transaction.from,
      hash: tx.hash,
      block: hex(rc?.blockNumber),
      status: rc?.status === "0x1" ? "success" : "failed",
      gasUsed: hex(rc?.gasUsed),
      feeMon: rc ? mon(BigInt(rc.gasUsed) * BigInt(rc.effectiveGasPrice)) : null,
      time: new Date(run.timestamp).toISOString(),
      gitCommit: run.commit ?? null,
      explorer: `${EXPLORER}/tx/${tx.hash}`,
      logs: rc?.logs ?? [],
    });
  }
}

// Contracts: CREATE txs, named by role. Kuru factories are told apart by deploy order (v1 was replaced by v2).
const creates = transactions.filter((t) => t.type === "CREATE");
const kuruFactories = creates.filter((t) => t.script === "Deploy.s.sol");
const role = (t) =>
  t.script === "Deploy.s.sol"
    ? kuruFactories.indexOf(t) === kuruFactories.length - 1
      ? "KaddClubFactory (Kuru v2)"
      : `KaddClubFactory (Kuru v${kuruFactories.indexOf(t) + 1}, deprecated)`
    : t.script === "DeployVenue.s.sol" && t.contract === "KaddClubFactory"
      ? "KaddClubFactory (venue)"
      : t.contract;
const contracts = creates.map((t) => ({ name: role(t), contract: t.contract, address: t.address, deployTx: t.hash, block: t.block, deployer: t.from, time: t.time }));

// Contracts the venue constructor created (no tx of their own): read them from the venue.
const venue = contracts.find((c) => c.contract === "KaddVenue");
if (venue) {
  const [core, usdc] = await Promise.all([call(venue.address, "0xf2f4eb26"), call(venue.address, "0x3e413bee")]); // core(), usdc() selectors
  for (const [name, address] of [["KaddCore", core], ["TestUSDC (tUSDC)", usdc]])
    contracts.push({ name, contract: name.split(" ")[0], address, deployTx: venue.deployTx, block: venue.block, deployer: venue.address, time: venue.time, createdBy: "KaddVenue constructor" });
}

// Mirror pools from MirrorCreated(address indexed source, address indexed pool, address token, string symbol).
const MIRROR_CREATED = "0xe394346b0ded2c5fcd6799b0c0d2fef81e838348d17e07505148bb7c68a304a9"; // keccak of the signature
const mirrors = [];
for (const t of transactions.filter((t) => t.function?.startsWith("createMirror"))) {
  for (const l of t.logs) {
    if (l.topics[0] !== MIRROR_CREATED || l.address.toLowerCase() !== venue?.address.toLowerCase()) continue;
    const data = l.data.slice(2);
    const token = "0x" + data.slice(24, 64);
    const len = parseInt(data.slice(128, 192), 16);
    const symbol = Buffer.from(data.slice(192, 192 + len * 2), "hex").toString("utf8");
    mirrors.push({ symbol, mainnetToken: "0x" + l.topics[1].slice(26), pool: "0x" + l.topics[2].slice(26), mirrorToken: token, tx: t.hash, block: t.block });
  }
}

for (const c of contracts) {
  c.verified = await sourcify(c.address);
  c.explorer = `${EXPLORER}/address/${c.address}`;
}

const inUse = ["KaddVenue", "KaddCore", "TestUSDC (tUSDC)", "KaddClubFactory (venue)", "KaddStrategies"];
const out = {
  network: "Monad testnet",
  chainId: 10143,
  rpc: RPC,
  explorer: EXPLORER,
  generatedAt: new Date().toISOString(),
  usedByApp: Object.fromEntries(contracts.filter((c) => inUse.includes(c.name)).map((c) => [c.name, c.address])),
  contracts,
  mirrors,
  transactions: transactions.map(({ logs, ...t }) => ({ ...t, logCount: logs.length })),
  totals: { transactions: transactions.length, gasUsed: transactions.reduce((s, t) => s + (t.gasUsed ?? 0), 0), feeMon: transactions.reduce((s, t) => s + (t.feeMon ?? 0), 0) },
};
writeFileSync(new URL("./deployment.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(`deployment.json: ${contracts.length} contracts, ${mirrors.length} mirror pools, ${transactions.length} txs, ${out.totals.feeMon.toFixed(4)} MON in fees`);
