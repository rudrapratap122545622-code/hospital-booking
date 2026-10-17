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
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
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
  const [savingDoctor, setSavingDoctor] = useState(false);

  const [staffOpen, setStaffOpen] = useState(false);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffName, setStaffName] = useState("");
  
  // Simplified: default is receptionist
  const [staffRole, setStaffRole] = useState<StaffRole>("receptionist");
  const [staffDoctorId, setStaffDoctorId] = useState("");
  
  // Simplified: permissions are auto-set based on role
  const [staffPerms, setStaffPerms] = useState<PagePermission[]>(["reception"]);
  const [staffErr, setStaffErr] = useState<string | null>(null);
  const [staffSaving, setStaffSaving] = useState(false);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  // THE LOCK: If not owner, block the page entirely
  if (!clinic || currentRole !== "owner") {
    return (
      <AppShell>
        <div className="space-y-2">
          <p className="text-sm text-muted">
            {!loaded ? "Loading clinic…" : "Access denied."}
          </p>
          {storeError && <p className="text-xs text-danger">{storeError}</p>}
          {loaded && currentRole !== "owner" && (
            <p className="text-xs text-danger">Only the clinic owner can access Settings.</p>
          )}
        </div>
      </AppShell>
    );
  }

  async function submitAddDoctor(e: React.FormEvent) {
    e.preventDefault();
    if (!newDoctorName.trim() || !newDoctorSpecialty.trim()) return;
    setSavingDoctor(true);
    await addDoctor({
      name: newDoctorName.trim(),
      specialty: newDoctorSpecialty.trim(),
    });
    setSavingDoctor(false);
    setNewDoctorName("");
    setNewDoctorSpecialty("");
    setAddDoctorOpen(false);
  }

  // Handle role changes and auto-set permissions
  function handleRoleChange(role: StaffRole) {
    setStaffRole(role);
    if (role === "receptionist") {
      setStaffPerms(["reception"]);
      setStaffDoctorId("");
    } else if (role === "doctor") {
      setStaffPerms(["doctor"]);
    }
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
        {/* CLINIC SETTINGS */}
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

        {/* OPENING HOURS */}
        <Card>
          <SectionHeader
            title="Opening hours"
            subtitle="When the clinic is open."
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

        {/* DOCTORS */}
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
                  <RemoveDoctorButton 
                    id={d.id} 
                    name={d.name} 
                    onRemove={removeDoctor} 
                  />
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

        {/* STAFF */}
        <Card>
          <div className="flex items-start justify-between gap-3">
            <SectionHeader
              title="Staff Logins"
              subtitle="Create logins for receptionists and doctors."
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
                    {s.email} · <span className="capitalize">{s.role}</span>
                    {s.role === "doctor" && s.doctorId && (
                      <> · {doctors.find((d) => d.id === s.doctorId)?.name}</>
                    )}
                  </p>
                </div>
                <RemoveStaffButton 
                  id={s.id} 
                  name={s.fullName || s.email} 
                  onRemove={removeStaff} 
                />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ADD DOCTOR DIALOG */}
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
              isLoading={savingDoctor}
              disabled={!newDoctorName.trim() || !newDoctorSpecialty.trim()}
            >
              Add doctor
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ADD STAFF DIALOG (SIMPLIFIED) */}
      <Dialog open={staffOpen} onClose={() => setStaffOpen(false)} title="Add staff login">
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
              <label className="text-xs font-medium text-muted">Password</label>
              <input
                type="text"
                value={staffPassword}
                onChange={(e) => setStaffPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted">What is their role?</label>
            <select
              value={staffRole}
              onChange={(e) => handleRoleChange(e.target.value as StaffRole)}
              className="mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            >
              <option value="receptionist">Receptionist (Manages the front desk)</option>
              <option value="doctor">Doctor (Manages their own queue)</option>
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

          {staffErr && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
              {staffErr}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStaffOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={staffSaving}>
              Create login
            </Button>
          </div>
        </form>
      </Dialog>
    </AppShell>
  );
}

const inputClass =
  "mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-accent";

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

// HELPER: Remove Doctor Button with Loading State
function RemoveDoctorButton({ id, name, onRemove }: { id: string; name: string; onRemove: (id: string) => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  async function handle() {
    if (!confirm(`Remove ${name}?`)) return;
    setLoading(true);
    await onRemove(id);
    setLoading(false);
  }
  return (
    <Button variant="danger" className="h-8 shrink-0 px-3 text-xs" onClick={handle} isLoading={loading}>
      Remove
    </Button>
  );
}

// HELPER: Remove Staff Button with Loading State
function RemoveStaffButton({ id, name, onRemove }: { id: string; name: string; onRemove: (id: string) => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  async function handle() {
    if (!confirm(`Remove ${name}?`)) return;
    setLoading(true);
    await onRemove(id);
    setLoading(false);
  }
  return (
    <Button variant="danger" className="h-8 shrink-0 px-3 text-xs" onClick={handle} isLoading={loading}>
      Remove
    </Button>
  );
}

// Dropdown Time Picker (No lag)
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

  const times: string[] = [];
  for (let h = 8; h <= 22; h++) {
    times.push(`${String(h).padStart(2, "0")}:00`);
    if (h !== 22) times.push(`${String(h).padStart(2, "0")}:30`);
  }

  function addShift() {
    if (shifts.length === 0) {
      onChange([{ start: "09:00", end: "13:00" }]);
      return;
    }
    const lastEnd = shifts[shifts.length - 1].end;
    onChange([...shifts, { start: lastEnd, end: "18:00" }]);
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
              <select
                value={s.start}
                onChange={(e) => updateShift(i, { start: e.target.value })}
                className="rounded-lg border border-line bg-canvas px-2 py-1.5 text-xs tabular-nums text-ink outline-none focus:border-accent"
              >
                {times.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              
              <span className="text-xs text-muted">to</span>
              
              <select
                value={s.end}
                onChange={(e) => updateShift(i, { end: e.target.value })}
                className="rounded-lg border border-line bg-canvas px-2 py-1.5 text-xs tabular-nums text-ink outline-none focus:border-accent"
              >
                {times.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              
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