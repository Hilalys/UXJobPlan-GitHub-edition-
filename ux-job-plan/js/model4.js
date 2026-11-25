// Stage 4 numbers: application funnel and rates, companies, weekly goals, follow-ups and hints.

import { S, save, normApp } from "./store.js";
import { APP_STATUS } from "./content.js";
import { TIERS, HINT_RULES, REPLY_GOAL, LOOP_ORDER } from "./content4.js";
import { today, addDays, daysBetween, sum, uid } from "./util.js";
import { currentWeek, inWeek, weekGoal, beforeStart } from "./model.js";

export const PIPE = ["Saved", "Applied", "Recruiter screen", "Interviewing", "Final round", "Offer"];
export const stageIdx = s => PIPE.indexOf(s);
const REPLY = ["Recruiter screen", "Interviewing", "Final round", "Offer", "Rejected"];
export const ACTIVE = ["Recruiter screen", "Interviewing", "Final round"];
export const CLOSED = ["Rejected", "Withdrawn"];

export const reachedOf = a => Math.max(a.reached || 0, stageIdx(a.status), ...(a.log || []).map(l => stageIdx(l.s)));
export const isSent = a => a.status !== "Saved" && !(a.status === "Withdrawn" && reachedOf(a) < 1 && !a.appliedAt);
export const hasReply = a => a.status === "Rejected" || reachedOf(a) >= 2;
export const isOpen = a => !CLOSED.includes(a.status);
export const appById = id => S.apps.list.find(a => a.id === id);

export function setAppStatus(a, s) {
  if (a.status === s) return;
  a.status = s;
  a.log = a.log || [];
  a.log.push({ s, d: today() });
  if (s !== "Saved" && s !== "Withdrawn" && !a.appliedAt) a.appliedAt = today();
  a.reached = reachedOf(a);
}
export function firstReplyDays(a) {
  if (!a.appliedAt) return null;
  const r = (a.log || []).find(l => REPLY.includes(l.s) && l.d);
  return r ? Math.max(0, daysBetween(a.appliedAt, r.d)) : null;
}

export function appStats(list = S.apps.list) {
  const sent = list.filter(isSent);
  const replied = sent.filter(hasReply);
  const ref = sent.filter(a => (a.referral || "").trim() || a.source === "Referral");
  const refReplied = ref.filter(hasReply);
  const days = sent.map(firstReplyDays).filter(d => d != null);
  return {
    sent: sent.length, replied: replied.length, rate: sent.length ? replied.length / sent.length : null,
    ref: ref.length, refReplied: refReplied.length, refRate: ref.length ? refReplied.length / ref.length : null,
    active: list.filter(a => ACTIVE.includes(a.status)).length,
    offers: list.filter(a => a.status === "Offer").length,
    avgDays: days.length ? sum(days) / days.length : null, daysN: days.length
  };
}
// How many reached each stage at some point.
export function funnel(list = S.apps.list) {
  const sent = list.filter(isSent);
  const steps = [["Applied", 1], ["Recruiter screen", 2], ["Interviewing", 3], ["Final round", 4], ["Offer", 5]];
  return steps.map(([label, i]) => ({ label, value: sent.filter(a => reachedOf(a) >= i).length }));
}
export function rateBy(key, labels) {
  const sent = S.apps.list.filter(isSent);
  return labels.map(([k, label]) => {
    const g = sent.filter(a => (a[key] || "") === k);
    const r = g.filter(hasReply).length;
    return { label, n: g.length, r, rate: g.length ? r / g.length : 0 };
  }).filter(x => x.n > 0);
}
export const tierOf = a => a.tier || companyFor(a)?.tier || "";

// ---------- Companies ----------
export const companyById = id => S.companies.list.find(c => c.id === id);
const norm = s => (s || "").toLowerCase().replace(/\s*\(.*?\)\s*/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
export function companyByName(name) {
  const n = norm(name);
  if (!n) return null;
  return S.companies.list.find(c => norm(c.name) === n) || S.companies.list.find(c => norm(c.name).split(" ")[0] === n.split(" ")[0] && n.split(" ")[0].length > 3) || null;
}
export function companyFor(a) {
  return (a.companyId && companyById(a.companyId)) || companyByName(a.company);
}
// The same record is used everywhere: adding an application for a new company adds it.
export function ensureCompany(name, tier = "2") {
  const hit = companyByName(name);
  if (hit) return hit;
  const c = { id: uid("co"), name: name.trim(), tier, careers: "", fit: "", builtIn: false, target: true, loop: null, contact: "", next: "", nextDate: "", notes: "" };
  S.companies.list.push(c); save("companies");
  return c;
}
export const appsFor = c => S.apps.list.filter(a => a.companyId === c.id || (!a.companyId && companyByName(a.company)?.id === c.id));
export const contactsFor = c => S.network.contacts.filter(x => x.companyId === c.id || (!x.companyId && companyByName(x.company)?.id === c.id));
export function loopCompanies() {
  const withLoop = S.companies.list.filter(c => c.loop && c.loop.steps?.length);
  return withLoop.sort((a, b) => {
    const ia = LOOP_ORDER.indexOf(a.id), ib = LOOP_ORDER.indexOf(b.id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.name.localeCompare(b.name);
  });
}
export function tierShares() {
  const sent = S.apps.list.filter(isSent);
  const by = { 1: 0, 2: 0, 3: 0 };
  for (const a of sent) { const t = tierOf(a); if (by[t] != null) by[t]++; }
  const n = sum(Object.values(by));
  return Object.keys(TIERS).map(k => ({ tier: k, n: by[k], share: n ? (by[k] / n) * 100 : 0, target: Number(S.strategy.shares[k]) || 0 }));
}

// ---------- This week's networking counts ----------
export function weekCounts(n = currentWeek()) {
  const ev = S.events.list.filter(e => inWeek(e.date, n) && e.status === "attended");
  return {
    apps: S.apps.list.filter(a => a.appliedAt && inWeek(a.appliedAt, n)).length,
    chats: ev.filter(e => e.type === "Coffee chat").length,
    events: ev.filter(e => ["Meetup", "Workshop", "Other"].includes(e.type)).length,
    refs: S.network.referrals.filter(r => r.date && inWeek(r.date, n) && r.status !== "toask").length,
    goal: weekGoal(n)
  };
}
// Applied within a day of the posting date, where they logged one.
export function fastApply() {
  const withPosted = S.apps.list.filter(a => a.posted && a.appliedAt);
  return { n: withPosted.length, fast: withPosted.filter(a => daysBetween(a.posted, a.appliedAt) <= 1).length };
}

// ---------- Follow-ups due (shown on Overview) ----------
export function dueItems(within = 7) {
  const t = today(), lim = addDays(t, within), out = [];
  const push = (kind, id, label, sub, date, href) => { if (date && date <= lim) out.push({ kind, id, label, sub, date, overdue: date < t, href }); };
  for (const a of S.apps.list) if (isOpen(a) && a.next) push("app", a.id, a.next, `${a.company}${a.role ? " · " + a.role : ""}`, a.nextDate, "#applications");
  for (const c of S.network.contacts) if (c.next) push("contact", c.id, c.next, `${c.name}${c.company ? " · " + c.company : ""}`, c.nextDate, "#strategy");
  for (const c of S.companies.list) if (c.next) push("company", c.id, c.next, c.name, c.nextDate, "#strategy");
  for (const r of S.network.referrals) if (r.status === "asked" && r.date && !r.followed) push("referral", r.id, "Follow up on referral ask", `${r.person || "Contact"} · ${r.company}`, addDays(r.date, 7), "#strategy");
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ---------- Hints from their own numbers ----------
export function hints() {
  const st = appStats(), off = new Set(S.strategy.hintsOff || []);
  const sent = S.apps.list.filter(isSent);
  const reach = i => sent.filter(a => reachedOf(a) >= i).length;
  const out = [];
  const add = (key, level = "warn") => { if (!off.has(key)) out.push({ key, text: HINT_RULES[key], level }); };
  if (st.sent >= 20 && st.replied === 0) add("noReplies");
  else if (st.sent >= 12 && st.rate != null && st.rate < REPLY_GOAL) add("lowReply");
  if (reach(2) >= 3 && reach(3) === 0) add("screensNoPortfolio");
  if (reach(3) >= 3 && reach(4) === 0) add("portfolioNoOnsite");
  if (reach(4) >= 2 && reach(5) === 0) add("onsiteNoOffer");
  const perCo = {};
  for (const a of S.apps.list.filter(a => isSent(a) && isOpen(a))) { const k = companyFor(a)?.id || a.company.toLowerCase(); perCo[k] = (perCo[k] || 0) + 1; }
  if (Object.values(perCo).some(v => v > 3)) add("tooMany", "info");
  if (st.sent >= 8 && !S.network.referrals.length) add("noReferrals", "info");
  if (!beforeStart() && !off.has("behindApps")) {
    const wc = weekCounts();
    const dow = (new Date().getDay() + 6) % 7; // Monday = 0
    if (wc.goal.apps && dow >= 3 && wc.apps < wc.goal.apps * (dow / 7) - 1) out.push({ key: "behindApps", text: `${HINT_RULES.behindApps} ${wc.apps} of ${wc.goal.apps} sent, and it's ${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][dow]}.`, level: "info" });
  }
  return out;
}

export const statusIdx = s => APP_STATUS.indexOf(s);
export { normApp };
