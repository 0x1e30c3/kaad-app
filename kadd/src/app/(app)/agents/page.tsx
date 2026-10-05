import Link from "next/link";
import { headers } from "next/headers";
import { ArrowUpRight, BarChart3, Bot, Coins, KeyRound, Search, ShieldCheck, Trophy, Wallet } from "lucide-react";
import { PageHeader, card } from "@/components/ui";
import CopyCode from "@/components/CopyCode";

export const metadata = { title: "AI Agents · Kadd" };

const REPO = "https://github.com/maulana-tech/kaad-app";
const SKILL_URL = (name: string) => `${REPO}/blob/dev/skills/${name}/SKILL.md`;

const SKILLS = [
  {
    name: "kadd-market",
    icon: BarChart3,
    title: "Market lists",
    what: "Trending, hot (1h activity), 1h gainers, new pairs and top volume on Monad, with price, liquidity, change and a quick risk badge.",
    ask: ["What's pumping on Monad in the last hour?", "Koin baru di Monad hari ini apa aja?"],
    api: "/api/agent/market?list=gainers&limit=5",
  },
  {
    name: "kadd-token",
    icon: Search,
    title: "Token due diligence",
    what: "Find a token by ticker, then a 0–100 risk score where every point has a reason, honeypot and trust checks, holders and the latest trades.",
    ask: ["Is CHOG safe to buy?", "Cek token 0x3500…7777 aman nggak"],
    api: "/api/agent/token/0x350035555e10d9afaf1566aaebfced5ba6c27777",
  },
  {
    name: "kadd-wallet",
    icon: Wallet,
    title: "Wallet profile",
    what: "A wallet's recent trades, holdings, .nad name, PnL on Kadd, and a backtest of what copying it would have returned.",
    ask: ["Should I copy 0xb42f…ead6?", "Trader ini bagus nggak?"],
    api: "/api/agent/wallet/0xb42f812a44c22cc6b861478900401ee759ebead6",
  },
  {
    name: "kadd-smart-money",
    icon: Trophy,
    title: "Smart money",
    what: "Nansen-labelled smart money with real 30-day PnL, who's trading Monad right now ranked by volume or Copy ROI, and the Kadd PnL board.",
    ask: ["Which wallets are worth copying right now?", "Siapa whale Monad hari ini?"],
    api: "/api/agent/leaderboard?board=smart&limit=5",
  },
  {
    name: "kadd-trade",
    icon: Coins,
    title: "Paper trade & auto copy",
    what: "Buy and sell on Kadd testnet at mainnet prices, or start an auto copy vault that mirrors a real wallet. Testnet only.",
    ask: ["Buy 10 tUSDC of CHOG on Kadd", "Auto-copy that wallet with $5 per buy"],
    api: "/api/agent/copy?owner=0x4FF54485854bE63824EFBBBA9eEB3EB0396cd17B",
  },
];

const ENDPOINTS: [string, string, string][] = [
  ["market", "/api/agent/market?list=trending|hot|gainers|new|volume", "/api/agent/market?list=trending&limit=5"],
  ["search", "/api/agent/search?q=<ticker or name>", "/api/agent/search?q=chog"],
  ["token", "/api/agent/token/<address>", "/api/agent/token/0x350035555e10d9afaf1566aaebfced5ba6c27777"],
  ["wallet", "/api/agent/wallet/<address>", "/api/agent/wallet/0xb42f812a44c22cc6b861478900401ee759ebead6"],
  ["leaderboard", "/api/agent/leaderboard?sort=volume|copyRoi|trades|net|lastAt&minTrades=", "/api/agent/leaderboard?sort=volume&limit=5"],
  ["smart money", "/api/agent/leaderboard?board=smart", "/api/agent/leaderboard?board=smart&limit=5"],
  ["stats", "/api/agent/stats", "/api/agent/stats"],
  ["trade", "/api/agent/trade?token=&side=buy|sell&amount=&from=", ""],
  ["copy", "/api/agent/copy?leader=&from=&perTrade=&dailyCap=&deposit= · ?owner=", ""],
];

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <li className="grid grid-cols-[28px_1fr] gap-3">
    <span className="grid place-items-center size-7 rounded-full bg-fg text-bg text-[12px] font-semibold tabular-nums">{n}</span>
    <div className="min-w-0 flex flex-col gap-2 pt-0.5">
      <h3 className="text-[14px] font-semibold">{title}</h3>
      {children}
    </div>
  </li>
);

export default async function AgentsPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3123";
  const origin = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;

  return (
    <div className="p-3 md:p-5 max-w-5xl mx-auto flex flex-col gap-6">
      <PageHeader title="AI Agents" desc="Give any AI agent Kadd's live Monad data, wallet intel and testnet trading. Five skills, one install.">
        <a href={`${REPO}/tree/dev/skills`} target="_blank" rel="noreferrer" className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-md border border-line-strong text-[13px] font-semibold hover:bg-hover">
          View on GitHub <ArrowUpRight className="size-4" />
        </a>
      </PageHeader>

      <section className={`${card} -mt-2 p-5 md:p-6 gap-5`}>
        <div className="flex items-center gap-2">
          <Bot className="size-4 text-muted" />
          <h2 className="text-[15px] font-semibold">Set up in two minutes</h2>
          <span className="ml-auto text-[12px] text-muted hidden sm:inline">Works with agents that support Agent Skills: Claude Code, Cursor, Codex and more</span>
        </div>
        <ol className="flex flex-col gap-5">
          <Step n={1} title="Install the skills">
            <CopyCode code={`npx skills add maulana-tech/kaad-app`} />
            <p className="text-[12px] text-muted">Pick your agent when asked. The skills land in its skills folder; restart the agent so it picks them up.</p>
          </Step>
          <Step n={2} title="Point them at Kadd">
            <CopyCode code={`export KADD_API=${origin}`} />
            <p className="text-[12px] text-muted">That&apos;s all research needs: market lists, token checks, wallets and leaderboards are public and read-only.</p>
          </Step>
          <Step n={3} title="Optional: a testnet key for trading">
            <CopyCode code={`# only for kadd-trade · testnet MON from faucet.monad.xyz\ncast wallet new\nexport KADD_PRIVATE_KEY=0x...`} />
            <p className="text-[12px] text-muted">
              Needs <a href="https://getfoundry.sh" target="_blank" rel="noreferrer" className="text-fg underline">Foundry</a>&apos;s <code className="font-mono">cast</code>. Use a fresh key that holds nothing real; never paste it into chat.
            </p>
          </Step>
          <Step n={4} title="Ask in plain words">
            <p className="text-[13px]">
              <span className="font-mono text-muted">&gt;</span> &ldquo;Which wallets are worth copying right now? Check the best one.&rdquo;
            </p>
            <p className="text-[12px] text-muted">The agent picks the right skill on its own, calls Kadd, and answers with the numbers behind it.</p>
          </Step>
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold">Skills</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {SKILLS.map((s) => (
            <article key={s.name} className={`${card} p-5 gap-3`}>
              <div className="flex items-start gap-3">
                <span className="grid place-items-center size-10 shrink-0 rounded-xl bg-raised text-muted [&>svg]:size-5"><s.icon /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-semibold leading-tight">{s.title}</h3>
                  <code className="text-[12px] text-faint font-mono">{s.name}</code>
                </div>
              </div>
              <p className="text-[13px] text-muted">{s.what}</p>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-faint uppercase tracking-wide">Try asking</span>
                {s.ask.map((q) => (
                  <span key={q} className="rounded-lg bg-raised px-3 py-2 text-[13px]">&ldquo;{q}&rdquo;</span>
                ))}
              </div>
              <div className="mt-auto flex items-center gap-3 pt-3 border-t border-line text-[13px]">
                <a href={SKILL_URL(s.name)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-muted hover:text-fg">
                  SKILL.md <ArrowUpRight className="size-3.5" />
                </a>
                <a href={s.api} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 font-medium text-muted hover:text-fg">
                  Live data <ArrowUpRight className="size-3.5" />
                </a>
              </div>
            </article>
          ))}
          <article className={`${card} p-5 gap-3 md:col-span-1`}>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-up" />
              <h3 className="text-[15px] font-semibold">How trading stays safe</h3>
            </div>
            <ul className="flex flex-col gap-2 text-[13px] text-muted">
              <li><span className="text-fg font-medium">Plans, not custody.</span> Kadd returns ready <code className="font-mono">cast</code> commands; your agent signs them locally. The key never reaches Kadd.</li>
              <li><span className="text-fg font-medium">You approve every step.</span> The skill shows the plan and amounts, and waits for your yes.</li>
              <li><span className="text-fg font-medium">Testnet only.</span> Free test USDC at real mainnet prices. Nothing touches mainnet funds.</li>
              <li><span className="text-fg font-medium">Auto copy has hard limits.</span> The vault contract enforces per-trade and daily caps, and you can withdraw anytime.</li>
            </ul>
            <p className="mt-auto flex items-center gap-1.5 text-[12px] text-faint"><KeyRound className="size-3.5" /> Use a fresh testnet key that holds nothing else.</p>
          </article>
        </div>
      </section>

      <section className={`${card} overflow-hidden`}>
        <div className="flex flex-wrap items-baseline gap-2 px-4 pt-4 pb-3">
          <h2 className="text-[15px] font-semibold">Agent API</h2>
          <span className="text-[12px] text-muted">Public JSON, no key. Base: <code className="font-mono">{origin}</code></span>
          <a href="/api/agent/help" target="_blank" rel="noreferrer" className="ml-auto text-[12px] font-medium text-muted hover:text-fg inline-flex items-center gap-1">
            /api/agent/help <ArrowUpRight className="size-3.5" />
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <tbody>
              {ENDPOINTS.map(([name, path, sample]) => (
                <tr key={name} className="border-t border-line hover:bg-hover">
                  <td className="px-4 py-2.5 font-medium whitespace-nowrap">{name}</td>
                  <td className="px-3 font-mono text-[12px] text-muted"><span className="text-faint">GET </span>{path}</td>
                  <td className="px-4 text-right whitespace-nowrap">
                    {sample ? (
                      <a href={sample} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-medium text-muted hover:text-fg">
                        Try <ArrowUpRight className="size-3.5" />
                      </a>
                    ) : (
                      <span className="text-[12px] text-faint">returns a cast plan</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[12px] text-faint">
        Market data is live Monad mainnet; trading and auto copy run on Monad testnet. Nothing here is financial advice.{" "}
        <Link href="/leaderboard" className="underline hover:text-fg">See the same data in the app →</Link>
      </p>
    </div>
  );
}
