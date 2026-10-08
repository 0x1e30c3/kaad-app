import { followCandidates } from "@/lib/wallets";
import { PageHeader } from "@/components/ui";
import QuickStart from "@/components/QuickStart";

export const revalidate = 60;
export const metadata = { title: "Start · Kadd", description: "Your first copy trade on Monad in about a minute." };

export default async function StartPage() {
  const candidates = await followCandidates().catch(() => []);
  return (
    <div className="p-3 md:p-5 max-w-3xl mx-auto flex flex-col gap-4">
      <PageHeader title="Your first trade in a minute" desc="Sign in, get gas, copy a real Monad trader. Free test USDC, real transactions." />
      <QuickStart candidates={candidates} />
    </div>
  );
}
