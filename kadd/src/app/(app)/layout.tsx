import Header from "@/components/Header";
import StatusBar from "@/components/StatusBar";
import AlertWatcher from "@/components/AlertWatcher";
import StrategyKeeper from "@/components/StrategyKeeper";

/** App chrome (header, status bar) for the trading terminal; the landing page at / has its own. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="h-dvh flex flex-col">
      <Header />
      <AlertWatcher />
      <StrategyKeeper />
      <main className="flex-1 min-h-0 overflow-auto pb-16 md:pb-0">{children}</main>
      <StatusBar />
    </div>
  );
}
