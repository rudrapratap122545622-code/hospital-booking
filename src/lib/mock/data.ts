// Fictional seed data — Phase A only.

import type {
  Clinic,
  Doctor,
  Appointment,
  AppointmentStatus,
  QueueEntry,
  QueueStatus,
  QueueEvent,
} from "../types";

// ---------- helpers ----------

const now = new Date();
const TODAY = now.toISOString().slice(0, 10);

function at(hour: number, minute = 0): string {
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

// ---------- clinic ----------

export const mockClinic: Clinic = {
  id: "clinic_sunrise",
  name: "Sunrise Family Clinic",
  timezone: "Asia/Kolkata",
  openingHours: {
    0: [],
    1: [{ start: "09:00", end: "13:00" }, { start: "16:00", end: "20:00" }],
    2: [{ start: "09:00", end: "13:00" }, { start: "16:00", end: "20:00" }],
    3: [{ start: "09:00", end: "13:00" }, { start: "16:00", end: "20:00" }],
    4: [{ start: "09:00", end: "13:00" }, { start: "16:00", end: "20:00" }],
    5: [{ start: "09:00", end: "13:00" }, { start: "16:00", end: "20:00" }],
    6: [{ start: "09:00", end: "14:00" }],
  },
  appointmentDurationMinutes: 15,
  bookingDaysAhead: 2,
};

// ---------- doctors ----------

export const mockDoctors: Doctor[] = [
  {
    id: "doc_meera",
    clinicId: mockClinic.id,
    name: "Dr. Meera Nair",
    specialty: "General Physician",
    workingHours: {
      0: [],
      1: [{ start: "09:00", end: "12:00" }, { start: "17:00", end: "20:00" }],
      2: [{ start: "09:00", end: "12:00" }, { start: "17:00", end: "20:00" }],
      3: [{ start: "09:00", end: "12:00" }, { start: "17:00", end: "20:00" }],
      4: [{ start: "09:00", end: "12:00" }, { start: "17:00", end: "20:00" }],
      5: [{ start: "09:00", end: "12:00" }, { start: "17:00", end: "20:00" }],
      6: [{ start: "09:00", end: "13:00" }],
    },
  },
  {
    id: "doc_arjun",
    clinicId: mockClinic.id,
    name: "Dr. Arjun Rao",
    specialty: "Pediatrician",
    workingHours: {
      0: [],
      1: [],
      2: [{ start: "16:00", end: "20:00" }],
      3: [{ start: "16:00", end: "20:00" }],
      4: [{ start: "16:00", end: "20:00" }],
      5: [{ start: "16:00", end: "20:00" }],
      6: [],
    },
  },
];

// ---------- patients ----------

const PATIENTS = [
  "Aarav Sharma", "Diya Patel", "Vihaan Kumar", "Ananya Reddy", "Ishaan Nair",
  "Saanvi Iyer", "Arjun Mehta", "Kavya Joshi", "Reyansh Gupta", "Myra Singh",
  "Aditya Verma", "Anika Rao", "Krishna Das", "Pari Choudhury", "Rohan Bansal",
  "Aadhya Kulkarni", "Vivaan Shah", "Riya Menon", "Ayaan Khan", "Sara Bose",
  "Kabir Malhotra", "Aarohi Pillai", "Dev Saxena", "Naina Trivedi",
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

// ---------- appointments ----------
// 24 today. Meera: 6 morning + 6 evening. Arjun: 12 evening.
// Status: 17 checked_in, 4 booked, 2 cancelled, 1 no_show.

function buildAppointments(): Appointment[] {
  const out: Appointment[] = [];

  for (let i = 0; i < 24; i++) {
    const doctorId = i % 2 === 0 ? "doc_meera" : "doc_arjun";
    const isMeera = doctorId === "doc_meera";

    // Meera has morning + evening; Arjun only evening.
    let shiftStart: string;
    let shiftEnd: string;
    if (isMeera && i < 12) {
      shiftStart = "09:00";
      shiftEnd = "12:00";
    } else if (isMeera) {
      shiftStart = "17:00";
      shiftEnd = "20:00";
    } else {
      shiftStart = "16:00";
      shiftEnd = "20:00";
    }

    const [sh, sm] = shiftStart.split(":").map(Number);

    let status: AppointmentStatus;
    if (i < 17) status = "checked_in";
    else if (i < 21) status = "booked";
    else if (i < 23) status = "cancelled";
    else status = "no_show";

    out.push({
      id: `apt_${i + 1}`,
      clinicId: mockClinic.id,
      doctorId,
      patientName: pick(PATIENTS, i),
      patientPhone: `+91 90000 ${String(10000 + i).slice(-5)}`,
      scheduledAt: at(sh, sm),
      shiftEnd,
      status,
      reference: `CF-${String(1000 + i)}`,
      createdAt: ago(60 * 24 * (i % 3)),
    });
  }
  return out;
}

export const mockAppointments: Appointment[] = buildAppointments();

// ---------- queue entries ----------

function buildQueueEntries(): QueueEntry[] {
  const out: QueueEntry[] = [];

  const counters: Record<string, number> = {};
  const nextFor = (docId: string) => {
    counters[docId] = (counters[docId] ?? 0) + 1;
    return counters[docId];
  };

  const shiftOf = (iso: string, end: string): { start: string; end: string } => {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return { start: `${hh}:${mm}`, end };
  };

  const checkedIn = mockAppointments.filter((a) => a.status === "checked_in");

  checkedIn.forEach((apt, i) => {
    const token = nextFor(apt.doctorId);
    const status: QueueStatus = i < 16 ? "completed" : "in_consultation";
    const shift = shiftOf(apt.scheduledAt, apt.shiftEnd);
    out.push({
      id: `q_${apt.doctorId}_${token}`,
      clinicId: mockClinic.id,
      doctorId: apt.doctorId,
      day: TODAY,
      tokenNumber: token,
      arrivalType: "appointment",
      appointmentId: apt.id,
      patientName: apt.patientName,
      status,
      shiftStart: shift.start,
      shiftEnd: shift.end,
      createdAt: ago(240 - i * 5),
      calledAt: ago(200 - i * 5),
      completedAt: status === "completed" ? ago(180 - i * 5) : undefined,
    });
  });

  // 7 walk-ins → all into the doctor's first shift of today.
  const walkIns: string[] = [
    "doc_meera",
    "doc_arjun",
    "doc_meera",
    "doc_arjun",
    "doc_meera",
    "doc_arjun",
    "doc_meera",
  ];

  walkIns.forEach((docId, i) => {
    const doc = mockDoctors.find((d) => d.id === docId)!;
    const firstShift = (doc.workingHours[now.getDay()] ?? [])[0] ?? {
      start: "09:00",
      end: "12:00",
    };
    const token = nextFor(docId);
    out.push({
      id: `q_${docId}_${token}`,
      clinicId: mockClinic.id,
      doctorId: docId,
      day: TODAY,
      tokenNumber: token,
      arrivalType: "walk_in",
      patientName: pick(PATIENTS, 17 + i),
      status: "waiting",
      shiftStart: firstShift.start,
      shiftEnd: firstShift.end,
      createdAt: ago(30 - i * 3),
    });
  });

  return out;
}

export const mockQueueEntries: QueueEntry[] = buildQueueEntries();

// ---------- queue events ----------

export const mockQueueEvents: QueueEvent[] = mockQueueEntries.flatMap((q) => {
  const events: QueueEvent[] = [
    {
      id: `ev_${q.id}_created`,
      queueEntryId: q.id,
      type: "created",
      actorLabel: "Reception",
      at: q.createdAt,
    },
  ];
  if (q.calledAt) {
    events.push({
      id: `ev_${q.id}_called`,
      queueEntryId: q.id,
      type: "called",
      actorLabel: "Reception",
      at: q.calledAt,
    });
  }
  if (q.completedAt) {
    events.push({
      id: `ev_${q.id}_completed`,
      queueEntryId: q.id,
      type: "completed",
      actorLabel: q.doctorId,
      at: q.completedAt,
    });
  }
  return events;
});