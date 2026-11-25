// Derived numbers and plan rules (week math, carry-over, hours).

import { S, save } from "./store.js";
import { TRACK_KEYS, FEEDBACK, PHASES } from "./content.js";
import { GOAL_DEFAULT } from "./content4.js";
import { today, daysBetween, addDays, clamp, sum, parseYmd } from "./util.js";

export const weekRaw = date => Math.floor(daysBetween(S.settings.startDate, date) / 7) + 1;
export const weekCount = () => S.plan.weeks.length;
export const currentWeek = () => clamp(weekRaw(today()), 1, weekCount());
export const beforeStart = () => weekRaw(today()) < 1;
export const pastPlan = () => weekRaw(today()) > weekCount();
export const weekStart = n => addDays(S.settings.startDate, (n - 1) * 7);
export const weekEnd = n => addDays(weekStart(n), 6);
// Days before the plan starts count toward Week 1, so early work isn't lost.
export const inWeek = (date, n) => !!date && (n === 1 || date >= weekStart(n)) && date <= weekEnd(n);
export const weekMeta = n => S.plan.weeks.find(w => w.n === n);
// Each plan week has its own hours split (the phases shift hours between tracks); weeks you
// add yourself use the default split from Settings.
export const trackTarget = (n, k) => { const s = weekMeta(n)?.split; return s && typeof s[k] === "number" ? s[k] : S.settings.hours[k]; };
export const plannedTotal = (n = currentWeek()) => sum(TRACK_KEYS, k => trackTarget(n, k));
export const phaseOf = n => PHASES.find(p => p.id === weekMeta(n)?.phase) || PHASES.find(p => n >= p.from && n <= p.to) || null;

export const taskById = id => S.plan.tasks.find(t => t.id === id);
const trackIdx = k => TRACK_KEYS.indexOf(k);
export function weekTasks(n, { dropped = false } = {}) {
  return S.plan.tasks
    .filter(t => t.week === n && (dropped ? t.dropped : !t.dropped))
    .sort((a, b) => trackIdx(a.track) - trackIdx(b.track) || a.order - b.order);
}
export const tasksByTrack = (n, k) => weekTasks(n).filter(t => t.track === k);
export function weekProgress(n) {
  const ts = weekTasks(n);
  const done = ts.filter(t => t.done);
  return { total: ts.length, done: done.length, hours: sum(ts, t => t.hours), doneHours: sum(done, t => t.hours), pct: ts.length ? done.length / ts.length : 0 };
}

// Fraction of the week elapsed, for the expected-progress marker (0 before start).
export function weekElapsed(n) {
  const t = today();
  if (t < weekStart(n)) return 0;
  if (t > weekEnd(n)) return 1;
  return (daysBetween(weekStart(n), t) + 1) / 7;
}

// ---- Hours ----
export const sessionsInWeek = n => S.sessions.list.filter(s => inWeek(s.date, n));
export const workedHours = n => sum(sessionsInWeek(n), s => s.min) / 60;
export function workedByTrack(n) {
  const out = { learn: 0, build: 0, practice: 0, apply: 0, other: 0 };
  for (const s of sessionsInWeek(n)) out[TRACK_KEYS.includes(s.track) ? s.track : "other"] += s.min / 60;
  return out;
}
// Productivity = planned hours of tasks completed this week ÷ hours worked this week.
export function productivity(n) {
  const worked = workedHours(n);
  const doneHours = sum(S.plan.tasks.filter(t => t.done && !t.dropped && inWeek(t.doneAt, n)), t => t.hours);
  return { worked, doneHours, ratio: worked > 0 ? doneHours / worked : null };
}
export const hoursToday = () => sum(S.sessions.list.filter(s => s.date === today()), s => s.min) / 60;

// ---- Weekly carry-over: unfinished tasks move to the current week ----
export function rollover() {
  const cur = currentWeek();
  if ((S.plan.lastRollover || 1) >= cur) return 0;
  let moved = 0;
  for (const t of S.plan.tasks) {
    if (t.week < cur && !t.done && !t.dropped) {
      t.carriedFrom = t.week; t.week = cur; t.carryPending = true; t.order = 1000 + t.order; moved++;
    }
  }
  S.plan.lastRollover = cur;
  save("plan");
  return moved;
}
export const carryPending = () => S.plan.tasks.filter(t => t.carryPending && !t.dropped && !t.done && t.week === currentWeek());

// ---- Today's tasks: unfinished ones carry to the next day ----
export function syncToday() {
  const t = S.today, d = today();
  if (t.date === d) return;
  const left = t.ids.filter(id => { const k = taskById(id); return k && !k.done && !k.dropped; });
  const hadAny = t.ids.length > 0 || t.carried.length > 0;
  t.prevDate = t.date;
  t.carried = left; t.ids = [...left]; t.date = d;
  if (hadAny) save("today");
}
export const todayTasks = () => S.today.ids.map(taskById).filter(t => t && !t.dropped);
export const inToday = id => S.today.ids.includes(id);

// ---- Weekly goals: each plan week sets its own; your Strategy goals replace the full-pace ones ----
export function weekGoal(n) {
  const g = { ...GOAL_DEFAULT, ...(S.strategy?.goals || {}) };
  const base = weekMeta(n)?.goals;
  const out = {};
  for (const k of ["apps", "chats", "events", "refs"]) {
    const b = base && typeof base[k] === "number" ? base[k] : null;
    // Lighter weeks (setup, before the portfolio is live, holidays) keep the plan's lower goal.
    out[k] = b != null && b < GOAL_DEFAULT[k] ? Math.min(b, g[k]) : g[k];
  }
  if (S.plan.hired) for (const k of Object.keys(out)) if (n >= S.plan.hired) out[k] = 0;
  return out;
}

// ---- Applications ----
export function appsPerWeek() {
  const n = weekCount();
  const counts = Array.from({ length: n }, () => 0);
  for (const a of S.apps.list) {
    if (!a.appliedAt) continue;
    const w = Math.max(1, weekRaw(a.appliedAt)); // days before the start count toward Week 1
    if (w <= n) counts[w - 1]++;
  }
  const targets = Array.from({ length: n }, (_, i) => weekGoal(i + 1).apps);
  return { counts, targets };
}
export function feedback() {
  const parts = FEEDBACK.map(f => ({ label: f.label, color: f.color, value: S.apps.list.filter(a => f.statuses.includes(a.status)).length }));
  const sent = sum(parts, p => p.value);
  const replied = sent - parts[0].value;
  return { parts, sent, replied, rate: sent ? replied / sent : null };
}

// ---- Skills ----
export function skillSummary() {
  const list = S.skills.list;
  return { list, met: list.filter(s => s.now >= s.target).length, total: list.length, gap: sum(list, s => Math.max(0, s.target - s.now)) };
}

// ---- Events ----
const evKey = e => `${e.date || "9999-12-31"} ${e.time || "99:99"}`;
export const upcomingEvents = () => S.events.list.filter(e => e.date && e.date >= today()).sort((a, b) => evKey(a) < evKey(b) ? -1 : 1);
export const pastEvents = () => S.events.list.filter(e => !e.date || e.date < today()).sort((a, b) => evKey(a) > evKey(b) ? -1 : 1);

export const isSunday = () => parseYmd(today()).getDay() === 0;

// ---- Skills (Stage 2) ----
export const skillById = id => S.skills.list.find(s => s.id === id);
export const resById = id => S.resources.list.find(r => r.id === id);
export const tasksForSkill = id => S.plan.tasks.filter(t => !t.dropped && t.skills.includes(id)).sort((a, b) => a.week - b.week || a.order - b.order);
export const resourcesForSkill = id => S.resources.list.filter(r => r.skills.includes(id));
// A session counts toward a skill when it's logged on the skill, or on a task or resource tagged with it.
export function sessionSkills(s) {
  const out = new Set();
  if (s.skillId) out.add(s.skillId);
  if (s.taskId) { const t = taskById(s.taskId); if (t) t.skills.forEach(k => out.add(k)); }
  if (s.resourceId) { const r = resById(s.resourceId); if (r) r.skills.forEach(k => out.add(k)); }
  return out;
}
export const sessionsForSkill = id => S.sessions.list.filter(s => sessionSkills(s).has(id));
export const skillHours = id => sum(sessionsForSkill(id), s => s.min) / 60;
export const skillHoursInWeek = (id, n) => sum(sessionsForSkill(id).filter(s => inWeek(s.date, n)), s => s.min) / 60;
export const lastRated = sk => (sk.history.length ? sk.history[sk.history.length - 1].d : "");
export const ratingPoints = sk => [{ d: "", lvl: sk.start ?? sk.now, label: "Start" }, ...sk.history.map(h => ({ ...h, label: h.d }))];
// Re-rate skills every four weeks and in the last week of the plan.
export const isRerateWeek = n => n > 0 && (n % 4 === 0 || n === weekCount());
export const rerateWeeks = () => Array.from({ length: weekCount() }, (_, i) => i + 1).filter(isRerateWeek);
export function rerateDue() {
  const n = currentWeek();
  if (!isRerateWeek(n) || beforeStart()) return false;
  return S.skills.list.some(sk => !sk.history.some(h => inWeek(h.d, n)));
}

// ---- Resources ----
export function resPct(r) {
  if (r.status === "done") return 1;
  if (r.units && r.units.total > 0) return Math.min(1, (r.units.done || 0) / r.units.total);
  return r.status === "doing" ? 0.5 : 0;
}
export const sessionsForRes = id => S.sessions.list.filter(s => s.resourceId === id);
export const resHours = id => sum(sessionsForRes(id), s => s.min) / 60;
export const resHoursInWeek = n => sum(S.sessions.list.filter(s => s.resourceId && inWeek(s.date, n)), s => s.min) / 60;

// ---- Weekly review numbers ----
export function weekReview(n) {
  const tasks = S.plan.tasks;
  const inW = tasks.filter(t => t.week === n);
  const done = inW.filter(t => t.done && !t.dropped);
  const open = inW.filter(t => !t.done && !t.dropped);
  const dropped = inW.filter(t => t.dropped);
  const carriedOut = tasks.filter(t => t.carriedFrom === n && t.week !== n);
  const byTrack = workedByTrack(n);
  const planned = Object.fromEntries(TRACK_KEYS.map(k => [k, trackTarget(n, k)]));
  const pr = productivity(n);
  const ap = appsPerWeek();
  const sentApps = S.apps.list.filter(a => a.appliedAt && inWeek(a.appliedAt, n));
  const evs = S.events.list.filter(e => inWeek(e.date, n));
  const attended = evs.filter(e => e.status === "attended");
  const unmarked = evs.filter(e => e.date < today() && (!e.status || e.status === "planned"));
  const chats = attended.filter(e => e.type === "Coffee chat");
  const rated = S.skills.list.map(sk => {
    const h = sk.history.filter(x => inWeek(x.d, n));
    if (!h.length) return null;
    const before = [...ratingPoints(sk)].filter(p => !p.d || p.d < weekStart(n)).pop();
    return { id: sk.id, name: sk.name, from: before ? before.lvl : sk.start, to: h[h.length - 1].lvl };
  }).filter(Boolean);
  const skillHrs = S.skills.list.map(sk => ({ id: sk.id, name: sk.name, h: skillHoursInWeek(sk.id, n) })).filter(x => x.h > 0).sort((a, b) => b.h - a.h);
  const resFinished = S.resources.list.filter(r => inWeek(r.finished, n));
  const resStarted = S.resources.list.filter(r => inWeek(r.started, n));
  return { n, done, open, dropped, carriedOut, byTrack, planned, pr, apps: { sent: sentApps.length, target: ap.targets[n - 1] || 0, list: sentApps }, events: evs, attended, unmarked, chats, rated, skillHrs, resFinished, resStarted, resHours: resHoursInWeek(n) };
}
