// Pure helpers for the date and time pickers (no React in here, so they are
// easy to test). Dates are 'YYYY-MM-DD'; times are whole hours as 'HH:00'
// (24-hour). A booking is a block of whole hours, e.g. '08:00-10:00'.

const TIMEZONE = 'Asia/Manila';

export const pad = (n) => String(n).padStart(2, '0');

// Today's date in the Philippines, regardless of the browser's own timezone.
export const todayISO = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });

// 2026-10-05 -> 2026/10/05 (the format shown on the pills in the design)
export const formatDisplay = (iso) => iso.replace(/-/g, '/');

export const monthLabel = (year, month) =>
  new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

// Weeks (Sunday first) for a month. Cells outside the month are null.
// month is 0-based.
export function monthGrid(year, month) {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells = Array(firstWeekday).fill(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, iso: `${year}-${pad(month + 1)}-${pad(day)}` });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// ---------- time (whole hours only) ----------

export const hourToLabel = (hour) => `${pad(hour)}:00`;

export const labelToHour = (label) => Number(label.slice(0, 2));

// A block can start at 00:00 ... 23:00 and end at 01:00 ... 24:00 (midnight).
export const START_OPTIONS = Array.from({ length: 24 }, (_, h) => hourToLabel(h));
export const END_OPTIONS = Array.from({ length: 24 }, (_, h) => hourToLabel(h + 1));

const TYPED = /^(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?$/;

// What the user types -> 'HH:00', or null if it isn't a whole hour.
// Accepts: 7, 07, 7:00, 0700, 19, 7pm, 7 PM, 7:00pm. Rejects 7:30 and 24.
export function parseTypedHour(text) {
  const m = TYPED.exec(String(text).trim().toLowerCase());
  if (!m) return null;

  const minutes = m[2] ? Number(m[2]) : 0;
  if (minutes !== 0) return null;

  let hours = Number(m[1]);
  if (m[3]) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (m[3] === 'pm' ? 12 : 0);
  } else if (hours > 23) {
    return null;
  }
  return hourToLabel(hours);
}

// True when the text is a valid time that just has minutes in it (7:30),
// so the UI can say "whole hours only" instead of a generic error.
export function typedHasMinutes(text) {
  const m = TYPED.exec(String(text).trim().toLowerCase());
  return Boolean(m && m[2] && Number(m[2]) !== 0 && Number(m[2]) <= 59);
}

export function splitRange(range) {
  const [start, end] = range.split('-');
  return { start, end };
}

export const joinRange = (start, end) => `${start}-${end}`;