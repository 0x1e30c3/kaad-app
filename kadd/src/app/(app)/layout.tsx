import Header, { Sidebar } from "@/components/Header";
import StatusBar from "@/components/StatusBar";
import AlertWatcher from "@/components/AlertWatcher";
import StrategyKeeper from "@/components/StrategyKeeper";
import GasDrip from "@/components/GasDrip";
import ActivityWatcher from "@/components/ActivityWatcher";

/** App chrome (header, status bar) for the trading terminal; the landing page at / has its own. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="h-dvh flex overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <AlertWatcher />
        <StrategyKeeper />
        <GasDrip />
        <ActivityWatcher />
        <main className="flex-1 min-h-0 overflow-auto pb-[var(--mobile-nav-height)]">{children}</main>
        <StatusBar />
      </div>
    </div>
  );
}
