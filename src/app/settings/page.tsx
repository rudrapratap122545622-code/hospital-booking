"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useClinic, useEnsureLoaded } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { PagePermission, Shift, StaffRole } from "@/lib/types";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const PERMISSIONS: { id: PagePermission; label: string }[] = [
  { id: "reception", label: "Reception (queue, walk-ins, check-in)" },
  { id: "appointments", label: "Appointments list" },
  { id: "doctor", label: "Doctor workspace" },
  { id: "settings", label: "Settings (manage clinic + staff)" },
];

export default function SettingsPage() {
  useEnsureLoaded();
  const clinic = useClinic((s) => s.clinic);
  const doctors = useClinic((s) => s.doctors);
  const staff = useClinic((s) => s.staff);
  const loadStaff = useClinic((s) => s.loadStaff);
  const updateClinic = useClinic((s) => s.updateClinic);
  const updateDoctor = useClinic((s) => s.updateDoctor);
  const addDoctor = useClinic((s) => s.addDoctor);
  const removeDoctor = useClinic((s) => s.removeDoctor);
  const addStaff = useClinic((s) => s.addStaff);
  const removeStaff = useClinic((s) => s.removeStaff);
  const currentRole = useClinic((s) => s.currentRole);
  const storeError = useClinic((s) => s.error);
  const loaded = useClinic((s) => s.loaded);

  const [addDoctorOpen, setAddDoctorOpen] = useState(false);
  const [newDoctorName, setNewDoctorName] = useState("");
  const [newDoctorSpecialty, setNewDoctorSpecialty] = useState("");

  const [staffOpen, setStaffOpen] = useState(false);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState<StaffRole>("receptionist");
  const [staffDoctorId, setStaffDoctorId] = useState("");
  const [staffPerms, setStaffPerms] = useState<PagePermission[]>(["reception"]);
  const [staffErr, setStaffErr] = useState<string | null>(null);
  const [staffSaving, setStaffSaving] = useState(false);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  if (!clinic) {
    return (
      <AppShell>
        <div className="space-y-2">
          <p className="text-sm text-muted">
            {loaded ? "Clinic not found." : "Loading clinic…"}
          </p>
          {storeError && (
            <p className="text-xs text-danger">{storeError}</p>
          )}
          {loaded && !storeError && (
            <p className="text-xs text-muted">
              Check Supabase: clinic_staff row for your user?
            </p>
          )}
        </div>
      </AppShell>
    );
  }

  if (currentRole !== "owner") {
    return (
      <AppShell>
        <p className="text-sm text-muted">Only the owner can view settings.</p>
      </AppShell>
    );
  }

  async function submitAddDoctor(e: React.FormEvent) {
    e.preventDefault();
    if (!newDoctorName.trim() || !newDoctorSpecialty.trim()) return;
    await addDoctor({
      name: newDoctorName.trim(),
      specialty: newDoctorSpecialty.trim(),
    });
    setNewDoctorName("");
    setNewDoctorSpecialty("");
    setAddDoctorOpen(false);
  }

  function togglePerm(p: PagePermission) {
    setStaffPerms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function submitStaff(e: React.FormEvent) {
    e.preventDefault();
    setStaffErr(null);
    if (!staffEmail.trim() || !staffPassword.trim() || !staffName.trim()) {
      setStaffErr("All fields are required.");
      return;
    }
    if (staffPassword.length < 6) {
      setStaffErr("Password must be at least 6 characters.");
      return;
    }
    if (staffPerms.length === 0) {
      setStaffErr("Pick at least one page they can access.");
      return;
    }
    if (staffRole === "doctor" && !staffDoctorId) {
      setStaffErr("Pick which doctor this user is.");
      return;
    }

    setStaffSaving(true);
    const res = await addStaff({
      email: staffEmail.trim(),
      password: staffPassword,
      fullName: staffName.trim(),
      role: staffRole,
      doctorId: staffRole === "doctor" ? staffDoctorId : undefined,
      permissions: staffPerms,
    });
    setStaffSaving(false);

    if (!res.ok) {
      setStaffErr(res.error);
      return;
    }
    setStaffEmail("");
    setStaffPassword("");
    setStaffName("");
    setStaffRole("receptionist");
    setStaffDoctorId("");
    setStaffPerms(["reception"]);
    setStaffOpen(false);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <SectionHeader title="Clinic" subtitle="Basic profile and booking window." />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Clinic name">
              <input
                value={clinic.name}
                onChange={(e) => updateClinic({ name: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Timezone">
              <input
                value={clinic.timezone}
                readOnly
                className={cn(inputClass, "cursor-not-allowed text-muted")}
              />
            </Field>
            <Field label="Booking window (days ahead)">
              <input
                type="number"
                min={1}
                max={14}
                value={clinic.bookingDaysAhead}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n >= 1) {
                    updateClinic({ bookingDaysAhead: n });
                  }
                }}
                className={inputClass}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <SectionHeader
            title="Opening hours"
            subtitle="When the clinic is open. Add multiple shifts per day if you close midday."
          />
          <div className="mt-4 divide-y divide-line">
            {DAYS.map((day, i) => (
              <ShiftsRow
                key={i}
                label={day}
                shifts={clinic.openingHours[i] ?? []}
                offLabel="Closed"
                onChange={(v) =>
                  updateClinic({
                    openingHours: { ...clinic.openingHours, [i]: v },
                  })
                }
              />
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <SectionHeader
              title="Doctors"
              subtitle="Add doctors and set their working shifts."
            />
            <Button
              className="h-8 shrink-0 px-3 text-xs"
              onClick={() => setAddDoctorOpen(true)}
            >
              + Add doctor
            </Button>
          </div>

          <div className="mt-5 space-y-6">
            {doctors.length === 0 && (
              <p className="text-sm text-muted">No doctors yet.</p>
            )}
            {doctors.map((d) => (
              <div
                key={d.id}
                className="rounded-lg border border-line bg-elevated p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="grid flex-1 gap-3 sm:grid-cols-2">
                    <Field label="Name">
                      <input
                        value={d.name}
                        onChange={(e) => updateDoctor(d.id, { name: e.target.value })}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Specialty">
                      <input
                        value={d.specialty}
                        onChange={(e) =>
                          updateDoctor(d.id, { specialty: e.target.value })
                        }
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  <Button
                    variant="danger"
                    className="h-8 shrink-0 px-3 text-xs"
                    onClick={() => {
                      if (confirm(`Remove ${d.name}?`)) removeDoctor(d.id);
                    }}
                  >
                    Remove
                  </Button>
                </div>
                <p className="mt-5 text-xs uppercase tracking-wide text-muted">
                  Working shifts
                </p>
                <div className="mt-2 divide-y divide-line">
                  {DAYS.map((day, i) => (
                    <ShiftsRow
                      key={i}
                      label={day}
                      shifts={d.workingHours[i] ?? []}
                      offLabel="Off"
                      onChange={(v) =>
                        updateDoctor(d.id, {
                          workingHours: { ...d.workingHours, [i]: v },
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <SectionHeader
              title="Staff"
              subtitle="Create staff logins and choose which pages they can access."
            />
            <Button
              className="h-8 shrink-0 px-3 text-xs"
              onClick={() => setStaffOpen(true)}
            >
              + Add staff
            </Button>
          </div>

          <div className="mt-5 divide-y divide-line">
            {staff.length === 0 && (
              <p className="py-3 text-sm text-muted">No staff yet.</p>
            )}
            {staff.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {s.fullName || s.email || "(no name)"}
                  </p>
                  <p className="text-[11px] text-muted">
                    {s.email} · {s.role}
                    {s.role === "doctor" && s.doctorId && (
                      <> · {doctors.find((d) => d.id === s.doctorId)?.name ?? "unknown"}</>
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.permissions.map((p) => (
                      <Badge key={p} tone="muted">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button
                  variant="danger"
                  className="h-8 shrink-0 px-3 text-xs"
                  onClick={() => {
                    if (confirm(`Remove ${s.fullName || s.email}?`)) {
                      removeStaff(s.id);
                    }
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Dialog
        open={addDoctorOpen}
        onClose={() => setAddDoctorOpen(false)}
        title="Add doctor"
      >
        <form onSubmit={submitAddDoctor} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted">Name</label>
            <input
              autoFocus
              value={newDoctorName}
              onChange={(e) => setNewDoctorName(e.target.value)}
              placeholder="Dr. Priya Menon"
              className="mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted">Specialty</label>
            <input
              value={newDoctorSpecialty}
              onChange={(e) => setNewDoctorSpecialty(e.target.value)}
              placeholder="Dermatologist"
              className="mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAddDoctorOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!newDoctorName.trim() || !newDoctorSpecialty.trim()}
            >
              Add doctor
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={staffOpen} onClose={() => setStaffOpen(false)} title="Add staff">
        <form onSubmit={submitStaff} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted">Full name</label>
            <input
              autoFocus
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted">Email</label>
              <input
                type="email"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted">
                Password (min 6 chars)
              </label>
              <input
                type="text"
                value={staffPassword}
                onChange={(e) => setStaffPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted">Role</label>
            <select
              value={staffRole}
              onChange={(e) => setStaffRole(e.target.value as StaffRole)}
              className="mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            >
              <option value="owner">Owner (full access)</option>
              <option value="receptionist">Receptionist</option>
              <option value="doctor">Doctor</option>
            </select>
          </div>

          {staffRole === "doctor" && (
            <div>
              <label className="text-xs font-medium text-muted">
                Which doctor is this?
              </label>
              <select
                value={staffDoctorId}
                onChange={(e) => setStaffDoctorId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              >
                <option value="">— pick a doctor —</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.specialty}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-muted">Pages they can access</p>
            <div className="mt-2 space-y-2">
              {PERMISSIONS.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={staffPerms.includes(p.id)}
                    onChange={() => togglePerm(p.id)}
                    className="h-4 w-4"
                  />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          {staffErr && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
              {staffErr}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStaffOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={staffSaving}>
              {staffSaving ? "Creating…" : "Create login"}
            </Button>
          </div>
        </form>
      </Dialog>
    </AppShell>
  );
}

const inputClass =
  "mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-accent";

const timeInputClass =
  "rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs tabular-nums text-ink outline-none focus:border-accent";

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function ShiftsRow({
  label,
  shifts,
  onChange,
  offLabel,
}: {
  label: string;
  shifts: Shift[];
  onChange: (shifts: Shift[]) => void;
  offLabel: string;
}) {
  const isOpen = shifts.length > 0;

  function addShift() {
    if (shifts.length === 0) {
      onChange([{ start: "09:00", end: "13:00" }]);
      return;
    }
    const lastEnd = shifts[shifts.length - 1].end;
    const [eh] = lastEnd.split(":").map(Number);
    const nextStartH = Math.min(eh + 4, 20);
    const nextEndH = Math.min(eh + 7, 22);
    const fmt = (h: number) => `${String(h).padStart(2, "0")}:00`;
    onChange([...shifts, { start: fmt(nextStartH), end: fmt(nextEndH) }]);
  }

  function updateShift(idx: number, patch: Partial<Shift>) {
    onChange(shifts.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function removeShift(idx: number) {
    onChange(shifts.filter((_, i) => i !== idx));
  }

  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="w-24 shrink-0 text-sm">{label}</span>
          {!isOpen && <Badge tone="muted">{offLabel}</Badge>}
        </div>
        <Button
          variant="ghost"
          className="h-7 px-2.5 text-[11px]"
          onClick={addShift}
        >
          + Add shift
        </Button>
      </div>

      {isOpen && (
        <div className="mt-2 space-y-2 pl-24">
          {shifts.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="time"
                value={s.start}
                onChange={(e) => updateShift(i, { start: e.target.value })}
                className={timeInputClass}
              />
              <span className="text-xs text-muted">to</span>
              <input
                type="time"
                value={s.end}
                onChange={(e) => updateShift(i, { end: e.target.value })}
                className={timeInputClass}
              />
              <button
                type="button"
                onClick={() => removeShift(i)}
                className="ml-1 text-xs text-muted transition-colors hover:text-danger"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}