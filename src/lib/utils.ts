import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names and resolves Tailwind conflicts.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ==========================================
// TIMEZONE & DATE HELPERS
// ==========================================

export function dateInTimeZone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const year = value("year");
  const month = value("month");
  const day = value("day");
  if (!year || !month || !day) {
    throw new Error(`Could not determine date in timezone "${timezone}".`);
  }
  return `${year}-${month}-${day}`;
}

export function addCalendarDays(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid calendar date: ${day}`);
  }
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function weekdayForCalendarDate(day: string): number {
  const date = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid calendar date: ${day}`);
  }
  return date.getUTCDay();
}

export function weekdayInTimeZone(date: Date, timezone: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(date);
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const index = weekdays.indexOf(weekday);
  if (index < 0) {
    throw new Error(`Could not determine weekday in timezone "${timezone}".`);
  }
  return index;
}

export function timeInTimeZone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;
  if (!hour || !minute) {
    throw new Error(`Could not determine time in timezone "${timezone}".`);
  }
  return `${hour}:${minute}`;
}

/**
 * Converts a local clinic date (e.g. "2026-10-16") and time (e.g. "14:30") 
 * into an exact ISO timestamp (UTC) based on the clinic's timezone.
 */
export function calendarDateTimeToIso(
  day: string,
  time: string,
  timezone: string
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match || !timeMatch) {
    throw new RangeError(`Invalid calendar date or time: ${day} ${time}`);
  }

  const [, year, month, date] = match;
  const [, hour, minute] = timeMatch;
  const desired = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(date),
    Number(hour),
    Number(minute)
  );
  const utcDate = new Date(desired);
  if (
    utcDate.getUTCFullYear() !== Number(year) ||
    utcDate.getUTCMonth() !== Number(month) - 1 ||
    utcDate.getUTCDate() !== Number(date)
  ) {
    throw new RangeError(`Invalid calendar date: ${day}`);
  }

  let timestamp = desired;
  for (let i = 0; i < 4; i++) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(timestamp));
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    const represented = Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute")
    );
    const difference = desired - represented;
    if (difference === 0) break;
    timestamp += difference;
  }

  if (
    dateInTimeZone(new Date(timestamp), timezone) !== day ||
    timeInTimeZone(new Date(timestamp), timezone) !== time
  ) {
    throw new RangeError(
      `The local time ${day} ${time} does not exist in timezone "${timezone}".`
    );
  }
  return new Date(timestamp).toISOString();
}

// ==========================================
// FORMATTERS (For UI Display)
// ==========================================

/** "09:15" from an ISO timestamp, in the local timezone. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** "Mon, 16 Oct" */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}