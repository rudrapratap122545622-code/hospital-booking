import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "danger" | "subtle" | "cyan" | "cream";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-[#7FBCDF] text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.4),0_6px_18px_-6px_rgb(127_188_223/0.7)] hover:bg-[#5DA5D1] hover:shadow-[inset_0_1px_0_0_rgb(255_255_255/0.5),0_8px_24px_-8px_rgb(93_165_209/0.8)] active:translate-y-px",
  cyan: "bg-[#3A7DA8] text-white hover:bg-[#2E6A91] active:translate-y-px",
  cream: "bg-[#DCD3CE] text-[#3B2E28] hover:bg-[#CFC4BE] active:translate-y-px",
  ghost: "border border-line bg-surface text-ink hover:border-accent/60 hover:bg-accent-dim",
  danger: "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/15 hover:border-danger/50",
  subtle: "bg-elevated text-ink border border-line hover:bg-raised hover:border-line-strong",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs rounded-lg",
  md: "h-10 px-4 text-sm rounded-[var(--radius-btn)]",
  lg: "h-11 px-5 text-sm rounded-[var(--radius-btn)]",
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  className,
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
}) {
  return (
    <button
      disabled={disabled || isLoading}
      className={cn(
        "relative inline-flex select-none items-center justify-center gap-2 font-semibold tracking-tight",
        "transition-all duration-200 ease-[var(--ease-out-soft)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        "disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      <span className={cn("flex items-center gap-2", isLoading && "invisible")}>
        {children}
      </span>
      
      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex space-x-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: '0ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: '150ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: '300ms' }} />
          </span>
        </span>
      )}
    </button>
  );
}