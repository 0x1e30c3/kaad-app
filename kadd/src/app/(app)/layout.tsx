import { Suspense } from "react";
import Header, { Sidebar } from "@/components/Header";
import TickerStrip from "@/components/TickerStrip";
import StatusBar from "@/components/StatusBar";
import AlertWatcher from "@/components/AlertWatcher";
import StrategyKeeper from "@/components/StrategyKeeper";
import GasDrip from "@/components/GasDrip";
import ActivityWatcher from "@/components/ActivityWatcher";

/** App chrome (icon rail, top bar, ticker, status bar) for the trading terminal; the landing page at / has its own. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="h-dvh flex">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header />
        <Suspense fallback={<div className="hidden md:block h-9 shrink-0 border-b border-line bg-panel" />}>
          <TickerStrip />
        </Suspense>
        <AlertWatcher />
        <StrategyKeeper />
        <GasDrip />
        <ActivityWatcher />
        <main className="flex-1 min-h-0 overflow-auto pb-[var(--mobile-nav-height)] md:pb-0">{children}</main>
        <StatusBar />
      </div>
    </div>
  );
}
