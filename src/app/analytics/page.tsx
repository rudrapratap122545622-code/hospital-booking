"use client";

import { useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { useClinic, useEnsureLoaded } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function AnalyticsPage() {
  useEnsureLoaded();
  const appointments = useClinic((s) => s.appointments);
  const queueEntries = useClinic((s) => s.queueEntries);
  const doctors = useClinic((s) => s.doctors);
  const currentRole = useClinic((s) => s.currentRole);
  const clinic = useClinic((s) => s.clinic);

  const isOwner = currentRole === "owner";

  // Filter to only today's data for the dashboard
  const today = new Date().toISOString().slice(0, 10);
  const todayQueue = useMemo(() => queueEntries.filter((e) => e.day === today), [queueEntries, today]);
  const todayAppointments = useMemo(() => appointments.filter((a) => a.scheduledAt.slice(0, 10) === today), [appointments, today]);

  // Calculate Metrics
  const stats = useMemo(() => {
    let walkIns = 0;
    let booked = 0;
    let completed = 0;

    for (const e of todayQueue) {
      if (e.arrivalType === "walk_in") walkIns++;
      else booked++;
      if (e.status === "completed") completed++;
    }

    return { walkIns, booked, completed };
  }, [todayQueue]);

  // Calculate peak hours
  const peakHours = useMemo(() => {
    const hours = new Array(12).fill(0); // 8 AM to 8 PM
    for (const e of todayQueue) {
      const hour = Number(e.shiftStart.split(":")[0]);
      if (hour >= 8 && hour <= 19) {
        hours[hour - 8]++;
      }
    }
    return hours;
  }, [todayQueue]);

  // Doctor leaderboard
  const doctorStats = useMemo(() => {
    return doctors.map((doc) => {
      const entries = todayQueue.filter((e) => e.doctorId === doc.id);
      return {
        name: doc.name,
        total: entries.length,
        completed: entries.filter((e) => e.status === "completed").length,
      };
    }).sort((a, b) => b.total - a.total);
  }, [doctors, todayQueue]);

  if (!isOwner || !clinic) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-danger">Access denied. Only the owner can view analytics.</p>
        </div>
      </AppShell>
    );
  }

  const maxPeak = Math.max(...peakHours, 1); // Prevent division by zero

  return (
    <AppShell>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clinic Analytics</h1>
          <p className="text-sm text-muted">Live overview for {clinic.name}</p>
        </div>
        <div className="rounded-lg bg-elevated px-4 py-2 text-sm font-medium border border-line">
          Today, {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </div>
      </div>

      {/* TOP METRICS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Patients" value={todayQueue.length} />
        <MetricCard title="Completed" value={stats.completed} />
        <MetricCard title="Booked Online" value={stats.booked} />
        <MetricCard title="Walk-ins" value={stats.walkIns} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* PEAK HOURS CHART */}
        <Card>
          <h2 className="text-base font-semibold">Busiest Hours</h2>
          <p className="mt-1 text-sm text-muted">Patient volume per hour today</p>
          
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
                  
                  {/* Tooltip */}
                  {count > 0 && (
                    <div className="absolute -top-8 hidden rounded bg-surface px-2 py-1 text-xs font-medium border border-line group-hover:block">
                      {count} pts
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* DOCTOR LEADERBOARD */}
        <Card>
          <h2 className="text-base font-semibold">Doctor Workload</h2>
          <p className="mt-1 text-sm text-muted">Patients seen per doctor today</p>
          
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