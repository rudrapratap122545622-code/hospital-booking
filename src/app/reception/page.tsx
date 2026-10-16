"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { DayPicker, todayIso } from "@/components/ui/DayPicker";
import { useClinic, useEnsureLoaded } from "@/lib/store";
import type { Doctor, QueueEntry, Shift } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ReceptionPage() {
  useEnsureLoaded();
  const appointments = useClinic((s) => s.appointments);
  const queueEntries = useClinic((s) => s.queueEntries);
  const doctors = useClinic((s) => s.doctors);
  const load = useClinic((s) => s.load);

  const [day, setDay] = useState<string>(todayIso());
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const dayQueue = useMemo(
    () => queueEntries.filter((e) => e.day === day),
    [queueEntries, day]
  );
  const dayAppointments = useMemo(
    () => appointments.filter((a) => a.scheduledAt.slice(0, 10) === day),
    [appointments, day]
  );

  const stats = useMemo(
    () => ({
      appointments: dayAppointments.length,
      waiting: dayQueue.filter((e) => e.status === "waiting").length,
      inConsultation: dayQueue.filter((e) => e.status === "in_consultation").length,
      completed: dayQueue.filter((e) => e.status === "completed").length,
    }),
    [dayAppointments, dayQueue]
  );

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            Date
          </p>
          <DayPicker days={7} value={day} onChange={setDay} className="mt-2" />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing…" : "↻ Refresh"}
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric label="Appointments" value={stats.appointments} />
        <Metric label="Waiting" value={stats.waiting} />
        <Metric label="In consultation" value={stats.inConsultation} />
        <Metric label="Completed" value={stats.completed} />
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-medium">Live queues</h2>
        <p className="mt-1 text-sm text-muted">
          Check in booked patients so they join the doctor's queue.
        </p>
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          {doctors.map((d) => (
            <QueueCard key={d.id} doctor={d} day={day} />
          ))}
          {doctors.length === 0 && (
            <p className="text-sm text-muted">
              No doctors yet. Add one in Settings.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function QueueCard({ doctor, day }: { doctor: Doctor; day: string }) {
  const queueEntries = useClinic((s) => s.queueEntries);
  const appointments = useClinic((s) => s.appointments);
  const paused = useClinic((s) => s.pausedDoctors.includes(doctor.id));
  const addWalkIn = useClinic((s) => s.addWalkIn);
  const checkIn = useClinic((s) => s.checkIn);

  const [shiftKey, setShiftKey] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const dayOfWeek = new Date(day).getDay();
  const shiftsForDay = useMemo(
    () =>
      (doctor.workingHours[dayOfWeek] ?? [])
        .slice()
        .sort((a, b) => a.start.localeCompare(b.start)),
    [doctor, dayOfWeek]
  );

  const doctorEntries = useMemo(
    () => queueEntries.filter((e) => e.doctorId === doctor.id && e.day === day),
    [queueEntries, doctor.id, day]
  );

  const comingToday = useMemo(
    () =>
      appointments
        .filter(
          (a) =>
            a.doctorId === doctor.id &&
            a.scheduledAt.slice(0, 10) === day &&
            a.status === "booked"
        )
        .sort(
          (a, b) =>
            new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
        ),
    [appointments, doctor.id, day]
  );

  const current = useMemo(
    () => doctorEntries.find((e) => e.status === "in_consultation"),
    [doctorEntries]
  );

  const waitingPerShift = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of doctorEntries) {
      if (e.status !== "waiting") continue;
      const k = shiftKeyOf(e);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [doctorEntries]);

  const waiting = useMemo(
    () =>
      doctorEntries
        .filter((e) => e.status === "waiting")
        .filter((e) => (shiftKey ? shiftKeyOf(e) === shiftKey : true))
        .sort((a, b) => a.tokenNumber - b.tokenNumber),
    [doctorEntries, shiftKey]
  );

  const completedCount = useMemo(
    () => doctorEntries.filter((e) => e.status === "completed").length,
    [doctorEntries]
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await addWalkIn(trimmed, doctor.id);
    setName("");
    setOpen(false);
  }

  return (
    <Card className="flex flex-col p-0">
      <div className="flex items-start justify-between gap-3 border-b border-line p-5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{doctor.name}</p>
          <p className="truncate text-xs text-muted">{doctor.specialty}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {paused && <Badge tone="warn">Paused</Badge>}
          <Badge tone="muted">{completedCount} done</Badge>
          <Button
            variant="ghost"
            className="h-7 px-2.5 text-xs"
            onClick={() => setOpen(true)}
          >
            + Walk-in
          </Button>
        </div>
      </div>

      {comingToday.length > 0 && (
        <div className="border-b border-line bg-accent/[0.04] p-5">
          <p className="text-xs uppercase tracking-wide text-accent">
            Coming today ({comingToday.length})
          </p>
          <div className="mt-3 space-y-2">
            {comingToday.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-accent/20 bg-surface px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.patientName}</p>
                  <p className="truncate text-[11px] text-muted">
                    {a.patientPhone} ·{" "}
                    {shiftLabel({
                      start: hhmmOf(a.scheduledAt),
                      end: a.shiftEnd,
                    })}
                  </p>
                </div>
                <Button size="sm" className="shrink-0" onClick={() => checkIn(a.id)}>
                  Check in
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <ShiftTab
          label="All"
          active={shiftKey === null}
          count={doctorEntries.filter((e) => e.status === "waiting").length}
          onClick={() => setShiftKey(null)}
        />
        {shiftsForDay.map((s) => {
          const key = `${s.start}-${s.end}`;
          return (
            <ShiftTab
              key={key}
              label={shiftLabel(s)}
              active={shiftKey === key}
              count={waitingPerShift.get(key) ?? 0}
              onClick={() => setShiftKey(key)}
            />
          );
        })}
      </div>

      <div className="border-b border-line p-5">
        <p className="text-xs uppercase tracking-wide text-muted">
          In consultation
        </p>
        {current ? (
          <div className="mt-2">
            <p className="text-xs text-muted">
              #{current.tokenNumber} ·{" "}
              {shiftLabel({ start: current.shiftStart, end: current.shiftEnd })}
            </p>
            <p className="truncate text-base font-medium">{current.patientName}</p>
            <p className="truncate text-xs text-muted">
              {current.patientPhone ?? "No phone on file"}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">No one yet.</p>
        )}
      </div>

      <div className="flex-1 p-5">
        <p className="text-xs uppercase tracking-wide text-muted">
          Waiting ({waiting.length})
        </p>
        <div className="mt-3 space-y-2">
          {waiting.map((q) => (
            <div
              key={q.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-elevated px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">
                  <span className="text-muted">#{q.tokenNumber}</span>{" "}
                  {q.patientName}
                </p>
                <p className="truncate text-[11px] text-muted">
                  {q.patientPhone ?? "No phone"} ·{" "}
                  {shiftLabel({ start: q.shiftStart, end: q.shiftEnd })}
                </p>
              </div>
              <Badge tone="muted">
                {q.arrivalType === "walk_in" ? "Walk-in" : "Apt."}
              </Badge>
            </div>
          ))}
          {waiting.length === 0 && (
            <p className="text-sm text-muted">
              {shiftKey ? "No one waiting in this shift." : "Queue is empty."}
            </p>
          )}
        </div>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="Add walk-in">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted">Patient name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priya Menon"
              className="mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Add to queue
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

function ShiftTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
        active ? "bg-accent text-white" : "bg-elevated text-muted hover:text-ink"
      )}
    >
      {label} <span className="ml-1 opacity-70">({count})</span>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-xs font-medium tracking-wide text-muted uppercase">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

function hhmmOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function shiftKeyOf(e: QueueEntry): string {
  return `${e.shiftStart}-${e.shiftEnd}`;
}

function shiftLabel(s: Shift): string {
  return `${format12(s.start)} – ${format12(s.end)}`;
}

function format12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0
    ? `${hour12} ${period}`
    : `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}