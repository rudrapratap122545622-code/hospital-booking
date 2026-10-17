"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useClinic, useEnsureLoaded } from "@/lib/store";
import { cn } from "@/lib/utils";

type Range = "today" | "week" | "month";

export default function AnalyticsPage() {
  useEnsureLoaded();
  const appointments = useClinic((s) => s.appointments);
  const queueEntries = useClinic((s) => s.queueEntries);
  const doctors = useClinic((s) => s.doctors);
  const currentRole = useClinic((s) => s.currentRole);
  const clinic = useClinic((s) => s.clinic);

  const [range, setRange] = useState<Range>("today");

  const isOwner = currentRole === "owner";

  // Filter data based on the selected range
  const { filteredQueue, filteredAppointments } = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    
    // Start of this week (Monday)
    const weekStart = new Date(now);
    const day = weekStart.getDay() || 7; 
    if (day !== 1) weekStart.setHours(-24 * (day - 1));
    
    // Start of this month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const filterFn = (dateStr: string) => {
      const d = new Date(dateStr);
      if (range === "today") return dateStr.slice(0, 10) === today;
      if (range === "week") return d >= weekStart;
      if (range === "month") return d >= monthStart;
      return true;
    };

    return {
      filteredQueue: queueEntries.filter((e) => filterFn(e.day)),
      filteredAppointments: appointments.filter((a) => filterFn(a.scheduledAt)),
    };
  }, [queueEntries, appointments, range]);

  // Calculate Metrics
  const stats = useMemo(() => {
    let walkIns = 0;
    let booked = 0;
    let completed = 0;

    for (const e of filteredQueue) {
      if (e.arrivalType === "walk_in") walkIns++;
      else booked++;
      if (e.status === "completed") completed++;
    }

    return { total: filteredQueue.length, walkIns, booked, completed };
  }, [filteredQueue]);

  // Calculate peak hours (only for "today" view)
  const peakHours = useMemo(() => {
    if (range !== "today") return [];
    const hours = new Array(12).fill(0);
    for (const e of filteredQueue) {
      const hour = Number(e.shiftStart.split(":")[0]);
      if (hour >= 8 && hour <= 19) hours[hour - 8]++;
    }
    return hours;
  }, [filteredQueue, range]);

  // Doctor leaderboard
  const doctorStats = useMemo(() => {
    return doctors.map((doc) => {
      const entries = filteredQueue.filter((e) => e.doctorId === doc.id);
      return {
        name: doc.name,
        total: entries.length,
        completed: entries.filter((e) => e.status === "completed").length,
      };
    }).sort((a, b) => b.total - a.total);
  }, [doctors, filteredQueue]);

  if (!isOwner || !clinic) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-danger">Access denied. Only the owner can view analytics.</p>
        </div>
      </AppShell>
    );
  }

  const maxPeak = Math.max(...peakHours, 1);

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clinic Analytics</h1>
          <p className="text-sm text-muted">Overview for {clinic.name}</p>
        </div>
        
        {/* Range Selector */}
        <div className="flex rounded-lg border border-line bg-surface p-1">
          {(["today", "week", "month"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors capitalize",
                range === r ? "bg-accent text-white shadow-sm" : "text-muted hover:text-ink"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* TOP METRICS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Patients" value={stats.total} />
        <MetricCard title="Completed" value={stats.completed} />
        <MetricCard title="Booked Online" value={stats.booked} />
        <MetricCard title="Walk-ins" value={stats.walkIns} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        
        {/* PEAK HOURS (Only shows for Today) */}
        <Card className={cn(range !== "today" && "opacity-50")}>
          <h2 className="text-base font-semibold">Busiest Hours</h2>
          <p className="mt-1 text-sm text-muted">
            {range === "today" ? "Patient volume per hour today" : "Switch to 'Today' to see hourly breakdown"}
          </p>
          
          {range === "today" && (
            <div className="mt-8 flex h-48 items-end gap-1.5">
              {peakHours.map((count, i) => {
                const height = count === 0 ? "0%" : `${Math.max((count / maxPeak) * 100, 10)}%`;
                const hourLabel = i + 8;
                const period = hourLabel >= 12 ? "PM" : "AM";
                const displayHour = hourLabel > 12 ? hourLabel - 12 : hourLabel;
                
                return (
                  <div key={i} className="group relative flex flex-1 flex-col items-center justify-end h-full">
                    <div 
                      className={cn(
                        "w-full rounded-t-sm transition-all duration-300",
                        count > 0 ? "bg-accent/80 group-hover:bg-accent" : "bg-line"
                      )}
                      style={{ height }}
                    />
                    <span className="mt-2 text-[10px] text-muted">{displayHour}{period}</span>
                    
                    {count > 0 && (
                      <div className="absolute -top-8 hidden rounded bg-surface px-2 py-1 text-xs font-medium border border-line group-hover:block">
                        {count} pts
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* DOCTOR LEADERBOARD */}
        <Card>
          <h2 className="text-base font-semibold">Doctor Workload</h2>
          <p className="mt-1 text-sm text-muted">Patients seen per doctor</p>
          
          <div className="mt-6 space-y-5">
            {doctorStats.map((doc) => (
              <div key={doc.name}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium">{doc.name}</span>
                  <span className="text-muted">{doc.completed} / {doc.total} seen</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-elevated">
                  <div 
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${doc.total === 0 ? 0 : (doc.completed / doc.total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {doctorStats.length === 0 && <p className="text-sm text-muted">No doctors added yet.</p>}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{title}</p>
      <p className="mt-3 text-4xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}