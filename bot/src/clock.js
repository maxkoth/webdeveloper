// Session-time helpers in US Eastern, so the bot only runs 4am–8pm on weekdays
// and can scale "relative volume" by how much of the session has elapsed.

import { DateTime } from "luxon";

export function nowET(cfg) {
  return DateTime.now().setZone(cfg.session.timezone);
}

export function isWeekday(dt) {
  return dt.weekday >= 1 && dt.weekday <= 5; // Mon–Fri (does NOT know holidays)
}

export function isWithinSession(cfg, dt = nowET(cfg)) {
  if (!isWeekday(dt)) return false;
  const h = dt.hour + dt.minute / 60;
  return h >= cfg.session.startHour && h < cfg.session.endHour;
}

/** Epoch ms for today's session start (e.g. 04:00 ET). */
export function sessionStartMs(cfg, dt = nowET(cfg)) {
  return dt.set({ hour: cfg.session.startHour, minute: 0, second: 0, millisecond: 0 }).toMillis();
}

/** Fraction of the session elapsed (0..1), for relative-volume pacing. */
export function sessionFraction(cfg, dt = nowET(cfg)) {
  const h = dt.hour + dt.minute / 60;
  const total = cfg.session.endHour - cfg.session.startHour;
  return Math.min(1, Math.max(0.02, (h - cfg.session.startHour) / total));
}
