"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type {
  Appointment,
  Clinic,
  Doctor,
  PagePermission,
  QueueEntry,
  QueueEvent,
  Shift,
  StaffMember,
  StaffRole,
} from "./types";
import {
  dateInTimeZone,
  timeInTimeZone,
  weekdayInTimeZone,
} from "./utils";

interface ClinicStore {
  loaded: boolean;
  error: string | null;
  currentUserId: string | null;
  currentPermissions: PagePermission[];
  currentRole: StaffRole | null;
  currentDoctorId: string | null;

  clinic: Clinic | null;
  doctors: Doctor[];
  staff: StaffMember[];
  appointments: Appointment[];
  queueEntries: QueueEntry[];
  queueEvents: QueueEvent[];
  pausedDoctors: string[];

  load: () => Promise<void>;

  bookAppointment: (input: {
    doctorId: string;
    patientName: string;
    patientPhone: string;
    shiftStartIso: string;
    shiftEnd: string;
  }) => Promise<Appointment | null>;
  checkIn: (appointmentId: string) => Promise<void>;
  addWalkIn: (patientName: string, doctorId: string) => Promise<void>;
  callNext: (doctorId: string) => Promise<void>;
  completeConsultation: (queueEntryId: string) => Promise<void>;
  pauseQueue: (doctorId: string) => Promise<void>;
  resumeQueue: (doctorId: string) => Promise<void>;

  updateClinic: (patch: Partial<Clinic>) => Promise<void>;
  updateDoctor: (id: string, patch: Partial<Doctor>) => Promise<void>;
  addDoctor: (input: { name: string; specialty: string }) => Promise<Doctor | null>;
  removeDoctor: (id: string) => Promise<void>;

  loadStaff: () => Promise<void>;
  addStaff: (input: {
    email: string;
    password: string;
    fullName: string;
    role: StaffRole;
    doctorId?: string;
    permissions: PagePermission[];
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  removeStaff: (id: string) => Promise<void>;
}

type Row = Record<string, unknown>;

function currentOrNextShift(
  doctor: Doctor,
  timezone: string,
  when = new Date()
): Shift {
  const today = weekdayInTimeZone(when, timezone);
  const todayShifts = doctor.workingHours[today] ?? [];
  const nowHHMM = timeInTimeZone(when, timezone);
  for (const s of todayShifts) if (s.start <= nowHHMM && nowHHMM < s.end) return s;
  for (const s of todayShifts) if (s.start > nowHHMM) return s;
  for (let i = 1; i <= 7; i++) {
    const day = (today + i) % 7;
    const shifts = doctor.workingHours[day] ?? [];
    if (shifts.length) return shifts[0];
  }
  return { start: "09:00", end: "18:00" };
}

function toClinic(r: Row): Clinic {
  return {
    id: r.id as string,
    name: r.name as string,
    timezone: r.timezone as string,
    openingHours: (r.opening_hours ?? {}) as Record<number, Shift[]>,
    appointmentDurationMinutes: r.appointment_duration_min as number,
    bookingDaysAhead: r.booking_days_ahead as number,
  };
}

function toDoctor(r: Row): Doctor {
  return {
    id: r.id as string,
    clinicId: r.clinic_id as string,
    name: r.name as string,
    specialty: r.specialty as string,
    workingHours: (r.working_hours ?? {}) as Record<number, Shift[]>,
  };
}

function toAppointment(r: Row): Appointment {
  return {
    id: r.id as string,
    clinicId: r.clinic_id as string,
    doctorId: r.doctor_id as string,
    patientName: r.patient_name as string,
    patientPhone: r.patient_phone as string,
    scheduledAt: r.scheduled_at as string,
    shiftEnd: r.shift_end as string,
    status: r.status as Appointment["status"],
    reference: r.reference as string,
    createdAt: r.created_at as string,
  };
}

function toQueueEntry(r: Row): QueueEntry {
  return {
    id: r.id as string,
    clinicId: r.clinic_id as string,
    doctorId: r.doctor_id as string,
    day: r.day as string,
    tokenNumber: r.token_number as number,
    arrivalType: r.arrival_type as QueueEntry["arrivalType"],
    appointmentId: (r.appointment_id as string | null) ?? undefined,
    patientName: r.patient_name as string,
    patientPhone: (r.patient_phone as string | null) ?? undefined,
    status: r.status as QueueEntry["status"],
    shiftStart: r.shift_start as string,
    shiftEnd: r.shift_end as string,
    createdAt: r.created_at as string,
    calledAt: (r.called_at as string | null) ?? undefined,
    completedAt: (r.completed_at as string | null) ?? undefined,
  };
}

function toQueueEvent(r: Row): QueueEvent {
  return {
    id: r.id as string,
    queueEntryId: r.queue_entry_id as string,
    type: r.type as QueueEvent["type"],
    actorLabel: r.actor_label as string,
    at: r.at as string,
  };
}

function toStaff(r: Row): StaffMember {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    email: (r.email as string) ?? "",
    fullName: (r.full_name as string) ?? "",
    role: r.role as StaffRole,
    doctorId: (r.doctor_id as string | null) ?? undefined,
    permissions: (r.permissions as PagePermission[]) ?? [],
    createdAt: r.created_at as string,
  };
}

export const useClinic = create<ClinicStore>((set, get) => ({
  loaded: false,
  error: null,
  currentUserId: null,
  currentPermissions: [],
  currentRole: null,
  currentDoctorId: null,
  clinic: null,
  doctors: [],
  staff: [],
  appointments: [],
  queueEntries: [],
  queueEvents: [],
  pausedDoctors: [],

  async load() {
    const supabase = createClient();

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      set({ loaded: true, error: "Not signed in" });
      return;
    }

    const { data: staff, error: staffErr } = await supabase
      .from("clinic_staff")
      .select("clinic_id, role, doctor_id, permissions")
      .eq("user_id", user.id)
      .maybeSingle();

    if (staffErr || !staff) {
      set({
        loaded: true,
        error: staffErr?.message ?? "No clinic linked to this user.",
      });
      return;
    }

    const clinicId = staff.clinic_id as string;

    const today = new Date();
    const start = new Date(today); start.setDate(start.getDate() - 1);
    const end = new Date(today); end.setDate(end.getDate() + 2);

    const [clinicRes, docsRes, apptRes, queueRes, eventsRes] = await Promise.all([
      supabase.from("clinics").select("*").eq("id", clinicId).single(),
      supabase.from("doctors").select("*").eq("clinic_id", clinicId),
      supabase
        .from("appointments")
        .select("*")
        .eq("clinic_id", clinicId)
        .gte("scheduled_at", start.toISOString())
        .lte("scheduled_at", end.toISOString())
        .order("scheduled_at", { ascending: true }),
      supabase
        .from("queue_entries")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("token_number", { ascending: true }),
      supabase
        .from("queue_events")
        .select("*")
        .order("at", { ascending: false })
        .limit(500),
    ]);

    if (clinicRes.error || !clinicRes.data) {
      set({
        loaded: true,
        error: clinicRes.error?.message ?? "Could not load clinic.",
      });
      return;
    }

    set({
      loaded: true,
      error: null,
      currentUserId: user.id,
      currentPermissions: (staff.permissions as PagePermission[]) ?? [],
      currentRole: staff.role as StaffRole,
      currentDoctorId: (staff.doctor_id as string | null) ?? null,
      clinic: toClinic(clinicRes.data as Row),
      doctors: (docsRes.data ?? []).map((r) => toDoctor(r as Row)),
      appointments: (apptRes.data ?? []).map((r) => toAppointment(r as Row)),
      queueEntries: (queueRes.data ?? []).map((r) => toQueueEntry(r as Row)),
      queueEvents: (eventsRes.data ?? []).map((r) => toQueueEvent(r as Row)),
    });
  },

  async bookAppointment(input) {
    const clinic = get().clinic;
    if (!clinic) return null;
    const supabase = createClient();
    const reference = `CF-${crypto.randomUUID().slice(0,8).toUpperCase()}`;

    const { data, error } = await supabase
      .from("appointments")
      .insert({
        clinic_id: clinic.id,
        doctor_id: input.doctorId,
        patient_name: input.patientName,
        patient_phone: input.patientPhone,
        scheduled_at: input.shiftStartIso,
        shift_end: input.shiftEnd,
        status: "booked",
        reference,
      })
      .select("*")
      .single();

    if (error || !data) {
      set({ error: error?.message ?? "Could not book." });
      return null;
    }
    const apt = toAppointment(data as Row);
    set((s) => ({ appointments: [...s.appointments, apt] }));
    return apt;
  },

  async checkIn(appointmentId) {
    const supabase = createClient();
    const apt = get().appointments.find((a) => a.id === appointmentId);
    const clinic = get().clinic;
    if (!apt || apt.status !== "booked" || !clinic) return;

    const start = new Date(apt.scheduledAt);
    const shiftStart = timeInTimeZone(start, clinic.timezone);
    const day = dateInTimeZone(new Date(), clinic.timezone);

    const { data: token, error: tokenErr } = await supabase.rpc("next_token", {
      p_clinic_id: apt.clinicId,
      p_doctor_id: apt.doctorId,
      p_day: day,
    });

    if (tokenErr || token === null) {
      alert("CHECKIN FAILED (Token RPC): " + (tokenErr?.message ?? "Unknown error"));
      set({ error: tokenErr?.message ?? "Could not generate token." });
      return;
    }

    const { data, error } = await supabase
      .from("queue_entries")
      .insert({
        clinic_id: apt.clinicId,
        doctor_id: apt.doctorId,
        day,
        token_number: token,
        arrival_type: "appointment",
        appointment_id: apt.id,
        patient_name: apt.patientName,
        patient_phone: apt.patientPhone,
        status: "waiting",
        shift_start: shiftStart,
        shift_end: apt.shiftEnd,
      })
      .select("*")
      .single();

    if (error || !data) {
      alert("CHECKIN FAILED (Queue Insert): " + (error?.message ?? "Unknown error"));
      set({ error: error?.message ?? "Could not add to queue." });
      return;
    }

    const { error: updErr } = await supabase
      .from("appointments")
      .update({ status: "checked_in" })
      .eq("id", appointmentId);
      
    if (updErr) {
      alert("CHECKIN FAILED (Appointment Update): " + updErr.message);
      set({ error: updErr.message });
      return;
    }

    set((s) => ({
      appointments: s.appointments.map((a) =>
        a.id === appointmentId ? { ...a, status: "checked_in" } : a
      ),
      queueEntries: [...s.queueEntries, toQueueEntry(data as Row)],
    }));
  },

  async addWalkIn(patientName, doctorId) {
    const clinic = get().clinic;
    const doctor = get().doctors.find((d) => d.id === doctorId);
    if (!clinic || !doctor) return;
    
    const shift = currentOrNextShift(doctor, clinic.timezone);
    const day = dateInTimeZone(new Date(), clinic.timezone);
    const supabase = createClient();

    const { data: token, error: tokenErr } = await supabase.rpc("next_token", {
      p_clinic_id: clinic.id,
      p_doctor_id: doctorId,
      p_day: day,
    });

    if (tokenErr || token === null) {
      set({ error: tokenErr?.message ?? "Could not generate token." });
      return;
    }

    const { data, error } = await supabase
      .from("queue_entries")
      .insert({
        clinic_id: clinic.id,
        doctor_id: doctorId,
        day,
        token_number: token,
        arrival_type: "walk_in",
        patient_name: patientName,
        status: "waiting",
        shift_start: shift.start,
        shift_end: shift.end,
      })
      .select("*")
      .single();

    if (error || !data) {
      set({ error: error?.message ?? "Could not add walk-in." });
      return;
    }
    set((s) => ({ queueEntries: [...s.queueEntries, toQueueEntry(data as Row)] }));
  },

  async callNext(doctorId) {
    const { pausedDoctors, queueEntries } = get();
    if (pausedDoctors.includes(doctorId)) return;
    const busy = queueEntries.some(
      (e) => e.doctorId === doctorId && e.status === "in_consultation"
    );
    if (busy) return;
    const next = queueEntries.find(
      (e) => e.doctorId === doctorId && e.status === "waiting"
    );
    if (!next) return;

    const supabase = createClient();
    const nowIso = new Date().toISOString();
    
    const { data, error } = await supabase
      .from("queue_entries")
      .update({ status: "in_consultation", called_at: nowIso })
      .eq("id", next.id)
      .eq("status", "waiting")
      .select("id")
      .maybeSingle();

    if (error) {
      alert("CALL NEXT FAILED (Update Queue): " + error.message);
      set({ error: error.message });
      return;
    }
    
    if (!data) {
      alert("CALL NEXT FAILED: Another user clicked first, or RLS blocked reading the updated row.");
      return;
    }

    const { error: eventErr } = await supabase.from("queue_events").insert({
      queue_entry_id: next.id,
      type: "called",
      actor_label: "Reception",
    });

    if (eventErr) {
      alert("CALL NEXT FAILED (Audit Log): " + eventErr.message);
    }
    
    set((s) => ({
      queueEntries: s.queueEntries.map((e) =>
        e.id === next.id ? { ...e, status: "in_consultation", calledAt: nowIso } : e
      ),
    }));
  },

  async completeConsultation(queueEntryId) {
    const supabase = createClient();
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("queue_entries")
      .update({ status: "completed", completed_at: nowIso })
      .eq("id", queueEntryId);
      
    if (error) {
      alert("COMPLETE FAILED (Update Queue): " + error.message);
      set({ error: error.message });
      return;
    }

    const { error: eventErr } = await supabase.from("queue_events").insert({
      queue_entry_id: queueEntryId,
      type: "completed",
      actor_label: "Doctor",
    });

    if (eventErr) {
      alert("COMPLETE FAILED (Audit Log): " + eventErr.message);
    }

    set((s) => ({
      queueEntries: s.queueEntries.map((e) =>
        e.id === queueEntryId ? { ...e, status: "completed", completedAt: nowIso } : e
      ),
    }));
  },

  async pauseQueue(doctorId) {
    set((s) => ({
      pausedDoctors: s.pausedDoctors.includes(doctorId)
        ? s.pausedDoctors
        : [...s.pausedDoctors, doctorId],
    }));
  },

  async resumeQueue(doctorId) {
    set((s) => ({
      pausedDoctors: s.pausedDoctors.filter((id) => id !== doctorId),
    }));
  },

  async updateClinic(patch) {
    const clinic = get().clinic;
    if (!clinic) return;
    const supabase = createClient();
    const row: Row = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.timezone !== undefined) row.timezone = patch.timezone;
    if (patch.appointmentDurationMinutes !== undefined)
      row.appointment_duration_min = patch.appointmentDurationMinutes;
    if (patch.bookingDaysAhead !== undefined)
      row.booking_days_ahead = patch.bookingDaysAhead;
    if (patch.openingHours !== undefined) row.opening_hours = patch.openingHours;

    const { error } = await supabase.from("clinics").update(row).eq("id", clinic.id);
    if (error) {
      set({ error: error.message });
      return;
    }
    set({ clinic: { ...clinic, ...patch } });
  },

  async updateDoctor(id, patch) {
    const supabase = createClient();
    const row: Row = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.specialty !== undefined) row.specialty = patch.specialty;
    if (patch.workingHours !== undefined) row.working_hours = patch.workingHours;
    const { error } = await supabase.from("doctors").update(row).eq("id", id);
    if (error) {
      set({ error: error.message });
      return;
    }
    set((s) => ({
      doctors: s.doctors.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  },

  async addDoctor(input) {
    const clinic = get().clinic;
    if (!clinic) return null;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("doctors")
      .insert({
        clinic_id: clinic.id,
        name: input.name,
        specialty: input.specialty,
        working_hours: { "0": [], "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] },
      })
      .select("*")
      .single();
    if (error || !data) {
      set({ error: error?.message ?? "Could not add doctor." });
      return null;
    }
    const doc = toDoctor(data as Row);
    set((s) => ({ doctors: [...s.doctors, doc] }));
    return doc;
  },

  async removeDoctor(id) {
    const supabase = createClient();
    const { error } = await supabase.from("doctors").delete().eq("id", id);
    if (error) {
      set({ error: error.message });
      return;
    }
    set((s) => ({
      doctors: s.doctors.filter((d) => d.id !== id),
      appointments: s.appointments.filter((a) => a.doctorId !== id),
      queueEntries: s.queueEntries.filter((q) => q.doctorId !== id),
    }));
  },

  async loadStaff() {
    const supabase = createClient();
    const { data, error } = await supabase.from("clinic_staff").select("*");
    if (error) {
      set({ error: error.message });
      return;
    }
    set({ staff: (data ?? []).map((r) => toStaff(r as Row)) });
  },

  async addStaff(input) {
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error ?? "Failed" };
    await get().loadStaff();
    return { ok: true };
  },

  async removeStaff(id) {
    const res = await fetch(`/api/staff/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      set({ error: json.error ?? "Could not remove staff." });
      return;
    }
    set((s) => ({ staff: s.staff.filter((x) => x.id !== id) }));
  },
}));

export function useEnsureLoaded() {
  const loaded = useClinic((s) => s.loaded);
  const load = useClinic((s) => s.load);
  if (!loaded) void load();
}