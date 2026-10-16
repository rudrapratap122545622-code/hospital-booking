"use client";

import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { useClinic } from "@/lib/store";

const TITLES: Record<string, string> = {
  "/reception": "Reception",
  "/appointments": "Appointments",
  "/doctor": "Doctor workspace",
  "/settings": "Settings",
};

function titleFor(pathname: string) {
  for (const key of Object.keys(TITLES)) {
    if (pathname.startsWith(key)) return TITLES[key];
  }
  return "ClinicFlow";
}

export function Topbar() {
  const pathname = usePathname();
  const clinic = useClinic((s) => s.clinic);

  return (
    <header className="flex h-16 items-center justify-between border-b border-line bg-canvas px-8">
      <div>
        <h1 className="text-sm font-semibold">{titleFor(pathname)}</h1>
        <p className="text-xs text-muted">{clinic?.name ?? "—"}</p>
      </div>
      <Badge tone="accent">Live</Badge>
    </header>
  );
}