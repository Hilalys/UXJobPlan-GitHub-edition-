// Events: every event in one place, over a longer time frame (upcoming up to 6 months or more,
// a month calendar, past events), plus preparation for each one. Claude plans the prep to fit
// the event's type and topic; without AI a basic checklist for the type is used instead.

import { S, save } from "../store.js";
import { esc, today, fmtDate, fmtTime, relDay, monthShort, dayNum, addDays, parseYmd, ymd, daysBetween, safeUrl, host, uid, clamp, mondayOf, $ } from "../util.js";
import { icon, toast } from "../ui.js";
import * as M from "../model.js";
import { aiVisible, askJson, profileLine } from "../ai.js";
import { openEventSheet, guessEventType } from "../forms.js";
import { allItems, itemId } from "./updates.js";
import { RES_TYPES } from "../content2.js";
import { TRACK_KEYS } from "../content.js";
import { bus } from "../bus.js";
import { inPlace, cityName, hasCity, getLoc } from "../locale.js";

const TABS = { upcoming: "Upcoming", month: "Month", past: "Past" };
const RANGES = [["14", "Next 2 weeks"], ["30", "Next month"], ["90", "Next 3 months"], ["180", "Next 6 months"], ["all", "Everything ahead"]];
const F = { range: "90", type: "" };
let tab = "upcoming", mon = "";
let busy = null;        // { id, ctl } while Claude is preparing
let failed = null;      // { id, msg } after a failed run
export const setEventsTab = t => { tab = TABS[t] ? t : "upcoming"; };

const GOALS = [["learn", "Learn the topic"], ["people", "Meet designers"], ["leads", "Find job leads"], ["skill", "Practice a skill"], ["portfolio", "Get portfolio material"], ["company", "Learn about a company"]];
const LEVELS = [["new", "New to me"], ["some", "Know a little"], ["good", "Comfortable"]];
const GOAL_DEFAULT = { Workshop: ["skill", "portfolio"], Meetup: ["people", "learn"], Conference: ["learn", "people"], Webinar: ["learn"], "Coffee chat": ["people", "leads"], Interview: ["company"], Deadline: [], Other: ["learn"] };
const TRACK_NAME = { learn: "Learn", build: "Build", practice: "Practice", apply: "Apply" };

// ---------- data ----------
const evById = id => S.events.list.find(e => e.id === id);
function prepOf(id, make = false) {
  let p = S.evprep.map[id];
  if (!p && make) {
    const e = evById(id);
    p = S.evprep.map[id] = { ask: { goals: [...(GOAL_DEFAULT[e?.type] || ["learn"])], level: "some", extra: "" }, result: null, at: "", ai: false, done: {}, tasks: {} };
  }
  return p || null;
}
const endOf = e => e.date || "";
const upcoming = () => M.upcomingEvents();
const past = () => M.pastEvents();

// Events found by the Sunday search that they haven't added yet.
function feedEvents() {
  let items = [];
  try { items = allItems(); } catch { items = []; }
  const have = new Set(S.events.list.flatMap(e => [e.feedId || "", e.link ? itemId(e.link) : ""]).filter(Boolean));
  return items.filter(it => it.event && it.event.date && (it.event.end || it.event.date) >= today() && !have.has(it.id))
    .sort((a, b) => a.event.date < b.event.date ? -1 : a.event.date > b.event.date ? 1 : 0);
}

// Items they can tick: checklist steps and things to bring count toward "prep"; after-event steps don't.
function prepCount(e) {
  const p = prepOf(e.id);
  if (!p || !p.result) return null;
  const keys = [...p.result.steps.map((_, i) => "s" + i), ...p.result.bring.map((_, i) => "b" + i)];
  return { done: keys.filter(k => isDone(p, k)).length, total: keys.length };
}
function isDone(p, k) {
  if (p.done[k]) return true;
  const t = p.tasks[k] && M.taskById(p.tasks[k]);
  return !!(t && t.done);
}
function prepTag(e) {
  const c = prepCount(e);
  if (!c) return e.date >= today() ? `<span class="tag">No prep yet</span>` : "";
  if (!c.total) return `<span class="tag info">Prep ready</span>`;
  return c.done >= c.total ? `<span class="tag good">${icon("check", "sm")}Prep done</span>` : `<span class="tag info">Prep ${c.done}/${c.total}</span>`;
}
const monthName = m => parseYmd(m + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" });
const metaLine = e => [e.date ? (e.date >= today() ? relDay(e.date) : fmtDate(e.date, { dow: true })) : "No date", e.time ? fmtTime(e.time) : "", e.location].filter(Boolean).map(esc).join(" · ");

// ---------- list pieces ----------
function row(e, sel) {
  const pastEv = e.date < today();
  const mark = pastEv ? (e.status === "attended" ? `<span class="tag good">Attended</span>` : e.status === "skipped" ? `<span class="tag">Skipped</span>`
    : `<span class="evp-mark"><button class="btn btn-sm" type="button" data-act="evp-mark" data-id="${e.id}" data-v="attended">I went</button><button class="btn btn-sm btn-ghost" type="button" data-act="evp-mark" data-id="${e.id}" data-v="skipped">Skipped</button></span>`) : "";
  return `<li class="${e.id === sel ? "is-sel" : ""}">
    <div class="d" aria-hidden="true">${e.date ? `${monthShort(e.date)}<b>${dayNum(e.date)}</b>` : "–"}</div>
    <div class="n"><a href="#event-${e.id}" ${e.id === sel ? `aria-current="true"` : ""}>${esc(e.name)}<span class="sr-only">, ${esc(e.date ? fmtDate(e.date, { dow: true, year: true }) : "no date")}</span></a>
      <span>${metaLine(e)}</span></div>
    <div class="evp-tags"><span class="type-pill">${esc(e.type)}</span>${pastEv ? "" : prepTag(e)}${mark}</div></li>`;
}
function grouped(list, sel) {
  const groups = [];
  for (const e of list) {
    const m = (e.date || "").slice(0, 7) || "none";
    let g = groups.find(x => x.m === m);
    if (!g) groups.push(g = { m, list: [] });
    g.list.push(e);
  }
  return groups.map(g => `<h3 class="evp-month">${g.m === "none" ? "No date" : esc(monthName(g.m))} <span class="muted small">· ${g.list.length}</span></h3>
    <ul class="ev-list evp-list">${g.list.map(e => row(e, sel)).join("")}</ul>`).join("");
}
function suggestions(until) {
  const list = feedEvents().filter(it => until === "all" || it.event.date <= until).slice(0, 6);
  if (!list.length) return "";
  return `<section class="card evp-sug" aria-labelledby="evs-h">
    <div class="card-h"><h2 id="evs-h">${icon("news")}From What's new</h2><a class="btn btn-sm btn-ghost" href="#updates">See all updates</a></div>
    <div class="card-b"><p class="small muted" style="margin:0 0 6px">Events the Sunday search found that aren't in your list yet.</p>
      <ul class="ev-list evp-list">${list.map(it => `<li>
        <div class="d" aria-hidden="true">${monthShort(it.event.date)}<b>${dayNum(it.event.date)}</b></div>
        <div class="n"><a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">${esc(it.title)}<span class="sr-only"> (opens in a new tab)</span></a>
          <span>${[relDay(it.event.date), it.event.time ? fmtTime(it.event.time) : "", it.event.where, it.event.cost].filter(Boolean).map(esc).join(" · ")}</span></div>
        <div class="evp-tags"><button class="btn btn-sm" type="button" data-act="evp-add-feed" data-id="${it.id}" aria-label="Add ${esc(it.title)} to your events">${icon("plus", "sm")}Add</button></div></li>`).join("")}</ul></div></section>`;
}

function upcomingView(sel) {
  const t = today();
  const until = F.range === "all" ? "all" : addDays(t, Number(F.range));
  const list = upcoming().filter(e => (until === "all" || e.date <= until) && (!F.type || e.type === F.type));
  const types = [...new Set(S.events.list.map(e => e.type))];
  return `<section class="card" aria-labelledby="evl-h">
      <div class="card-h"><h2 id="evl-h">Upcoming <span class="sub">${list.length}</span></h2></div>
      <div class="card-b">
        <div class="filters" role="group" aria-label="Show">
          <label class="sr-only" for="evp-range">Time frame</label><select id="evp-range" data-change="evp-filter" data-k="range">${RANGES.map(([v, l]) => `<option value="${v}" ${v === F.range ? "selected" : ""}>${l}</option>`).join("")}</select>
          ${types.length > 1 ? `<label class="sr-only" for="evp-type">Type</label><select id="evp-type" data-change="evp-filter" data-k="type"><option value="">All types</option>${types.map(x => `<option ${x === F.type ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>` : ""}
        </div>
        ${list.length ? grouped(list, sel) : `<div class="empty">${icon("calendar")}<b>${F.type ? "No events of this type" : "Nothing in this time frame"}</b>${F.range !== "all" ? `<button class="btn btn-sm" type="button" data-act="evp-all">Show everything ahead</button>` : "Add meetups, workshops, coffee chats and interviews."}</div>`}
      </div></section>
    ${suggestions(until)}`;
}

function monthView(sel) {
  const t = today();
  const m = mon || t.slice(0, 7);
  const first = m + "-01";
  const last = ymd(new Date(parseYmd(first).getFullYear(), parseYmd(first).getMonth() + 1, 0));
  const start = mondayOf(first), end = addDays(mondayOf(last), 6);
  const byDay = {};
  for (const e of S.events.list) if (e.date >= start && e.date <= end) (byDay[e.date] ||= []).push(e);
  Object.values(byDay).forEach(l => l.sort((a, b) => (a.time || "99") < (b.time || "99") ? -1 : 1));
  const weeks = [];
  for (let d = start; d <= end; d = addDays(d, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
  const shift = n => { const d = parseYmd(first); d.setMonth(d.getMonth() + n); return ymd(d).slice(0, 7); };
  const inMonth = S.events.list.filter(e => e.date >= first && e.date <= last).sort((a, b) => (a.date + (a.time || "99")) < (b.date + (b.time || "99")) ? -1 : 1);
  const cell = d => {
    const evs = byDay[d] || [];
    const out = d.slice(0, 7) !== m;
    return `<td class="${out ? "out" : ""}${d === t ? " today" : ""}${d < t ? " gone" : ""}"><span class="evm-day"${d === t ? ` aria-current="date"` : ""}>${dayNum(d)}<span class="sr-only"> ${esc(fmtDate(d, { dow: true }))}${evs.length ? `, ${evs.length} event${evs.length > 1 ? "s" : ""}` : ""}</span></span>
      ${evs.slice(0, 3).map(e => `<a class="evm-chip${e.id === sel ? " is-sel" : ""}" href="#event-${e.id}" title="${esc((e.time ? fmtTime(e.time) + " " : "") + e.name)}"><span>${e.time ? `<b>${esc(fmtTime(e.time).replace(":00", "").replace(" ", "").toLowerCase())}</b> ` : ""}${esc(e.name)}</span></a>`).join("")}
      ${evs.length > 3 ? `<span class="evm-more">+${evs.length - 3} more</span>` : ""}</td>`;
  };
  return `<section class="card" aria-labelledby="evm-h">
      <div class="card-h"><h2 id="evm-h">${esc(monthName(m))}</h2>
        <div class="evm-nav"><button class="icon-btn sm boxed" type="button" data-act="evp-mon" data-m="${shift(-1)}" aria-label="Previous month">${icon("chev", "sm flip")}</button>
          ${m !== t.slice(0, 7) ? `<button class="btn btn-sm" type="button" data-act="evp-mon" data-m="${t.slice(0, 7)}">This month</button>` : ""}
          <button class="icon-btn sm boxed" type="button" data-act="evp-mon" data-m="${shift(1)}" aria-label="Next month">${icon("chev", "sm")}</button></div></div>
      <div class="card-b">
        <table class="evm"><caption class="sr-only">Events in ${esc(monthName(m))}</caption>
          <thead><tr>${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(x => `<th scope="col">${x}</th>`).join("")}</tr></thead>
          <tbody>${weeks.map(w => `<tr>${w.map(cell).join("")}</tr>`).join("")}</tbody></table>
        <h3 class="evp-month" style="margin-top:16px">In ${esc(monthName(m).split(" ")[0])} <span class="muted small">· ${inMonth.length}</span></h3>
        ${inMonth.length ? `<ul class="ev-list evp-list">${inMonth.map(e => row(e, sel)).join("")}</ul>` : `<p class="muted small" style="margin:6px 0 0">No events this month.</p>`}
      </div></section>
    ${suggestions(last)}`;
}

function pastView(sel) {
  const list = past();
  const went = list.filter(e => e.status === "attended").length;
  return `<section class="card" aria-labelledby="evpa-h">
    <div class="card-h"><h2 id="evpa-h">Past <span class="sub">${list.length} · ${went} attended</span></h2></div>
    <div class="card-b">${list.length ? grouped(list, sel) : `<div class="empty">${icon("calendar")}<b>No past events yet</b>Events move here the day after they happen.</div>`}</div></section>`;
}

// ---------- page ----------
export function renderEvents(selId = "") {
  const sel = selId && evById(selId) ? selId : "";
  const up = upcoming(), t = today();
  const week = up.filter(e => e.date <= addDays(t, 6)).length;
  const three = up.filter(e => e.date <= addDays(t, 90)).length;
  const prepped = up.filter(e => prepOf(e.id)?.result).length;
  const left = `<nav class="subnav" aria-label="Event views">${Object.entries(TABS).map(([k, l]) => `<a href="#events${k === "upcoming" ? "" : "-" + k}" ${tab === k && !sel ? `aria-current="page"` : tab === k ? `aria-current="true"` : ""}>${l}${k === "upcoming" ? ` <span class="muted">${up.length}</span>` : k === "past" ? ` <span class="muted">${past().length}</span>` : ""}</a>`).join("")}</nav>
    ${tab === "month" ? monthView(sel) : tab === "past" ? pastView(sel) : upcomingView(sel)}`;
  const missing = selId && !sel;
  return `<header class="page-h"><div><div class="eyebrow">Stay current</div><h1>Events</h1>
      <p class="lead">Meetups, workshops, conferences, coffee chats and interviews, months ahead. Open an event and Claude helps you prepare in a way that fits it: what to brush up on, what to bring and set up, questions to ask, and steps you can add to your weekly plan.</p></div>
    <div class="evp-head-r"><div class="fd-stats" aria-label="Summary"><span><b>${week}</b> this week</span><span><b>${three}</b> next 3 months</span><span><b>${prepped}</b> of ${up.length} prepped</span></div>
      <button class="btn btn-primary" type="button" data-act="add-event">${icon("plus", "sm")}Add event</button></div></header>
  ${missing ? `<p class="hint warn-note" role="status">${icon("alert", "sm")}That event isn't in your list anymore. It may have been deleted.</p>` : ""}
  <div class="evp-layout${sel ? " has-sel" : ""}">
    <div class="evp-main">${left}</div>
    ${sel ? `<div class="evp-detail">${detail(evById(sel))}</div>` : ""}
  </div>`;
}

// ---------- detail ----------
function detail(e) {
  const p = prepOf(e.id);
  const pastEv = e.date < today();
  const days = e.date ? daysBetween(today(), e.date) : null;
  const app = e.appId ? S.apps.list.find(a => a.id === e.appId) : null;
  const back = `#events${tab === "upcoming" ? "" : "-" + tab}`;
  return `<a class="link-btn evp-back" href="${back}">${icon("chev", "sm flip")}Back to events</a>
  <section class="card evp-ev" aria-labelledby="evd-h">
    <div class="card-b">
      <div class="evp-ev-top"><span class="type-pill">${esc(e.type)}</span>${pastEv ? (e.status === "attended" ? `<span class="tag good">Attended</span>` : e.status === "skipped" ? `<span class="tag">Skipped</span>` : `<span class="tag warn">Did you go?</span>`) : days != null && days <= 7 ? `<span class="tag info">${esc(relDay(e.date))}</span>` : ""}</div>
      <h2 id="evd-h" class="evp-ev-name">${esc(e.name)}</h2>
      <div class="ev-meta"><span>${icon("clock", "sm")}${e.date ? esc(fmtDate(e.date, { dow: true, year: true })) : "No date"}${e.time ? ` · ${esc(fmtTime(e.time))}` : ""}${!pastEv && days > 7 ? ` · in ${days} days` : ""}</span>
        ${e.location ? `<span>${icon("pin", "sm")}${esc(e.location)}</span>` : ""}
        ${e.link ? `<span>${icon("link", "sm")}<a href="${esc(e.link)}" target="_blank" rel="noopener noreferrer">Event page<span class="sr-only"> (${esc(host(e.link))}, opens in a new tab)</span></a></span>` : ""}</div>
      ${e.notes ? `<p class="evp-notes">${esc(e.notes)}</p>` : ""}
      <div class="evp-ev-acts">
        <button class="btn btn-sm" type="button" data-act="edit-event" data-id="${e.id}">${icon("edit", "sm")}Edit event</button>
        ${pastEv && e.status !== "attended" ? `<button class="btn btn-sm" type="button" data-act="evp-mark" data-id="${e.id}" data-v="attended">${icon("check", "sm")}I went</button>` : ""}
        ${pastEv && !e.status || pastEv && e.status === "planned" ? `<button class="btn btn-sm btn-ghost" type="button" data-act="evp-mark" data-id="${e.id}" data-v="skipped">Skipped</button>` : ""}
        ${e.type === "Interview" ? `<a class="btn btn-sm" href="#interview">${icon("mic", "sm")}Interview prep</a>${app ? `<a class="btn btn-sm btn-ghost" href="#applications">${icon("briefcase", "sm")}${esc(app.company)} application</a>` : ""}` : ""}
      </div>
    </div></section>
  ${prepCard(e, p)}`;
}

function prepCard(e, p) {
  const ai = aiVisible();
  const ask = p?.ask || { goals: GOAL_DEFAULT[e.type] || ["learn"], level: "some", extra: "" };
  const running = busy && busy.id === e.id;
  const err = failed && failed.id === e.id ? failed.msg : "";
  const r = p?.result;
  const form = `<div class="form evp-form">
      <div class="field"><label for="evp-about">About the event <span class="muted">(optional)</span></label>
        <textarea id="evp-about" rows="4" maxlength="4000" data-change="evp-about" data-id="${e.id}" placeholder="Paste the description from the event page: the agenda, speakers' topics, what you'll build.">${esc(e.about || "")}</textarea>
        <p class="hint">Claude can't open links, so the more of the event page you paste, the better the prep fits.</p></div>
      <fieldset class="field evp-fs"><legend class="lbl">What do you want from it?</legend>
        <div class="chips">${GOALS.map(([v, l]) => `<label class="chip evp-chip"><input type="checkbox" value="${v}" data-change="evp-goal" data-id="${e.id}" ${ask.goals.includes(v) ? "checked" : ""}>${l}</label>`).join("")}</div></fieldset>
      <fieldset class="field evp-fs"><legend class="lbl">How well do you know the topic?</legend>
        <div class="seg-ctl">${LEVELS.map(([v, l]) => `<label><input type="radio" name="evp-level-${e.id}" value="${v}" data-change="evp-level" data-id="${e.id}" ${ask.level === v ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></fieldset>
      <div class="field"><label for="evp-extra">Anything else? <span class="muted">(optional)</span></label>
        <input id="evp-extra" type="text" maxlength="300" data-change="evp-extra" data-id="${e.id}" value="${esc(ask.extra || "")}" placeholder="e.g. I want to ask how teams use AI in research"></div>
      <div class="evp-run">${running ? "" : `<button class="btn btn-primary" type="button" data-act="evp-run" data-id="${e.id}">${icon(ai ? "sparkle" : "check", "sm")}${ai ? (r ? "Prepare again" : "Prepare with AI") : (r ? "Make the checklist again" : "Make a checklist")}</button>
        ${ai && !r ? `<button class="btn btn-ghost" type="button" data-act="evp-basic" data-id="${e.id}">Basic checklist instead</button>` : ""}`}</div>
    </div>`;
  const wait = running ? `<div class="ai-wait" role="status"><div class="spinner" aria-hidden="true"></div><p>Claude is planning your prep for this ${esc(e.type.toLowerCase())}. This can take up to a minute.</p><button class="btn btn-sm" type="button" data-act="evp-stop">Stop</button></div>` : "";
  const errHtml = err ? `<p class="error" role="alert">${esc(err)}${ai ? ` <button class="btn btn-sm" type="button" data-act="evp-basic" data-id="${e.id}">Use a basic checklist</button>` : ""}</p>` : "";
  return `<section class="card evp-prep" aria-labelledby="evpp-h">
    <div class="card-h"><h2 id="evpp-h">${icon("sparkle")}Prepare</h2>${r ? `<span class="sub">${p.ai ? "AI draft" : "Basic checklist"} · ${esc(fmtDate(p.at, { year: true }))}</span>` : ""}</div>
    <div class="card-b">
      ${r ? `<details class="evp-ask"><summary>Your answers${ask.goals.length ? `: ${esc(ask.goals.map(g => (GOALS.find(x => x[0] === g) || [, g])[1]).join(", ").toLowerCase())}` : ""}</summary>${form}</details>`
        : `<p class="small muted" style="margin:0 0 10px">${ai ? "Answer a few questions and Claude plans your prep for this event: what to review first, what to bring or set up, what to ask, and when to do each step." : "AI is off, so you'll get a basic checklist for this kind of event. Turn AI on in Settings for prep that fits this event."}</p>${form}`}
      ${wait}${errHtml}
      ${r && !running ? result(e, p) : ""}
    </div></section>`;
}

const searchUrl = x => x.type === "Video"
  ? "https://www.youtube.com/results?search_query=" + encodeURIComponent(`${x.title} ${x.source || ""}`.trim())
  : "https://www.google.com/search?q=" + encodeURIComponent(`${x.title} ${x.source || ""}`.trim());
const mins = m => m ? (m >= 60 ? `about ${Math.round(m / 6) / 10} h` : `about ${m} min`) : "";

function result(e, p) {
  const r = p.result;
  const dueOf = s => e.date ? addDays(e.date, -s.daysBefore) : "";
  const check = (k, text, extra = "") => `<li class="${isDone(p, k) ? "is-done" : ""}"><label><input type="checkbox" data-change="evp-done" data-id="${e.id}" data-k="${k}" ${isDone(p, k) ? "checked" : ""}><span>${esc(text)}</span></label>${extra}</li>`;
  const sec = (title, ic, body) => body ? `<div class="evp-sec"><h3>${icon(ic, "sm")}${title}</h3>${body}</div>` : "";
  const lib = r.library.map(x => ({ ...x, res: M.resById(x.id) })).filter(x => x.res);
  const openSteps = r.steps.filter((s, i) => !p.tasks["s" + i] && !isDone(p, "s" + i)).length;
  return `<div class="evp-result">
    ${r.read || r.goal ? `<div class="evp-read">${r.read ? `<p>${esc(r.read)}</p>` : ""}${r.goal ? `<p class="evp-goal">${icon("target", "sm")}<span><b>Aim:</b> ${esc(r.goal)}</span></p>` : ""}</div>` : ""}
    ${sec("Brush up first", "book", r.brushUp.length ? `<ul class="evp-plain">${r.brushUp.map(b => `<li><b>${esc(b.topic)}</b>${b.minutes ? ` <span class="muted small">· ${mins(b.minutes)}</span>` : ""}${b.why ? `<br><span class="small">${esc(b.why)}</span>` : ""}</li>`).join("")}</ul>` : "")}
    ${sec("From your library", "folder", lib.length ? `<ul class="evp-plain">${lib.map(x => `<li><a href="${esc(x.res.url || "#resources")}" ${x.res.url ? `target="_blank" rel="noopener noreferrer"` : ""}><b>${esc(x.res.title)}</b></a> <span class="muted small">· ${esc(x.res.type)}${x.res.status === "done" ? " · finished" : x.res.status === "doing" ? " · in progress" : ""}</span>${x.why ? `<br><span class="small">${esc(x.why)}</span>` : ""}</li>`).join("")}</ul>` : "")}
    ${sec("More to review", "news", r.suggest.length ? `<p class="small muted" style="margin:0 0 6px">Suggested by Claude from what it knows. Links say "Not checked" until you open them.</p><ul class="evp-plain">${r.suggest.map((x, i) => `<li><b>${esc(x.title)}</b> <span class="muted small">· ${[x.source, x.type, mins(x.minutes)].filter(Boolean).map(esc).join(" · ")}</span>${x.why ? `<br><span class="small">${esc(x.why)}</span>` : ""}
        <span class="evp-links">${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(host(x.url))}<span class="sr-only"> (opens in a new tab)</span></a><span class="tag warn">Not checked</span>` : ""}<a href="${esc(searchUrl(x))}" target="_blank" rel="noopener noreferrer">${x.type === "Video" ? "Search YouTube" : "Search the web"}<span class="sr-only"> for ${esc(x.title)} (opens in a new tab)</span></a>
        ${x.added && M.resById(x.added) ? `<span class="muted small">${icon("check", "sm")}In your library</span>` : `<button class="btn btn-sm btn-ghost" type="button" data-act="evp-lib" data-id="${e.id}" data-i="${i}">${icon("plus", "sm")}Save to library</button>`}</span></li>`).join("")}</ul>` : "")}
    ${sec("Checklist", "check", r.steps.length ? `<ul class="evp-check">${r.steps.map((s, i) => {
        const k = "s" + i, due = dueOf(s), tid = p.tasks[k], task = tid && M.taskById(tid);
        const when = s.daysBefore === 0 ? "On the day" : due ? `By ${fmtDate(due, { dow: true })}` : `${s.daysBefore} day${s.daysBefore > 1 ? "s" : ""} before`;
        return check(k, s.text, `<span class="evp-due small">${esc(when)}${s.minutes ? ` · ${mins(s.minutes)}` : ""} · ${TRACK_NAME[s.track]}</span>${task ? `<a class="small evp-inplan" href="#plan-w${task.week}">${icon("calendar", "sm")}Week ${task.week}</a>` : isDone(p, k) ? "" : `<button class="btn btn-sm btn-ghost evp-addone" type="button" data-act="evp-task" data-id="${e.id}" data-i="${i}" aria-label="Add to weekly plan: ${esc(s.text)}">${icon("plus", "sm")}Plan</button>`}`);
      }).join("")}</ul>${openSteps > 1 ? `<button class="btn btn-sm" type="button" data-act="evp-task-all" data-id="${e.id}">${icon("calendar", "sm")}Add ${openSteps} steps to your weekly plan</button>` : ""}` : "")}
    ${sec(e.type === "Workshop" ? "Bring and set up" : "Bring", "briefcase", r.bring.length ? `<ul class="evp-check">${r.bring.map((b, i) => check("b" + i, b)).join("")}</ul>` : "")}
    ${sec("Your introduction", "mic", r.intro ? `<blockquote class="evp-intro">${esc(r.intro)}</blockquote><button class="btn btn-sm" type="button" data-act="evp-copy" data-id="${e.id}">${icon("copy", "sm")}Copy</button><span class="small muted"> Say it out loud a few times so it sounds like you.</span>` : "")}
    ${sec("Questions to ask", "chat", r.questions.length ? `<ol class="evp-plain evp-q">${r.questions.map(q => `<li>${esc(q)}</li>`).join("")}</ol>` : "")}
    ${sec("Who to look for", "users", r.people.length ? `<ul class="evp-plain">${r.people.map(q => `<li>${esc(q)}</li>`).join("")}</ul>` : "")}
    ${sec("After the event", "flag", r.after.length ? `<ul class="evp-check">${r.after.map((a, i) => check("a" + i, a)).join("")}</ul>` : "")}
    ${r.note ? `<p class="hint evp-note">${icon("alert", "sm")}<span>${esc(r.note)}</span></p>` : ""}
    ${p.ai ? `<p class="small muted evp-foot">AI draft. Check it against the event page before relying on it.</p>` : ""}
  </div>`;
}

// ---------- AI ----------
function prompt(e, p) {
  const t = today();
  const days = e.date ? daysBetween(t, e.date) : null;
  const goals = p.ask.goals.map(g => (GOALS.find(x => x[0] === g) || [, g])[1]);
  const level = (LEVELS.find(x => x[0] === p.ask.level) || LEVELS[1])[1];
  const skills = S.skills.list.map(s => `${s.name} ${s.now}/${s.target}`).join("; ");
  const lib = S.resources.list.slice(0, 160).map(r => `${r.id} | ${r.title} | ${r.type}${r.units?.total ? ` | ${r.units.total} ${r.units.label || "h"}` : ""} | ${r.status}`).join("\n");
  const app = e.appId ? S.apps.list.find(a => a.id === e.appId) : null;
  return `You help a product designer${inPlace()} prepare for one event. ${profileLine()}
Today is ${t}. ${days == null ? "The event has no date." : days < 0 ? `The event was ${-days} days ago; focus on follow-ups.` : days === 0 ? "The event is today." : `The event is in ${days} day${days > 1 ? "s" : ""}, on ${e.date}${e.time ? ` at ${e.time}` : ""}.`}

Event: ${e.name}
Type: ${e.type}
Where: ${e.location || "not given"}
Link: ${e.link || "none"} (you can't open it)
${app ? `This is an interview round for: ${app.company}, ${app.role || "Product Designer"}.\n` : ""}About the event, from the event page (may be empty): """${(e.about || "").slice(0, 4000)}"""
Their notes: """${(e.notes || "").slice(0, 1500)}"""
What they want from it: ${goals.join(", ") || "not said"}
How well they know the topic: ${level}
Anything else: ${p.ask.extra || "nothing"}
Their skills, rated now/target out of 5: ${skills}
Their library (id | title | type | length | status):
${lib}

Plan their preparation for this event, fitted to its type and topic:
- Workshop, hackathon or design jam: what to install or set up and sign in to, files or examples to bring, what to read first so they can keep up, a small problem of their own to work on so the result can become new portfolio material, and how to get the most from the session.
- Meetup, talk, conference or webinar: topics to brush up on so they can follow and ask good questions, questions for speakers and attendees, a short introduction, the kinds of people to look for (roles and teams, never names), and follow-ups.
- Coffee chat: what to learn about the company and the person's role first, questions, a short introduction, a follow-up.
- Interview: what to review for this company's loop, what to rehearse, questions to ask. They have an Interview prep page with company loops, a story bank and practice sessions; point to it instead of repeating it.
- Deadline: the steps to finish on time.
Depth: if they're new to the topic, include the basics to brush up on and beginner-friendly resources; if they're comfortable, skip the basics and focus on sharper questions and stretch goals.
Timing: fit the checklist to the time left. daysBefore is how many days before the event a step is due (0 = on the day); never make a step due before today. If the event is today or tomorrow, keep it to what fits in a few hours.
Rules: Use only what's given here and well-established public knowledge. Don't invent details about this event, its agenda, speakers or attendees; if the description is thin, say what to check on the event page. Never name private individuals. Never suggest Interaction Design Foundation (IxDF) content. Never suggest using work from their past jobs as portfolio material; portfolio work is new projects of their own. Pick from their library first (use its exact ids). Suggest new resources only if they fill a gap: real, current (2024 or later where possible), free where possible; give a URL only if you're sure of the exact page, otherwise leave it empty. Plain, friendly English; short items. Leave out sections that don't fit this event (empty array or empty string).
Reply with only JSON:
{"read":"1–2 sentences: what this event likely is and covers","goal":"one sentence: the main thing for them to get out of it","brushUp":[{"topic":"","why":"","minutes":30}],"library":[{"id":"","why":""}],"suggest":[{"title":"","source":"","type":"${RES_TYPES.join("|")}","minutes":20,"url":"","why":""}],"steps":[{"text":"","daysBefore":3,"minutes":30,"track":"learn|build|practice|apply"}],"bring":[""],"intro":"2–3 sentences in first person, for introducing herself here","questions":[""],"people":[""],"after":[""],"note":"optional: anything to double-check, or empty"}`;
}

const str = (v, n = 300) => typeof v === "string" ? v.trim().slice(0, n) : "";
const arr = (v, n) => Array.isArray(v) ? v.slice(0, n) : [];
const num = (v, lo, hi) => { const x = Number(v); return Number.isFinite(x) ? clamp(Math.round(x), lo, hi) : null; };
const strs = (v, n, len = 220) => arr(v, n).map(x => str(x, len)).filter(Boolean);

function cleanResult(r, e) {
  const seen = new Set();
  const maxBefore = e.date && e.date >= today() ? daysBetween(today(), e.date) : 30;
  return {
    read: str(r?.read, 500), goal: str(r?.goal, 300),
    brushUp: arr(r?.brushUp, 6).map(x => ({ topic: str(x?.topic, 120), why: str(x?.why, 240), minutes: num(x?.minutes, 5, 600) })).filter(x => x.topic),
    library: arr(r?.library, 6).map(x => ({ id: str(x?.id, 80), why: str(x?.why, 240) })).filter(x => M.resById(x.id) && !seen.has(x.id) && seen.add(x.id)),
    suggest: arr(r?.suggest, 6).map(x => ({ title: str(x?.title, 160), source: str(x?.source, 60), type: RES_TYPES.includes(x?.type) ? x.type : "Article", minutes: num(x?.minutes, 5, 1200), url: /ixdf|interaction-design\.org/i.test(x?.url || "") ? "" : safeUrl(str(x?.url, 600)), why: str(x?.why, 240), added: "" }))
      .filter(x => x.title && !/interaction design foundation|ixdf/i.test(x.title + " " + x.source)),
    steps: arr(r?.steps, 12).map(x => ({ text: str(x?.text, 240), daysBefore: Math.min(num(x?.daysBefore, 0, 60) ?? 1, maxBefore), minutes: num(x?.minutes, 0, 600) ?? 30, track: TRACK_KEYS.includes(x?.track) ? x.track : "learn" }))
      .filter(x => x.text).sort((a, b) => b.daysBefore - a.daysBefore),
    bring: strs(r?.bring, 10, 160), intro: str(r?.intro, 700), questions: strs(r?.questions, 8, 260), people: strs(r?.people, 6, 200), after: strs(r?.after, 6, 220), note: str(r?.note, 300)
  };
}

// A checklist for the type, used when AI is off or they ask for it.
function basic(e) {
  const p = S.settings.profile;
  const intro = `Hi, I'm ${p.name || "[your name]"}. I'm a ${p.role || "product designer"}${hasCity() ? ` based in ${cityName()}` : ""}, mostly working on mobile and web products. I'm looking for ${p.target || "product and UX design roles"}, and I'm here to learn and meet people in the community.`;
  const T = {
    Workshop: { steps: [[3, "Read the workshop page and note what you'll learn or build", 15, "learn"], [3, "Install or update the tools it uses, and sign in ahead of time", 20, "build"], [2, "Pick a small problem of your own to work on, so the result can become new portfolio material", 30, "build"], [1, "Charge your laptop and plan your route or test the link", 10, "apply"], [0, "Arrive 10 minutes early", 0, "apply"]],
      bring: ["Laptop and charger", "Notebook and pen", "Headphones, if it's online"], questions: ["What's the one thing you'd want people to practice after today?", "How do teams use this day to day?"], after: ["Save your work and notes the same day", "Write three takeaways in this event's notes", "Decide whether the result is worth turning into a case study"] },
    Meetup: { steps: [[3, "Read about the topic and the speakers on the event page", 20, "learn"], [2, "Write two questions for the speakers or attendees", 10, "learn"], [1, "Practice your 30-second introduction out loud", 15, "practice"], [1, "Have your portfolio and LinkedIn ready to show on your phone", 10, "apply"]],
      bring: ["Phone with your LinkedIn QR code", "Portfolio link ready to share"], questions: ["What are you working on right now?", "How is your team using AI in its design process?", "Which local groups or events do you find most useful?"], people: ["Designers at companies on your target list", "Design managers and recruiters", "People who just changed jobs nearby"], after: ["Connect with the people you met within 48 hours, with a short note", "Add new contacts in Strategy & networking", "Write down what you learned in this event's notes"] },
    Conference: { steps: [[7, "Look through the agenda and pick the sessions you'll attend", 30, "learn"], [5, "Brush up on the topic of the session you care most about", 45, "learn"], [2, "Write a question for each session you picked", 15, "learn"], [1, "Practice your 30-second introduction out loud", 15, "practice"]],
      bring: ["Phone and charger", "Portfolio link ready to share", "Notebook"], questions: ["What surprised you most at this conference?", "How is your team putting this into practice?"], people: ["Speakers from sessions you attended", "Designers from companies on your target list"], after: ["Write a short summary of your top three sessions", "Follow up with people you met within 48 hours", "Save the talks you liked to your library"] },
    Webinar: { steps: [[2, "Read the description and note what you want to learn", 10, "learn"], [1, "Write one or two questions to ask in the Q&A", 10, "learn"], [0, "Test the link and your audio a few minutes early", 5, "apply"]],
      bring: ["Notes app or notebook"], questions: ["How would you apply this on a small team?"], after: ["Write three takeaways in this event's notes", "Save the recording to your library if there is one"] },
    "Coffee chat": { steps: [[3, "Learn about the company, its products and recent news", 30, "learn"], [2, "Look at the person's role and team on LinkedIn", 15, "apply"], [1, "Write three questions and your short introduction", 15, "practice"], [0, "Confirm the time and place, and be a few minutes early", 5, "apply"]],
      bring: ["Your questions", "Portfolio link, in case they ask"], questions: ["What does a typical week look like on your team?", "What makes a designer stand out there?", "Is there anyone else you think I should talk to?"], after: ["Send a thank-you note within 24 hours", "Log the chat and any next step in Strategy & networking"] },
    Interview: { steps: [[5, "Review this company's loop in Interview prep", 30, "practice"], [3, "Rehearse your portfolio presentation with the timer", 60, "practice"], [2, "Pick the stories from your story bank that fit this company", 45, "practice"], [1, "Write the questions you'll ask", 15, "practice"], [0, "Test your setup or plan your route, and be early", 10, "apply"]],
      bring: ["Portfolio presentation, ready to share", "Questions for the interviewers", "Water"], questions: ["What does success look like in this role after six months?", "How do designers and engineers work together here?"], after: ["Send thank-you notes within 24 hours", "Update the application's status and next step", "Write down what went well and what to practice"] },
    Deadline: { steps: [[7, "List everything that needs to be done", 15, "apply"], [3, "Finish a full draft", 120, "build"], [1, "Review and fix the last details", 45, "build"], [0, "Submit, and save a copy", 10, "apply"]], bring: [], questions: [], after: ["Note what you'd do differently next time"] },
    Other: { steps: [[3, "Read the event page and note why you're going", 15, "learn"], [1, "Prepare your short introduction and one question", 15, "practice"]], bring: ["Phone with your LinkedIn QR code"], questions: ["What are you working on right now?"], after: ["Follow up with anyone you met within 48 hours"] }
  };
  const b = T[e.type] || T.Other;
  const words = `${e.name} ${e.about || ""}`.toLowerCase().match(/[a-z]{4,}/g) || [];
  const stop = new Set(["design", "designer", "designers", "with", "from", "your", "this", "that", "event", "meetup", "online", "night", "workshop", "about", "will", "what", "join"]);
  const keys = [...new Set(words.filter(w => !stop.has(w)))];
  const lib = S.resources.list.filter(r => r.status !== "done" && keys.some(k => r.title.toLowerCase().includes(k))).slice(0, 4).map(r => ({ id: r.id, why: "Matches the event's topic." }));
  const maxBefore = e.date && e.date >= today() ? daysBetween(today(), e.date) : 30;
  return { read: "", goal: "", brushUp: [], library: lib, suggest: [],
    steps: b.steps.map(([d, text, m, track]) => ({ text, daysBefore: Math.min(d, maxBefore), minutes: m, track })),
    bring: b.bring, intro: ["Interview", "Deadline", "Webinar"].includes(e.type) ? "" : intro, questions: b.questions, people: b.people || [], after: b.after, note: "" };
}

async function run(id, useBasic = false) {
  const e = evById(id); if (!e) return;
  const p = prepOf(id, true);
  failed = null;
  if (useBasic || !aiVisible()) {
    Object.assign(p, { result: basic(e), at: today(), ai: false, done: {}, tasks: {} });
    save("evprep"); bus.render(); toast("Checklist ready"); return;
  }
  const ctl = new AbortController();
  busy = { id, ctl }; bus.render();
  try {
    const r = await askJson(prompt(e, p), { signal: ctl.signal });
    const res = cleanResult(r, e);
    if (!res.steps.length && !res.brushUp.length && !res.questions.length) throw Object.assign(new Error("Nothing useful came back. Try again, or paste more of the event page."), { code: "empty" });
    Object.assign(p, { result: res, at: today(), ai: true, done: {}, tasks: {} });
    save("evprep");
    toast("Your prep is ready");
  } catch (err) {
    if (err.code !== "cancelled" && err.name !== "AbortError") failed = { id, msg: err.message || "Something went wrong. Try again." };
  } finally {
    busy = null; bus.render();
  }
}

// ---------- plan tasks ----------
function addTasks(e, p, idxs) {
  let added = 0, weeks = new Set();
  const short = e.name.length > 48 ? e.name.slice(0, 46).trim() + "…" : e.name;
  for (const i of idxs) {
    const s = p.result.steps[i], k = "s" + i;
    if (!s || p.tasks[k] || isDone(p, k)) continue;
    const due = e.date ? addDays(e.date, -s.daysBefore) : today();
    const raw = M.weekRaw(due < today() ? today() : due);
    const week = clamp(raw, Math.min(M.currentWeek(), M.weekCount()), M.weekCount());
    const order = Math.max(-1, ...S.plan.tasks.filter(x => x.week === week).map(x => x.order)) + 1;
    const id = uid("t");
    S.plan.tasks.push({ id, week, origWeek: week, track: s.track, title: `${short}: ${s.text}`, detail: `To prepare for ${e.name}${e.date ? `, ${fmtDate(e.date, { dow: true })}` : ""}.`, hours: Math.max(0.25, Math.round((s.minutes || 15) / 15) / 4), res: [], skills: [], done: false, doneAt: "", dropped: false, carriedFrom: 0, carryPending: false, order, eventId: e.id });
    p.tasks[k] = id; added++; weeks.add(week);
  }
  if (!added) return;
  save("plan"); save("evprep"); bus.render();
  const w = [...weeks].sort((a, b) => a - b);
  toast(`Added ${added} step${added > 1 ? "s" : ""} to Week ${w.join(" and ")}`, { action: "Open week", onAction: () => { location.hash = `#plan-w${w[0]}`; } });
}

// ---------- actions ----------
export const eventsActions = {
  "evp-all": () => { F.range = "all"; bus.render(); },
  "evp-mon": d => { mon = d.m; bus.render(); },
  "evp-mark": d => { const e = evById(d.id); if (!e) return; const was = e.status; e.status = d.v; save("events"); bus.render(); toast(d.v === "attended" ? "Marked as attended" : "Marked as skipped", { action: "Undo", onAction: () => { e.status = was; save("events"); bus.render(); } }); },
  "evp-add-feed": d => {
    const it = allItems().find(x => x.id === d.id); if (!it || !it.event) return;
    const id = uid("e");
    S.events.list.push({ id, name: it.title, type: guessEventType(it.title, it.summary, it.event.where), date: it.event.date, time: it.event.time || "", location: it.event.where || "", link: it.url, notes: "", about: it.summary || "", status: "planned", group: "", feedId: it.id });
    save("events"); location.hash = `#event-${id}`;
    toast("Added to your events", { action: "Undo", onAction: () => { S.events.list = S.events.list.filter(e => e.id !== id); save("events"); location.hash = "#events"; } });
  },
  "evp-run": d => run(d.id),
  "evp-basic": d => run(d.id, true),
  "evp-stop": () => { if (busy) busy.ctl.abort(); },
  "evp-task": d => { const e = evById(d.id), p = prepOf(d.id); if (e && p?.result) addTasks(e, p, [Number(d.i)]); },
  "evp-task-all": d => { const e = evById(d.id), p = prepOf(d.id); if (e && p?.result) addTasks(e, p, p.result.steps.map((_, i) => i)); },
  "evp-lib": d => {
    const p = prepOf(d.id), x = p?.result?.suggest[Number(d.i)]; if (!x) return;
    const id = uid("r");
    S.resources.list.push({ id, title: x.title, type: x.type, url: x.url, skills: [], week: 0, cost: "Unknown", units: x.minutes ? { done: 0, total: Math.max(1, Math.round(x.minutes / 60)), label: "hours" } : null, status: "todo", notes: x.why, rating: 0, started: "", finished: "", last: "", checked: false, src: "ai" });
    x.added = id; save("resources"); save("evprep"); bus.render(); toast("Saved to Courses & resources");
  },
  "evp-copy": d => {
    const t = prepOf(d.id)?.result?.intro; if (!t) return;
    (navigator.clipboard?.writeText(t) || Promise.reject()).then(() => toast("Introduction copied"), () => toast("Couldn't copy. Select the text and copy it instead."));
  }
};

export const eventsChanges = {
  "evp-filter": el => { F[el.dataset.k] = el.value; bus.render(); },
  "evp-about": el => { const e = evById(el.dataset.id); if (e) { e.about = el.value.trim(); save("events"); } },
  "evp-extra": el => { const p = prepOf(el.dataset.id, true); p.ask.extra = el.value.trim(); save("evprep"); },
  "evp-level": el => { const p = prepOf(el.dataset.id, true); p.ask.level = el.value; save("evprep"); },
  "evp-goal": el => { const p = prepOf(el.dataset.id, true); const g = new Set(p.ask.goals); if (el.checked) g.add(el.value); else g.delete(el.value); p.ask.goals = GOALS.map(x => x[0]).filter(x => g.has(x)); save("evprep"); },
  "evp-done": el => {
    const p = prepOf(el.dataset.id); if (!p) return;
    const k = el.dataset.k;
    if (el.checked) p.done[k] = today(); else delete p.done[k];
    const t = p.tasks[k] && M.taskById(p.tasks[k]);
    if (t && t.done !== el.checked) { t.done = el.checked; t.doneAt = el.checked ? today() : ""; save("plan"); }
    save("evprep"); bus.render();
  }
};

// The Overview card links here.
export const eventHref = e => `#event-${e.id}`;
