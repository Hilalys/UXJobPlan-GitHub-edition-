// Rebuild the plan from the profile, start it over, and update built-in text when the location changes.

import { S, save, saveNow, planFromContent, mondayOf, defaults } from "./store.js";
import { SKILLS } from "./content.js";
import { RESOURCES } from "./content2.js";
import { RES_WEEK } from "./plan-data.js";
import { normMe, levelOf, targetOf, builtinText, builtinWeek, mapWeek, buildPlan } from "./personalize.js";
import { communities } from "./content4.js";
import { RESUME_CHECKS, LINKEDIN_CHECKS, STARTER_CASES } from "./content3.js";
import { SKILL_DETAILS } from "./content2.js";
import { fill } from "./locale.js";
import { today, daysBetween } from "./util.js";

const BUILTIN = /^w\d+-t\d+$/;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// What a rebuild would produce, for the preview in Settings.
export function previewPlan() {
  const p = buildPlan(normMe(S.settings.me));
  const hours = p.tasks.reduce((a, t) => a + t.hours, 0);
  return { weeks: p.weeks.length, tasks: p.tasks.length, skipped: p.skipped, hours };
}

// Skill levels and targets from the profile. History (re-ratings) is kept.
function applySkillLevels() {
  const me = normMe(S.settings.me);
  for (const sk of S.skills.list) {
    const base = SKILLS.find(s => s.id === sk.id);
    if (!base) continue;
    const lvl = levelOf(me, sk.id);
    sk.start = lvl;
    if (!sk.history.length) sk.now = lvl;
    sk.target = targetOf(me, base);
  }
  save("skills");
}

function mapResources() {
  for (const r of S.resources.list) {
    if (r.src && r.src !== "built-in") continue;
    if (RES_WEEK[r.id] != null) r.week = mapWeek(S.plan, RES_WEEK[r.id]);
  }
  save("resources");
}

// Rebuild around the profile. Ticked tasks stay ticked; your own tasks and edits are kept.
export function rebuildPlan({ start } = {}) {
  const old = S.plan;
  if (start) { S.settings.startDate = start; }
  S.settings.me = { ...normMe(S.settings.me), built: true };
  saveNow("settings");
  const fresh = planFromContent();
  const byId = new Map(old.tasks.map(t => [t.id, t]));
  for (const t of fresh.tasks) {
    const o = byId.get(t.id);
    if (!o) continue;
    t.done = o.done; t.doneAt = o.doneAt; t.dropped = o.dropped;
    const b = builtinText(t.id);
    // Keep edits the person made to a built-in task.
    if (b && (o.title !== b.title || o.detail !== b.detail || !same(o.res, b.res))) {
      t.title = o.title; t.detail = o.detail; t.res = o.res; t.hours = o.hours; t.skills = o.skills;
    }
  }
  const n = fresh.weeks.length;
  const mine = old.tasks.filter(t => !BUILTIN.test(t.id)).map(t => ({ ...t, week: Math.min(Math.max(1, t.week), n) }));
  for (const w of fresh.weeks) { const o = old.weeks.find(x => x.n === w.n); if (o && o.notes) w.notes = o.notes; }
  S.plan = { ...fresh, tasks: [...fresh.tasks, ...mine], lastRollover: 1 };
  // Don't pull every task of past weeks into this one after a rebuild: the plan starts where it is.
  const cur = Math.max(1, Math.min(n, Math.floor(daysBetween(S.settings.startDate, today()) / 7) + 1));
  S.plan.lastRollover = cur;
  saveNow("plan");
  S.today.ids = S.today.ids.filter(id => S.plan.tasks.some(t => t.id === id));
  S.today.carried = (S.today.carried || []).filter(id => S.plan.tasks.some(t => t.id === id));
  save("today");
  applySkillLevels();
  mapResources();
}

// Start the plan over from a new week 1: clears ticks, today's list and (optionally) logged work.
export function restartPlan({ start, sessions = true, reviews = true, ratings = false } = {}) {
  S.settings.startDate = start || mondayOf();
  saveNow("settings");
  S.plan = planFromContent();
  saveNow("plan");
  for (const k of ["today", "timer"]) { S[k] = defaults(k); saveNow(k); }
  if (sessions) { S.sessions = defaults("sessions"); saveNow("sessions"); }
  if (reviews) { S.reviews = defaults("reviews"); saveNow("reviews"); }
  if (ratings) { for (const sk of S.skills.list) { sk.history = []; sk.tests = []; } save("skills"); }
  applySkillLevels();
  mapResources();
}

// The location changed: update built-in text that still reads as it was built (your edits stay).
export function relocalize(oldLoc) {
  const newLoc = S.settings.location;
  const at = (loc, fn) => { S.settings.location = loc; try { return fn(); } finally { S.settings.location = newLoc; } };
  let changed = 0;
  const swap = (obj, key, prev, next) => { if (obj[key] === prev && prev !== next) { obj[key] = next; changed++; } };

  for (const t of S.plan.tasks) {
    if (!BUILTIN.test(t.id)) continue;
    const prev = at(oldLoc, () => builtinText(t.id)), next = builtinText(t.id);
    if (!prev || !next) continue;
    swap(t, "title", prev.title, next.title);
    swap(t, "detail", prev.detail, next.detail);
    if (same(t.res, prev.res) && !same(prev.res, next.res)) { t.res = next.res; changed++; }
  }
  for (const w of S.plan.weeks) {
    const o = w.origWeek || w.n;
    const prev = at(oldLoc, () => builtinWeek(o)), next = builtinWeek(o);
    if (!prev || !next) continue;
    for (const k of ["theme", "goal", "deliv"]) swap(w, k, prev[k], next[k]);
  }
  save("plan");

  for (const r of S.resources.list) {
    const b = RESOURCES.find(x => x.id === r.id);
    if (!b || (r.src && r.src !== "built-in")) continue;
    swap(r, "title", at(oldLoc, () => fill(b.title)), fill(b.title));
    swap(r, "url", at(oldLoc, () => fill(b.url)), fill(b.url));
  }
  save("resources");

  const fresh = communities();
  for (const c of S.strategy.communities) {
    const f = fresh.find(x => x.id === c.id);
    if (c.builtIn && f) { Object.assign(c, f); changed++; }
  }
  save("strategy");

  const fixChecks = (list, built, p) => list.forEach(c => {
    const i = c.id.startsWith(p) ? parseInt(c.id.slice(p.length), 10) - 1 : -1;
    const b = built[i]; if (!b) return;
    for (const k of ["text", "why", "how"]) swap(c, k, at(oldLoc, () => fill(b[k] || "")), fill(b[k] || ""));
  });
  fixChecks(S.resume.checks || [], RESUME_CHECKS, "rc"); save("resume");
  fixChecks(S.linkedin.checks || [], LINKEDIN_CHECKS, "li"); save("linkedin");

  for (const c of S.portfolio.cases || []) {
    const b = STARTER_CASES.find(x => x.id === c.id); if (!b) continue;
    swap(c, "title", at(oldLoc, () => fill(b.title)), fill(b.title));
    swap(c, "problem", at(oldLoc, () => fill(b.problem || "")), fill(b.problem || ""));
  }
  save("portfolio");

  for (const sk of S.skills.list) {
    const d = SKILL_DETAILS[sk.id]; if (!d) continue;
    swap(sk, "proof", at(oldLoc, () => fill(d.proof || "")), fill(d.proof || ""));
    (sk.projects || []).forEach((p, i) => {
      const bp = d.projects && d.projects[i]; if (!bp) return;
      swap(p, "title", at(oldLoc, () => fill(bp.t)), fill(bp.t));
      const ps = at(oldLoc, () => bp.steps.map(fill)), ns = bp.steps.map(fill);
      if (same(p.steps, ps) && !same(ps, ns)) { p.steps = ns; changed++; }
    });
  }
  save("skills");
  return changed;
}

