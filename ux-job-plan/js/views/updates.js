// What's new: read the public feed or Claude's scheduled feed; keep likes and read marks separately.

import { S, save, getFeedRuns, getFeedState, getFeedSource } from "../store.js";
import { esc, today, fmtDate, fmtTime, safeUrl, host, uid, addDays, parseYmd } from "../util.js";
import { icon, toast } from "../ui.js";
import { openEventSheet, guessEventType } from "../forms.js";
import { bus } from "../bus.js";

export const FEED_TYPES = ["Article", "Video", "Course", "Resource", "Podcast", "News", "Event"];
const EXTRA_TOPICS = { career: "Careers and hiring", industry: "Industry and tools" };
const PAGE = 30;
const F = { q: "", topic: "", type: "", source: "", status: "" };
let tab = "all", limit = PAGE;
const TAB_NAMES = { all: "All updates", unread: "Unread", read: "Read", liked: "Liked" };
export const setTab = t => { if (!TAB_NAMES[t]) t = "all"; if (t !== tab) { tab = t; limit = PAGE; } };
// On the Unread and Read tabs the tab itself decides read or unread, so only "New this week" still filters there.
const statusOn = () => !!F.status && tab !== "read" && !(tab === "unread" && F.status !== "new");

export const topicName = id => S.skills.list.find(s => s.id === id)?.name || EXTRA_TOPICS[id] || id;

// A stable id per link, so a like or read mark follows the item from week to week.
function normUrl(u) {
  try {
    const x = new URL(u);
    [...x.searchParams.keys()].filter(k => /^(utm_|ref$|source$|fbclid|gclid)/i.test(k)).forEach(k => x.searchParams.delete(k));
    x.hash = "";
    return (x.hostname.replace(/^www\./, "").toLowerCase() + x.pathname.replace(/\/+$/, "") + (x.search || "")).toLowerCase();
  } catch { return String(u || "").trim().toLowerCase(); }
}
export function itemId(u) {
  let h = 5381;
  const s = normUrl(u);
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return "f" + h.toString(36);
}

const isYmd = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !!parseYmd(s);
const str = (v, n = 400) => typeof v === "string" ? v.trim().slice(0, n) : "";

// Items come from a scheduled run, so treat them as untrusted: keep known fields, safe links, short text.
function clean(raw, run) {
  if (!raw || typeof raw !== "object") return null;
  const url = safeUrl(str(raw.url, 2000));
  const title = str(raw.title, 240);
  if (!url || !title) return null;
  const type = FEED_TYPES.includes(raw.type) ? raw.type : "Article";
  const topics = Array.isArray(raw.topics) ? [...new Set(raw.topics.filter(t => typeof t === "string").map(t => t.trim()).filter(Boolean))].slice(0, 6) : [];
  const ev = raw.event && typeof raw.event === "object" ? raw.event : null;
  return {
    id: itemId(url), url, title, type, topics,
    source: str(raw.source, 80) || host(url),
    summary: str(raw.summary, 600),
    why: str(raw.why, 300),
    length: str(raw.length, 40),
    cost: str(raw.cost, 40),
    published: isYmd(raw.published) ? raw.published : "",
    found: isYmd(run) ? run : "",
    event: ev ? { date: isYmd(ev.date) ? ev.date : "", end: isYmd(ev.end) ? ev.end : "", time: /^\d{2}:\d{2}$/.test(ev.time || "") ? ev.time : "", where: str(ev.where, 160), cost: str(ev.cost, 40) } : null
  };
}

// Every item across the saved runs, once each (the newest run's copy wins), plus liked items from runs that were cleared.
export function allItems() {
  const runs = [...getFeedRuns()].sort((a, b) => String(b.run || "").localeCompare(String(a.run || "")));
  const map = new Map();
  for (const r of runs) for (const raw of r.items || []) {
    const it = clean(raw, r.run);
    if (!it) continue;
    const prev = map.get(it.id);
    if (!prev) map.set(it.id, it);
    else if (it.found && (!prev.firstFound || it.found < prev.firstFound)) prev.firstFound = it.found;
  }
  for (const [id, l] of Object.entries(S.feed.liked)) if (!map.has(id) && l && l.item) { const it = clean(l.item, l.item.found); if (it) map.set(id, { ...it, id }); }
  return [...map.values()].map(it => ({ ...it, firstFound: it.firstFound || it.found }));
}

const sortKey = it => it.published || it.firstFound || "";
export const latestRun = () => getFeedRuns().reduce((m, r) => (String(r.run || "") > m ? String(r.run) : m), "");
const isRead = it => !!S.feed.read[it.id];
const isLiked = it => !!S.feed.liked[it.id];
const isNew = (it, run) => !!run && it.firstFound === run && !isRead(it) &&
  (getFeedSource() !== "public" || it.published >= addDays(today(), -7));
export const newCount = () => { if (!S.feed) return 0; const run = latestRun(); return run ? allItems().filter(it => isNew(it, run)).length : 0; };

function nextSunday() {
  const t = today(); const d = parseYmd(t).getDay();
  return addDays(t, d === 0 ? (new Date().getHours() * 60 + new Date().getMinutes() < 333 ? 0 : 7) : 7 - d);
}

function eventLine(e) {
  if (!e) return "";
  const when = e.date ? `${fmtDate(e.date, { dow: true, year: true })}${e.end && e.end !== e.date ? ` – ${fmtDate(e.end, { dow: true, year: true })}` : ""}${e.time ? `, ${fmtTime(e.time)}` : ""}` : "Date on the event page";
  return `<p class="fd-event">${icon("calendar", "sm")}<span><b>${esc(when)}</b>${e.where ? ` · ${esc(e.where)}` : ""}${e.cost ? ` · ${esc(e.cost)}` : ""}</span></p>`;
}

function card(it, run) {
  const liked = isLiked(it), read = isRead(it);
  const date = it.published ? fmtDate(it.published, { year: true }) : it.firstFound ? `Found ${fmtDate(it.firstFound, { year: true })}` : "";
  const upcoming = it.event && it.event.date && it.event.date >= today();
  const canLib = !["Event", "News"].includes(it.type);
  const inLib = canLib && S.resources.list.some(r => r.url && normUrl(r.url) === normUrl(it.url));
  return `<li class="fd-card${read ? " is-read" : ""}" data-fid="${it.id}">
    <div class="fd-top"><span class="chip">${esc(it.type)}</span><span class="fd-src">${esc(it.source)}</span>${date ? `<span class="fd-date">${esc(date)}</span>` : ""}${it.length ? `<span class="fd-len">${esc(it.length)}</span>` : ""}${isNew(it, run) ? `<span class="tag info">New</span>` : ""}${read ? `<span class="tag good">${icon("check", "sm")}Read</span>` : ""}</div>
    <h3 class="fd-title"><a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">${esc(it.title)}<span class="sr-only"> (${esc(host(it.url))}, opens in a new tab)</span></a></h3>
    ${eventLine(it.event)}
    ${it.summary ? `<p class="fd-sum">${esc(it.summary)}</p>` : ""}
    ${it.why ? `<p class="fd-why">${icon("target", "sm")}<span>${esc(it.why)}</span></p>` : ""}
    <div class="fd-foot">
      ${it.topics.length ? `<div class="chips fd-topics">${it.topics.map(t => `<button class="chip chip-btn" type="button" data-act="fd-topic" data-t="${esc(t)}" aria-label="Show only ${esc(topicName(t))}">${esc(topicName(t))}</button>`).join("")}</div>` : `<span></span>`}
      <div class="fd-acts">
        <button class="btn btn-sm fd-like" type="button" data-act="fd-like" data-id="${it.id}" aria-pressed="${liked}">${icon("heart", "sm")}${liked ? "Liked" : "Like"}</button>
        <button class="btn btn-sm" type="button" data-act="fd-read" data-id="${it.id}" aria-pressed="${read}">${icon("check", "sm")}${read ? "Read" : "Mark read"}</button>
        ${upcoming ? `<button class="btn btn-sm" type="button" data-act="fd-event" data-id="${it.id}">${icon("plus", "sm")}Add to events</button>` : ""}
        ${canLib ? (inLib ? `<span class="muted small fd-inlib">${icon("book", "sm")}In your library</span>` : `<button class="btn btn-sm" type="button" data-act="fd-lib" data-id="${it.id}">${icon("book", "sm")}Save to library</button>`) : ""}
      </div>
    </div>
  </li>`;
}

function select(id, k, label, opts, all) {
  return `<label class="sr-only" for="${id}">${label}</label><select id="${id}" data-change="fd-filter" data-k="${k}"><option value="">${all}</option>${opts.map(([v, l, n]) => `<option value="${esc(v)}" ${v === F[k] ? "selected" : ""}>${esc(l)}${n != null ? ` (${n})` : ""}</option>`).join("")}</select>`;
}

// What the current tab and filters show.
function view() {
  const items = allItems(), run = latestRun();
  const base = tab === "liked" ? items.filter(isLiked) : tab === "unread" ? items.filter(it => !isRead(it)) : tab === "read" ? items.filter(isRead) : items;
  const q = F.q.trim().toLowerCase();
  const list = base.filter(it => (!q || (it.title + " " + it.summary + " " + it.source).toLowerCase().includes(q))
    && (!F.topic || it.topics.includes(F.topic)) && (!F.type || it.type === F.type) && (!F.source || it.source === F.source)
    && (!statusOn() || (F.status === "unread" ? !isRead(it) : F.status === "read" ? isRead(it) : isNew(it, run))))
    .sort((a, b) => tab === "liked" ? String(S.feed.liked[b.id]?.at || "").localeCompare(String(S.feed.liked[a.id]?.at || "")) || sortKey(b).localeCompare(sortKey(a))
      : sortKey(b).localeCompare(sortKey(a)) || String(b.firstFound).localeCompare(String(a.firstFound)) || a.title.localeCompare(b.title));
  return { items, run, base, list };
}

export function renderUpdates() {
  const { items, run, base, list } = view();
  const state = getFeedState();
  const publicFeed = getFeedSource() === "public";
  const schedule = publicFeed ? "Updated weekly from public design publications" : `Next update Sunday, ${fmtDate(nextSunday(), { year: true })} at 5:33 a.m.`;
  const count = (f) => base.filter(f).length;
  const topics = [...new Set(base.flatMap(it => it.topics))].map(t => [t, topicName(t), count(it => it.topics.includes(t))]).sort((a, b) => b[2] - a[2] || a[1].localeCompare(b[1]));
  const types = FEED_TYPES.filter(t => base.some(it => it.type === t)).map(t => [t, t, count(it => it.type === t)]);
  const sources = [...new Set(base.map(it => it.source))].map(s => [s, s, count(it => it.source === s)]).sort((a, b) => b[2] - a[2] || a[1].localeCompare(b[1]));
  const liked = items.filter(isLiked).length, unread = items.filter(it => !isRead(it)).length, fresh = run ? items.filter(it => isNew(it, run)).length : 0;
  const filtered = !!(F.q || F.topic || F.type || F.source || statusOn());
  const runRow = getFeedRuns().find(r => r.run === run);
  const lastLine = run ? `Last update ${fmtDate(run, { dow: true, year: true })}${!publicFeed && runRow?.items ? ` · ${runRow.items.length} item${runRow.items.length === 1 ? "" : "s"}` : ""}` : publicFeed && items.length ? "Starter reading list" : "No update yet";
  const note = state === "slow" ? `<p class="hint warn-note" role="status">${icon("alert", "sm")}Can't reach your saved updates yet. What's shown may be out of date.</p>`
    : state === "error" ? `<p class="hint warn-note" role="status">${icon("alert", "sm")}${items.length ? "Couldn't refresh the weekly updates. Showing saved items." : "Couldn't load the weekly updates."} Reload the page to try again.</p>` : "";

  const empty = !items.length
    ? `<div class="empty">${icon("news")}<b>${state === "loading" ? "Loading updates…" : state === "error" ? "Updates unavailable" : "No updates yet"}</b>${state === "loading" || state === "error" ? "" : publicFeed ? "The latest links will appear here after the next successful refresh." : "Updates appear here when the weekly task in Claude is set up and has run."}</div>`
    : tab === "unread" && !base.length ? `<div class="empty">${icon("check")}<b>You're all caught up</b>Nothing unread right now. New items arrive with the next Sunday update.</div>`
    : tab === "read" && !base.length ? `<div class="empty">${icon("check")}<b>Nothing read yet</b>Press Mark read on an item and it moves here.</div>`
    : tab === "liked" && !base.length ? `<div class="empty">${icon("heart")}<b>Nothing liked yet</b>Press Like on an item to keep it here. Liked items stay even after older weeks are cleared.</div>`
    : `<div class="empty"><b>Nothing matches</b>${filtered ? `<button class="btn btn-sm" type="button" data-act="fd-clear">Clear filters</button>` : ""}</div>`;

  return `<header class="page-h"><div><div class="eyebrow">Stay current</div><h1>What's new</h1>
      <p class="lead">${publicFeed ? "A weekly reading list from UX design publications, newest first. Like an article, mark it read or save it to your library." : "New articles, videos, resources, industry news and events for your skills from the weekly Claude task."}</p></div>
    <div class="fd-stats" aria-label="Summary"><span><b>${fresh}</b> new this week</span><span><b>${unread}</b> unread</span><span><b>${liked}</b> liked</span></div></header>
  <p class="fd-run small muted">${icon("clock", "sm")}<span>${esc(lastLine)} · ${esc(schedule)}</span></p>
  ${note}
  <nav class="subnav" aria-label="What's new sections"><a href="#updates" ${tab === "all" ? `aria-current="page"` : ""}>All updates <span class="muted">${items.length}</span></a><a href="#updates-unread" ${tab === "unread" ? `aria-current="page"` : ""}>Unread <span class="muted">${unread}</span></a><a href="#updates-read" ${tab === "read" ? `aria-current="page"` : ""}>${icon("check", "sm")}Read <span class="muted">${items.length - unread}</span></a><a href="#updates-liked" ${tab === "liked" ? `aria-current="page"` : ""}>${icon("heart", "sm")}Liked <span class="muted">${liked}</span></a></nav>
  <section class="card" aria-labelledby="fd-h">
    <div class="card-h"><h2 id="fd-h">${TAB_NAMES[tab] || "All updates"} <span class="sub">${list.length} of ${base.length}</span></h2>
      ${list.some(it => !isRead(it)) ? `<button class="btn btn-sm" type="button" data-act="fd-read-all">${icon("check", "sm")}Mark ${filtered ? "these" : "all"} as read</button>` : ""}</div>
    <div class="card-b">
      ${base.length ? `<div class="filters fd-filters" role="search">
        <label class="sr-only" for="fd-q">Search updates</label><input id="fd-q" type="search" placeholder="Search" value="${esc(F.q)}" data-change="fd-filter" data-k="q">
        ${select("fd-topic", "topic", "Topic", topics, "All topics")}
        ${select("fd-type", "type", "Type", types, "All types")}
        ${select("fd-source", "source", "Source", sources, "All sources")}
        ${tab === "read" ? "" : tab === "unread" ? select("fd-status", "status", "Status", [["new", "New this week"]], "Any unread") : select("fd-status", "status", "Status", [["new", "New this week"], ["unread", "Unread"], ["read", "Read"]], "Any status")}
        ${filtered ? `<button class="btn btn-ghost btn-sm" type="button" data-act="fd-clear">Clear filters</button>` : ""}
      </div>` : ""}
      ${list.length ? `<ul class="fd-list">${list.slice(0, limit).map(it => card(it, run)).join("")}</ul>
        ${list.length > limit ? `<div style="text-align:center;margin-top:12px"><button class="btn" type="button" data-act="fd-more">Show ${Math.min(PAGE, list.length - limit)} more <span class="muted">(${list.length - limit} left)</span></button></div>` : ""}` : empty}
    </div>
  </section>`;
}

const byId = id => allItems().find(it => it.id === id);
function strip(it) { const { firstFound, ...rest } = it; return rest; }

export const updatesActions = {
  "fd-more": () => { limit += PAGE; bus.render(); },
  "fd-clear": () => { Object.keys(F).forEach(k => { F[k] = ""; }); limit = PAGE; bus.render(); },
  "fd-topic": d => { F.topic = d.t; limit = PAGE; bus.render(); setTimeout(() => document.getElementById("fd-topic")?.focus(), 0); },
  "fd-like": d => {
    const it = byId(d.id); if (!it) return;
    if (S.feed.liked[it.id]) delete S.feed.liked[it.id];
    else S.feed.liked[it.id] = { at: new Date().toISOString(), item: strip(it) };
    save("feed"); bus.render();
  },
  "fd-read": d => {
    const it = byId(d.id); if (!it) return;
    const was = S.feed.read[it.id];
    if (was) delete S.feed.read[it.id]; else S.feed.read[it.id] = today();
    save("feed"); bus.render();
    // On the Unread and Read tabs the item leaves the list, so say where it went and offer a way back.
    if (tab === "unread" || tab === "read") toast(was ? "Moved to Unread" : "Moved to Read", { action: "Undo", onAction: () => { if (was) S.feed.read[it.id] = was; else delete S.feed.read[it.id]; save("feed"); bus.render(); } });
  },
  "fd-read-all": () => {
    const marked = view().list.filter(it => !isRead(it)).map(it => it.id);
    if (!marked.length) return;
    marked.forEach(id => { S.feed.read[id] = today(); });
    save("feed"); bus.render();
    toast(`${marked.length} marked as read`, { action: "Undo", onAction: () => { marked.forEach(id => delete S.feed.read[id]); save("feed"); bus.render(); } });
  },
  "fd-event": d => {
    const it = byId(d.id); if (!it || !it.event) return;
    openEventSheet({ prefill: { name: it.title, type: guessEventType(it.title, it.summary, it.event.where), date: it.event.date || today(), time: it.event.time || "", location: it.event.where || "", link: it.url, notes: "", about: it.summary || "", feedId: it.id } });
  },
  "fd-lib": d => {
    const it = byId(d.id); if (!it) return;
    const type = it.type === "Resource" ? "Guide" : it.type;
    const skills = it.topics.filter(t => S.skills.list.some(s => s.id === t));
    S.resources.list.push({ id: uid("r"), title: it.title, type, url: it.url, skills, week: 0, cost: it.cost || "Free", units: null, status: "todo", notes: it.summary, rating: 0, started: "", finished: "", last: "", checked: true, src: "news" });
    save("resources"); bus.render();
    toast("Saved to Courses & resources");
  }
};

const searchRender = (() => { let t; return () => { clearTimeout(t); t = setTimeout(() => bus.render(), 220); }; })();
export const updatesChanges = {
  "fd-filter": el => { if (el.type === "search") return; F[el.dataset.k] = el.value; limit = PAGE; bus.render(); }
};
export const updatesInputs = {
  "fd-filter": el => { if (el.type !== "search") return; F.q = el.value; limit = PAGE; searchRender(); }
};
