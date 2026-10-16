"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useClinic } from "@/lib/store";
import type { PagePermission } from "@/lib/types";

const NAV: {
  href: string;
  label: string;
  permission: PagePermission;
  Icon: () => React.ReactElement;
}[] = [
  { href: "/reception", label: "Reception", permission: "reception", Icon: DashboardIcon },
  { href: "/appointments", label: "Appointments", permission: "appointments", Icon: CalendarIcon },
  { href: "/doctor", label: "Doctor", permission: "doctor", Icon: StethoscopeIcon },
  { href: "/settings", label: "Settings", permission: "settings", Icon: SlidersIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const permissions = useClinic((s) => s.currentPermissions);
  const role = useClinic((s) => s.currentRole);
  const clinic = useClinic((s) => s.clinic);

  // Owners always see everything, regardless of the permissions array.
  const visible = role === "owner"
    ? NAV
    : NAV.filter((n) => permissions.includes(n.permission));

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-canvas">
      <div className="flex h-16 items-center gap-2 border-b border-line px-6">
        <div className="h-2 w-2 rounded-full bg-accent" />
        <span className="text-sm font-semibold tracking-tight">ClinicFlow</span>
      </div>

      {clinic && (
        <div className="border-b border-line px-6 py-3">
          <p className="truncate text-[11px] uppercase tracking-wide text-muted">
            Clinic
          </p>
          <p className="truncate text-xs font-medium">{clinic.name}</p>
        </div>
      )}

      <nav className="flex-1 space-y-1 p-3">
        {visible.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-elevated text-ink"
                  : "text-muted hover:bg-elevated hover:text-ink"
              )}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
        {visible.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted">
            No pages assigned. Ask the owner to grant access.
          </p>
        )}
      </nav>

      <div className="space-y-1 border-t border-line p-3">
        <Link
          href="/book"
          target="_blank"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-elevated hover:text-ink"
        >
          <ExternalIcon />
          Public booking
        </Link>
        <Link
          href="/queue"
          target="_blank"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-elevated hover:text-ink"
        >
          <ExternalIcon />
          Public queue
        </Link>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          <SignOutIcon />
          Sign out
        </button>
      </div>
    </aside>
  );
}

/* icons unchanged */

function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function StethoscopeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a8 8 0 0 1 16 0v1" />
    </svg>
  );
}
function SlidersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <line x1="3" y1="12" x2="9" y2="12" />
      <line x1="15" y1="12" x2="21" y2="12" />
    </svg>
  );
}
function ExternalIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 3h7v7" />
      <path d="M10 14 21 3" />
      <path d="M21 14v7H3V3h7" />
    </svg>
  );
}
function SignOutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}