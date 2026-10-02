import { orEmpty, trending } from "@/lib/market";
import TrendingTable from "@/components/TrendingTable";
import AutoRefresh from "@/components/AutoRefresh";

export const revalidate = 30;

export default async function Trending() {
  return (
    <>
      <AutoRefresh />
      <TrendingTable tokens={await orEmpty(trending())} />
    </>
  );
}
