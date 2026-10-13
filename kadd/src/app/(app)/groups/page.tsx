"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Ticket } from "lucide-react";
import { groupStory, type Group } from "@/lib/mock";
import { allGroups, createGroup, joinByCode, useStore } from "@/lib/store";
import { Monogram, PageHeader, PanelEmpty, Pct, card, hueOf } from "@/components/ui";
import ClubsSection from "@/components/ClubsSection";
import FollowingFeed from "@/components/FollowingFeed";
import CopyClubs from "@/components/CopyClubs";

function GroupCard({ g, joined }: { g: Group; joined: boolean }) {
  const { total, people } = groupStory(g);
  const volume = people.reduce((s, t) => s + t.volume, 0);
  const roi = volume ? (total / volume) * 100 : 0;
  return (
    <article className={`${card} p-5 gap-4`}>
      <div className="flex items-center gap-3">
        <Monogram name={g.name} hue={hueOf(g.id)} size={40} />
        <h3 className="min-w-0 truncate text-[16px] font-semibold">{g.name}</h3>
      </div>
      <div>
        <div className="text-[12px] text-muted">Members’ PnL · 7d · Demo Data</div>
        <Pct v={roi} className="text-[28px] font-semibold tracking-[-0.02em]" />
      </div>
      <Link href={`/groups/${g.id}`} className="mt-auto inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-fg px-4 text-[13px] font-semibold text-bg hover:opacity-90">
        {joined ? "Open group" : "View group"} <ArrowRight className="size-3.5" />
      </Link>
    </article>
  );
}

export default function GroupsPage() {
  const s = useStore();
  const router = useRouter();
  const [mode, setMode] = useState<null | "create" | "join">(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [code, setCode] = useState("");
  const [filter, setFilter] = useState<"all" | "joined">("all");

  const groups = allGroups(s);
  const mine = groups.filter((g) => s.joined.includes(g.id));
  // Joined groups first, then the rest by members' weekly PnL.
  const rows = filter === "joined" ? mine : [...mine, ...groups.filter((g) => !s.joined.includes(g.id)).sort((a, b) => groupStory(b).total - groupStory(a).total)];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = mode === "create" ? (name.trim() ? createGroup(name.trim(), desc.trim()) : null) : joinByCode(code);
    if (id) {
      setMode(null);
      setName("");
      setDesc("");
      setCode("");
      router.push(`/groups/${id}`);
    }
  };

  return (
    <div className="p-3 md:p-5 max-w-6xl mx-auto">
      <PageHeader title="Groups & Clubs" desc="Trade with friends: see their trades, copy each other, pool funds onchain.">
        <button onClick={() => setMode(mode === "join" ? null : "join")} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md border border-line-strong font-semibold hover:bg-hover">
          <Ticket className="size-4" /> Use code
        </button>
        <button onClick={() => setMode(mode === "create" ? null : "create")} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-fg text-bg font-semibold hover:opacity-90">
          <Plus className="size-4" /> Create group
        </button>
      </PageHeader>

      {mode && (
        <form onSubmit={submit} className="mb-4 p-3 rounded-lg border border-line bg-panel flex flex-col sm:flex-row gap-2">
          {mode === "create" ? (
            <>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" maxLength={40} className="flex-1 h-10 px-3 rounded-md bg-raised outline-none border border-transparent focus:border-line-strong placeholder:text-faint" />
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" maxLength={80} className="flex-[2] h-10 px-3 rounded-md bg-raised outline-none border border-transparent focus:border-line-strong placeholder:text-faint" />
            </>
          ) : (
            <input autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="Invite code, e.g. KADD-UI24" className="flex-1 h-10 px-3 rounded-md bg-raised outline-none border border-transparent focus:border-line-strong placeholder:text-faint font-mono uppercase" />
          )}
          <button className="h-10 px-5 rounded-md bg-fg text-bg font-semibold hover:opacity-90">{mode === "create" ? "Create" : "Join"}</button>
        </form>
      )}

      <div className="flex flex-col gap-8">
        <FollowingFeed />
        <CopyClubs />
        <ClubsSection />

        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-[15px] font-semibold">Groups <span className="text-[11px] text-muted">Demo</span></h2>
            <span className="text-[13px] text-faint tabular-nums">{rows.length}</span>
            <div role="tablist" aria-label="Filter groups" className="ml-auto flex p-0.5 rounded-md bg-raised text-[12px] font-medium">
              {(["all", "joined"] as const).map((f) => (
                <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`h-7 px-3 rounded ${filter === f ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg"}`}>
                  {f === "all" ? "All" : `Joined ${mine.length}`}
                </button>
              ))}
            </div>
          </div>
          <p className="mb-3 text-[11px] text-muted">Demo group feeds and PnL — illustrative performance, not actual returns.</p>
          {rows.length === 0 ? (
            <div className="rounded-xl border border-line bg-panel">
              <PanelEmpty>
                You haven’t joined a group yet. <button onClick={() => setFilter("all")} className="text-fg underline">Browse groups</button> or{" "}
                <button onClick={() => setMode("create")} className="text-fg underline">create one</button>.
              </PanelEmpty>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((g) => <GroupCard key={g.id} g={g} joined={s.joined.includes(g.id)} />)}
            </div>
          )}
          <p className="mt-2 text-[11px] text-faint">Group feeds and PnL are demo data until groups go onchain.</p>
        </section>
      </div>
    </div>
  );
}
