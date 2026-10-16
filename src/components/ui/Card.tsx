import { cn } from "@/lib/utils";

type Variant = "default" | "gradient" | "glow" | "doctor";

export function Card({
  className,
  children,
  interactive = false,
  variant = "default",
  style,
}: {
  className?: string;
  children: React.ReactNode;
  interactive?: boolean;
  variant?: Variant;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn(
        "relative rounded-[var(--radius-card)] border border-line bg-surface p-5",
        "shadow-[var(--shadow-sm)]",
        interactive &&
          "cursor-pointer transition-all duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-[var(--shadow-glow)]",
        variant === "gradient" && "border-gradient",
        variant === "glow" && "shadow-[var(--shadow-glow)]",
        variant === "doctor" &&
          "border-[rgb(var(--doc-color)/0.4)] bg-[linear-gradient(180deg,rgb(var(--doc-color)/0.08),transparent_60%)]",
        className
      )}
    >
      {children}
    </div>
  );
}