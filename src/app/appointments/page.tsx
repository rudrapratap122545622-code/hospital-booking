"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useClinic, useEnsureLoaded } from "@/lib/store";
import { timeInTimeZone, cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/lib/types";

type Filter = "all" | AppointmentStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "booked", label: "Booked" },
  { value: "checked_in", label: "Checked in" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
];

const STATUS_TONE: Record<
  AppointmentStatus,
  "muted" | "accent" | "ok" | "warn" | "danger"
> = {
  booked: "accent",
  checked_in: "ok",
  completed: "muted",
  cancelled: "danger",
  no_show: "warn",
};

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  booked: "Booked",
  checked_in: "Checked in",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export default function AppointmentsPage() {
  useEnsureLoaded();
  const appointments = useClinic((s) => s.appointments);
  const doctors = useClinic((s) => s.doctors);
  const timezone = useClinic((s) => s.clinic?.timezone);
  const checkIn = useClinic((s) => s.checkIn);
  const load = useClinic((s) => s.load);

  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const doctorName = useMemo(() => {
    const map = new Map(doctors.map((d) => [d.id, d.name]));
    return (id: string) => map.get(id) ?? "—";
  }, [doctors]);

  const filtered = useMemo(() => {
    const list =
      filter === "all"
        ? appointments
        : appointments.filter((a) => a.status === filter);
    return [...list].sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );
  }, [appointments, filter]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: appointments.length,
      booked: 0,
      checked_in: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
    };
    for (const a of appointments) c[a.status]++;
    return c;
  }, [appointments]);

  return (
    <AppShell>
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              filter === f.value
                ? "bg-accent text-white"
                : "bg-elevated text-muted hover:text-ink"
            )}
          >
            {f.label}
            <span className="ml-2 opacity-70">{counts[f.value]}</span>
          </button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={refreshing}
          className="ml-auto"
        >
          {refreshing ? "Refreshing…" : "↻ Refresh"}
        </Button>
      </div>

      <Card className="mt-6 p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Shift</th>
              <th className="px-5 py-3 font-medium">Patient</th>
              <th className="px-5 py-3 font-medium">Phone</th>
              <th className="px-5 py-3 font-medium">Doctor</th>
              <th className="px-5 py-3 font-medium">Reference</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr
                key={a.id}
                className="border-b border-line last:border-b-0 hover:bg-elevated/40"
              >
                <td className="px-5 py-3 text-sm">
                  {timezone
                    ? formatShift(a.scheduledAt, a.shiftEnd, timezone)
                    : "—"}
                </td>
                <td className="px-5 py-3 text-sm">{a.patientName}</td>
                <td className="px-5 py-3 text-sm text-muted">
                  {a.patientPhone}
                </td>
                <td className="px-5 py-3 text-sm text-muted">
                  {doctorName(a.doctorId)}
                </td>
                <td className="px-5 py-3 font-mono text-xs text-muted">
                  {a.reference}
                </td>
                <td className="px-5 py-3">
                  <Badge tone={STATUS_TONE[a.status]}>
                    {STATUS_LABEL[a.status]}
                  </Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  {a.status === "booked" ? (
                    <Button size="sm" onClick={() => checkIn(a.id)}>
                      Check in
                    </Button>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-12 text-center text-sm text-muted"
                >
                  No appointments match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}

function formatShift(
  startIso: string,
  endHHMM: string,
  timezone: string
): string {
  const [hour, minute] = timeInTimeZone(new Date(startIso), timezone).split(":");
  const start = fmt12(hour, minute);
  const end = fmt12(endHHMM.slice(0, 2), endHHMM.slice(3, 5));
  return `${start} – ${end}`;
}

function fmt12(h: string, m: string): string {
  const hour = Number(h);
  const period = hour < 12 ? "AM" : "PM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return Number(m) === 0 ? `${h12} ${period}` : `${h12}:${m} ${period}`;
}