import { cn } from "@/lib/utils";

type Tone = "ok" | "accent" | "warn" | "danger" | "muted" | "cyan" | "amber" | "cream";

const tones: Record<Tone, string> = {
  ok:     "bg-ok-dim text-ok ring-1 ring-inset ring-ok/30",
  accent: "bg-accent-dim text-accent-deep ring-1 ring-inset ring-accent/40",
  cyan:   "bg-[#E4EFF6] text-[#3A7DA8] ring-1 ring-inset ring-[#7FBCDF]/40",
  amber:  "bg-warn-dim text-warn ring-1 ring-inset ring-warn/30",
  warn:   "bg-warn-dim text-warn ring-1 ring-inset ring-warn/30",
  danger: "bg-danger-dim text-danger ring-1 ring-inset ring-danger/30",
  muted:  "bg-elevated text-muted ring-1 ring-inset ring-line",
  cream:  "bg-cream-soft text-warm ring-1 ring-inset ring-cream",
};

export function Badge({
  tone = "muted",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}