// Builds the weekly plan around the person's profile (Settings → About you).
//
// With no profile the plan is the built-in 25-week plan, unchanged. With a profile:
// - learning tasks for skills already at or above their target are skipped,
// - skills marked as a focus get a higher target (and keep all their tasks),
// - setup tasks for things the person already has (resume, LinkedIn, portfolio site) are skipped,
// - "Learning only" drops the job-search (Apply) tasks and weekly goals,
// - the remaining tasks are packed, in order, into weeks of the chosen number of hours.
// Every task keeps its built-in id, so ticks and logged time survive a rebuild.

import { WEEKS, WEEK_HOURS } from "./plan-data.js";
import { SKILLS } from "./content.js";
import { fill } from "./locale.js";

export const MODES = { search: "Job search and skills", learn: "Learning only (not applying yet)" };
export const HAVES = [
  ["resume", "A resume I'm happy with", "Skips the resume rewrite in week 1."],
  ["linkedin", "An up-to-date LinkedIn profile", "Skips the LinkedIn update."],
  ["portfolio", "A live portfolio site", "Skips building the site skeleton. Case studies stay in the plan."]
];
export const LEVEL_WORDS = ["New to it", "Aware", "Basic", "Working knowledge", "Strong", "Expert"];

export function defaultMe() {
  return { hours: WEEK_HOURS, levels: {}, focus: [], have: [], mode: "search", built: false };
}
export function normMe(m) {
  const d = defaultMe();
  const o = { ...d, ...(m && typeof m === "object" ? m : {}) };
  o.hours = Math.max(5, Math.min(60, Number(o.hours) || WEEK_HOURS));
  o.levels = o.levels && typeof o.levels === "object" ? o.levels : {};
  o.focus = Array.isArray(o.focus) ? o.focus : [];
  o.have = Array.isArray(o.have) ? o.have : [];
  if (!MODES[o.mode]) o.mode = "search";
  return o;
}

export const levelOf = (me, id) => Math.max(0, Math.min(5, Number(me?.levels?.[id]) || 0));
export function targetOf(me, s) {
  const base = s.target;
  return me && me.focus.includes(s.id) ? Math.min(5, base + 1) : base;
}
// True when nothing in the profile changes the plan.
export function isDefault(me) {
  return !me || (me.hours === WEEK_HOURS && me.mode === "search" && !me.have.length && !me.focus.length &&
    !SKILLS.some(s => levelOf(me, s.id) >= s.target));
}

const HAVE_SKIP = {
  resume: t => t.item === "b-resume",
  linkedin: t => t.title === "Update LinkedIn",
  portfolio: t => t.item === "b-skeleton"
};

// Why a built-in task is left out, or "" when it stays.
export function skipReason(t, me) {
  if (!me) return "";
  if (me.mode === "learn" && t.track === "apply") return "Learning only";
  for (const k of me.have) if (HAVE_SKIP[k] && HAVE_SKIP[k](t)) return "Already done";
  if (t.track === "learn" && t.skills.length) {
    const strong = t.skills.every(id => {
      const s = SKILLS.find(x => x.id === id);
      return s && !me.focus.includes(id) && levelOf(me, id) >= targetOf(me, s);
    });
    if (strong) return "Skill already at target";
  }
  return "";
}

const taskFrom = (w, t, i) => ({
  id: `w${w.n}-t${String(i + 1).padStart(2, "0")}`,
  week: w.n, origWeek: w.n, track: t.track, title: fill(t.title), detail: fill(t.detail), hours: t.hours,
  res: t.res.map(x => ({ l: fill(x.l), u: fill(x.u) })), skills: [...t.skills],
  item: t.item || "", part: t.part || 0, parts: t.parts || 0, total: t.total || 0, search: !!t.search,
  done: false, doneAt: "", dropped: false, carriedFrom: 0, carryPending: false, order: i
});
const weekFrom = (w, n) => ({
  n, origWeek: w.n, phase: w.phase, theme: fill(w.theme), goal: fill(w.goal), deliv: fill(w.deliv),
  skills: [...w.skills], study: (w.study || []).map(x => ({ t: fill(x.t), w: fill(x.w), q: x.q })),
  split: { ...w.split }, goals: { ...w.goals }, notes: ""
});

// Built-in text for one task id, filled for the current location (used when the location changes).
export function builtinText(id) {
  const m = /^w(\d+)-t(\d+)$/.exec(id || "");
  if (!m) return null;
  const w = WEEKS.find(x => x.n === +m[1]);
  const t = w && w.tasks[+m[2] - 1];
  return t ? { title: fill(t.title), detail: fill(t.detail), res: t.res.map(x => ({ l: fill(x.l), u: fill(x.u) })) } : null;
}
export function builtinWeek(orig) {
  const w = WEEKS.find(x => x.n === orig);
  return w ? { theme: fill(w.theme), goal: fill(w.goal), deliv: fill(w.deliv), study: (w.study || []).map(x => ({ t: fill(x.t), w: fill(x.w), q: x.q })) } : null;
}

// The plan for a profile: { weeks, tasks, weekMap } where weekMap maps built-in week → plan week.
export function buildPlan(me) {
  me = normMe(me);
  if (isDefault(me)) {
    const weeks = WEEKS.map(w => weekFrom(w, w.n));
    const tasks = [];
    for (const w of WEEKS) w.tasks.forEach((t, i) => tasks.push(taskFrom(w, t, i)));
    return { weeks, tasks, weekMap: Object.fromEntries(WEEKS.map(w => [w.n, w.n])), skipped: 0 };
  }
  const B = me.hours;
  const weeks = [], tasks = [], weekMap = {};
  let cur = null, used = 0, skipped = 0;
  const open = w => {
    cur = weekFrom(w, weeks.length + 1);
    cur.split = { learn: 0, build: 0, practice: 0, apply: 0 };
    cur.goals = { apps: 0, chats: 0, events: 0, refs: 0 };
    cur.from = [w.n];
    weeks.push(cur); used = 0;
  };
  const gone = {}; // built-in week → titles of its tasks left out
  for (const w of WEEKS) {
    w.tasks.forEach((t, i) => {
      if (skipReason(t, me)) { skipped++; (gone[w.n] = gone[w.n] || []).push(t.title); return; }
      if (!cur) open(w);
      else if (used > 0 && used + t.hours > B + Math.min(2, t.hours / 2)) open(w);
      const task = taskFrom(w, t, i);
      task.week = cur.n; task.order = tasks.filter(x => x.week === cur.n).length;
      tasks.push(task);
      used += t.hours;
      cur.split[t.track] = (cur.split[t.track] || 0) + t.hours;
      if (!cur.from.includes(w.n)) cur.from.push(w.n);
      if (weekMap[w.n] == null) weekMap[w.n] = cur.n;
    });
  }
  if (!weeks.length) open(WEEKS[0]);
  // Weekly goals: the job-search rhythm of the built-in weeks each plan week covers,
  // scaled to the hours (fewer hours, lighter goals).
  for (const wk of weeks) {
    if (me.mode === "learn") continue;
    const src = wk.from.map(n => WEEKS.find(x => x.n === n)).filter(Boolean);
    const scale = Math.min(1.5, B / WEEK_HOURS);
    for (const k of ["apps", "chats", "events", "refs"]) {
      const v = Math.max(...src.map(x => x.goals[k] || 0));
      wk.goals[k] = Math.round(v * scale);
    }
    delete wk.from;
  }
  // Goal lines name the week's deliverables: drop the ones that were left out ("Done by Sunday: Resume v1; Portfolio plan.").
  for (const wk of weeks) {
    const out = gone[wk.origWeek] || [];
    if (!out.length) continue;
    wk.goal = stripItems(wk.goal, out, /;\s*/, "; ", "Done by Sunday: ");
    wk.deliv = stripItems(wk.deliv, out, /\s*·\s*/, " · ", "");
  }
  weeks.forEach(wk => { delete wk.from; for (const k of Object.keys(wk.split)) wk.split[k] = Math.round(wk.split[k] * 4) / 4; });
  // Built-in weeks whose tasks were all skipped point at the next plan week that exists.
  let last = 1;
  for (const w of WEEKS) { if (weekMap[w.n] == null) weekMap[w.n] = last; else last = weekMap[w.n]; }
  return { weeks, tasks, weekMap, skipped };
}

function stripItems(text, titles, split, join, prefix) {
  if (!text) return text;
  const pre = prefix && text.startsWith(prefix) ? prefix : "";
  const body = text.slice(pre.length).replace(/\.$/, "");
  const kept = body.split(split).filter(x => !titles.some(t => x.trim().toLowerCase() === t.toLowerCase()));
  if (!kept.length) return pre ? "Done by Sunday: this week's tasks." : "";
  return pre + kept.join(join) + (text.endsWith(".") ? "." : "");
}

// Map a built-in week number (resource weeks, the mock-interview target) onto the current plan.
export function mapWeek(plan, orig) {
  const m = plan && plan.weekMap;
  const n = m && m[orig] != null ? m[orig] : orig;
  return Math.max(1, Math.min(n, plan && plan.weeks ? plan.weeks.length : n));
}

// The span of weeks each phase covers in the current plan.
export function phaseSpan(plan, id) {
  const ns = (plan?.weeks || []).filter(w => w.phase === id).map(w => w.n);
  return ns.length ? { from: Math.min(...ns), to: Math.max(...ns) } : null;
}
