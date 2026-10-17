"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DayPicker, todayIso } from "@/components/ui/DayPicker";
import { useClinic, useEnsureLoaded } from "@/lib/store";
import type { QueueEntry, Shift } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function DoctorPage() {
  useEnsureLoaded();
  const doctors = useClinic((s) => s.doctors);
  const currentRole = useClinic((s) => s.currentRole);
  const currentDoctorId = useClinic((s) => s.currentDoctorId);

  const isDoctor = currentRole === "doctor" && !!currentDoctorId;
  const [doctorId, setDoctorId] = useState<string>(
    isDoctor ? currentDoctorId! : doctors[0]?.id ?? ""
  );
  const [day, setDay] = useState<string>(todayIso());

  const doctor = useMemo(
    () => doctors.find((d) => d.id === (doctorId || doctors[0]?.id)),
    [doctors, doctorId]
  );

  if (!doctor) {
    return (
      <AppShell>
        <p className="text-muted">No doctors configured. Add one in Settings.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-6">
          {isDoctor ? (
            <div className="max-w-xs">
              <p className="text-xs font-medium text-muted">Signed in as</p>
              <p className="mt-1 text-sm font-medium">
                {doctors.find((d) => d.id === currentDoctorId)?.name ?? "—"}
              </p>
            </div>
          ) : (
            <div className="max-w-xs">
              <label className="text-xs font-medium text-muted">
                View as doctor
              </label>
              <select
                value={doctor.id}
                onChange={(e) => setDoctorId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              >
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.specialty}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Date
            </p>
            <DayPicker days={7} value={day} onChange={setDay} className="mt-2" />
          </div>
        </div>

        <QueueControls doctorId={doctor.id} />
      </div>

      <DoctorWorkspace doctorId={doctor.id} day={day} />
    </AppShell>
  );
}

function QueueControls({ doctorId }: { doctorId: string }) {
  const paused = useClinic((s) => s.pausedDoctors.includes(doctorId));
  const pause = useClinic((s) => s.pauseQueue);
  const resume = useClinic((s) => s.resumeQueue);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    if (paused) await resume(doctorId);
    else await pause(doctorId);
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-2">
      {paused && <Badge tone="warn">Queue paused</Badge>}
      <Button variant="ghost" onClick={toggle} isLoading={loading}>
        {paused ? "Resume queue" : "Pause queue"}
      </Button>
    </div>
  );
}

function DoctorWorkspace({ doctorId, day }: { doctorId: string; day: string }) {
  const doctors = useClinic((s) => s.doctors);
  const queueEntries = useClinic((s) => s.queueEntries);
  const paused = useClinic((s) => s.pausedDoctors.includes(doctorId));
  const callNext = useClinic((s) => s.callNext);
  const complete = useClinic((s) => s.completeConsultation);

  const [calling, setCalling] = useState(false);
  const [completing, setCompleting] = useState(false);

  const doctor = doctors.find((d) => d.id === doctorId)!;
  const [shiftKey, setShiftKey] = useState<string | null>(null);

  const dayOfWeek = new Date(day).getDay();
  const shiftsForDay = useMemo(
    () => (doctor.workingHours[dayOfWeek] ?? []).slice().sort((a, b) => a.start.localeCompare(b.start)),
    [doctor, dayOfWeek]
  );

  const doctorEntries = useMemo(
    () => queueEntries.filter((e) => e.doctorId === doctorId && e.day === day),
    [queueEntries, doctorId, day]
  );

  const current = useMemo(
    () => doctorEntries.find((e) => e.status === "in_consultation"),
    [doctorEntries]
  );

  const waitingAll = useMemo(
    () => doctorEntries.filter((e) => e.status === "waiting").sort((a, b) => a.tokenNumber - b.tokenNumber),
    [doctorEntries]
  );

  const waitingPerShift = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of waitingAll) {
      const k = shiftKeyOf(e);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [waitingAll]);

  const waiting = useMemo(
    () => waitingAll.filter((e) => (shiftKey ? shiftKeyOf(e) === shiftKey : true)),
    [waitingAll, shiftKey]
  );

  const nextUp = waiting[0];

  async function handleCallNext() {
    setCalling(true);
    await callNext(doctorId);
    setCalling(false);
  }

  async function handleComplete() {
    if (!current) return;
    setCompleting(true);
    await complete(current.id);
    setCompleting(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <ShiftTab label="All" active={shiftKey === null} count={waitingAll.length} onClick={() => setShiftKey(null)} />
        {shiftsForDay.map((s) => {
          const key = `${s.start}-${s.end}`;
          return <ShiftTab key={key} label={shiftLabel(s)} active={shiftKey === key} count={waitingPerShift.get(key) ?? 0} onClick={() => setShiftKey(key)} />;
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <p className="text-xs uppercase tracking-wide text-muted">Current patient</p>
          {current ? (
            <>
              <p className="mt-2 text-xs text-muted">
                #{current.tokenNumber} · {shiftLabel({ start: current.shiftStart, end: current.shiftEnd })}
              </p>
              <p className="text-2xl font-semibold">{current.patientName}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={handleComplete} isLoading={completing}>Mark complete</Button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-2xl font-semibold text-muted">No patient in consultation</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={handleCallNext} disabled={paused || waiting.length === 0} isLoading={calling}>
                  Call next patient
                </Button>
              </div>
            </>
          )}
        </Card>

        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">Next up</p>
          {nextUp ? (
            <>
              <p className="mt-2 text-xs text-muted">
                #{nextUp.tokenNumber} · {shiftLabel({ start: nextUp.shiftStart, end: nextUp.shiftEnd })}
              </p>
              <p className="text-lg font-medium">{nextUp.patientName}</p>
              <Badge tone={nextUp.arrivalType === "walk_in" ? "warn" : "accent"}>
                {nextUp.arrivalType === "walk_in" ? "Walk-in" : "Appointment"}
              </Badge>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">No one waiting.</p>
          )}
        </Card>

        <Card className="lg:col-span-3">
          <p className="text-xs uppercase tracking-wide text-muted">Waiting ({waiting.length})</p>
          <div className="mt-3 divide-y divide-line">
            {waiting.map((q) => (
              <div key={q.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    <span className="text-muted">#{q.tokenNumber}</span> {q.patientName}
                  </p>
                </div>
                <Badge tone="muted">{q.arrivalType === "walk_in" ? "Walk-in" : "Appointment"}</Badge>
              </div>
            ))}
            {waiting.length === 0 && <p className="py-4 text-sm text-muted">Queue is empty.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ShiftTab({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", active ? "bg-accent text-white" : "bg-elevated text-muted hover:text-ink")}>
      {label} <span className="ml-1 opacity-70">({count})</span>
    </button>
  );
}

function shiftKeyOf(e: QueueEntry): string { return `${e.shiftStart}-${e.shiftEnd}`; }
function shiftLabel(s: Shift): string { return `${format12(s.start)} – ${format12(s.end)}`; }
function format12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}