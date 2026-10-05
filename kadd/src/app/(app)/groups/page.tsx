"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Ticket, Trophy, Users, Zap } from "lucide-react";
import { groupStory, type Group } from "@/lib/mock";
import { allGroups, createGroup, joinByCode, joinGroup, useStore } from "@/lib/store";
import { Monogram, PageHeader, PanelEmpty, StatusPill, TraderAvatar, card, hueOf } from "@/components/ui";
import { AreaChart, agoLabel } from "@/components/charts";
import ClubsSection from "@/components/ClubsSection";
import FollowingFeed from "@/components/FollowingFeed";

/** A labelled fact row: icon, label, then the value on the right. */
const Fact = ({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) => (
  <div className="flex items-center gap-2.5 min-w-0 text-[13px]">
    <span className="grid place-items-center size-7 shrink-0 rounded-lg bg-raised text-muted [&>svg]:size-3.5">{icon}</span>
    <span className="text-muted shrink-0">{label}</span>
    <span className="ml-auto min-w-0 flex items-center gap-1.5 justify-end">{children}</span>
  </div>
);

function GroupCard({ g, joined }: { g: Group; joined: boolean }) {
  const { total, series, top, latest, people } = groupStory(g);
  const volume = people.reduce((s, t) => s + t.volume, 0);
  const roi = volume ? (total / volume) * 100 : 0;
  const up = total >= 0;
  return (
    <article className={`${card} p-5 gap-4`}>
      <div className="flex items-start gap-3">
        <Monogram name={g.name} hue={hueOf(g.id)} size={40} />
        <div className="min-w-0 flex-1">
          <Link href={`/groups/${g.id}`} className="block text-[16px] font-semibold leading-tight truncate hover:underline after:absolute after:inset-0">{g.name}</Link>
          <p className="mt-0.5 text-[12px] text-muted line-clamp-1">{g.desc || "No description"}</p>
        </div>
        {joined && <StatusPill tone="up">Joined</StatusPill>}
      </div>

      <div>
        <div className="text-[12px] text-muted">Members’ PnL · 7d</div>
        <div className="flex items-baseline gap-2">
          <span className="text-[28px] font-semibold tabular-nums tracking-[-0.02em]">
            {up ? "+" : "-"}${Math.abs(total).toLocaleString("en-US")}
          </span>
          <span className={`h-5 px-1.5 rounded-md text-[11px] font-semibold tabular-nums inline-flex items-center ${up ? "bg-up/12 text-up" : "bg-down/12 text-down"}`}>
            {up ? "▲" : "▼"} {Math.abs(roi).toFixed(1)}%
          </span>
        </div>
        <div className="relative z-10 mt-2 -mx-1">
          <AreaChart data={series.map((v, i) => ({ t: i, v }))} height={72} axes={false} kind="pnl" label={agoLabel(7)} color={up ? "var(--up)" : "var(--down)"} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Fact icon={<Users />} label="Members">
          <span className="flex -space-x-1.5">
            {people.slice(0, 4).map((p) => <span key={p.address} className="ring-2 ring-panel rounded-full"><TraderAvatar name={p.name} hue={p.hue} size={20} /></span>)}
          </span>
          <span className="font-medium tabular-nums">{g.members.length}</span>
        </Fact>
        {top && (
          <Fact icon={<Trophy />} label="Top trader">
            <span className="font-medium truncate">{top.name}</span>
            <span className="tabular-nums text-up">+${top.pnl7d.toLocaleString("en-US")}</span>
          </Fact>
        )}
        {latest && (
          <Fact icon={<Zap />} label="Latest">
            <span className="truncate">
              <span className="font-medium">{latest.trader.name}</span> <span className={latest.side === "buy" ? "text-up" : "text-down"}>{latest.side === "buy" ? "bought" : "sold"}</span>{" "}
              <Link href={`/token/${latest.token.address}`} className="relative z-10 font-medium hover:underline">{latest.token.symbol}</Link>
            </span>
            <span className="shrink-0 text-faint tabular-nums">{latest.agoMin || 1}m</span>
          </Fact>
        )}
      </div>

      <div className="relative z-10 mt-auto flex items-center gap-2 pt-4 border-t border-line">
        <Link href={`/groups/${g.id}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-fg">
          View group <ArrowRight className="size-3.5" />
        </Link>
        {!joined && (
          <button onClick={() => joinGroup(g.id)} className="ml-auto h-8 px-3.5 rounded-lg bg-fg text-bg text-[12px] font-semibold hover:opacity-90">Join</button>
        )}
      </div>
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
        <ClubsSection />

        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-[15px] font-semibold">Groups</h2>
            <span className="text-[13px] text-faint tabular-nums">{rows.length}</span>
            <div role="tablist" aria-label="Filter groups" className="ml-auto flex p-0.5 rounded-md bg-raised text-[12px] font-medium">
              {(["all", "joined"] as const).map((f) => (
                <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`h-7 px-3 rounded ${filter === f ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg"}`}>
                  {f === "all" ? "All" : `Joined ${mine.length}`}
                </button>
              ))}
            </div>
          </div>
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
