// Overview: week header, metric cards, Today's tasks, this week, hours and events.

import { S } from "../store.js";
import { TRACKS, TRACK_KEYS, SKILLS } from "../content.js";
import { esc, addDays, fmtDate, fmtHours, fmtMin, fmtClock, fmtTime, relDay, monthShort, dayNum, today, dowLong, sum, pct, safeUrl } from "../util.js";
import { icon, CHECK_SVG, meter, columns, segmented, legend, skillBars, weekLabels } from "../ui.js";
import * as M from "../model.js";
import * as T from "../timer.js";
import { dueItems } from "../model4.js";
import { eventImgUrl } from "../forms.js";

const trk = k => `<span class="trk"><i class="dot" style="--c:${TRACKS[k]?.color || "var(--c-neutral)"}"></i>${esc(TRACKS[k]?.name || "Other")}</span>`;

export function checkbox(t, label) {
  return `<span class="check"><input type="checkbox" data-change="task-toggle" data-id="${t.id}" ${t.done ? "checked" : ""} aria-label="${esc(label || `Done: ${t.title}`)}"><span>${CHECK_SVG}</span></span>`;
}

function weekHeader(n) {
  const w = M.weekMeta(n);
  const before = M.beforeStart();
  const eyebrow = before
    ? `Week 1 of ${M.weekCount()} · starts ${dowLong(M.weekStart(1))}, ${fmtDate(M.weekStart(1))}`
    : `Week ${n} of ${M.weekCount()} · ${fmtDate(M.weekStart(n))} – ${fmtDate(M.weekEnd(n))}`;
  const strip = S.plan.weeks.map(x => {
    const p = M.weekProgress(x.n);
    return `<a href="#plan-w${x.n}" class="${x.n === n ? "current" : ""}" data-tip="${esc(`Week ${x.n} · ${Math.round(p.pct * 100)}%`)}|${esc(x.theme)}" aria-label="Week ${x.n}: ${esc(x.theme)}, ${Math.round(p.pct * 100)}% done"><span style="height:${Math.round(p.pct * 100)}%"></span></a>`;
  }).join("");
  return `<header class="week-h">
    <div>
      <div class="page-h" style="margin:0;display:block"><div class="eyebrow">${eyebrow}</div></div>
      <h1>${esc(w?.theme || "Your plan")}</h1>
      ${w?.goal ? `<p class="goal">${esc(w.goal)}</p>` : ""}
      <nav class="week-strip" aria-label="Weeks" style="grid-template-columns:repeat(${S.plan.weeks.length},1fr)">${strip}</nav>
      <div class="week-strip-labels"><span>Week 1</span><span>Done per week</span><span>Week ${M.weekCount()}</span></div>
    </div>
    <div class="actions"><a class="btn" href="#plan">${icon("calendar", "sm")}Preview weekly plan</a></div>
  </header>`;
}

function metricCards(n) {
  // 1. Plan progress
  const p = M.weekProgress(n);
  const el = M.weekElapsed(n);
  const expected = Math.round(p.total * el);
  const behind = p.done < expected;
  const planCard = `<section class="card metric" aria-labelledby="m1">
    <div class="m-h"><span class="m-label" id="m1">Tasks this week</span></div>
    <div class="m-row"><div class="m-val">${p.done}<small>of ${p.total}</small></div>${el > 0 ? `<span class="tag ${behind ? "warn" : "good"}">${behind ? `${expected - p.done} behind pace` : "On pace"}</span>` : `<span class="tag">Not started</span>`}</div>
    ${meter(p.done, p.total, { marker: el > 0 && el < 1 ? p.total * el : null, label: `${p.done} of ${p.total} tasks done; expected about ${expected} by today` })}
    <p class="m-note"><b>${fmtHours(p.doneHours)}</b> of ${fmtHours(p.hours)} planned task time done${el > 0 && el < 1 ? ` · the line marks where you'd be at an even pace` : ""}</p>
  </section>`;

  // 2. Hours
  const pr = M.productivity(n);
  const byT = M.workedByTrack(n);
  const planned = M.plannedTotal(n);
  const paceH = planned * el;
  const rows = TRACK_KEYS.map(k => `<div class="trow"><span class="tn"><i class="dot" style="--c:${TRACKS[k].color}"></i>${TRACKS[k].name}</span>
      ${meter(byT[k], M.trackTarget(n, k), { color: TRACKS[k].color, thin: true, label: `${TRACKS[k].name}: ${fmtHours(byT[k])} of ${fmtHours(M.trackTarget(n, k))}` })}
      <span class="tv">${fmtHours(byT[k])} / ${fmtHours(M.trackTarget(n, k))}</span></div>`).join("");
  const ratio = pr.ratio == null ? "–" : `${Math.round(pr.ratio * 100)}%`;
  const hoursCard = `<section class="card metric" aria-labelledby="m2">
    <div class="m-h"><span class="m-label" id="m2">Hours worked</span></div>
    <div class="m-row"><div class="m-val">${fmtHours(pr.worked).replace("h", "")}<small>of ${planned}h</small></div>${el > 0 ? `<span class="tag ${pr.worked + 0.01 >= paceH ? "good" : "warn"}">${pr.worked + 0.01 >= paceH ? "On pace" : `${fmtHours(paceH - pr.worked)} behind`}</span>` : ""}</div>
    <div class="trows">${rows}</div>
    <p class="m-note" data-tip="${esc(`Productivity ${ratio}`)}|Planned hours of tasks you finished this week, divided by hours worked."><b>Productivity ${ratio}</b> · ${fmtHours(pr.doneHours)} of task time done in ${fmtHours(pr.worked)} worked</p>
  </section>`;

  // 3. Applications
  const ap = M.appsPerWeek();
  const thisWk = ap.counts[n - 1] || 0, target = ap.targets[n - 1] || 0;
  const total = sum(ap.counts);
  const appsCard = `<section class="card metric" aria-labelledby="m3">
    <div class="m-h"><span class="m-label" id="m3">Applications</span><a class="m-link" href="#applications">Open</a></div>
    <div class="m-row"><div class="m-val">${thisWk}<small>this week</small></div>${target ? `<span class="tag ${thisWk >= target ? "good" : "info"}">Target ${target}</span>` : `<span class="tag">From Week 3</span>`}</div>
    <div>${columns(ap.counts, ap.targets, ap.counts.map((_, i) => `Week ${i + 1}`), { cur: n - 1, unit: "sent" })}
      ${weekLabels(ap.counts.length)}</div>
    <p class="m-note"><b>${total}</b> sent in total · bars are weeks, ticks are targets</p>
  </section>`;

  // 4. Feedback
  const fb = M.feedback();
  const fbCard = `<section class="card metric" aria-labelledby="m4">
    <div class="m-h"><span class="m-label" id="m4">Feedback</span><a class="m-link" href="#applications">Charts</a></div>
    <div class="m-row"><div class="m-val">${fb.replied}<small>of ${fb.sent} replied</small></div>${fb.sent ? `<span class="tag info">${Math.round(fb.rate * 100)}%</span>` : ""}</div>
    ${segmented(fb.parts, { tall: true, label: `Application outcomes: ${fb.parts.map(x => `${x.label} ${x.value}`).join(", ")}` })}
    ${fb.sent ? legend(fb.parts) : `<p class="m-note">Outcomes show here as replies come in: no reply, rejected, advancing, offer.</p>`}
  </section>`;

  // 5. Skills
  const sk = M.skillSummary();
  const names = Object.fromEntries(SKILLS.map(s => [s.id, s.name]));
  const avgNow = sk.total ? sum(sk.list, s => s.now) / sk.total : 0, avgT = sk.total ? sum(sk.list, s => s.target) / sk.total : 0;
  const skillCard = `<section class="card metric" aria-labelledby="m5">
    <div class="m-h"><span class="m-label" id="m5">Skill growth</span><a class="m-link" href="#skills">Skills</a></div>
    <div class="m-val">${sk.met}<small>of ${sk.total} at target</small></div>
    ${skillBars(sk.list.map(s => ({ ...s, name: s.name || names[s.id] })))}
    <p class="m-note">Average level <b>${avgNow.toFixed(1)}</b> → target ${avgT.toFixed(1)} · ticks mark targets</p>
  </section>`;

  return `<div class="metrics">${planCard}${hoursCard}${appsCard}${fbCard}${skillCard}</div>`;
}

function carryLabel() {
  const prev = S.today.prevDate;
  if (!prev || prev === addDays(today(), -1)) return "From yesterday";
  return `From ${fmtDate(prev)}`;
}

function todayItem(t, i, len) {
  const carried = S.today.carried.includes(t.id);
  return `<li class="task ${t.done ? "is-done" : ""}" draggable="true" data-drag="today" data-id="${t.id}" data-key="today-item" tabindex="-1">
    <button class="grip" type="button" data-act="today-grip" data-id="${t.id}" aria-label="Reorder ${esc(t.title)}. Use Alt and the arrow keys." aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown">${icon("grip", "sm")}</button>
    ${checkbox(t)}
    <div class="t-body"><div class="t-title"><button type="button" data-act="task-view" data-id="${t.id}">${esc(t.title)}</button></div>
      <div class="t-meta">${trk(t.track)}<span>${fmtHours(t.hours)}</span>${carried ? `<span class="carry-tag">${carryLabel()}</span>` : ""}${t.week !== M.currentWeek() ? `<span>Week ${t.week}</span>` : ""}</div></div>
    <div class="t-actions">
      ${!t.done ? `<button class="icon-btn sm" type="button" data-act="task-timer" data-id="${t.id}" aria-label="Start stopwatch on ${esc(t.title)}" data-tip="Start stopwatch">${icon("play", "sm")}</button>` : ""}
      <button class="icon-btn sm" type="button" data-act="today-remove" data-id="${t.id}" aria-label="Remove ${esc(t.title)} from today" data-tip="Remove from today">${icon("x", "sm")}</button>
    </div></li>`;
}

function weekItem(t) {
  const inT = M.inToday(t.id);
  return `<li class="task ${t.done ? "is-done" : ""}" ${!t.done && !inT ? `draggable="true" data-drag="week"` : ""} data-id="${t.id}">
    ${!t.done && !inT ? `<span class="grip" aria-hidden="true" title="Drag to Today">${icon("grip", "sm")}</span>` : `<span class="grip" aria-hidden="true"></span>`}
    ${checkbox(t)}
    <div class="t-body"><div class="t-title"><button type="button" data-act="task-view" data-id="${t.id}">${esc(t.title)}</button></div>
      <div class="t-meta"><span>${fmtHours(t.hours)}</span>${t.carriedFrom ? `<span class="carry-tag">From Week ${t.carriedFrom}</span>` : ""}
        ${t.res.slice(0, 2).map(r => safeUrl(r.u) ? `<a href="${esc(safeUrl(r.u))}" target="_blank" rel="noopener noreferrer">${esc(r.l.length > 38 ? r.l.slice(0, 36) + "…" : r.l)}</a>` : "").join("")}${t.res.length > 2 ? `<span>+${t.res.length - 2} more</span>` : ""}</div></div>
    <div class="t-actions">${t.done ? "" : inT ? `<span class="tag">In Today</span>` : `<button class="btn btn-sm" type="button" data-act="today-add" data-id="${t.id}" aria-label="Add ${esc(t.title)} to today">${icon("plus", "sm")}Today</button>`}</div>
  </li>`;
}

function todayCard() {
  const list = M.todayTasks();
  const done = list.filter(t => t.done);
  const plannedH = sum(list, t => t.hours);
  const workedToday = M.hoursToday();
  const items = list.length ? `<ul class="tasks" data-list="today">${list.map((t, i) => todayItem(t, i, list.length)).join("")}</ul>`
    : `<div class="zone-empty"><b>${S.today.carried.length ? "All done from yesterday." : "Nothing planned for today yet."}</b>Drag tasks here from This week, or press <span class="nowrap">+ Today</span> on a task.</div>`;
  return `<section class="card" aria-labelledby="today-h">
    <div class="card-h"><h2 id="today-h">${icon("today")}Today's tasks <span class="sub">${dowLong(today())}, ${fmtDate(today())}</span></h2>
      <button class="btn btn-sm" type="button" data-act="add-task">${icon("plus", "sm")}Task</button></div>
    <div class="card-b">
      ${list.length ? `<div class="today-sum" style="margin-bottom:10px"><span><b>${done.length}</b> of ${list.length} done</span><span><b>${fmtHours(plannedH)}</b> planned</span><span><b>${fmtHours(workedToday)}</b> worked today</span></div>` : ""}
      <div class="today-zone" data-drop="today" aria-label="Today's tasks drop area">${items}</div>
    </div></section>`;
}

function thisWeekCard(n) {
  const groups = TRACK_KEYS.map(k => {
    const ts = M.tasksByTrack(n, k).sort((a, b) => (a.done - b.done) || a.order - b.order);
    if (!ts.length) return "";
    const d = ts.filter(t => t.done).length;
    const h = sum(ts, t => t.hours);
    return `<details class="track" data-track="${k}" ${d < ts.length ? "open" : ""}>
      <summary><span class="chev">${icon("chev", "sm")}</span><h3><i class="dot" style="--c:${TRACKS[k].color}"></i>${TRACKS[k].name}</h3>
        <span class="meta"><span>${d}/${ts.length}</span>${meter(d, ts.length, { color: TRACKS[k].color, thin: true, label: `${TRACKS[k].name}: ${d} of ${ts.length} done` })}<span>${fmtHours(h)}</span></span></summary>
      <ul class="tasks">${ts.map(weekItem).join("")}</ul></details>`;
  }).join("");
  return `<section class="card" aria-labelledby="wk-h">
    <div class="card-h"><h2 id="wk-h">${icon("calendar")}This week <span class="sub">Week ${n}</span></h2><a class="btn btn-sm btn-ghost" href="#plan-w${n}">Open plan ${icon("arrowR", "sm")}</a></div>
    <div class="card-b"><div class="week-tracks">${groups || `<div class="empty"><b>No tasks this week</b>Add one from the weekly plan.</div>`}</div></div></section>`;
}

function carryCard() {
  const list = M.carryPending();
  if (!list.length) return "";
  return `<section class="card" id="carry" aria-labelledby="carry-h">
    <div class="card-h"><h2 id="carry-h">${icon("undo")}From last week <span class="sub">${list.length} unfinished</span></h2>
      <button class="btn btn-sm btn-ghost" type="button" data-act="carry-keep-all">Keep all</button></div>
    <div class="card-b"><p class="muted small" style="margin-bottom:10px">These moved into this week. Keep them, move them later, or let them go.</p>
      <ul class="tasks">${list.map(t => `<li class="task compact" data-id="${t.id}">
        <div class="t-body" style="grid-column:1/3"><div class="t-title"><button type="button" data-act="task-view" data-id="${t.id}">${esc(t.title)}</button></div>
          <div class="t-meta">${trk(t.track)}<span>${fmtHours(t.hours)}</span><span class="carry-tag">From Week ${t.carriedFrom}</span></div></div>
        <div class="t-actions" style="flex-wrap:wrap;justify-content:flex-end">
          <button class="btn btn-sm" type="button" data-act="carry-keep" data-id="${t.id}">Keep</button>
          <button class="btn btn-sm" type="button" data-act="carry-move" data-id="${t.id}">Move</button>
          <button class="btn btn-sm btn-ghost" type="button" data-act="carry-drop" data-id="${t.id}">Let go</button></div></li>`).join("")}</ul></div></section>`;
}

export function focusOptions() {
  const cur = S.timer.focus;
  const todayL = M.todayTasks().filter(t => !t.done);
  const wk = M.weekTasks(M.currentWeek()).filter(t => !t.done && !M.inToday(t.id));
  const doing = S.resources.list.filter(r => r.status === "doing");
  const opt = t => `<option value="task:${t.id}" ${cur?.kind === "task" && cur.id === t.id ? "selected" : ""}>${esc(t.title)}</option>`;
  return `<option value="">Choose what you're working on</option>
    ${todayL.length ? `<optgroup label="Today">${todayL.map(opt).join("")}</optgroup>` : ""}
    ${wk.length ? `<optgroup label="This week">${wk.map(opt).join("")}</optgroup>` : ""}
    ${doing.length ? `<optgroup label="Resources in progress">${doing.map(r => `<option value="res:${r.id}" ${cur?.kind === "res" && cur.id === r.id ? "selected" : ""}>${esc(r.title)}</option>`).join("")}</optgroup>` : ""}
    ${S.portfolio.cases.some(c => !c.archived && c.status !== "published") ? `<optgroup label="Case studies">${S.portfolio.cases.filter(c => !c.archived && c.status !== "published").map(c => `<option value="case:${c.id}" ${cur?.kind === "case" && cur.id === c.id ? "selected" : ""}>${esc(c.title)}</option>`).join("")}</optgroup>` : ""}
    <optgroup label="Skills">${S.skills.list.map(k => `<option value="skill:${k.id}" ${cur?.kind === "skill" && cur.id === k.id ? "selected" : ""}>${esc(k.name)}</option>`).join("")}</optgroup>
    <option value="free" ${cur?.kind === "free" ? "selected" : ""}>Something else…</option>`;
}

function hoursCard(n) {
  const running = S.timer.running;
  const act = T.active();
  const pr = M.productivity(n);
  const recent = S.sessions.list.slice(0, 5);
  const free = S.timer.focus?.kind === "free";
  return `<section class="card" aria-labelledby="hrs-h">
    <div class="card-h"><h2 id="hrs-h">${icon("clock")}Hours <span class="sub">Week ${n}</span></h2></div>
    <div class="card-b">
      <div class="hours-sum"><div><span>Worked</span><b>${fmtHours(pr.worked)}</b></div><div><span>Planned</span><b>${fmtHours(M.plannedTotal(n))}</b></div><div><span>Today</span><b>${fmtHours(M.hoursToday())}</b></div></div>
      <hr class="divider">
      <div class="sw ${running ? "running" : ""}" aria-labelledby="sw-h">
        <div class="sw-row"><h3 id="sw-h" class="sr-only">Stopwatch</h3>
          <div class="sw-clock" data-clock aria-live="off">${fmtClock(T.elapsed())}</div>
          ${running ? `<span class="tag bad" style="gap:6px"><span class="pulse"></span>Recording</span>` : act ? `<span class="tag">Paused</span>` : ""}</div>
        <div class="field"><label for="sw-focus">Focus</label><select id="sw-focus" data-change="timer-focus">${focusOptions()}</select></div>
        ${free ? `<div class="field"><label for="sw-free" class="sr-only">What are you working on?</label><input id="sw-free" type="text" data-change="timer-free" value="${esc(S.timer.focus.label || "")}" placeholder="What are you working on?" maxlength="160"></div>` : ""}
        <div class="actions">
          ${running ? `<button class="btn" type="button" data-act="timer-pause">${icon("pause", "sm")}Pause</button>`
            : `<button class="btn btn-primary" type="button" data-act="timer-start">${icon("play", "sm")}${act ? "Resume" : "Start"}</button>`}
          <button class="btn" type="button" data-act="timer-stop" ${act ? "" : "disabled"}>${icon("stop", "sm")}Stop and save</button>
          ${act ? `<button class="btn btn-ghost" type="button" data-act="timer-discard">Clear</button>` : ""}
        </div>
      </div>
      <hr class="divider">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px">
        <h3>Recent sessions</h3><button class="btn btn-sm" type="button" data-act="add-session">${icon("plus", "sm")}Add hours</button></div>
      ${recent.length ? `<ul class="sessions">${recent.map(s => `<li><div class="s-label"><b>${esc(s.label)}</b><span><i class="dot" style="--c:${TRACKS[s.track]?.color || "var(--c-neutral)"}"></i>${relDay(s.date)}</span></div>
          <span class="s-dur">${fmtMin(s.min)}</span><button class="icon-btn sm boxed" type="button" data-act="edit-session" data-id="${s.id}" aria-label="Edit session: ${esc(s.label)}">${icon("edit", "sm")}</button></li>`).join("")}</ul>
        <button class="link-btn" type="button" data-act="all-sessions">See all ${S.sessions.list.length} sessions</button>`
        : `<p class="muted small">No sessions yet. Start the stopwatch, or add hours by hand.</p>`}
    </div></section>`;
}

function eventsCard() {
  const up = M.upcomingEvents();
  const next = up[0];
  const rest = up.slice(1, 5);
  const nextImg = next ? eventImgUrl(next) : "";
  const nextHtml = next ? `<div class="ev-next">
      ${nextImg ? `<img class="ev-img" src="${esc(nextImg)}" alt="" loading="lazy">` : ""}
      <div class="ev-date" aria-hidden="true"><small>${monthShort(next.date)}</small><b>${dayNum(next.date)}</b></div>
      <div style="min-width:0"><span class="type-pill">${esc(next.type)}</span>
        <h3 style="margin-top:6px"><button class="link-btn" style="all:unset;cursor:pointer;font:inherit" type="button" data-act="edit-event" data-id="${next.id}">${esc(next.name)}</button></h3>
        <div class="ev-meta"><span>${icon("clock", "sm")}${relDay(next.date)}${next.time ? ` · ${fmtTime(next.time)}` : ""}</span>
          ${next.location ? `<span>${icon("pin", "sm")}${esc(next.location)}</span>` : ""}
          ${next.link ? `<span>${icon("link", "sm")}<a href="${esc(next.link)}" target="_blank" rel="noopener noreferrer">Event page</a></span>` : ""}</div>
        <a class="btn btn-sm ev-prep-link" href="#event-${next.id}">${icon("sparkle", "sm")}${S.evprep?.map?.[next.id]?.result ? "See your prep" : "Prepare"}</a></div></div>` : "";
  return `<section class="card" aria-labelledby="ev-h">
    <div class="card-h"><h2 id="ev-h">${icon("flag")}Events</h2><button class="btn btn-sm" type="button" data-act="add-event">${icon("plus", "sm")}Add event</button></div>
    <div class="card-b">
      ${next ? nextHtml : `<div class="empty">${icon("calendar")}<b>No upcoming events</b>Add meetups, coffee chats, interviews and deadlines.</div>`}
      ${rest.length ? `<ul class="ev-list">${rest.map(e => `<li><div class="d">${monthShort(e.date)}<b>${dayNum(e.date)}</b></div>
        <div class="n"><a class="ev-name-link" href="#event-${e.id}">${esc(e.name)}</a><span>${[relDay(e.date), e.time ? fmtTime(e.time) : "", e.location].filter(Boolean).map(esc).join(" · ")}</span></div>
        <button class="icon-btn sm boxed" type="button" data-act="edit-event" data-id="${e.id}" aria-label="Edit event: ${esc(e.name)}">${icon("edit", "sm")}</button></li>`).join("")}</ul>` : ""}
      ${S.events.list.length ? `<button class="link-btn" type="button" data-act="all-events" style="margin-top:6px">See all events</button>` : ""}
    </div></section>`;
}

function followupsCard() {
  const items = dueItems(7);
  if (!items.length) return "";
  const over = items.filter(i => i.overdue).length;
  const kind = { app: "Application", contact: "Contact", company: "Company", referral: "Referral" };
  return `<section class="card" aria-labelledby="fu-h">
    <div class="card-h"><h2 id="fu-h">${icon("flag")}Follow-ups</h2><span class="sub">${over ? `<b class="warn-text">${over} overdue</b> · ` : ""}next 7 days</span></div>
    <div class="card-b"><ul class="fu-list">${items.slice(0, 6).map(i => `<li class="${i.overdue ? "overdue" : ""}"><div><b>${esc(i.label)}</b><span class="small muted">${esc(kind[i.kind])} · ${esc(i.sub)}</span></div>
      <span class="tag ${i.overdue ? "bad" : i.date === today() ? "warn" : ""}">${i.overdue ? "Overdue · " : ""}${relDay(i.date)}</span><a class="icon-btn sm" href="${i.href}" aria-label="Open ${esc(kind[i.kind].toLowerCase())}: ${esc(i.sub)}">${icon("arrowR", "sm")}</a></li>`).join("")}</ul>
      ${items.length > 6 ? `<p class="small muted">${items.length - 6} more in Applications and Strategy.</p>` : ""}</div></section>`;
}

function banners(n) {
  const out = [];
  const carry = M.carryPending().length;
  const st = S.settings;
  if (!st.setupHidden && !st.me?.built && !st.location?.city) out.push(`<div class="banner setup" role="note">${icon("wand")}<p><b>Make this plan yours.</b> Add your city and where you're starting from, and the plan rebuilds around you. Or keep the full built-in plan as it is.</p><a class="btn btn-sm btn-primary" href="#tool-settings">Set up</a><button class="btn btn-sm btn-ghost" type="button" data-act="setup-hide">Not now</button></div>`);
  if (carry) out.push(`<div class="banner warn" role="note">${icon("undo")}<p><b>${carry} unfinished task${carry > 1 ? "s" : ""}</b> moved into this week from last week.</p><a class="btn btn-sm" href="#carry" data-act="scroll-carry">Review</a></div>`);
  if (M.isSunday()) out.push(`<div class="banner" role="note">${icon("review")}<p><b>It's Sunday.</b> A good moment to review the week and pick next week's focus.</p><a class="btn btn-sm" href="#review">Weekly review</a></div>`);
  if (M.pastPlan()) out.push(`<div class="banner" role="note">${icon("flag")}<p><b>You've reached the end of the ${M.weekCount()}-week plan.</b> Add a week to keep going.</p><button class="btn btn-sm" type="button" data-act="add-week">Add a week</button></div>`);
  return out.join("");
}

export function renderOverview() {
  const n = M.currentWeek();
  return `${weekHeader(n)}${banners(n)}${metricCards(n)}
    <div class="quick" role="group" aria-label="Quick add"><span class="q-label">Quick add</span>
      <button class="btn" type="button" data-act="add-task">${icon("plus", "sm")}Task</button>
      <button class="btn" type="button" data-act="add-event">${icon("plus", "sm")}Event</button>
      <button class="btn" type="button" data-act="add-session">${icon("plus", "sm")}Work session</button></div>
    <div class="ov-grid">
      <div class="ov-col">
        <div class="ov-today">${todayCard()}</div>
        ${carryCard() ? `<div class="ov-carry">${carryCard()}</div>` : ""}
        <div class="ov-week">${thisWeekCard(n)}</div>
      </div>
      <div class="ov-col">
        <div class="ov-hours">${hoursCard(n)}</div>
        ${followupsCard() ? `<div class="ov-follow">${followupsCard()}</div>` : ""}
        <div class="ov-events">${eventsCard()}</div>
      </div>
    </div>`;
}
