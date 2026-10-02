import Link from "next/link";
import { Logo } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 text-center text-fg">
      <div className="flex flex-col items-center gap-3">
        <Logo size={36} />
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Page not found</h1>
        <p className="max-w-sm text-muted">The token, group or club you&apos;re looking for doesn&apos;t exist, or the link is wrong.</p>
        <div className="mt-2 flex gap-2">
          <Link href="/trenches" className="grid h-9 place-items-center rounded-md bg-fg px-4 font-semibold text-bg">Open Trenches</Link>
          <Link href="/" className="grid h-9 place-items-center rounded-md border border-line px-4 font-medium hover:bg-hover">Home</Link>
        </div>
      </div>
    </main>
  );
}
