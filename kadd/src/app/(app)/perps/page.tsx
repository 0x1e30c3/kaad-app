import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import PerpsTrade from "@/components/PerpsTrade";

export const metadata = { title: "Perps · Kadd", description: "Trade perpetual futures on Perpl from one passkey: AUSD in, long or short, close anytime." };

export default function PerpsPage() {
  return (
    <div className="p-3 md:p-5 max-w-xl mx-auto flex flex-col gap-4">
      <PageHeader title="Perps" desc="Long or short BTC, ETH, SOL and MON on Perpl with AUSD. Your passkey signs; Kadd never holds your funds." />
      <Suspense>
        <PerpsTrade />
      </Suspense>
    </div>
  );
}
