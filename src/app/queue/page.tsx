"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type PublicRow = {
  id: string;
  doctor_id: string;
  token_number: number;
  patient_short: string;
  status: "waiting" | "in_consultation" | "completed" | "skipped";
  day: string;
  shift_start: string;
  shift_end: string;
};

type DoctorLite = { id: string; name: string; specialty: string };

export default function PublicQueuePage() {
  const [clinicName, setClinicName] = useState<string>("");
  const [doctors, setDoctors] = useState<DoctorLite[]>([]);
  const [rows, setRows] = useState<PublicRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      const supabase = createClient();
      const [{ data: clinics }, { data: docs }, { data: pq }] = await Promise.all([
        supabase.from("public_clinic").select("id, name").limit(1),
        supabase.from("public_doctors").select("id, name, specialty"),
        supabase
          .from("public_queue")
          .select(
            "id, doctor_id, token_number, patient_short, status, day, shift_start, shift_end"
          )
          .order("token_number", { ascending: true }),
      ]);
      if (cancelled) return;
      setClinicName(clinics?.[0]?.name ?? "Clinic");
      setDoctors(
        (docs ?? []).map((d) => ({
          id: d.id,
          name: d.name,
          specialty: d.specialty,
        }))
      );
      setRows((pq ?? []) as PublicRow[]);
    }

    fetchAll();
    const poll = setInterval(fetchAll, 15_000);
    const clock = setInterval(() => setNow(new Date()), 30_000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(clock);
    };
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const perDoctor = useMemo(
    () =>
      doctors.map((d) => {
        const mine = rows.filter((r) => r.doctor_id === d.id && r.day === today);
        const current = mine.find((r) => r.status === "in_consultation");
        const waiting = mine
          .filter((r) => r.status === "waiting")
          .sort((a, b) => a.token_number - b.token_number);
        const lastDone = mine
          .filter((r) => r.status === "completed")
          .reduce((max, r) => Math.max(max, r.token_number), 0);
        return { doctor: d, current, waiting, lastDone };
      }),
    [doctors, rows, today]
  );

  const selected = useMemo(
    () => perDoctor.find((s) => s.doctor.id === selectedId) ?? null,
    [perDoctor, selectedId]
  );

  return (
    <main className="min-h-screen bg-canvas px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-medium tracking-widest text-accent uppercase">
              {clinicName}
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
              {selected ? selected.doctor.name : "Live queue"}
            </h1>
          </div>
          <p className="text-[11px] text-muted">
            Updated{" "}
            {now.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        {!selected && (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {perDoctor.length === 0 && (
              <p className="text-sm text-muted">No doctors available.</p>
            )}
            {perDoctor.map(({ doctor, current, waiting }) => (
              <button
                key={doctor.id}
                onClick={() => setSelectedId(doctor.id)}
                className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-accent/60 hover:bg-elevated"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{doctor.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted">
                    {doctor.specialty}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 pl-3">
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wide text-muted">
                      Now
                    </p>
                    <p
                      className={cn(
                        "text-base font-semibold tabular-nums",
                        current ? "text-accent" : "text-muted"
                      )}
                    >
                      {current ? `#${current.token_number}` : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wide text-muted">
                      Wait
                    </p>
                    <p className="text-base font-semibold tabular-nums">
                      {waiting.length}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {selected && (
          <div className="mt-4">
            <Button
              variant="ghost"
              onClick={() => setSelectedId(null)}
              className="h-7 px-2 text-[11px]"
            >
              ← All doctors
            </Button>

            <section className="mt-3 rounded-[var(--radius-card)] border border-line bg-surface">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted">
                    Now serving
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-2xl font-semibold tabular-nums",
                      selected.current ? "text-accent" : "text-muted"
                    )}
                  >
                    {selected.current
                      ? `#${selected.current.token_number}`
                      : "—"}
                  </p>
                  {selected.current && (
                    <p className="mt-0.5 text-xs">
                      {selected.current.patient_short}
                    </p>
                  )}
                </div>
                <p className="text-[10px] text-muted">
                  Last completed:{" "}
                  {selected.lastDone > 0 ? `#${selected.lastDone}` : "—"}
                </p>
              </div>

              <div className="px-2 py-2">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted">
                    Waiting
                  </p>
                  <p className="text-[10px] text-muted">
                    {selected.waiting.length}
                  </p>
                </div>

                {selected.waiting.length === 0 ? (
                  <p className="px-2 py-4 text-xs text-muted">
                    No one waiting. You'll be seen quickly.
                  </p>
                ) : (
                  <ul className="divide-y divide-line">
                    {selected.waiting.map((q, i) => (
                      <li
                        key={q.id}
                        className={cn(
                          "flex items-center justify-between gap-3 px-2 py-2",
                          i === 0 && "rounded-md bg-accent/10"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={cn(
                              "w-10 shrink-0 text-sm font-semibold tabular-nums",
                              i === 0 ? "text-accent" : "text-ink"
                            )}
                          >
                            #{q.token_number}
                          </span>
                          <span className="truncate text-sm">
                            {q.patient_short}
                          </span>
                        </div>
                        {i === 0 && (
                          <span className="text-[10px] uppercase tracking-wide text-accent">
                            Next
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        )}

        <p className="mt-8 text-center text-[10px] text-muted">
          First name &amp; initial shown
        </p>
      </div>
    </main>
  );
}