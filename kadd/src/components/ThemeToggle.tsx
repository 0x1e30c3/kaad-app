"use client";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const toggle = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
  };
  return (
    <button
      onClick={toggle}
      aria-label="Toggle light/dark theme"
      className="grid place-items-center size-8 rounded-md text-muted hover:text-fg hover:bg-hover"
    >
      <Sun className="size-4 hidden dark:block" />
      <Moon className="size-4 dark:hidden" />
    </button>
  );
}
