"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DayPicker({
  days = 7,
  value,
  onChange,
  className,
}: {
  days?: number;
  value: string;
  onChange: (day: string) => void;
  className?: string;
}) {
  const list = useMemo(() => {
    const out: Date[] = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      out.push(d);
    }
    return out;
  }, [days]);

  const todayIso = localIso(new Date());

  return (
    <div className={cn("flex gap-2 overflow-x-auto pb-1", className)}>
      {list.map((d) => {
        const iso = localIso(d);
        const active = iso === value;
        const isToday = iso === todayIso;
        return (
          <button
            key={iso}
            onClick={() => onChange(iso)}
            className={cn(
              "shrink-0 rounded-lg border px-3 py-1.5 text-center text-xs transition-colors",
              active
                ? "border-accent bg-accent/10 text-ink"
                : "border-line bg-surface text-muted hover:text-ink"
            )}
          >
            <div className="font-medium">
              {isToday
                ? "Today"
                : d.toLocaleDateString("en-IN", { weekday: "short" })}
            </div>
            <div className="mt-0.5 text-[10px]">
              {d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function todayIso(): string {
  return localIso(new Date());
}