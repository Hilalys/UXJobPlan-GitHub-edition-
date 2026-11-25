// Applications: the pipeline with tailored resumes attached, next actions, charts and AI job-fit suggestions.

import { S, save, saveNow, normApp } from "../store.js";
import { APP_STATUS } from "../content.js";
import { TIERS, SOURCES, STATUS_TIPS, companyTips, REPLY_GOAL, MIDSIZE_LOOP } from "../content4.js";
import { esc, uid, today, addDays, fmtDate, relDay, safeUrl, toCsv, $ } from "../util.js";
import { icon, sheet, toast, confirmSheet, columns, segmented, legend, hbars, weekLabels } from "../ui.js";
import { aiVisible, askJson } from "../ai.js";
import * as M from "../model.js";
import * as A from "../model4.js";
import { saveFile } from "./settings.js";
import { draftFor, tailorActions } from "./tailor.js";
import { downloadResume } from "../export.js";
import { loopHTML } from "./interview.js";
import { bus } from "../bus.js";
import { inPlace, cityName, hasCity, getLoc } from "../locale.js";

const F = { view: "open", tier: "", status: "", sort: "date", q: "" };
let openId = null;
let busy = null;        // { id, ctl }
const aiErr = {};
const pctTxt = r => (r == null ? "–" : `${Math.round(r * 100)}%`);

function statusClass(s) {
  if (s === "Offer") return "st-offer";
  if (A.ACTIVE.includes(s)) return "st-active";
  if (s === "Rejected" || s === "Withdrawn") return "st-closed";
  if (s === "Applied") return "st-applied";
  return "st-saved";
}
const statusSel = (a, extra = "") => `<select class="status-sel ${statusClass(a.status)}" data-change="ap-f" data-f="status" data-id="${a.id}" aria-label="Status of ${esc(a.company)} application" ${extra}>${APP_STATUS.map(s => `<option ${s === a.status ? "selected" : ""}>${s}</option>`).join("")}</select>`;

// ---------- Charts ----------
function funnelHTML() {
  const f = A.funnel(), max = Math.max(1, f[0].value);
  if (!f[0].value) return `<div class="empty-chart" style="height:120px" role="img" aria-label="No applications sent yet"></div><p class="small muted" style="margin-top:8px">The funnel fills in as you send applications and move them through the stages.</p>`;
  return `<ol class="funnel" aria-label="Applications that reached each stage">${f.map((s, i) => {
    const prev = i ? f[i - 1].value : null, conv = prev ? Math.round((s.value / prev) * 100) : null;
    return `<li><span class="fn-l">${esc(s.label)}</span><span class="fn-bar"><i style="width:${(s.value / max) * 100}%"></i></span><b class="fn-v">${s.value}</b>
      <span class="fn-c small muted">${i ? (prev ? `${conv}% of previous` : "–") : "sent"}</span></li>`;
  }).join("")}</ol>`;
}
function perWeekHTML() {
  const ap = M.appsPerWeek(), n = M.currentWeek();
  const bands = ap.targets.map((t, i) => (i >= 4 && t ? [t, t + 2] : null));
  return `${columns(ap.counts, ap.targets, ap.counts.map((_, i) => `Week ${i + 1}`), { cur: n - 1, unit: "sent", bands })}
    ${weekLabels(ap.counts.length)}
    <p class="small muted" style="margin-top:6px">Bars are applications sent each week. Ticks are the weekly target; the shaded band from Week 5 is the 8–10 the research suggests, all tailored.</p>`;
}
function rateRows(groups) {
  return groups.map(g => ({ label: g.label, value: Math.round(g.rate * 100), max: 100, display: `${pctTxt(g.rate)} · ${g.r} of ${g.n}`, color: "var(--c-apply)" }));
}
function byTierSource() {
  const sent = S.apps.list.filter(A.isSent);
  const group = (keyFn, labels) => labels.map(([k, label]) => {
    const g = sent.filter(a => keyFn(a) === k), r = g.filter(A.hasReply).length;
    return { label, n: g.length, r, rate: g.length ? r / g.length : 0 };
  }).filter(x => x.n);
  const tiers = group(A.tierOf, Object.entries(TIERS).map(([k, t]) => [k, `${t.short} · ${t.name}`]));
  const srcs = group(a => a.source || "", [...SOURCES.map(s => [s, s]), ["", "Not set"]]);
  return `<div class="rate-rows"><h3 class="h-sm">By tier</h3>${hbars(rateRows(tiers), { empty: "Set a tier on your applications to see this." })}
    <h3 class="h-sm" style="margin-top:14px">By source</h3>${hbars(rateRows(srcs), { empty: "Set where each application came from to see this." })}</div>
    <p class="small muted" style="margin-top:8px">Reply rate for each group. A rejection counts as a reply.</p>`;
}

// ---------- Cards ----------
function resumeBlock(a) {
  const h = a.tailoredId && S.tailor.history.find(x => x.id === a.tailoredId);
  if (h) return `<div class="ap-res"><span>${icon("file", "sm")}Tailored resume from ${fmtDate(h.savedAt || h.created || today())}${h.coverage != null ? ` · ${h.coverage}% keyword coverage` : ""}</span>
    <span class="actions"><button class="btn btn-sm" type="button" data-act="ap-res-open" data-id="${a.id}">Open in Resume Tailor</button><button class="btn btn-sm" type="button" data-act="ap-res-dl" data-id="${a.id}">${icon("download", "sm")}PDF</button></span></div>`;
  return `<div class="ap-res"><label for="ap-rv-${a.id}">${icon("file", "sm")}Resume used</label>
    <select id="ap-rv-${a.id}" data-change="ap-f" data-f="resumeId" data-id="${a.id}"><option value="">Not linked</option>${S.resume.versions.map(v => `<option value="${esc(v.id)}" ${v.id === a.resumeId ? "selected" : ""}>${esc(v.name)}</option>`).join("")}</select>
    ${a.resumeId ? `<button class="btn btn-sm" type="button" data-act="ap-res-dl" data-id="${a.id}">${icon("download", "sm")}PDF</button>` : ""}
    ${a.tailoredId ? `<span class="small muted">The tailored resume for this application was deleted from Resume Tailor's history.</span>` : ""}</div>`;
}
function nextLine(a) {
  if (!a.next) return "";
  const overdue = a.nextDate && a.nextDate < today();
  return `<span class="ap-next ${overdue ? "overdue" : ""}">${icon(overdue ? "alert" : "flag", "sm")}${esc(a.next)}${a.nextDate ? ` · ${overdue ? "overdue, " : ""}${relDay(a.nextDate)}` : ""}</span>`;
}
function fitHTML(a) {
  const f = a.ai;
  if (!f) return "";
  const li = arr => (arr && arr.length ? `<ul class="plain">${arr.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="small muted">None</p>`);
  const cls = f.score >= 75 ? "fit-strong" : f.score >= 55 ? "fit-good" : "fit-stretch";
  return `<div class="ai-draft"><p class="ai-label">${icon("sparkle", "sm")}Job-fit suggestions · ${fmtDate(f.at, { year: true })}</p>
    <p class="fit ${cls}"><b>${f.score}</b> / 100 fit</p><p>${esc(f.summary)}</p>
    <div class="grid-2 in"><div><h3 class="h-sm">Keywords you match</h3>${li(f.matched)}</div><div><h3 class="h-sm">Keywords to add, only if true</h3>${li(f.missing)}</div></div>
    <h3 class="h-sm">Resume changes for this role</h3>${li(f.edits)}
    <h3 class="h-sm">Case study to lead with</h3><p>${esc(f.lead)}</p>
    <h3 class="h-sm">Interview focus</h3>${li(f.focus)}
    <h3 class="h-sm">Questions to prepare</h3>${li(f.questions)}
    <h3 class="h-sm">Stories to use</h3>${li(f.stories)}
    <p class="small muted">Check every suggestion; never add experience you don't have.</p></div>`;
}
const inp = (a, f, label, type = "text", extra = "") => `<div class="field"><label for="ap-${f}-${a.id}">${label}</label><input id="ap-${f}-${a.id}" type="${type}" value="${esc(a[f] || "")}" data-change="ap-f" data-f="${f}" data-id="${a.id}" ${extra}></div>`;

function cardBody(a) {
  const co = A.companyFor(a);
  const tips = [STATUS_TIPS[a.status], ...companyTips(a.company, A.tierOf(a))].filter(Boolean);
  const link = safeUrl(a.link);
  return `<div class="ap-body">
    <div class="row3">
      ${inp(a, "role", "Role")}
      <div class="field"><label for="ap-tier-${a.id}">Tier</label><select id="ap-tier-${a.id}" data-change="ap-f" data-f="tier" data-id="${a.id}"><option value="">Not set</option>${Object.entries(TIERS).map(([k, t]) => `<option value="${k}" ${k === A.tierOf(a) ? "selected" : ""}>${t.short} · ${t.name}</option>`).join("")}</select></div>
      <div class="field"><label for="ap-source-${a.id}">Source</label><select id="ap-source-${a.id}" data-change="ap-f" data-f="source" data-id="${a.id}"><option value="">Not set</option>${SOURCES.map(s => `<option ${s === a.source ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      ${inp(a, "referral", "Referral person", "text", `maxlength="120" placeholder="Name and how you know them"`)}
      ${inp(a, "pay", "Posted pay range", "text", `maxlength="80" placeholder="e.g. $110–140K"`)}
      ${inp(a, "location", "Location or remote", "text", `maxlength="80" placeholder="e.g. ${esc(hasCity() ? cityName() : "Austin")}, hybrid"`)}
      ${inp(a, "posted", "Posted on", "date")}
      ${inp(a, "appliedAt", "Applied on", "date")}
      ${inp(a, "link", "Job link", "url", `placeholder="https://"`)}
    </div>
    <div class="row2 ap-nextrow">
      ${inp(a, "next", "Next action", "text", `maxlength="140" placeholder="e.g. Follow up with the recruiter"`)}
      <div class="field"><label for="ap-nextDate-${a.id}">Due</label><div class="actions"><input id="ap-nextDate-${a.id}" type="date" value="${esc(a.nextDate || "")}" data-change="ap-f" data-f="nextDate" data-id="${a.id}">
        <button class="btn btn-sm" type="button" data-act="ap-follow" data-id="${a.id}">Follow up in 7 days</button>${a.next ? `<button class="btn btn-sm btn-ghost" type="button" data-act="ap-next-done" data-id="${a.id}">${icon("check", "sm")}Done</button>` : ""}</div></div>
    </div>
    <div class="field"><span class="lbl">Interview dates</span>
      ${a.interviews.length ? `<ul class="ap-ints">${a.interviews.slice().sort((x, y) => (x.d < y.d ? -1 : 1)).map(i => `<li><b>${fmtDate(i.d, { dow: true })}</b> · ${esc(i.round || "Interview")}<button class="icon-btn sm danger" type="button" data-act="ap-int-del" data-id="${a.id}" data-k="${esc(i.k)}" aria-label="Remove ${esc(i.round || "interview")} on ${fmtDate(i.d)}">${icon("x", "sm")}</button></li>`).join("")}</ul>` : ""}
      <div class="actions"><label class="sr-only" for="ap-intd-${a.id}">Interview date</label><input id="ap-intd-${a.id}" type="date" style="width:auto"><label class="sr-only" for="ap-intr-${a.id}">Round</label><input id="ap-intr-${a.id}" type="text" placeholder="Round, e.g. Portfolio review" maxlength="80" style="flex:1 1 200px;width:auto">
        <button class="btn btn-sm" type="button" data-act="ap-int-add" data-id="${a.id}">${icon("plus", "sm")}Add</button></div>
      <p class="hint">Each date is also added to Events, so it shows on Overview.</p></div>
    ${resumeBlock(a)}
    <div class="field"><label for="ap-notes-${a.id}">Notes</label><textarea id="ap-notes-${a.id}" rows="3" maxlength="3000" data-change="ap-f" data-f="notes" data-id="${a.id}" placeholder="Feedback, who you talked to, next steps">${esc(a.notes)}</textarea></div>
    <details class="ap-jd"><summary>Job description${a.description ? ` <span class="muted small">· ${a.description.length.toLocaleString()} characters</span>` : ""}</summary>
      <textarea id="ap-description-${a.id}" rows="7" maxlength="12000" data-change="ap-f" data-f="description" data-id="${a.id}" aria-label="Job description" placeholder="Paste the posting for job-fit suggestions">${esc(a.description)}</textarea></details>
    <div class="ap-tips"><b>Next steps for this application</b><ul>${tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>
    ${co?.loop ? `<details class="ap-loop"><summary>${icon("mic", "sm")}Interview loop at ${esc(co.name)}</summary>${loopHTML(co)}</details>` : `<p class="small muted">${icon("info", "sm")}No researched loop for ${esc(a.company)} yet. ${MIDSIZE_LOOP} <a href="#interview-loops">Add it in Interview prep</a>.</p>`}
    <div class="actions" style="margin-top:12px">
      ${aiVisible() ? `<button class="btn" type="button" data-act="ap-fit" data-id="${a.id}" ${busy ? "disabled" : ""}>${icon("sparkle", "sm")}${a.ai ? "Refresh suggestions" : "Get suggestions"}</button>` : ""}
      ${link ? `<a class="btn btn-ghost" href="${esc(link)}" target="_blank" rel="noopener">${icon("ext", "sm")}Open posting</a>` : ""}
      <span class="spacer"></span><button class="btn btn-danger btn-sm" type="button" data-act="ap-del" data-id="${a.id}">${icon("trash", "sm")}Delete</button></div>
    ${busy?.id === a.id ? `<div class="ai-wait" role="status"><div class="spinner" aria-hidden="true"></div><p>Comparing the posting with your profile…</p><button class="btn btn-sm" type="button" data-act="ap-fit-cancel">Cancel</button></div>` : ""}
    ${aiErr[a.id] ? `<p class="error" role="alert">${esc(aiErr[a.id])}</p>` : ""}
    ${fitHTML(a)}
  </div>`;
}
function card(a) {
  const open = openId === a.id;
  const t = A.tierOf(a);
  return `<article class="card ap-card ${open ? "is-open" : ""}" aria-labelledby="ap-h-${a.id}">
    <div class="ap-top">
      <button class="ap-sum" type="button" data-act="ap-toggle" data-id="${a.id}" aria-expanded="${open}" aria-controls="ap-b-${a.id}">
        <span class="ap-co" id="ap-h-${a.id}">${esc(a.company)}</span><span class="ap-role">${esc(a.role || "Role not set")}</span>
        <span class="ap-meta small muted">${t ? `${TIERS[t].short}` : ""}${a.appliedAt ? `${t ? " · " : ""}Applied ${fmtDate(a.appliedAt)}` : a.created ? `${t ? " · " : ""}Saved ${fmtDate(a.created)}` : ""}${a.tailoredId ? " · tailored" : ""}${a.referral ? " · referral" : ""}</span>
        ${icon("chevDown", "sm ap-chev")}</button>
      ${statusSel(a)}
    </div>
    ${a.next && !open ? `<div class="ap-nextbar">${nextLine(a)}</div>` : ""}
    <div id="ap-b-${a.id}" ${open ? "" : "hidden"}>${open ? cardBody(a) : ""}</div>
  </article>`;
}

function filtered() {
  const q = F.q.trim().toLowerCase();
  let list = S.apps.list.filter(a =>
    (F.view === "all" || (F.view === "open" ? A.isOpen(a) : !A.isOpen(a))) &&
    (!F.tier || A.tierOf(a) === F.tier) && (!F.status || a.status === F.status) &&
    (!q || `${a.company} ${a.role} ${a.notes} ${a.location}`.toLowerCase().includes(q)));
  const dateOf = a => a.appliedAt || a.created || "";
  if (F.sort === "date") list.sort((x, y) => (dateOf(x) < dateOf(y) ? 1 : -1));
  else if (F.sort === "next") list.sort((x, y) => (x.nextDate || "9999") < (y.nextDate || "9999") ? -1 : 1);
  else list.sort((x, y) => A.reachedOf(y) - A.reachedOf(x) || (dateOf(x) < dateOf(y) ? 1 : -1));
  return list;
}

export function renderApplications() {
  const st = A.appStats();
  const fb = M.feedback();
  const list = filtered();
  const counts = { open: S.apps.list.filter(A.isOpen).length, closed: S.apps.list.filter(a => !A.isOpen(a)).length, all: S.apps.list.length };
  const hints = A.hints().filter(h => ["noReplies", "lowReply", "screensNoPortfolio", "portfolioNoOnsite", "onsiteNoOffer", "tooMany"].includes(h.key));
  const due = A.dueItems(0).filter(d => d.kind === "app");
  return `<header class="page-h"><div><div class="eyebrow">Land the job</div><h1>Applications</h1>
      <p class="lead">Every role from saved to offer, with the resume you sent, the next step and how the search is going.</p></div>
    <div class="actions"><button class="btn" type="button" data-act="ap-csv" ${S.apps.list.length ? "" : "disabled"}>${icon("download", "sm")}CSV</button><button class="btn btn-primary" type="button" data-act="ap-add">${icon("plus", "sm")}Add application</button></div></header>
  ${hints.map(h => `<div class="banner ${h.level === "warn" ? "warn" : ""}" role="note">${icon(h.level === "warn" ? "alert" : "info")}<p>${esc(h.text)}</p></div>`).join("")}
  ${due.length ? `<div class="banner warn" role="note">${icon("flag")}<p><b>${due.length} follow-up${due.length > 1 ? "s" : ""} due:</b> ${due.slice(0, 3).map(d => `${esc(d.label)} (${esc(d.sub.split(" · ")[0])})`).join("; ")}${due.length > 3 ? "…" : ""}</p><button class="btn btn-sm" type="button" data-act="ap-show-due">Show</button></div>` : ""}
  <div class="tiles">
    <div class="tile"><span>Response rate</span><b>${pctTxt(st.rate)}${st.sent ? `<small> · ${st.replied} of ${st.sent}</small>` : ""}</b><span class="small">${st.sent ? "" : "None sent yet. "}Goal: at least ${Math.round(REPLY_GOAL * 100)}%</span></div>
    <div class="tile"><span>With a referral</span><b>${pctTxt(st.refRate)}${st.ref ? `<small> · ${st.refReplied} of ${st.ref}</small>` : ""}</b><span class="small">Referrals reach interviews far more often</span></div>
    <div class="tile"><span>Active processes</span><b>${st.active}</b><span class="small">Recruiter screen to final round</span></div>
    <div class="tile"><span>Offers</span><b>${st.offers}</b></div>
    <div class="tile"><span>Days to first reply</span><b>${st.avgDays == null ? "–" : Math.round(st.avgDays)}<small>${st.daysN ? ` · avg of ${st.daysN}` : ""}</small></b><span class="small">From applying to the first reply</span></div>
  </div>
  <div class="chart-grid ap-charts">
    <section class="card" aria-labelledby="ap-fn"><div class="card-h"><h2 id="ap-fn">${icon("review")}Funnel</h2><span class="sub">How far applications got</span></div><div class="card-b">${funnelHTML()}</div></section>
    <section class="card" aria-labelledby="ap-wk"><div class="card-h"><h2 id="ap-wk">${icon("calendar")}Applications per week</h2></div><div class="card-b">${perWeekHTML()}</div></section>
    <section class="card" aria-labelledby="ap-oc"><div class="card-h"><h2 id="ap-oc">${icon("target")}Outcomes</h2><span class="sub">${fb.sent} sent</span></div><div class="card-b">
      ${segmented(fb.parts, { tall: true, label: `Outcomes: ${fb.parts.map(x => `${x.label} ${x.value}`).join(", ")}` })}
      ${fb.sent ? legend(fb.parts) : `<p class="small muted" style="margin-top:8px">No reply, rejected, advancing and offer, as replies come in.</p>`}</div></section>
    <section class="card" aria-labelledby="ap-rt"><div class="card-h"><h2 id="ap-rt">${icon("compass")}Reply rate by tier and source</h2></div><div class="card-b">${byTierSource()}</div></section>
  </div>
  <section class="card" aria-labelledby="ap-list"><div class="card-h"><h2 id="ap-list">${icon("briefcase")}Your applications</h2><span class="sub">${S.apps.list.length} in total</span></div><div class="card-b">
    <div class="filters" role="group" aria-label="Filter applications">
      <div class="seg-ctl" role="radiogroup" aria-label="Show">${[["open", "Open"], ["closed", "Closed"], ["all", "All"]].map(([k, l]) => `<label><input type="radio" name="ap-view" value="${k}" data-change="ap-filter" data-k="view" ${F.view === k ? "checked" : ""}><span>${l} <span class="muted">${counts[k]}</span></span></label>`).join("")}</div>
      <label class="sr-only" for="ap-q">Search applications</label><input id="ap-q" type="search" placeholder="Search company, role or notes" value="${esc(F.q)}" data-change="ap-q">
      <label class="sr-only" for="ap-ft">Tier</label><select id="ap-ft" data-change="ap-filter" data-k="tier"><option value="">All tiers</option>${Object.entries(TIERS).map(([k, t]) => `<option value="${k}" ${F.tier === k ? "selected" : ""}>${t.short}</option>`).join("")}</select>
      <label class="sr-only" for="ap-fs">Status</label><select id="ap-fs" data-change="ap-filter" data-k="status"><option value="">All statuses</option>${APP_STATUS.map(s => `<option ${F.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
      <label class="sr-only" for="ap-so">Sort</label><select id="ap-so" data-change="ap-filter" data-k="sort">${[["date", "Newest first"], ["next", "Next action"], ["stage", "Furthest stage"]].map(([k, l]) => `<option value="${k}" ${F.sort === k ? "selected" : ""}>${l}</option>`).join("")}</select>
    </div>
    ${list.length ? `<div class="ap-list">${list.map(card).join("")}</div>` : S.apps.list.length ? `<p class="muted">No applications match these filters.</p>`
      : `<div class="empty">${icon("briefcase")}<b>No applications yet</b>Add one here, or use Resume Tailor's “Add to Applications” to attach the tailored resume.<div class="actions" style="justify-content:center;margin-top:10px"><button class="btn btn-primary" type="button" data-act="ap-add">${icon("plus", "sm")}Add application</button><a class="btn" href="#tailor">Resume Tailor</a></div></div>`}
  </div></section>
  <details class="card fold" ${S.settings.profile.summary ? "" : "open"}><summary class="card-h"><h2>${icon("idcard")}Profile used for suggestions</h2></summary><div class="card-b">
    <p class="small muted">Job-fit suggestions compare each posting with this summary. Keep it accurate as your work grows. It's the same profile as in Settings.</p>
    <label class="sr-only" for="ap-profile">Profile summary</label><textarea id="ap-profile" rows="10" maxlength="6000" data-change="set-profile" data-f="summary">${esc(S.settings.profile.summary)}</textarea></div></details>`;
}

// ---------- Add sheet ----------
export function openAddApp(prefill = {}) {
  const d = { company: "", role: "", status: "Applied", source: "", referral: "", link: "", posted: "", appliedAt: today(), pay: "", location: "", description: "", next: "", nextDate: "", ...prefill };
  sheet({
    title: "Add an application", wide: true,
    body: `<form class="form" novalidate>
      <datalist id="ap-cos">${S.companies.list.map(c => `<option value="${esc(c.name)}"></option>`).join("")}</datalist>
      <div class="row2"><div class="field"><label for="na-co">Company</label><input id="na-co" name="company" type="text" list="ap-cos" value="${esc(d.company)}" maxlength="100" placeholder="e.g. Zillow"><p class="error" data-err="company" hidden>Add the company.</p></div>
        <div class="field"><label for="na-role">Role</label><input id="na-role" name="role" type="text" value="${esc(d.role)}" maxlength="120" placeholder="e.g. Product Designer I"><p class="error" data-err="role" hidden>Add the role.</p></div></div>
      <div class="row3">
        <div class="field"><label for="na-st">Status</label><select id="na-st" name="status">${APP_STATUS.map(s => `<option ${s === d.status ? "selected" : ""}>${s}</option>`).join("")}</select></div>
        <div class="field"><label for="na-tier">Tier</label><select id="na-tier" name="tier"><option value="">From the company</option>${Object.entries(TIERS).map(([k, t]) => `<option value="${k}">${t.short} · ${t.name}</option>`).join("")}</select><p class="hint" data-tierhint></p></div>
        <div class="field"><label for="na-src">Source</label><select id="na-src" name="source"><option value="">Not set</option>${SOURCES.map(s => `<option ${s === d.source ? "selected" : ""}>${s}</option>`).join("")}</select></div>
        <div class="field"><label for="na-ap">Applied on</label><input id="na-ap" name="appliedAt" type="date" value="${esc(d.appliedAt)}"></div>
        <div class="field"><label for="na-po">Posted on <span class="muted">(optional)</span></label><input id="na-po" name="posted" type="date" value="${esc(d.posted)}"></div>
        <div class="field"><label for="na-ref">Referral person <span class="muted">(optional)</span></label><input id="na-ref" name="referral" type="text" value="${esc(d.referral)}" maxlength="120"></div>
        <div class="field"><label for="na-pay">Posted pay range</label><input id="na-pay" name="pay" type="text" value="${esc(d.pay)}" maxlength="80" placeholder="e.g. $110–140K"></div>
        <div class="field"><label for="na-loc">Location or remote</label><input id="na-loc" name="location" type="text" value="${esc(d.location)}" maxlength="80" placeholder="e.g. ${esc(hasCity() ? cityName() : "Austin")}, hybrid"></div>
        <div class="field"><label for="na-link">Job link</label><input id="na-link" name="link" type="url" value="${esc(d.link)}" placeholder="https://"></div>
      </div>
      <div class="row2"><div class="field"><label for="na-next">Next action <span class="muted">(optional)</span></label><input id="na-next" name="next" type="text" value="${esc(d.next)}" maxlength="140" placeholder="e.g. Follow up"></div>
        <div class="field"><label for="na-nd">Due</label><input id="na-nd" name="nextDate" type="date" value="${esc(d.nextDate)}"></div></div>
      <div class="field"><label for="na-jd">Job description <span class="muted">(paste it for job-fit suggestions)</span></label><textarea id="na-jd" name="description" rows="5" maxlength="12000">${esc(d.description)}</textarea></div>
      <p class="hint">Tailored the resume already? Resume Tailor's “Add to Applications” attaches it for you.</p>
      <button type="submit" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">Add</button></form>`,
    foot: `<button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" data-save>Add application</button>`,
    onMount: (el, api) => {
      const form = $("form", el), E = form.elements;
      const hint = () => { const c = A.companyByName(E.company.value); $("[data-tierhint]", el).textContent = c && !E.tier.value ? `${c.name} is ${TIERS[c.tier]?.short || "not tiered"}${c.target ? ", on your target list" : ""}.` : ""; };
      E.company.addEventListener("input", hint); E.tier.addEventListener("change", hint); hint();
      const doSave = () => {
        const company = E.company.value.trim(), role = E.role.value.trim();
        $("[data-err=company]", el).hidden = !!company; $("[data-err=role]", el).hidden = !!role;
        if (!company) { E.company.focus(); return; } if (!role) { E.role.focus(); return; }
        const co = A.ensureCompany(company, E.tier.value || "2");
        if (E.tier.value && !co.builtIn && co.tier !== E.tier.value) { co.tier = E.tier.value; save("companies"); }
        const status = E.status.value;
        const a = normApp({
          id: uid("a"), company: co.name === company ? company : company, companyId: co.id, role, status, tier: E.tier.value || co.tier || "",
          source: E.source.value, referral: E.referral.value.trim(), link: safeUrl(E.link.value.trim()) || "", posted: E.posted.value,
          appliedAt: status === "Saved" ? "" : (E.appliedAt.value || today()), created: today(), pay: E.pay.value.trim(), location: E.location.value.trim(),
          next: E.next.value.trim(), nextDate: E.nextDate.value, description: E.description.value.trim(), log: [{ s: status, d: today() }]
        });
        S.apps.list.unshift(a); saveNow("apps");
        openId = a.id; api.close(); bus.render();
        toast(status === "Saved" ? "Saved in Applications" : `Added. ${a.appliedAt && M.inWeek(a.appliedAt, M.currentWeek()) ? "It counts toward this week." : ""}`);
      };
      form.addEventListener("submit", e => { e.preventDefault(); doSave(); });
      $("[data-save]", el).addEventListener("click", doSave);
    }
  });
}

// ---------- AI job fit ----------
async function getFit(a) {
  if (!a.description || a.description.trim().length < 80) { aiErr[a.id] = "Paste the job description first (open “Job description” above)."; bus.render(); return; }
  busy = { id: a.id, ctl: new AbortController() }; aiErr[a.id] = ""; bus.render();
  const ctl = busy.ctl;
  const cases = S.portfolio.cases.filter(c => !c.archived).map(c => `${c.title} (${c.status})`).join("; ");
  try {
    const res = await askJson(`You are a career coach for junior product designers applying${inPlace()}. Compare the candidate profile with the job posting and give honest, specific advice.
Rules: use only experience in the profile; never invent experience, numbers or skills. Missing keywords are things to add ONLY if the candidate truly has them; say so. Be concise. Plain English.
CANDIDATE PROFILE:
${(S.settings.profile.summary || "").slice(0, 4000)}
CASE STUDIES SHE IS BUILDING: ${cases || "none listed"}
COMPANY: ${a.company}
ROLE: ${a.role}
JOB POSTING:
${a.description.slice(0, 10000)}
Reply with only a JSON object with these keys:
"match_score": integer 0-100, "fit_summary": 1-2 sentences, "matched_keywords": up to 8 strings, "missing_keywords": up to 8 strings,
"resume_edits": 3-5 concrete changes for this role, "lead_case_study": one sentence on which case study to lead with and why,
"interview_focus": 3-4 things to prepare for this company's process, "likely_questions": 4-6 questions they're likely to ask, "stories_to_prepare": 3 story topics from their experience.`, { signal: ctl.signal });
    const arr = (x, n) => (Array.isArray(x) ? x : []).map(v => String(typeof v === "string" ? v : JSON.stringify(v)).slice(0, 300)).filter(Boolean).slice(0, n);
    const score = Math.max(0, Math.min(100, Math.round(Number(res?.match_score) || 0)));
    a.ai = { score, summary: String(res?.fit_summary || "").slice(0, 400), matched: arr(res?.matched_keywords, 8), missing: arr(res?.missing_keywords, 8), edits: arr(res?.resume_edits, 5), lead: String(res?.lead_case_study || "").slice(0, 300), focus: arr(res?.interview_focus, 4), questions: arr(res?.likely_questions, 6), stories: arr(res?.stories_to_prepare, 3), at: today() };
    if (!a.ai.summary && !a.ai.edits.length) { a.ai = null; throw new Error("The suggestions came back empty. Try again."); }
    save("apps");
  } catch (e) { if (!ctl.signal.aborted) aiErr[a.id] = e.message; }
  if (busy?.ctl === ctl) busy = null;
  bus.render();
}

function addInterview(a, d, round) {
  const k = uid("i");
  a.interviews.push({ k, d, round });
  // Also an event, so it shows on Overview's calendar.
  S.events.list.push({ id: uid("e"), name: `${a.company}: ${round || "Interview"}`, type: "Interview", date: d, time: "", location: "", link: "", notes: a.role, status: "planned", appId: a.id, appKey: k });
  save("apps"); save("events");
}

function doCsv() {
  const res = a => { const h = a.tailoredId && S.tailor.history.find(x => x.id === a.tailoredId); return h ? "Tailored" : (S.resume.versions.find(v => v.id === a.resumeId)?.name || ""); };
  saveFile(`ux-job-plan-applications-${today()}.csv`, toCsv(S.apps.list, [
    { label: "Company", get: a => a.company }, { label: "Role", get: a => a.role }, { label: "Tier", get: a => A.tierOf(a) }, { label: "Status", get: a => a.status },
    { label: "Applied", get: a => a.appliedAt }, { label: "Posted", get: a => a.posted }, { label: "Source", get: a => a.source }, { label: "Referral", get: a => a.referral },
    { label: "Pay range", get: a => a.pay }, { label: "Location", get: a => a.location }, { label: "Next action", get: a => a.next }, { label: "Next date", get: a => a.nextDate },
    { label: "Interview dates", get: a => a.interviews.map(i => `${i.d} ${i.round}`).join("; ") }, { label: "Resume", get: res }, { label: "Fit score", get: a => a.ai?.score ?? "" },
    { label: "Link", get: a => a.link }, { label: "Notes", get: a => a.notes }]), "text/csv");
}

bus.csvApps = doCsv;

// ---------- Handlers ----------
const appOf = d => A.appById(d.id);
export const applicationsActions = {
  "ap-add": () => openAddApp(),
  "ap-toggle": d => { openId = openId === d.id ? null : d.id; bus.render(); },
  "ap-csv": () => doCsv(),
  "ap-fit": d => { const a = appOf(d); if (a) getFit(a); },
  "ap-fit-cancel": () => { busy?.ctl.abort(); busy = null; bus.render(); },
  "ap-show-due": () => { F.view = "open"; F.sort = "next"; F.status = ""; F.tier = ""; F.q = ""; bus.render(); setTimeout(() => document.getElementById("ap-list")?.scrollIntoView({ behavior: "smooth" }), 30); },
  "ap-follow": d => { const a = appOf(d); if (!a) return; if (!a.next) a.next = "Follow up"; a.nextDate = addDays(today(), 7); save("apps"); bus.render(); toast("Follow-up set for 7 days from today"); },
  "ap-next-done": d => {
    const a = appOf(d); if (!a) return;
    const prev = { next: a.next, nextDate: a.nextDate };
    a.notes = `${a.notes ? a.notes + "\n" : ""}${today()}: done: ${a.next}`; a.next = ""; a.nextDate = "";
    save("apps"); bus.render();
    toast("Marked done and noted", { action: "Undo", onAction: () => { Object.assign(a, prev); a.notes = a.notes.replace(/\n?[^\n]*$/, ""); save("apps"); bus.render(); } });
  },
  "ap-int-add": d => {
    const a = appOf(d); if (!a) return;
    const dt = document.getElementById(`ap-intd-${a.id}`)?.value, round = document.getElementById(`ap-intr-${a.id}`)?.value.trim() || "";
    if (!dt) { toast("Pick the interview date first"); document.getElementById(`ap-intd-${a.id}`)?.focus(); return; }
    addInterview(a, dt, round); bus.render(); toast("Interview added, and it's on your events");
  },
  "ap-int-del": d => {
    const a = appOf(d); if (!a) return;
    a.interviews = a.interviews.filter(i => i.k !== d.k);
    S.events.list = S.events.list.filter(e => !(e.appId === a.id && e.appKey === d.k));
    save("apps"); save("events"); bus.render();
  },
  "ap-res-open": d => { const a = appOf(d); if (!a?.tailoredId) return; tailorActions["tl-open"]({ id: a.tailoredId }); location.hash = "#tailor"; },
  "ap-res-dl": d => {
    const a = appOf(d); if (!a) return;
    const h = a.tailoredId && S.tailor.history.find(x => x.id === a.tailoredId);
    if (h) { const { draft, base } = draftFor(h); downloadResume(draft, "pdf", S.resume.design, { nameFrom: base }); return; }
    const v = S.resume.versions.find(x => x.id === a.resumeId); if (v) downloadResume(v, "pdf", S.resume.design);
  },
  "ap-del": d => {
    const a = appOf(d); if (!a) return;
    confirmSheet({ title: `Delete ${esc(a.company)}?`, message: `This removes the ${esc(a.role || "")} application and its interview dates.`, confirm: "Delete", danger: true, onConfirm: () => {
      const i = S.apps.list.indexOf(a); S.apps.list.splice(i, 1);
      const evs = S.events.list.filter(e => e.appId === a.id); S.events.list = S.events.list.filter(e => e.appId !== a.id);
      save("apps"); save("events"); openId = null; bus.render();
      toast("Application deleted", { action: "Undo", onAction: () => { S.apps.list.splice(i, 0, a); S.events.list.push(...evs); save("apps"); save("events"); bus.render(); } });
    } });
  }
};

export const applicationsChanges = {
  "ap-f": el => {
    const a = A.appById(el.dataset.id); if (!a) return;
    const f = el.dataset.f;
    if (f === "status") {
      const was = a.status;
      A.setAppStatus(a, el.value); save("apps"); bus.render();
      if (el.value === "Offer") toast("An offer! Ask for time to decide and compare total compensation.");
      else if (was === "Saved" && el.value === "Applied") toast("Marked as applied today");
      return;
    }
    if (f === "tier" || f === "source" || f === "resumeId" || f === "nextDate" || f === "posted" || f === "appliedAt") {
      a[f] = el.value; save("apps"); bus.render(); return;
    }
    if (f === "link") { a.link = safeUrl(el.value.trim()) || ""; save("apps"); return; }
    a[f] = el.value; save("apps");
  },
  "ap-filter": el => { F[el.dataset.k] = el.value; bus.render(); }
};
let qT = null;
export const applicationsInputs = {
  "ap-f": el => {
    const a = A.appById(el.dataset.id); if (!a) return;
    if (["role", "referral", "pay", "location", "next", "notes", "description"].includes(el.dataset.f)) { a[el.dataset.f] = el.value; save("apps"); }
  },
  "ap-q": el => { F.q = el.value; clearTimeout(qT); qT = setTimeout(() => bus.render(), 220); }
};
export const openApp = id => { openId = id; };
