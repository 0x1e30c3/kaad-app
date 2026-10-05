"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** A shell snippet with a copy button. `prompt` adds a `$` gutter for single commands. */
export default function CopyCode({ code, prompt = true }: { code: string; prompt?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <div className="group relative rounded-lg border border-line bg-raised">
      <pre className="overflow-x-auto px-3.5 py-3 pr-12 font-mono text-[12.5px] leading-relaxed">
        {code.split("\n").map((line, i) => (
          <div key={i}>
            {prompt && !line.startsWith("#") && line && <span className="select-none text-faint">$ </span>}
            <span className={line.startsWith("#") ? "text-faint" : ""}>{line}</span>
          </div>
        ))}
      </pre>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(code.split("\n").filter((l) => l && !l.startsWith("#")).join("\n"));
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        }}
        aria-label={done ? "Copied" : "Copy"}
        className="absolute top-2 right-2 grid place-items-center size-8 rounded-md border border-line bg-panel text-muted hover:text-fg"
      >
        {done ? <Check className="size-3.5 text-up" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}
