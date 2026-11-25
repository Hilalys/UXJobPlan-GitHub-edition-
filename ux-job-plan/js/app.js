// App shell: routing, navigation, actions, drag and drop, stopwatch ticks.

import * as store from "./store.js";
import { S, save, saveNow } from "./store.js";
import { STAGES } from "./content.js";
import { $, $$, esc, today, fmtClock } from "./util.js";
import { icon, toast, initTooltips, sheetOpen } from "./ui.js";
import * as M from "./model.js";
import * as T from "./timer.js";
import * as F from "./forms.js";
import { bus } from "./bus.js";
import { renderOverview } from "./views/overview.js";
import { renderPlan, setWeek, openWeekSheet, addWeek, planActions } from "./views/plan.js";
import * as SV from "./views/settings.js";
import { renderStage } from "./views/stage.js";
import { renderSkills, renderSkill, skillActions, setSort } from "./views/skills.js";
import { renderResources, resActions, setResFilter, setStatus as setResStatus } from "./views/resources.js";
import { renderReview, reviewActions, setReviewWeek, setField as setReviewField } from "./views/review.js";
import { debounce } from "./util.js";
import { renderResume, resumeActions, resumeInputs, resumeChanges, fitPreviews } from "./views/resume.js";
import { renderTailor, tailorActions, tailorInputs, tailorChanges, tailorSubmit } from "./views/tailor.js";
import { renderLinkedin, linkedinActions, linkedinInputs, linkedinChanges, linkedinSubmit } from "./views/linkedin.js";
import { renderPortfolio, renderCase, portfolioActions, portfolioInputs, portfolioChanges, portfolioSubmit, openNewCase, caseById } from "./views/portfolio.js";
import { checklistActions, toggleCheck } from "./checklist.js";
import { renderApplications, applicationsActions, applicationsChanges, applicationsInputs } from "./views/applications.js";
import { renderInterview, interviewActions, interviewChanges, interviewInputs, interviewSubmit, setTab as setIvTab } from "./views/interview.js";
import { renderStrategy, strategyActions, strategyChanges, strategyInputs } from "./views/strategy.js";
import { initPractice, practiceActions } from "./practice.js";
import { renderEvents, eventsActions, eventsChanges, setEventsTab } from "./views/events.js";
import { renderUpdates, updatesActions, updatesChanges, updatesInputs, setTab as setFeedTab, newCount as feedNewCount } from "./views/updates.js";
import { usesClaude } from "./ai.js";
import { checkBrowserAi } from "./browser-ai.js";

const NAV = [
  { g: "Stay current", items: [["updates", "What's new", "news"], ["events", "Events", "ticket"]] },
  { g: "Plan", items: [["overview", "Overview", "home"], ["plan", "Weekly plan", "calendar"], ["review", "Weekly review", "review"]] },
  { g: "Grow", items: [["skills", "Skills", "skills"], ["resources", "Courses & resources", "book"]] },
  { g: "Materials", items: [["resume", "Resume", "file"], ["tailor", "Resume Tailor", "wand"], ["linkedin", "LinkedIn", "idcard"], ["portfolio", "Portfolio", "folder"]] },
  { g: "Land the job", items: [["interview", "Interview prep", "mic"], ["applications", "Applications", "briefcase"], ["strategy", "Strategy & networking", "compass"]] }
];
const TITLES = Object.fromEntries([...NAV.flatMap(g => g.items.map(([k, l]) => [k, l])), ["tool-settings", "Settings"], ["skill", "Skill"], ["case", "Case study"], ["event", "Event"]]);
let param = "";

const main = $("#main");
let route = "overview";
let lastRoute = "";
let renderQueued = false;

function parseRoute() {
  const h = decodeURIComponent(location.hash.replace(/^#/, ""));
  const m = h.match(/^plan-w(\d+)$/);
  if (m) { setWeek(parseInt(m[1], 10)); return "plan"; }
  if (h === "plan") { setWeek(null); return "plan"; }
  const rw = h.match(/^review-w(\d+)$/);
  if (rw) { setReviewWeek(parseInt(rw[1], 10)); return "review"; }
  if (h === "review") { setReviewWeek(null); return "review"; }
  const sk = h.match(/^skill-([a-z0-9-]+)$/);
  if (sk) { param = sk[1]; return "skill"; }
  const iv = h.match(/^interview-([a-z]+)$/);
  if (iv) { setIvTab(iv[1]); param = iv[1]; return "interview"; }
  if (h === "interview") { setIvTab("loops"); param = "loops"; return "interview"; }
  if (/^updates(-(liked|unread|read))?$/.test(h)) { setFeedTab(h === "updates" ? "all" : h.slice(8)); param = h; return "updates"; }
  const ev = h.match(/^event-([a-z0-9_-]+)$/i);
  if (ev) { param = ev[1]; return "event"; }
  const evt = h.match(/^events(-(month|past))?$/);
  if (evt) { setEventsTab(evt[2] || "upcoming"); param = ""; return "events"; }
  const cs = h.match(/^case-([a-z0-9-]+)$/i);
  if (cs) { param = cs[1]; return "case"; }
  return TITLES[h] && h !== "skill" && h !== "case" && h !== "event" ? h : "overview";
}

function buildNav() {
  const nav = $("#nav");
  nav.innerHTML = NAV.map(g => `<div class="nav-group"><div>${g.g}</div>${g.items.map(([k, l, ic]) =>
    `<a href="#${k}" data-route="${k}">${icon(ic)}<span>${esc(l)}</span>${STAGES[k] ? `<span class="soon">Soon</span>` : ""}${k === "updates" ? `<span class="nav-badge" data-badge="updates" hidden></span>` : ""}</a>`).join("")}</div>`).join("");
  $("#nav-settings").innerHTML = `${icon("gear")}<span>Settings</span>`;
}

function updateNav() {
  const sub = route === "skill" || route === "case" || route === "event";
  const navRoute = route === "skill" ? "skills" : route === "case" ? "portfolio" : route === "event" ? "events" : route;
  $$("[data-route]").forEach(a => {
    if (a.dataset.route === navRoute) a.setAttribute("aria-current", sub ? "true" : "page"); else a.removeAttribute("aria-current");
  });
  const title = route === "skill" ? (M.skillById(param)?.name || "Skill") : route === "case" ? (caseById(param)?.title || "Case study") : route === "event" ? (S.events.list.find(e => e.id === param)?.name || "Event") : TITLES[route] || "";
  $("#top-title").textContent = title;
  const badge = $('[data-badge="updates"]');
  if (badge) { const n = feedNewCount(); badge.hidden = !n; badge.innerHTML = n ? `${n > 99 ? "99+" : n}<span class="sr-only"> new</span>` : ""; }
  document.title = `${title || "Overview"} · UX Job Plan`;
  const brandSub = $("#brand-sub"); const city = S.settings?.location?.city; if (brandSub) brandSub.textContent = city ? `Product design · ${city}` : "Product design";
}

// Remember focus across re-renders so keyboard and screen-reader users keep their place.
function focusKey(el) {
  if (!el || el === document.body || !main.contains(el)) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  const a = el.dataset.act || el.dataset.change;
  if (!a) return null;
  // Match on every data attribute so the same button in a list is found again.
  return [...el.attributes].filter(x => x.name.startsWith("data-") && x.name !== "data-tip").map(x => `[${x.name}="${CSS.escape(x.value)}"]`).join("");
}

export function render() {
  renderQueued = false;
  const key = focusKey(document.activeElement);
  const routeKey = route + ":" + param;
  const changed = routeKey !== lastRoute;
  let html = "";
  if (route === "overview") html = renderOverview();
  else if (route === "plan") html = renderPlan();
  else if (route === "tool-settings") html = SV.renderSettings();
  else if (route === "skills") html = renderSkills();
  else if (route === "skill") html = renderSkill(param);
  else if (route === "resources") html = renderResources();
  else if (route === "review") html = renderReview();
  else if (route === "resume") html = renderResume();
  else if (route === "tailor") html = renderTailor();
  else if (route === "linkedin") html = renderLinkedin();
  else if (route === "portfolio") html = renderPortfolio();
  else if (route === "case") html = renderCase(param);
  else if (route === "interview") html = renderInterview();
  else if (route === "applications") html = renderApplications();
  else if (route === "strategy") html = renderStrategy();
  else if (route === "updates") html = renderUpdates();
  else if (route === "events") html = renderEvents();
  else if (route === "event") html = renderEvents(param);
  else html = renderStage(route);
  main.innerHTML = html;
  if (main.querySelector(".rp-wrap")) requestAnimationFrame(() => fitPreviews(main));
  // Long plans: keep the selected week chip in view (without moving the page).
  const chip = main.querySelector('.week-chips [aria-pressed="true"]');
  if (chip) { const row = chip.parentElement; row.scrollLeft = Math.max(0, chip.offsetLeft - row.clientWidth / 2 + chip.offsetWidth / 2); }
  updateNav();
  updateTimerBar();
  if (changed) {
    lastRoute = routeKey;
    window.scrollTo(0, 0);
    const h1 = main.querySelector("h1");
    if (h1) { h1.tabIndex = -1; h1.style.outline = "none"; h1.focus({ preventScroll: true }); }
  } else if (key) {
    let el = null;
    try { el = main.querySelector(key); } catch { el = null; }
    if (el) {
      el.focus({ preventScroll: true });
      if (el.setSelectionRange && /^(text|search|url)$/.test(el.type)) { try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* not all inputs */ } }
    }
  }
}
bus.render = () => { if (sheetOpen()) { renderQueued = true; return; } render(); };
bus.applyTheme = applyTheme;
bus.afterSheet = () => { if (renderQueued) setTimeout(() => { if (!sheetOpen()) render(); }, 0); };

function applyTheme() {
  const t = S.settings.theme;
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

// ---------- Stopwatch display ----------
function updateTimerBar() {
  const bar = $("#timerbar");
  const show = T.active() && route !== "overview";
  bar.hidden = !show;
  document.body.classList.toggle("has-timerbar", show);
  if (!show) return;
  bar.innerHTML = `${S.timer.running ? `<span class="pulse" aria-hidden="true"></span>` : ""}
    <span class="tb-time" data-clock>${fmtClock(T.elapsed())}</span>
    <span class="tb-label">${esc(T.focusLabel() || (S.timer.running ? "Recording" : "Paused"))}</span>
    ${S.timer.running ? `<button class="icon-btn" type="button" data-act="timer-pause" aria-label="Pause stopwatch">${icon("pause")}</button>`
      : `<button class="icon-btn" type="button" data-act="timer-start" aria-label="Resume stopwatch">${icon("play")}</button>`}
    <button class="icon-btn" type="button" data-act="timer-stop" aria-label="Stop and save">${icon("stop")}</button>
    <a class="icon-btn" href="#overview" aria-label="Open the stopwatch in Overview">${icon("arrowR")}</a>`;
}
setInterval(() => {
  if (!S.timer || !S.timer.running) return;
  const t = fmtClock(T.elapsed());
  $$("[data-clock]").forEach(el => { el.textContent = t; });
}, 1000);

// ---------- Actions ----------
const actions = {
  "task-edit": d => F.openTaskSheet({ id: d.id }),
  "task-view": d => F.openTaskView(d.id),
  "add-task": d => F.openTaskSheet({ week: d.week ? parseInt(d.week, 10) : null, track: d.track || "learn" }),
  "today-add": d => {
    if (!S.today.ids.includes(d.id)) { S.today.ids.push(d.id); S.today.date = today(); save("today"); }
    bus.render(); toast("Added to today");
  },
  "today-remove": d => {
    const i = S.today.ids.indexOf(d.id); if (i < 0) return;
    S.today.ids.splice(i, 1); save("today"); bus.render();
    toast("Removed from today", { action: "Undo", onAction: () => { S.today.ids.splice(i, 0, d.id); save("today"); bus.render(); } });
  },
  "task-timer": d => T.startTask(d.id),
  "carry-keep": d => { const t = M.taskById(d.id); if (t) { t.carryPending = false; save("plan"); bus.render(); } },
  "carry-keep-all": () => { M.carryPending().forEach(t => { t.carryPending = false; }); save("plan"); bus.render(); toast("Kept in this week"); },
  "carry-move": d => F.openMoveSheet(d.id),
  "carry-drop": d => F.dropTask(d.id),
  "task-restore": d => { const t = M.taskById(d.id); if (t) { t.dropped = false; save("plan"); bus.render(); toast("Restored"); } },
  "task-delete": d => F.deleteTask(d.id),
  "add-event": () => F.openEventSheet(),
  "edit-event": d => F.openEventSheet({ id: d.id }),
  "all-events": () => { location.hash = "#events"; },
  "add-session": () => F.openSessionSheet(),
  "edit-session": d => F.openSessionSheet({ id: d.id }),
  "all-sessions": () => F.openAllSessions(),
  "timer-start": () => {
    if (!S.timer.focus) {
      const sel = $("#sw-focus");
      if (sel && sel.value) setFocus(sel.value, false);
    }
    T.start();
  },
  "timer-pause": () => T.pause(),
  "timer-stop": () => T.stopAndSave(),
  "timer-discard": () => T.discard(),
  "week-select": d => { location.hash = `#plan-w${d.n}`; },
  "week-edit": d => openWeekSheet(parseInt(d.n, 10)),
  "add-week": () => addWeek(),
  "scroll-carry": (d, e) => { e.preventDefault(); const c = $("#carry"); if (c) { c.scrollIntoView({ behavior: "smooth", block: "start" }); const h = c.querySelector("h2"); h.tabIndex = -1; h.focus({ preventScroll: true }); } },
  "backup": () => SV.doBackup(),
  "backup-copy": () => SV.doBackupCopy(),
  "csv": d => SV.doCsv(d.k),
  "restore-check": () => SV.checkRestoreText($("#restore-text")?.value || ""),
  "restore-apply": () => SV.applyRestore($$("input[name=rk]:checked").map(x => x.value)),
  "restore-cancel": () => SV.cancelRestore(),
  "reset": d => SV.doReset(d.k),
  "today-grip": () => {},
  ...SV.settingsActions,
  ...skillActions,
  ...planActions,
  ...resActions,
  ...reviewActions,
  ...resumeActions,
  ...tailorActions,
  ...linkedinActions,
  ...portfolioActions,
  ...checklistActions,
  ...applicationsActions,
  ...interviewActions,
  ...strategyActions,
  ...practiceActions,
  ...updatesActions,
  ...eventsActions,
  "proj-case": d => {
    const sk = M.skillById(d.id), p = sk?.projects.find(x => x.id === d.p); if (!p) return;
    openNewCase({ title: p.title, skills: [sk.id], next: p.steps[0] || "", fromProject: p.id });
  }
};

function setFocus(v, rerender = true) {
  if (!v) S.timer.focus = null;
  else if (v === "free") S.timer.focus = { kind: "free", label: S.timer.focus?.kind === "free" ? S.timer.focus.label : "", track: "learn" };
  else if (v.startsWith("task:")) {
    const t = M.taskById(v.slice(5));
    if (t) S.timer.focus = { kind: "task", id: t.id, label: t.title, track: t.track };
  } else if (v.startsWith("res:")) {
    const r = M.resById(v.slice(4));
    if (r) S.timer.focus = { kind: "res", id: r.id, label: r.title, track: "learn" };
  } else if (v.startsWith("case:")) {
    const c = caseById(v.slice(5));
    if (c) S.timer.focus = { kind: "case", id: c.id, label: c.title, track: "build" };
  } else if (v.startsWith("skill:")) {
    const k = M.skillById(v.slice(6));
    if (k) S.timer.focus = { kind: "skill", id: k.id, label: k.name, track: "practice" };
  }
  saveNow("timer");
  if (rerender) {
    bus.render();
    if (v === "free") setTimeout(() => $("#sw-free")?.focus(), 0);
  }
}

document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (el && actions[el.dataset.act]) {
    if (el.tagName === "A" && el.dataset.act !== "scroll-carry" && el.getAttribute("href")?.startsWith("#")) { /* let links route */ }
    actions[el.dataset.act](el.dataset, e);
  }
  if (e.target.closest("#nav-toggle")) toggleNav(true);
  if (e.target.closest("#scrim") || (e.target.closest(".side a") && innerWidth < 1100)) toggleNav(false);
});

const changes = {
  "task-toggle": (el) => {
    const t = M.taskById(el.dataset.id); if (!t) return;
    t.done = el.checked; t.doneAt = el.checked ? today() : "";
    if (t.done) t.carryPending = false;
    save("plan"); bus.render();
  },
  "timer-focus": el => setFocus(el.value),
  "week-notes": el => { const w = M.weekMeta(parseInt(el.dataset.n, 10)); if (w) { w.notes = el.value; save("plan"); } },
  "set-start": el => SV.setStart(el.value),
  "set-hours": el => SV.setHours(el.dataset.k, el.value),
  "set-theme": el => { S.settings.theme = el.value; saveNow("settings"); applyTheme(); },
  "set-ai": el => { S.settings.aiOn = el.checked; save("settings"); },
  "skills-sort": el => { setSort(el.value); render(); },
  "res-status": el => { const r = M.resById(el.dataset.id); if (!r) return; setResStatus(r, el.value); save("resources"); render(); },
  "res-filter": el => { if (el.type === "search") return; setResFilter(el.dataset.k, el.type === "checkbox" ? el.checked : el.value); render(); },
  "restore-file": el => SV.readRestoreFile(el.files && el.files[0]),
  "chk-toggle": el => toggleCheck(el.dataset.path, el.dataset.id, el.checked),
  ...SV.settingsChanges,
  ...resumeChanges,
  ...tailorChanges,
  ...linkedinChanges,
  ...portfolioChanges,
  ...applicationsChanges,
  ...interviewChanges,
  ...strategyChanges,
  ...updatesChanges,
  ...eventsChanges
};
const searchRender = debounce(() => render(), 220);
const inputs = {
  "res-filter": el => { if (el.type !== "search") return; setResFilter("q", el.value); searchRender(); },
  "skill-notes": el => { const k = M.skillById(el.dataset.id); if (k) { k.notes = el.value; save("skills"); } },
  "review-field": el => setReviewField(parseInt(el.dataset.n, 10), el.dataset.f, el.value),
  "timer-free": el => { if (S.timer.focus?.kind === "free") { S.timer.focus.label = el.value; save("timer"); } },
  "week-notes": changes["week-notes"],
  "set-profile": el => { S.settings.profile[el.dataset.f] = el.value; save("settings"); },
  ...resumeInputs,
  ...tailorInputs,
  ...linkedinInputs,
  ...portfolioInputs,
  ...applicationsInputs,
  ...interviewInputs,
  ...strategyInputs,
  ...updatesInputs
};
const submits = { ...tailorSubmit, ...linkedinSubmit, ...portfolioSubmit, ...interviewSubmit };
document.addEventListener("submit", e => {
  const f = e.target.closest("form[data-form]");
  if (f && main.contains(f)) { e.preventDefault(); if (submits[f.dataset.form]) submits[f.dataset.form](f, e); }
});
addEventListener("resize", debounce(() => { if (main.querySelector(".rp-wrap")) fitPreviews(main); }, 150));
document.addEventListener("change", e => {
  const el = e.target.closest("[data-change]");
  if (el && changes[el.dataset.change]) changes[el.dataset.change](el, e);
});
document.addEventListener("input", e => {
  const el = e.target.closest("[data-change]");
  if (el && inputs[el.dataset.change]) inputs[el.dataset.change](el, e);
});

// ---------- Drag and drop into Today ----------
let dragId = null, dragFrom = null;
document.addEventListener("dragstart", e => {
  const li = e.target.closest && e.target.closest("[data-drag]");
  if (!li) return;
  dragId = li.dataset.id; dragFrom = li.dataset.drag;
  e.dataTransfer.effectAllowed = "move";
  try { e.dataTransfer.setData("text/plain", dragId); } catch { /* some browsers block */ }
  requestAnimationFrame(() => li.classList.add("dragging"));
});
document.addEventListener("dragend", () => {
  $$(".dragging").forEach(x => x.classList.remove("dragging"));
  $$(".today-zone.over").forEach(x => x.classList.remove("over"));
  dragId = null; dragFrom = null;
});
document.addEventListener("dragover", e => {
  const zone = e.target.closest && e.target.closest("[data-drop=today]");
  if (!zone || !dragId) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  zone.classList.add("over");
});
document.addEventListener("dragleave", e => {
  const zone = e.target.closest && e.target.closest("[data-drop=today]");
  if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove("over");
});
document.addEventListener("drop", e => {
  const zone = e.target.closest && e.target.closest("[data-drop=today]");
  if (!zone || !dragId) return;
  e.preventDefault();
  zone.classList.remove("over");
  const before = e.target.closest("[data-key=today-item]");
  const ids = S.today.ids.filter(x => x !== dragId);
  let at = before ? ids.indexOf(before.dataset.id) : ids.length;
  if (before && before.dataset.id !== dragId) {
    const r = before.getBoundingClientRect();
    if (e.clientY > r.top + r.height / 2) at += 1;
  }
  if (at < 0) at = ids.length;
  ids.splice(at, 0, dragId);
  const added = dragFrom === "week";
  S.today.ids = ids; S.today.date = today();
  save("today"); render();
  if (added) toast("Added to today");
});

// Keyboard reorder for Today: Alt + Up/Down on an item's handle.
document.addEventListener("keydown", e => {
  if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
  const g = e.target.closest && e.target.closest("[data-act=today-grip]");
  if (!g) return;
  e.preventDefault();
  const ids = S.today.ids, i = ids.indexOf(g.dataset.id), j = e.key === "ArrowUp" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  save("today"); render();
  $(`[data-act=today-grip][data-id="${CSS.escape(g.dataset.id)}"]`)?.focus();
  toast(`Moved to position ${j + 1} of ${ids.length}`, { ms: 1500 });
});

// ---------- Navigation drawer ----------
function toggleNav(open) {
  document.body.classList.toggle("nav-open", open);
  $("#nav-toggle")?.setAttribute("aria-expanded", String(open));
  if (open) setTimeout(() => $("#nav a[aria-current]")?.focus() || $("#nav a")?.focus(), 50);
}
document.addEventListener("keydown", e => { if (e.key === "Escape" && document.body.classList.contains("nav-open")) { toggleNav(false); $("#nav-toggle")?.focus(); } });

// ---------- Sync status ----------
const STATUS = { loading: "Loading…", synced: "Saved to your account", saving: "Saving…", local: "Saved in this browser", offline: "Offline · saved in this browser", slow: "Connecting…" };
store.onStatus(s => { const el = $("#sync"); if (el) { el.dataset.s = s; el.querySelector("span").textContent = STATUS[s] || ""; } });
store.onSaveError(code => {
  if (code === "too_big") toast("This section is getting too large to save. Download a backup and clear old entries.");
  else if (code === "quota_exceeded") toast("Your account storage is full. Download a backup, then clear old entries.");
});
store.onRemote(() => {
  const a = document.activeElement;
  if (sheetOpen() || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && main.contains(a))) { renderQueued = true; return; }
  applyTheme(); render();
});
setInterval(() => {
  if (renderQueued && !sheetOpen()) {
    const a = document.activeElement;
    if (!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) render();
  }
}, 1500);

// New day or week while the page is open.
let lastDay = today();
setInterval(() => {
  if (today() === lastDay) return;
  lastDay = today();
  M.syncToday(); M.rollover(); bus.render();
}, 60000);

addEventListener("hashchange", () => { route = parseRoute(); render(); });
addEventListener("pagehide", () => store.flushAll());
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") store.flushAll(); });

// ---------- Boot ----------
(async function boot() {
  buildNav();
  initTooltips();
  route = parseRoute();
  updateNav();
  await Promise.all([store.init(), usesClaude() ? null : checkBrowserAi()]);
  initPractice();
  applyTheme();
  M.syncToday();
  const moved = M.rollover();
  render();
  if (moved) toast(`${moved} unfinished task${moved > 1 ? "s" : ""} moved into this week`);
})();
