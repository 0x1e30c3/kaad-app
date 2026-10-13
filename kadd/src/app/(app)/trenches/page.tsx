import { trenchesSnapshot } from "@/lib/market";
import Trenches from "@/components/Trenches";

export const revalidate = 30;

export default async function Page() {
  const [fresh, heating, top] = await Promise.all([trenchesSnapshot("new"), trenchesSnapshot("hot"), trenchesSnapshot("top")]);
  return (
    <>
      <Trenches
        cols={[
          { key: "new", title: "New pairs", hint: "Newest pools on Monad. Review liquidity and risk before buying.", ...fresh },
          { key: "hot", title: "Hot · 1h", hint: "Getting the most trades in the last hour.", ...heating },
          { key: "top", title: "Top volume", hint: "Biggest 24h volume on Monad.", ...top },
        ]}
      />
    </>
  );
}
