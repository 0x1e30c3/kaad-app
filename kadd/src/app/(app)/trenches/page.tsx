import { hot, newPairs, orEmpty, topVolume } from "@/lib/market";
import Trenches from "@/components/Trenches";
import AutoRefresh from "@/components/AutoRefresh";

export const revalidate = 30;

export default async function Page() {
  const [fresh, heating, top] = await Promise.all([newPairs(), hot(), topVolume()].map(orEmpty));
  return (
    <>
      <AutoRefresh />
      <Trenches
        cols={[
          { key: "new", title: "New pairs", hint: "Newest pools on Monad. Most are tiny or junk — check the risk label.", tokens: fresh },
          { key: "hot", title: "Hot · 1h", hint: "Getting the most trades in the last hour.", tokens: heating },
          { key: "top", title: "Top volume", hint: "Biggest 24h volume on Monad.", tokens: top },
        ]}
      />
    </>
  );
}
