export type AppointmentStatus =
  | "booked"
  | "checked_in"
  | "completed"
  | "cancelled"
  | "no_show";

export type QueueStatus = "waiting" | "in_consultation" | "completed" | "skipped";
export type ArrivalType = "appointment" | "walk_in";
export type QueueEventType = "created" | "called" | "started" | "completed" | "skipped";

export type PagePermission = "reception" | "appointments" | "doctor" | "settings";
export type StaffRole = "owner" | "receptionist" | "doctor" | "staff";

export interface Shift {
  start: string;
  end: string;
}

export interface Clinic {
  id: string;
  name: string;
  timezone: string;
  openingHours: Record<number, Shift[]>;
  appointmentDurationMinutes: number;
  bookingDaysAhead: number;
}

export interface Doctor {
  id: string;
  clinicId: string;
  name: string;
  specialty: string;
  workingHours: Record<number, Shift[]>;
}

export interface StaffMember {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  role: StaffRole;
  doctorId?: string;
  permissions: PagePermission[];
  createdAt: string;
}

export interface Appointment {
  id: string;
  clinicId: string;
  doctorId: string;
  patientName: string;
  patientPhone: string;
  scheduledAt: string;
  shiftEnd: string;
  status: AppointmentStatus;
  reference: string;
  createdAt: string;
}

export interface QueueEntry {
  id: string;
  clinicId: string;
  doctorId: string;
  day: string;
  tokenNumber: number;
  arrivalType: ArrivalType;
  appointmentId?: string;
  patientName: string;
  patientPhone?: string;
  status: QueueStatus;
  shiftStart: string;
  shiftEnd: string;
  createdAt: string;
  calledAt?: string;
  completedAt?: string;
}

export interface QueueEvent {
  id: string;
  queueEntryId: string;
  type: QueueEventType;
  actorLabel: string;
  at: string;
}
