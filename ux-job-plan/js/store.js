// State, saving and backup.
// Data lives in one owner-only document per section ("hj/<key>") with a
// copy in localStorage so the page opens instantly and still works offline.

import { SKILLS, PLAN_VERSION } from "./content.js";
import { buildPlan, defaultMe, normMe, levelOf, targetOf, mapWeek, builtinText, builtinWeek } from "./personalize.js";
import { fill } from "./locale.js";
import { RES_WEEK } from "./plan-data.js";
import { presetDesign, normDesign } from "./resume-design.js";
import { RESOURCES, SKILL_DETAILS } from "./content2.js";
import { PREV_IDS, PREV_TITLES } from "./plan-data.js";
import { starterResume, RESUME_CHECKS, LINKEDIN_CHECKS, CASE_CHECKS, CASE_SECTIONS, STARTER_CASES, RETIRED_CASES, SITE_PAGES, SITE_LAUNCH, TAILOR_RULES, LINKEDIN_RULES, PROFILE_SUMMARY } from "./content3.js";
import { COMPANY_SEED, PRES_LONG, PRES_SHORT, TEMPLATES, communities, V1_SHARES, GOAL_DEFAULT, GOAL_OLD_DEFAULT, MOCK_TARGET } from "./content4.js";
import { clone, debounce, today, parseYmd, addDays } from "./util.js";

export const KEYS = ["settings", "plan", "today", "timer", "sessions", "events", "skills", "apps", "resources", "reviews", "resume", "tailor", "linkedin", "portfolio", "companies", "interview", "stories", "practice", "network", "strategy", "feed", "evprep"];
// Week 1 starts on the Monday of the week the plan is first opened (or restarted).
export function mondayOf(ymd = today(), offsetWeeks = 0) {
  const d = parseYmd(ymd);
  const back = d ? (d.getDay() + 6) % 7 : 0;
  return addDays(ymd, -back + offsetWeeks * 7);
}
export const DEFAULT_START = mondayOf();
const LS = "uxjp:";
const DOC = k => "hj/" + k;
const MAX_BYTES = 240 * 1024;

export const S = {};
let db = null;
let ready = false;
let dbWritable = true;
let status = "loading";
const statusFns = new Set();
const remoteFns = new Set();
const known = {};
const writing = {};
const again = {};
const debouncers = {};
const errorFns = new Set();
const migrate = [];
const loaded = {};

// The plan for the current profile (Settings → About you). With no profile, the built-in plan.
export function planFromContent() {
  const me = normMe(S.settings && S.settings.me);
  const { weeks, tasks, weekMap } = buildPlan(me);
  return { v: PLAN_VERSION, weeks, tasks, weekMap, lastRollover: 1 };
}

// A plan saved before the long-term rebuild: start from the new plan and keep what's yours.
const BUILTIN_ID = /^w\d+-t\d+$/;
const baseTitle = t => (t || "").replace(/ · part \d+ of \d+$/, "").trim().toLowerCase();
function migratePlan(old, fresh) {
  const tasks = fresh.tasks;
  const weekMax = fresh.weeks.length;
  const open = new Map();
  for (const t of tasks) { const k = baseTitle(t.title); if (!open.has(k)) open.set(k, []); open.get(k).push(t); }
  const kept = [];
  for (const t of Array.isArray(old.tasks) ? old.tasks : []) {
    if (!BUILTIN_ID.test(t.id)) { kept.push({ ...t, week: Math.min(Math.max(1, t.week || 1), weekMax) }); continue; }
    if (!t.done) continue;
    // A finished built-in task: tick the matching new task (its first open part), or keep it as done history.
    const m = (open.get(baseTitle(t.title)) || []).find(x => !x.done);
    if (m) { m.done = true; m.doneAt = t.doneAt || ""; }
    else kept.push({ ...t, id: "old-" + t.id, week: Math.min(Math.max(1, t.week || 1), weekMax) });
  }
  const weeks = fresh.weeks.map(w => { const o = (Array.isArray(old.weeks) ? old.weeks : []).find(x => x.n === w.n); return o && o.notes ? { ...w, notes: o.notes } : w; });
  return { ...fresh, weeks, tasks: [...tasks, ...kept], lastRollover: old.lastRollover || 1, migratedFrom: old.v || 1 };
}

// Task ids from the previous plan version: point logged time, Today and the timer at the same work in this one.
// Work that no longer exists (the removed IxDF courses) keeps its title as a label instead.
const RETIRED_RES = new Set(["ixdf-ur", "ixdf-ut", "ixdf-pgu", "ixdf-data", "ixdf-ai", "ixdf-git", "ixdf-kpi", "ixdf-plp", "ixdf-port", "ixdf-a11y", "ixdf-uxess", "ixdf-vibe", "ixdf-mobile"]);
const prevId = id => (BUILTIN_ID.test(id || "") && Object.prototype.hasOwnProperty.call(PREV_IDS, id)) ? PREV_IDS[id] : id;
function remapRef(o, key, labelKey = "label") {
  const id = o[key]; if (!id || !BUILTIN_ID.test(id)) return o;
  const n = prevId(id);
  if (n) return { ...o, [key]: n };
  return { ...o, [key]: "", [labelKey]: o[labelKey] || PREV_TITLES[id] || "" };
}

let seq = 0;
const sid = p => p + (++seq).toString(36);
export function skillFromBase(s) {
  const d = SKILL_DETAILS[s.id] || {};
  const me = normMe(S.settings && S.settings.me);
  const lvl = levelOf(me, s.id);
  return {
    id: s.id, name: s.name, why: s.why || "", proof: fill(d.proof || ""), now: lvl, target: targetOf(me, s), start: lvl,
    history: [], tests: [], notes: "", custom: false,
    projects: (d.projects || []).map((p, i) => ({ id: `${s.id}-p${i + 1}`, title: fill(p.t), steps: p.steps.map(fill), status: "idea" })),
    practice: (d.practice || []).map((t, i) => ({ id: `${s.id}-x${i + 1}`, title: t, count: 0, last: "" })),
    interview: (d.interview || []).map((q, i) => ({ id: `${s.id}-q${i + 1}`, q: q.q, tip: q.tip })),
    bank: (d.bank || []).map(b => ({ q: b.q, o: [...b.o], a: b.a, why: b.why }))
  };
}
// Built-in resources: the week follows the current plan; titles and links follow the location.
const resWeek = r => (RES_WEEK[r.id] != null && S.plan ? mapWeek(S.plan, RES_WEEK[r.id]) : r.week);
export const resFromBase = r => ({ ...r, title: fill(r.title), url: fill(r.url), week: resWeek(r), units: r.units ? { ...r.units } : null, status: "todo", notes: "", rating: 0, started: "", finished: "", last: "", checked: true, src: "built-in" });
export { sid };

const checks = (arr, p) => arr.map((c, i) => ({ id: `${p}${i + 1}`, text: fill(c.text), why: fill(c.why || ""), how: fill(c.how || ""), done: false }));
const list = (arr, p) => arr.map((t, i) => ({ id: `${p}${i + 1}`, text: t, done: false }));
export function newCase(c) {
  return {
    id: c.id, title: fill(c.title), status: c.status || "idea", archived: false,
    product: c.product || "", role: c.role || "", team: c.team || "", timeline: c.timeline || "", problem: fill(c.problem || ""), goal: c.goal || "",
    skills: [...(c.skills || [])], next: c.next || "",
    sections: CASE_SECTIONS.map(([key, title]) => ({ key, title, notes: "", done: false })),
    checklist: list(CASE_CHECKS, `${c.id}-c`),
    links: { figma: "", prototype: "", images: "", url: "" },
    plan: { outline: [], tasks: [] }, considerations: "", considerationsAi: false, review: [], reviewAt: "", feedback: ""
  };
}
function defaultResume() {
  const p = (S.settings && S.settings.profile) || {};
  const loc = S.settings && S.settings.location && S.settings.location.city ? fill("{cityFull}") : "";
  const master = starterResume({ name: p.name || "", title: p.role || "Product Designer", location: loc });
  const clone = o => JSON.parse(JSON.stringify(o));
  const mobile = clone(master); mobile.id = "v-mobile"; mobile.name = "Mobile-focused";
  const web = clone(master); web.id = "v-web"; web.name = "Web / dashboard-focused";
  return { versions: [master, mobile, web], current: "master", style: "clean", design: presetDesign("clean"), checks: checks(RESUME_CHECKS, "rc") };
}

export function defaults(key) {
  switch (key) {
    case "settings": return {
      startDate: mondayOf(), theme: "system", hours: { learn: 8, build: 12, practice: 6, apply: 9 },
      aiOn: !!(typeof window !== "undefined" && window.claude), setupHidden: false,
      profile: { name: "", role: "", target: "", summary: PROFILE_SUMMARY },
      location: { city: "", region: "", country: "", nearby: "", remote: false },
      me: defaultMe()
    };
    case "plan": return planFromContent();
    case "today": return { date: "", ids: [], carried: [] };
    case "timer": return { running: false, start: 0, acc: 0, focus: null };
    case "sessions": return { list: [] };
    case "events": return { list: [] };
    case "skills": return { list: SKILLS.map(s => skillFromBase(s)), removed: [] };
    case "apps": return { list: [] };
    case "resources": return { list: RESOURCES.map(resFromBase), removed: [], planV: PLAN_VERSION };
    case "reviews": return { weeks: {} };
    case "resume": return defaultResume();
    case "tailor": return { current: null, history: [], rules: { may: [...TAILOR_RULES.may], never: [...TAILOR_RULES.never] } };
    case "linkedin": return { checks: checks(LINKEDIN_CHECKS, "li"), drafts: { headline: "", about: "", skills: "", featured: "" }, rules: [...LINKEDIN_RULES], posts: [] };
    case "portfolio": return { cases: STARTER_CASES.map(newCase), site: { platform: "", url: "", domain: "", status: "todo", pages: list(SITE_PAGES, "pg"), launch: list(SITE_LAUNCH, "ln") } };
    case "companies": return { list: clone(COMPANY_SEED), removed: [] };
    case "interview": return { pres: { long: clone(PRES_LONG), short: clone(PRES_SHORT) }, prompts: [], answers: { intro: "", why: "", salary: "", start: "", qs: "" }, types: {}, mocks: [], mockTarget: MOCK_TARGET };
    case "stories": return { questions: [], list: [] };
    case "practice": return { list: [] };
    case "network": return { contacts: [], referrals: [], templates: clone(TEMPLATES) };
    case "strategy": return { shares: { ...V1_SHARES }, goals: { ...GOAL_DEFAULT }, communities: communities(), removedCommunities: [], hintsOff: [] };
    // What's new: likes (with a copy of the item, so it survives old weeks being cleared) and read marks.
    case "feed": return { liked: {}, read: {}, seenRun: "" };
    // Events: the answers and the prep plan for each event, keyed by event id.
    case "evprep": return { map: {} };
  }
  return {};
}

function readLocal(key) {
  try { const v = localStorage.getItem(LS + key); return v ? JSON.parse(v) : null; } catch { return null; }
}
function writeLocal(key) {
  try { localStorage.setItem(LS + key, JSON.stringify(S[key])); } catch { /* storage full or blocked */ }
}

function setStatus(s) { status = s; statusFns.forEach(f => f(s)); }
export const getStatus = () => status;
export const onStatus = f => { statusFns.add(f); f(status); };
export const onRemote = f => remoteFns.add(f);
export const onSaveError = f => errorFns.add(f);
export const isReady = () => ready;

function validShape(key, v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  if (key === "plan") return Array.isArray(v.weeks) && Array.isArray(v.tasks);
  if (["sessions", "events", "skills", "apps", "resources", "companies", "practice"].includes(key)) return Array.isArray(v.list);
  if (key === "today") return Array.isArray(v.ids);
  return true;
}

// Fill in fields added in later versions without touching saved values.
function normalize(key, v) {
  const d = defaults(key);
  if (key === "settings") {
    const profile = { ...d.profile, ...(v.profile || {}) };
    const location = { ...d.location, ...(v.location || {}) };
    return { ...d, ...v, hours: { ...d.hours, ...(v.hours || {}) }, profile, location, me: normMe(v.me) };
  }
  if (key === "plan") {
    if (v.v !== PLAN_VERSION) return migratePlan(v, d);
    return { ...d, ...v, weeks: v.weeks.map(w => ({ phase: 0, split: null, goals: null, ...w })) };
  }
  if (key === "today") {
    let ids = v.ids.slice(), carried = Array.isArray(v.carried) ? v.carried.slice() : [];
    if (v.planV !== PLAN_VERSION) { const m = a => [...new Set(a.map(prevId).filter(Boolean))]; ids = m(ids); carried = m(carried); }
    return { ...d, ...v, ids, carried, planV: PLAN_VERSION };
  }
  if (key === "timer") {
    const out = { ...d, ...v, planV: PLAN_VERSION };
    if (v.planV !== PLAN_VERSION && out.focus && out.focus.kind === "task") out.focus = remapRef(out.focus, "id");
    return out;
  }
  if (key === "sessions") {
    const list = v.planV !== PLAN_VERSION ? v.list.map(x => x && typeof x === "object" ? remapRef(x, "taskId") : x) : v.list;
    return { ...d, ...v, list, planV: PLAN_VERSION };
  }
  if (key === "skills") {
    const removed = Array.isArray(v.removed) ? v.removed : [];
    const base = Object.fromEntries(d.list.map(x => [x.id, x]));
    const list = v.list.map(x => {
      const b = base[x.id];
      if (!b) return { history: [], tests: [], notes: "", projects: [], practice: [], interview: [], bank: [], proof: "", start: x.now, ...x };
      const out = { ...b, ...x };
      for (const f of ["projects", "practice", "interview", "bank", "history", "tests"]) if (!Array.isArray(x[f])) out[f] = b[f];
      if (out.start == null) out.start = b.start;
      return out;
    });
    for (const b of d.list) if (!list.some(x => x.id === b.id) && !removed.includes(b.id)) list.push(b);
    return { list, removed };
  }
  if (key === "resources") {
    const removed = Array.isArray(v.removed) ? v.removed : [];
    const builtIn = x => !x.src || x.src === "built-in";
    // IxDF courses are no longer recommended: take the built-in ones out of the library.
    const list = v.planV !== PLAN_VERSION ? v.list.filter(x => !(RETIRED_RES.has(x.id) && builtIn(x))) : v.list.slice();
    for (const b of d.list) if (!list.some(x => x.id === b.id) && !removed.includes(b.id)) list.push(b);
    // A new plan version moves resources to new weeks: refresh the week on built-in ones, once.
    if (v.planV !== PLAN_VERSION) for (const x of list) { const b = d.list.find(y => y.id === x.id); if (b && builtIn(x)) { x.week = b.week; if (!x.units && b.units) x.units = clone(b.units); } }
    return { list, removed, planV: PLAN_VERSION };
  }
  if (key === "reviews") return { weeks: v.weeks && typeof v.weeks === "object" ? v.weeks : {} };
  if (key === "resume" || key === "linkedin") {
    const out = { ...d, ...v };
    const m = mergeBuiltins(Array.isArray(v.checks) ? v.checks : d.checks, d.checks, v.seenChecks, key === "resume" ? 11 : 8);
    out.checks = m.items; out.seenChecks = m.seen;
    // The resume's look: one design object for the preview, PDF and Word. Older saves only had a style name.
    if (key === "resume") { out.design = normDesign(v.design || v.style || "clean"); out.style = out.design.preset; }
    return out;
  }
  if (key === "portfolio" && Array.isArray(v.cases)) {
    const seen = new Set(Array.isArray(v.seenStarters) ? v.seenStarters : ["cs-transit"]);
    const kept = v.cases.filter(c => !RETIRED_CASES.includes(c.id));
    for (const sc of d.cases) if (!seen.has(sc.id) && !kept.some(c => c.id === sc.id)) kept.push(sc);
    const site = v.site && Array.isArray(v.site.pages) ? { ...v.site, pages: v.site.pages.filter(pg => !/work under NDA/.test(pg.text)) } : v.site;
    v = { ...v, site, seenStarters: [...new Set([...seen, ...d.cases.map(c => c.id)])] };
    const cases = kept.map(c => {
      if (!Array.isArray(c.checklist)) return c;
      const built = newCase({ id: c.id, title: c.title }).checklist;
      const m = mergeBuiltins(c.checklist, built, c.seenChecks, 10);
      return { ...c, checklist: m.items, seenChecks: m.seen };
    });
    return { ...d, ...v, cases };
  }
  if (key === "apps") return { ...d, ...v, list: v.list.map(normApp) };
  if (key === "evprep") {
    const map = v.map && typeof v.map === "object" && !Array.isArray(v.map) ? v.map : {};
    for (const [k, p] of Object.entries(map)) {
      if (!p || typeof p !== "object") { delete map[k]; continue; }
      p.ask = { goals: Array.isArray(p.ask?.goals) ? p.ask.goals : [], level: p.ask?.level || "some", extra: p.ask?.extra || "" };
      p.done = p.done && typeof p.done === "object" ? p.done : {};
      p.tasks = p.tasks && typeof p.tasks === "object" ? p.tasks : {};
      if (p.result && !Array.isArray(p.result.steps)) p.result = null;
    }
    return { ...d, ...v, map };
  }
  if (key === "feed") {
    const obj = x => x && typeof x === "object" && !Array.isArray(x) ? x : {};
    return { ...d, ...v, liked: obj(v.liked), read: obj(v.read), seenRun: typeof v.seenRun === "string" ? v.seenRun : "" };
  }
  if (key === "companies") {
    const removed = Array.isArray(v.removed) ? v.removed : [];
    const list = v.list.map(c => ({ ...{ tier: "2", careers: "", fit: "", target: true, loop: null, contact: "", next: "", nextDate: "", notes: "", builtIn: false }, ...c }));
    for (const b of d.list) if (!list.some(x => x.id === b.id) && !removed.includes(b.id)) list.push(b);
    return { list, removed };
  }
  if (key === "interview") return { ...d, ...v, pres: { ...d.pres, ...(v.pres || {}) }, answers: { ...d.answers, ...(v.answers || {}) }, types: v.types && typeof v.types === "object" ? v.types : {}, mocks: Array.isArray(v.mocks) ? v.mocks : [], prompts: Array.isArray(v.prompts) ? v.prompts : [] };
  if (key === "stories") return { questions: Array.isArray(v.questions) ? v.questions : [], list: Array.isArray(v.list) ? v.list : [] };
  if (key === "network") return { ...d, ...v, contacts: Array.isArray(v.contacts) ? v.contacts : [], referrals: Array.isArray(v.referrals) ? v.referrals : [], templates: Array.isArray(v.templates) ? v.templates : d.templates };
  if (key === "strategy") {
    const removed = Array.isArray(v.removedCommunities) ? v.removedCommunities : [];
    const communities = Array.isArray(v.communities) ? v.communities.slice() : [];
    for (const b of d.communities) if (!communities.some(x => x.id === b.id) && !removed.includes(b.id)) communities.push(b);
    let goals = { ...d.goals, ...(v.goals || {}) };
    if (Object.keys(GOAL_OLD_DEFAULT).every(k => goals[k] === GOAL_OLD_DEFAULT[k])) goals = { ...GOAL_DEFAULT };
    return { ...d, ...v, shares: { ...d.shares, ...(v.shares || {}) }, goals, communities, removedCommunities: removed, hintsOff: Array.isArray(v.hintsOff) ? v.hintsOff : [] };
  }
  return { ...d, ...v };
}

// Applications gained fields in Stage 4; Resume Tailor creates the short form.
const APP_PIPE = ["Saved", "Applied", "Recruiter screen", "Interviewing", "Final round", "Offer"];
export function normApp(a) {
  const out = { company: "", companyId: "", role: "", tier: "", status: "Saved", link: "", description: "", source: "", referral: "", pay: "", location: "", posted: "", appliedAt: "", created: "", tailoredId: "", resumeId: "", next: "", nextDate: "", interviews: [], log: [], reached: 0, notes: "", ai: null, ...a };
  if (!Array.isArray(out.interviews)) out.interviews = [];
  if (!Array.isArray(out.log)) out.log = [];
  if (!out.log.length && out.status) out.log = [{ s: out.status, d: out.appliedAt || out.created || "" }];
  out.reached = Math.max(out.reached || 0, APP_PIPE.indexOf(out.status), ...out.log.map(l => APP_PIPE.indexOf(l.s)));
  return out;
}

// Adds built-in checklist items added in later versions. Items the person deleted stay deleted:
// "seen" records every built-in id they've already had. Data saved before "seen" existed had
// the first `legacy` built-ins (Stage 3), so those count as seen.
function mergeBuiltins(items, builtins, seen, legacy) {
  const have = new Set(items.map(x => x.id));
  const known = new Set(Array.isArray(seen) ? seen : [...items.map(x => x.id), ...builtins.slice(0, legacy).map(b => b.id)]);
  const out = items.slice();
  for (const b of builtins) if (!have.has(b.id) && !known.has(b.id)) out.push({ ...b });
  return { items: out, seen: [...new Set([...known, ...builtins.map(b => b.id)])] };
}

function withTimeout(p, ms) {
  return Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
}

export async function init() {
  const cached = {};
  for (const k of KEYS) {
    const v = readLocal(k);
    cached[k] = v && validShape(k, v) ? v : null;
    S[k] = normalize(k, cached[k] || defaults(k));
  }
  try {
    if (window.claude && typeof window.claude.use === "function") db = await withTimeout(window.claude.use("db"), 10000);
  } catch { db = null; }
  if (!db) { ready = true; setStatus("local"); void loadPublicFeed(); return; }

  await new Promise(resolve => {
    let left = KEYS.length;
    const seen = loaded;
    const done = () => {
      if (--left === 0) { clearTimeout(timer); if (status === "slow") setStatus("synced"); resolve(); }
    };
    const timer = setTimeout(() => { setStatus("slow"); resolve(); }, 10000);
    for (const k of KEYS) {
      let ref;
      try { ref = db.doc(DOC(k)); } catch { done(); continue; }
      ref.onSnapshot(snap => {
        if (!seen[k]) {
          if (snap.metadata.fromCache && !snap.exists) return; // wait for the store to answer
          seen[k] = true;
          if (snap.exists) apply(k, snap.data(), ready);
          else if (cached[k]) migrate.push(k); // this device has data the store doesn't: copy it up
          done();
          return;
        }
        if (snap.metadata.hasPendingWrites || writing[k] || debouncers[k]?.pending || !snap.exists) return;
        apply(k, snap.data(), ready);
      }, err => {
        if (!seen[k]) { seen[k] = true; done(); }
        if (err && (err.code === "revoked" || err.code === "not_granted")) { db = null; setStatus("local"); }
      });
    }
  });
  ready = true;
  if (db && status !== "slow") setStatus("synced");
  for (const k of migrate) save(k);
  subscribeFeed();
}

// ---------- What's new ----------
const FEED_LS = LS + "feedruns";
const PUBLIC_FEED_LS = LS + "publicfeed";
function readFeed(key) {
  try { const v = JSON.parse(localStorage.getItem(key) || "null"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
let feedRuns = readFeed(FEED_LS);
let feedState = "idle";
let feedSource = "claude";
export const getFeedRuns = () => feedRuns;
export const getFeedState = () => feedState;
export const getFeedSource = () => feedSource;

async function loadPublicFeed() {
  feedSource = "public";
  feedRuns = readFeed(PUBLIC_FEED_LS);
  feedState = "loading";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(new URL("../data/updates.json", import.meta.url), { signal: controller.signal });
    if (!response.ok) throw new Error(`Feed HTTP ${response.status}`);
    const runs = await response.json();
    if (!Array.isArray(runs) || !runs.length || !runs.every(r => r && typeof r.run === "string" && Array.isArray(r.items))) throw new Error("Invalid feed");
    feedRuns = runs;
    feedState = "ready";
    try { localStorage.setItem(PUBLIC_FEED_LS, JSON.stringify(feedRuns)); } catch { /* storage full */ }
  } catch { feedState = "error"; }
  finally { clearTimeout(timeout); }
  remoteFns.forEach(f => f("feedruns"));
}

function subscribeFeed() {
  if (!db) { void loadPublicFeed(); return; }
  feedState = "loading";
  const timer = setTimeout(() => { if (feedState === "loading") { feedState = "slow"; remoteFns.forEach(f => f("feedruns")); } }, 10000);
  try {
    db.collection("feed").orderBy("run", "desc").limit(26).onSnapshot(snap => {
      if (snap.metadata.fromCache && snap.empty) return;
      if (!snap.metadata.fromCache) clearTimeout(timer);
      feedRuns = snap.docs.map(d => ({ ...d.data(), _id: d.id })).filter(r => r && Array.isArray(r.items));
      feedState = snap.metadata.fromCache ? "cached" : "ready";
      try { localStorage.setItem(FEED_LS, JSON.stringify(feedRuns)); } catch { /* storage full */ }
      remoteFns.forEach(f => f("feedruns"));
    }, () => { clearTimeout(timer); feedState = "error"; remoteFns.forEach(f => f("feedruns")); });
  } catch { clearTimeout(timer); feedState = "error"; }
}

function apply(k, v, notify) {
  if (!validShape(k, v)) return;
  const json = JSON.stringify(v);
  if (json === known[k]) return;
  known[k] = json;
  S[k] = normalize(k, clone(v));
  writeLocal(k);
  if (notify) remoteFns.forEach(f => f(k));
}

async function flush(key) {
  if (!db || !dbWritable) return;
  if (!loaded[key]) { setTimeout(() => flush(key), 3000); return; } // never write over data not read yet
  if (writing[key]) { again[key] = true; return; }
  const json = JSON.stringify(S[key]);
  if (json === known[key]) return;
  if (json.length > MAX_BYTES) { errorFns.forEach(f => f("too_big", key)); return; }
  writing[key] = true;
  setStatus("saving");
  try {
    await setWithRetry(key, JSON.parse(json));
    known[key] = json;
    setStatus("synced");
  } catch (e) {
    const code = e && e.code;
    if (code === "invalid_argument" || code === "not_granted" || code === "revoked") { dbWritable = false; setStatus("local"); }
    else setStatus("offline");
    errorFns.forEach(f => f(code || "unavailable", key));
  } finally {
    writing[key] = false;
    if (again[key]) { again[key] = false; flush(key); }
  }
}

async function setWithRetry(key, body) {
  const ref = db.doc(DOC(key));
  try { await ref.set(body); }
  catch (e) {
    if (e && e.code === "unavailable") { await new Promise(r => setTimeout(r, 600 + Math.random() * 900)); await ref.set(body); }
    else throw e;
  }
}

export function save(key) {
  writeLocal(key);
  if (!db || !ready) return;
  if (!debouncers[key]) {
    const d = debounce(() => { d.pending = false; flush(key); }, 700);
    debouncers[key] = d;
  }
  debouncers[key].pending = true;
  debouncers[key]();
}

export function saveNow(key) {
  writeLocal(key);
  if (!db || !ready) return;
  if (debouncers[key]) debouncers[key].pending = false;
  flush(key);
}

export function flushAll() {
  for (const k of KEYS) if (debouncers[k]?.pending) { debouncers[k].pending = false; debouncers[k].flush(); }
}

export const hasCloud = () => !!db && dbWritable;

// ---- Practice transcripts: one document each ("hjt/<id>"), so long transcripts never crowd the index ----
const TX = "sjp2:t:";
const txMem = {};
export async function txGet(id) {
  if (txMem[id] != null) return txMem[id];
  let text = null;
  try { const v = localStorage.getItem(TX + id); if (v != null) text = v; } catch { /* blocked */ }
  if (db) {
    try {
      const snap = await withTimeout(db.doc("hjt/" + id).get(), 8000);
      if (snap && snap.exists) { const d = snap.data(); if (d && typeof d.text === "string") text = d.text; }
    } catch { /* keep the local copy */ }
  }
  if (text != null) { txMem[id] = text; try { localStorage.setItem(TX + id, text); } catch { /* full */ } }
  return text || "";
}
export async function txSet(id, text) {
  txMem[id] = text;
  try { localStorage.setItem(TX + id, text); } catch { /* full */ }
  if (!db || !dbWritable) return;
  try { await db.doc("hjt/" + id).set({ text: text.slice(0, 200000), at: new Date().toISOString() }); }
  catch (e) { errorFns.forEach(f => f((e && e.code) || "unavailable", "practice")); }
}
export async function txDel(id) {
  delete txMem[id];
  try { localStorage.removeItem(TX + id); } catch { /* blocked */ }
  if (db && dbWritable) { try { await db.doc("hjt/" + id).delete(); } catch { /* already gone */ } }
}
export async function backupFull() {
  const b = backup();
  const ids = (S.practice?.list || []).filter(p => p.hasTx).map(p => p.id);
  const tx = {};
  for (const id of ids) { const t = await txGet(id); if (t) tx[id] = t; }
  if (Object.keys(tx).length) b.transcripts = tx;
  return b;
}

// ---- Backup and restore ----
export function backup() {
  const data = {};
  for (const k of KEYS) data[k] = S[k];
  return { app: "ux-job-plan", version: 2, exportedAt: new Date().toISOString(), data };
}

export function inspectBackup(obj) {
  if (!obj || typeof obj !== "object" || !obj.data || typeof obj.data !== "object") return { ok: false, reason: "This file isn't a UX Job Search Plan backup." };
  const found = KEYS.filter(k => validShape(k, obj.data[k]));
  if (!found.length) return { ok: false, reason: "The backup has no sections this tool can read." };
  const d = obj.data;
  return {
    ok: true, keys: found, exportedAt: obj.exportedAt || "",
    counts: {
      tasks: d.plan?.tasks?.length ?? 0,
      done: d.plan?.tasks?.filter(t => t.done).length ?? 0,
      sessions: d.sessions?.list?.length ?? 0,
      events: d.events?.list?.length ?? 0,
      apps: d.apps?.list?.length ?? 0,
      stories: d.stories?.list?.length ?? 0,
      practice: d.practice?.list?.length ?? 0
    }
  };
}

export function restore(obj, keys) {
  for (const k of keys) {
    S[k] = normalize(k, clone(obj.data[k]));
    saveNow(k);
  }
  if (keys.includes("practice") && obj.transcripts && typeof obj.transcripts === "object") {
    for (const [id, text] of Object.entries(obj.transcripts)) if (typeof text === "string") txSet(id, text);
  }
}

export function resetKey(k) {
  S[k] = defaults(k);
  saveNow(k);
}
