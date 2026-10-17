"use client";

import { useMemo } from "react";
import { addCalendarDays, dateInTimeZone, cn } from "@/lib/utils";

export function DayPicker({
  days = 7,
  value,
  onChange,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  className,
}: {
  days?: number;
  value: string;
  onChange: (day: string) => void;
  timezone?: string;
  className?: string;
}) {
  const list = useMemo(() => {
    const today = todayIso(timezone);
    return Array.from({ length: days }, (_, i) => addCalendarDays(today, i));
  }, [days, timezone]);

  return (
    <div className={cn("flex gap-2 overflow-x-auto pb-1", className)}>
      {list.map((iso) => {
        const date = new Date(`${iso}T00:00:00.000Z`);
        const active = iso === value;
        const isToday = iso === todayIso(timezone);
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
                : date.toLocaleDateString("en-IN", {
                    weekday: "short",
                    timeZone: "UTC",
                  })}
            </div>
            <div className="mt-0.5 text-[10px]">
              {date.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                timeZone: "UTC",
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function todayIso(
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
): string {
  return dateInTimeZone(new Date(), timezone);
}