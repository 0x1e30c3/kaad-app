import Link from "next/link";
import { getLeaderboard } from "@/lib/leaderboard";
import { getMainnetBoard } from "@/lib/wallets";
import { smartMoney } from "@/lib/nansen";
import { copyStats } from "@/lib/events";
import { copyBoard } from "@/lib/share";
import CopyBoard from "@/components/CopyBoard";
import { PageHeader } from "@/components/ui";
import Leaderboard from "@/components/Leaderboard";
import AutoRefresh from "@/components/AutoRefresh";

export const revalidate = 60;
export const metadata = { title: "Leaderboard · Kadd" };

export default async function LeaderboardPage() {
  const [board, mainnet, smart, copy, vaults] = await Promise.all([getLeaderboard(), getMainnetBoard(), smartMoney(), copyStats(), copyBoard().catch(() => [])]);
  return (
    <div className="p-3 md:p-5 flex flex-col gap-5">
      <AutoRefresh seconds={60} />
      <PageHeader title="Leaderboard" desc="Who’s trading Monad memecoins right now, and who’s winning on Kadd.">
        <Link href="/stats" className="text-[12px] font-medium text-muted hover:text-fg underline-offset-4 hover:underline">Network stats →</Link>
        <Link href="/agents" className="text-[12px] font-medium text-muted hover:text-fg underline-offset-4 hover:underline">AI agents →</Link>
      </PageHeader>
      <Leaderboard board={board} mainnet={mainnet} smart={smart} copiers={Object.fromEntries([...copy].map(([k, v]) => [k, v.copiers]))} />
      <CopyBoard rows={vaults} />
    </div>
  );
}
