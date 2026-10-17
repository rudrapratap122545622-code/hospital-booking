"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/client";
import type { Appointment, Clinic, Doctor, Shift } from "@/lib/types";
import { cn } from "@/lib/utils";

type Step = "doctor" | "shift" | "details" | "done";

const STEPS: { id: Step; label: string }[] = [
  { id: "doctor", label: "Doctor" },
  { id: "shift", label: "Shift" },
  { id: "details", label: "Details" },
  { id: "done", label: "Confirm" },
];

export default function BookPage() {
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("doctor");
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [dayIso, setDayIso] = useState<string | null>(null);
  const [shift, setShift] = useState<Shift | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmed, setConfirmed] = useState<Appointment | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: clinics, error: cErr } = await supabase
        .from("public_clinic")
        .select("*")
        .limit(1);
      if (cErr || !clinics?.length) {
        setLoadErr(cErr?.message ?? "No clinic available.");
        return;
      }
      const c = clinics[0];
      const cl: Clinic = {
        id: c.id,
        name: c.name,
        timezone: c.timezone,
        openingHours: (c.opening_hours ?? {}) as Record<number, Shift[]>,
        appointmentDurationMinutes: c.appointment_duration_min,
        bookingDaysAhead: c.booking_days_ahead,
      };
      setClinic(cl);

      const { data: docs } = await supabase
        .from("public_doctors")
        .select("*")
        .eq("clinic_id", c.id);
      setDoctors(
        (docs ?? []).map((d) => ({
          id: d.id,
          clinicId: d.clinic_id,
          name: d.name,
          specialty: d.specialty,
          workingHours: (d.working_hours ?? {}) as Record<number, Shift[]>,
        }))
      );
    })();
  }, []);

  const doctor = useMemo(
    () => doctors.find((d) => d.id === doctorId) ?? null,
    [doctors, doctorId]
  );

  const reset = () => {
    setStep("doctor");
    setDoctorId(null);
    setDayIso(null);
    setShift(null);
    setName("");
    setPhone("");
    setConfirmed(null);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clinic || !doctorId || !dayIso || !shift || !name.trim() || !phone.trim())
      return;

    setSubmitting(true);
    const [sh, sm] = shift.start.split(":").map(Number);
    const start = new Date(dayIso);
    start.setHours(sh, sm, 0, 0);

    const supabase = createClient();
    const reference = `CF-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        clinic_id: clinic.id,
        doctor_id: doctorId,
        patient_name: name.trim(),
        patient_phone: phone.trim(),
        scheduled_at: start.toISOString(),
        shift_end: shift.end,
        status: "booked",
        reference,
      })
      .select("*")
      .single();

    setSubmitting(false);

    if (error || !data) {
      alert(error?.message ?? "Booking failed.");
      return;
    }

    setConfirmed({
      id: data.id,
      clinicId: data.clinic_id,
      doctorId: data.doctor_id,
      patientName: data.patient_name,
      patientPhone: data.patient_phone,
      scheduledAt: data.scheduled_at,
      shiftEnd: data.shift_end,
      status: "booked",
      reference: data.reference,
      createdAt: data.created_at,
    });
    setStep("done");
  }

  if (loadErr) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas">
        <p className="text-sm text-danger">{loadErr}</p>
      </main>
    );
  }

  if (!clinic) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-canvas px-5 py-10 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <p className="text-sm font-medium tracking-widest text-accent uppercase">
          {clinic.name}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Book an appointment
        </h1>
        <p className="mt-3 text-muted">
          Pick a doctor, choose a day and shift, and get a booking reference.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href="/queue">
            <Button variant="ghost">See live queue →</Button>
          </Link>
          <span className="text-xs text-muted">
            Want to check the wait before booking?
          </span>
        </div>

        {step !== "done" && (
          <ol className="mt-8 flex items-center gap-3 text-xs text-muted">
            {STEPS.slice(0, 3).map((s, i) => {
              const active = s.id === step;
              const done = STEPS.findIndex((x) => x.id === step) > i;
              return (
                <li key={s.id} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium",
                      active && "bg-accent text-white",
                      done && "bg-elevated text-ink",
                      !active && !done && "bg-elevated text-muted"
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className={cn(active && "text-ink")}>{s.label}</span>
                  {i < 2 && <span className="text-muted">→</span>}
                </li>
              );
            })}
          </ol>
        )}

        {step === "doctor" && (
          <div className="mt-8 grid gap-3">
            {doctors.length === 0 && (
              <p className="text-sm text-muted">No doctors available.</p>
            )}
            {doctors.map((d) => {
              const working = Object.values(d.workingHours).some(
                (s) => (s ?? []).length > 0
              );
              const preview = nextShiftFor(d, clinic.bookingDaysAhead);
              return (
                <button
                  key={d.id}
                  disabled={!working}
                  onClick={() => {
                    setDoctorId(d.id);
                    setDayIso(null);
                    setShift(null);
                    setStep("shift");
                  }}
                  className={cn(
                    "rounded-[var(--radius-card)] border border-line bg-surface p-5 text-left transition-colors",
                    working ? "hover:bg-elevated" : "cursor-not-allowed opacity-50"
                  )}
                >
                  <p className="text-base font-medium">{d.name}</p>
                  <p className="mt-1 text-sm text-muted">{d.specialty}</p>
                  {working && preview ? (
                    <p className="mt-3 text-xs text-accent-soft">
                      Next shift: {preview.dayLabel}, {shiftLabel(preview.shift)}
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-muted">Not accepting bookings</p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {step === "shift" && doctor && (
          <ShiftPicker
            doctor={doctor}
            daysAhead={clinic.bookingDaysAhead}
            dayIso={dayIso}
            shift={shift}
            onPickDay={(iso) => {
              setDayIso(iso);
              setShift(null);
            }}
            onPickShift={(s) => setShift(s)}
            onBack={() => setStep("doctor")}
            onNext={() => {
              if (dayIso && shift) setStep("details");
            }}
          />
        )}

        {step === "details" && doctor && dayIso && shift && (
          <Card className="mt-8">
            <div className="mb-5 rounded-lg bg-elevated p-4">
              <p className="text-xs uppercase tracking-wide text-muted">
                Your selection
              </p>
              <p className="mt-1 text-sm font-medium">{doctor.name}</p>
              <p className="text-sm text-muted">
                {longDay(dayIso)} · {shiftLabel(shift)}
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted">Full name</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Priya Menon"
                  className="mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted">
                  Mobile number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 90000 00000"
                  className="mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
                />
              </div>

              <div className="flex justify-between pt-2">
                <Button type="button" variant="ghost" onClick={() => setStep("shift")}>
                  Back
                </Button>
                <Button
                  type="submit"
                  isLoading={submitting}
                  disabled={!name.trim() || !phone.trim()}
                >
                  Confirm booking
                </Button>
              </div>
            </form>
          </Card>
        )}

        {step === "done" && confirmed && doctor && (
          <Card className="mt-8">
            <Badge tone="ok">Booking confirmed</Badge>
            <h2 className="mt-4 text-2xl font-semibold">
              You're all set, {confirmed.patientName.split(" ")[0]}.
            </h2>
            <p className="mt-2 text-sm text-muted">
              Arrive within the shift and check in at reception. Quote your
              reference.
            </p>

            <div className="mt-6 rounded-lg border border-line bg-elevated p-5">
              <p className="text-xs uppercase tracking-wide text-muted">Reference</p>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-wider text-accent">
                {confirmed.reference}
              </p>

              <div className="mt-5 grid gap-3 text-sm">
                <Row label="Doctor" value={doctor.name} />
                <Row
                  label="Shift"
                  value={`${longDay(confirmed.scheduledAt)} · ${shiftLabel({
                    start: hhmmOf(confirmed.scheduledAt),
                    end: confirmed.shiftEnd,
                  })}`}
                />
                <Row label="Mobile" value={confirmed.patientPhone} />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/queue">
                <Button>Track queue</Button>
              </Link>
              <Button variant="ghost" onClick={reset}>
                Book another
              </Button>
            </div>
          </Card>
        )}

        <p className="mt-10 text-center text-xs text-muted">
          Need staff access?{" "}
          <Link href="/login" className="text-accent-soft hover:underline">
            Sign in here
          </Link>
        </p>
      </div>
    </main>
  );
}

/* ---------- helpers ---------- */

function ShiftPicker({
  doctor,
  daysAhead,
  dayIso,
  shift,
  onPickDay,
  onPickShift,
  onBack,
  onNext,
}: {
  doctor: Doctor;
  daysAhead: number;
  dayIso: string | null;
  shift: Shift | null;
  onPickDay: (iso: string) => void;
  onPickShift: (s: Shift) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const days = useMemo(() => nextNDays(daysAhead), [daysAhead]);
  const activeDay = useMemo(
    () => (dayIso ? new Date(dayIso) : days[0]),
    [dayIso, days]
  );
  const shifts = useMemo(
    () =>
      (doctor.workingHours[activeDay.getDay()] ?? [])
        .slice()
        .sort((a, b) => a.start.localeCompare(b.start)),
    [doctor, activeDay]
  );

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{doctor.name}</p>
          <p className="text-xs text-muted">{doctor.specialty}</p>
        </div>
        <Button variant="ghost" onClick={onBack} className="h-8 px-3 text-xs">
          Change doctor
        </Button>
      </div>

      <p className="mt-6 text-xs uppercase tracking-wide text-muted">Pick a day</p>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {days.map((d) => {
          const working = (doctor.workingHours[d.getDay()] ?? []).length > 0;
          const active =
            dayIso && new Date(dayIso).toDateString() === d.toDateString();
          const isToday = d.toDateString() === new Date().toDateString();
          return (
            <button
              key={d.toISOString()}
              disabled={!working}
              onClick={() => onPickDay(d.toISOString())}
              className={cn(
                "shrink-0 rounded-lg border px-3 py-2 text-center text-xs transition-colors",
                active
                  ? "border-accent bg-accent/10 text-ink"
                  : "border-line bg-surface text-muted hover:text-ink",
                !working && "cursor-not-allowed opacity-40"
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

      <p className="mt-6 text-xs uppercase tracking-wide text-muted">Pick a shift</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {shifts.length === 0 && (
          <p className="text-sm text-muted">Not available this day.</p>
        )}
        {shifts.map((s) => {
          const active = shift?.start === s.start && shift?.end === s.end;
          return (
            <button
              key={`${s.start}-${s.end}`}
              onClick={() => onPickShift(s)}
              className={cn(
                "rounded-[var(--radius-card)] border p-4 text-left transition-colors",
                active
                  ? "border-accent bg-accent/10"
                  : "border-line bg-surface hover:bg-elevated"
              )}
            >
              <p className="text-base font-semibold">{shiftLabel(s)}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={onNext} disabled={!dayIso || !shift}>
          Continue
        </Button>
      </div>
    </div>
  );
}

function hhmmOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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

function nextNDays(n: number): Date[] {
  const out: Date[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    out.push(d);
  }
  return out;
}

function longDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function nextShiftFor(
  doctor: Doctor,
  daysAhead: number
): { dayLabel: string; shift: Shift } | null {
  const now = new Date();
  const limit = Math.max(1, daysAhead);
  for (let i = 0; i < limit; i++) {
    const day = new Date(now);
    day.setDate(day.getDate() + i);
    const shifts = (doctor.workingHours[day.getDay()] ?? [])
      .slice()
      .sort((a, b) => a.start.localeCompare(b.start));
    for (const s of shifts) {
      if (i === 0) {
        const [eh] = s.end.split(":").map(Number);
        if (eh <= now.getHours()) continue;
      }
      return {
        dayLabel:
          i === 0
            ? "Today"
            : i === 1
            ? "Tomorrow"
            : day.toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
              }),
        shift: s,
      };
    }
  }
  return null;
}