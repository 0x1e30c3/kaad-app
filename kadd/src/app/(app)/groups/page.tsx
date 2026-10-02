"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Ticket, Users } from "lucide-react";
import { getTrader, type Group } from "@/lib/mock";
import { allGroups, createGroup, joinByCode, joinGroup, useStore } from "@/lib/store";
import { PageHeader, TraderAvatar } from "@/components/ui";
import ClubsSection from "@/components/ClubsSection";

function weeklyPnl(g: Group) {
  return g.members.reduce((sum, a) => sum + (getTrader(a)?.pnl7d ?? 0), 0);
}

function GroupCard({ g, joined }: { g: Group; joined: boolean }) {
  const people = g.members.map(getTrader).filter(Boolean).slice(0, 5);
  const pnl = weeklyPnl(g);
  return (
    <div className="relative flex flex-col gap-3 p-4 rounded-lg border border-line bg-panel hover:border-line-strong">
      <Link href={`/groups/${g.id}`} className="absolute inset-0" aria-label={`Open group ${g.name}`} />
      <div className="flex items-start gap-3">
        <div className="grid place-items-center size-10 rounded-lg bg-raised font-semibold">{g.name[0]}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{g.name}</h3>
          <p className="text-muted text-[12px] line-clamp-2">{g.desc || "No description"}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-[12px]">
        <div className="flex -space-x-1.5">
          {people.map((p) => (
            <span key={p!.address} className="ring-2 ring-panel rounded-full">
              <TraderAvatar name={p!.name} hue={p!.hue} size={22} />
            </span>
          ))}
        </div>
        <span className="text-muted tabular-nums">{g.members.length} members</span>
        <span className={`ml-auto tabular-nums font-medium ${pnl >= 0 ? "text-up" : "text-down"}`} title="Members' total 7d PnL">
          {pnl >= 0 ? "+" : "-"}${Math.abs(pnl).toLocaleString("en-US")}
        </span>
      </div>
      {joined ? (
        <span className="relative h-8 grid place-items-center rounded-md bg-raised text-[12px] font-medium text-muted">Joined</span>
      ) : (
        <button onClick={() => joinGroup(g.id)} className="relative z-10 h-8 rounded-md border border-line-strong text-[12px] font-semibold hover:bg-hover">
          Join
        </button>
      )}
    </div>
  );
}

export default function GroupsPage() {
  const s = useStore();
  const router = useRouter();
  const [mode, setMode] = useState<null | "create" | "join">(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [code, setCode] = useState("");

  const groups = allGroups(s);
  const mine = groups.filter((g) => s.joined.includes(g.id));
  const others = groups.filter((g) => !s.joined.includes(g.id));

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
      <PageHeader title="Groups" desc="Trade with friends: see their trades, copy each other, compete on weekly PnL.">
        <button onClick={() => setMode(mode === "join" ? null : "join")} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md border border-line-strong font-semibold hover:bg-hover">
          <Ticket className="size-4" /> Use code
        </button>
        <button onClick={() => setMode(mode === "create" ? null : "create")} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-fg text-bg font-semibold hover:opacity-90">
          <Plus className="size-4" /> Create group
        </button>
      </PageHeader>

      {mode && (
        <form onSubmit={submit} className="mb-6 p-4 rounded-lg border border-line bg-panel flex flex-col sm:flex-row gap-2">
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

      <ClubsSection />

      <section className="mb-8">
        <h2 className="font-semibold mb-3">My groups <span className="text-faint font-normal tabular-nums">{mine.length}</span></h2>
        {mine.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{mine.map((g) => <GroupCard key={g.id} g={g} joined />)}</div>
        ) : (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-dashed border-line-strong text-muted">
            <Users className="size-5 shrink-0" />
            You haven’t joined a group yet. Create your own or join one below.
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-3">Public groups</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{others.map((g) => <GroupCard key={g.id} g={g} joined={false} />)}</div>
      </section>
    </div>
  );
}
