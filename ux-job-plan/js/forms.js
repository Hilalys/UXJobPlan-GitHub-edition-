// Add/edit sheets for tasks, work sessions and events.

import { S, save } from "./store.js";
import { TRACKS, TRACK_KEYS, SKILLS, EVENT_TYPES } from "./content.js";
import { esc, uid, today, fmtDate, fmtMin, fmtTime, safeUrl, clamp, sum, $, $$ } from "./util.js";
import { sheet, toast, icon, confirmSheet } from "./ui.js";
import { currentWeek, weekCount, taskById, weekTasks, weekStart, weekEnd, inWeek, upcomingEvents, pastEvents } from "./model.js";
import { bus } from "./bus.js";

// Uploaded pictures (event images) live in the page's own file store.
let assetsP = null;
const getAssets = () => assetsP || (assetsP = (async () => { try { return window.claude?.use ? await window.claude.use("assets") : null; } catch { return null; } })());
const dropAsset = async id => { try { const a = await getAssets(); if (a && id) await a.delete(id); } catch { /* already gone */ } };
export const eventImgUrl = e => { const u = e?.img?.url || (e?.img?.id ? "/_blob/" + e.img.id : ""); return /^(\/_blob\/|https:\/\/|blob:)/.test(u) ? u : ""; };

const trackSeg = (name, sel) => `<div class="seg-ctl" role="radiogroup" aria-label="Track">${TRACK_KEYS.map(k =>
  `<label><input type="radio" name="${name}" value="${k}" ${k === sel ? "checked" : ""}><span><i class="dot" style="--c:${TRACKS[k].color}"></i>${TRACKS[k].name}</span></label>`).join("")}</div>`;

const weekOptions = sel => Array.from({ length: weekCount() }, (_, i) => i + 1).map(n => {
  const w = S.plan.weeks[n - 1];
  return `<option value="${n}" ${n === sel ? "selected" : ""}>Week ${n}: ${esc(w?.theme || "")}</option>`;
}).join("");

// ---------------- Tasks ----------------
// Read-only task details. Clicking a task's title opens this; editing is one more step (the Edit button).
export function openTaskView(id) {
  const t = taskById(id); if (!t) return;
  const skillName = k => SKILLS.find(x => x.id === k)?.name || S.skills.list.find(x => x.id === k)?.name || k;
  const res = (t.res || []).filter(r => safeUrl(r.u));
  const logged = sum(S.sessions.list.filter(x => x.taskId === t.id), x => x.min);
  const status = t.dropped ? "Let go" : t.done ? `Done${t.doneAt ? ` on ${fmtDate(t.doneAt)}` : ""}` : S.today.ids.includes(t.id) ? "In today's list" : "Not done yet";
  const rows = [
    ["Track", `<span class="trk"><i class="dot" style="--c:${TRACKS[t.track]?.color || "var(--c-neutral)"}"></i>${esc(TRACKS[t.track]?.name || "Other")}</span>`],
    ["Week", `Week ${t.week}${S.plan.weeks[t.week - 1]?.theme ? `: ${esc(S.plan.weeks[t.week - 1].theme)}` : ""}${t.carriedFrom ? ` <span class="carry-tag">From Week ${t.carriedFrom}</span>` : ""}`],
    ["Planned", `${esc(String(t.hours))}h${logged ? ` · ${fmtMin(logged)} logged` : ""}`],
    ["Status", esc(status)]
  ];
  sheet({
    title: t.title,
    body: `<div class="task-view">
      <dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
      ${t.detail ? `<div><h3>Details</h3><p class="pre">${esc(t.detail)}</p></div>` : ""}
      ${res.length ? `<div><h3>Links</h3><ul class="plain tv-links">${res.map(r => `<li><a href="${esc(safeUrl(r.u))}" target="_blank" rel="noopener noreferrer">${icon("ext", "sm")}${esc(r.l || r.u)}<span class="sr-only"> (opens in a new tab)</span></a></li>`).join("")}</ul></div>` : ""}
      ${(t.skills || []).length ? `<div><h3>Skills</h3><div class="chips">${t.skills.map(k => `<span class="chip">${esc(skillName(k))}</span>`).join("")}</div></div>` : ""}
    </div>`,
    foot: `<span class="spacer"></span><button class="btn btn-ghost" type="button" data-close>Close</button><button class="btn btn-primary" type="button" data-edit-task>${icon("edit", "sm")}Edit</button>`,
    initialFocus: "[data-close]",
    onMount: (el, api) => $("[data-edit-task]", el).addEventListener("click", () => { api.close(); openTaskSheet({ id: t.id }); })
  });
}

export function openTaskSheet({ id = null, week = null, track = "learn" } = {}) {
  const t = id ? taskById(id) : null;
  const d = t || { title: "", track, hours: 1, week: week || currentWeek(), detail: "", res: [], skills: [] };
  const linkRow = (l = "", u = "") => `<div class="row2 keep link-row" style="grid-template-columns:1fr 1.4fr auto;align-items:center">
    <input type="text" name="rl" value="${esc(l)}" placeholder="Label" aria-label="Link label">
    <input type="url" name="ru" value="${esc(u)}" placeholder="https://" aria-label="Link URL">
    <button class="icon-btn sm danger" type="button" data-rm-link aria-label="Remove link">${icon("x", "sm")}</button></div>`;
  const body = `<form class="form" novalidate>
    <div class="field"><label for="tf-title">Task</label><input id="tf-title" type="text" name="title" value="${esc(d.title)}" required maxlength="200">
      <p class="error" data-err hidden>Give the task a name.</p></div>
    <div class="field"><span class="lbl" id="tf-track">Track</span>${trackSeg("track", d.track)}</div>
    <div class="row2">
      <div class="field"><label for="tf-hours">Planned hours</label><input id="tf-hours" type="number" name="hours" value="${d.hours}" min="0" max="60" step="0.5" inputmode="decimal"></div>
      <div class="field"><label for="tf-week">Week</label><select id="tf-week" name="week">${weekOptions(d.week)}</select></div>
    </div>
    <div class="field"><label for="tf-detail">Details</label><textarea id="tf-detail" name="detail" rows="3" maxlength="2000">${esc(d.detail)}</textarea></div>
    <div class="field"><span class="lbl">Links</span><div class="form" data-links style="gap:8px">${(d.res.length ? d.res : []).map(r => linkRow(r.l, r.u)).join("")}</div>
      <div><button class="btn btn-sm" type="button" data-add-link>${icon("plus", "sm")}Add link</button></div></div>
    <fieldset class="field" style="border:0;padding:0;margin:0"><legend class="lbl" style="padding:0;margin-bottom:6px;font-weight:700;font-size:13.5px">Skills it builds</legend>
      <div class="chips">${SKILLS.map(s => `<label class="chip" style="cursor:pointer"><input type="checkbox" name="skills" value="${s.id}" ${d.skills.includes(s.id) ? "checked" : ""} style="margin:0;accent-color:var(--primary)">${esc(s.name)}</label>`).join("")}</div></fieldset>
  <button type="submit" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">Save</button></form>`;
  const foot = `${t ? `<button class="btn btn-danger" type="button" data-del>${icon("trash", "sm")}Delete</button>
      ${!t.dropped ? `<button class="btn btn-ghost" type="button" data-drop>Let go</button>` : ""}` : ""}
    <span class="spacer"></span>
    <button class="btn btn-ghost" type="button" data-close>Cancel</button>
    <button class="btn btn-primary" type="button" data-save>${t ? "Save changes" : "Add task"}</button>`;
  sheet({
    title: t ? "Edit task" : "Add a task", sub: t && t.carriedFrom ? `Carried over from Week ${t.carriedFrom}` : "", body, foot, wide: true,
    onMount: (el, api) => {
      const form = $("form", el), F = form.elements;
      el.addEventListener("click", e => {
        if (e.target.closest("[data-add-link]")) { $("[data-links]", el).insertAdjacentHTML("beforeend", linkRow()); $$(".link-row input[name=rl]", el).pop().focus(); }
        const rm = e.target.closest("[data-rm-link]"); if (rm) rm.closest(".link-row").remove();
      });
      form.addEventListener("submit", e => { e.preventDefault(); doSave(); });
      const doSave = () => {
        const title = F.title.value.trim();
        if (!title) { $("[data-err]", el).hidden = false; F.title.focus(); return; }
        const res = $$(".link-row", el).map(r => ({ l: r.querySelector("[name=rl]").value.trim(), u: safeUrl(r.querySelector("[name=ru]").value.trim()) })).filter(r => r.u).map(r => ({ l: r.l || r.u, u: r.u }));
        const vals = {
          title, track: F.track.value || "learn", hours: clamp(parseFloat(F.hours.value) || 0, 0, 60),
          week: parseInt(F.week.value, 10) || currentWeek(), detail: F.detail.value.trim(), res,
          skills: $$("input[name=skills]:checked", el).map(x => x.value)
        };
        if (t) {
          if (vals.week !== t.week) { t.carryPending = false; }
          Object.assign(t, vals);
          toast("Task saved");
        } else {
          const order = Math.max(-1, ...S.plan.tasks.filter(x => x.week === vals.week).map(x => x.order)) + 1;
          S.plan.tasks.push({ id: uid("t"), origWeek: vals.week, done: false, doneAt: "", dropped: false, carriedFrom: 0, carryPending: false, order, ...vals });
          toast(`Added to Week ${vals.week}`);
        }
        save("plan"); api.close(); bus.render();
      };
      $("[data-save]", el).addEventListener("click", doSave);
      if (t) {
        $("[data-del]", el).addEventListener("click", () => { api.close(); deleteTask(t.id); });
        const dr = $("[data-drop]", el); if (dr) dr.addEventListener("click", () => { api.close(); dropTask(t.id); });
      }
    }
  });
}

export function deleteTask(id) {
  const i = S.plan.tasks.findIndex(t => t.id === id);
  if (i < 0) return;
  const [t] = S.plan.tasks.splice(i, 1);
  const ti = S.today.ids.indexOf(id);
  if (ti >= 0) { S.today.ids.splice(ti, 1); save("today"); }
  save("plan"); bus.render();
  toast(`Deleted "${t.title}"`, { action: "Undo", onAction: () => { S.plan.tasks.splice(i, 0, t); if (ti >= 0) { S.today.ids.splice(ti, 0, id); save("today"); } save("plan"); bus.render(); } });
}
export function dropTask(id) {
  const t = taskById(id); if (!t) return;
  t.dropped = true; t.carryPending = false;
  const ti = S.today.ids.indexOf(id);
  if (ti >= 0) { S.today.ids.splice(ti, 1); save("today"); }
  save("plan"); bus.render();
  toast("Let go. You can restore it from the weekly plan.", { action: "Undo", onAction: () => { t.dropped = false; if (ti >= 0) { S.today.ids.splice(ti, 0, id); save("today"); } save("plan"); bus.render(); } });
}

export function openMoveSheet(id) {
  const t = taskById(id); if (!t) return;
  sheet({
    title: "Move to another week", sub: esc(t.title),
    body: `<div class="field"><label for="mv-week">Week</label><select id="mv-week">${weekOptions(Math.min(t.week + 1, weekCount()))}</select></div>`,
    foot: `<button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" data-ok>Move</button>`,
    onMount: (el, api) => $("[data-ok]", el).addEventListener("click", () => {
      const n = parseInt($("#mv-week", el).value, 10);
      const from = t.week;
      t.week = n; t.carryPending = false;
      save("plan"); api.close(); bus.render();
      toast(`Moved to Week ${n}`, { action: "Undo", onAction: () => { t.week = from; save("plan"); bus.render(); } });
    })
  });
}

// ---------------- Work sessions ----------------
export function openSessionSheet({ id = null, prefill = null, onSaved = null } = {}) {
  const s = id ? S.sessions.list.find(x => x.id === id) : null;
  const d = s || { date: today(), min: 60, label: "", taskId: "", skillId: "", resourceId: "", caseId: "", track: "learn", note: "", ...(prefill || {}) };
  const cases = S.portfolio.cases.filter(c => !c.archived || c.id === d.caseId);
  const resOpts = S.resources.list.filter(r => r.status !== "done" || r.id === d.resourceId).sort((a, b) => ({ doing: 0, todo: 1, done: 2 }[a.status] - { doing: 0, todo: 1, done: 2 }[b.status]) || a.title.localeCompare(b.title));
  const wk = currentWeek();
  const tasks = weekTasks(wk).filter(t => !t.done || t.id === d.taskId);
  if (d.taskId && !tasks.find(t => t.id === d.taskId)) { const t = taskById(d.taskId); if (t) tasks.unshift(t); }
  const task = d.taskId ? taskById(d.taskId) : null;
  const h = Math.floor((d.min || 0) / 60), m = Math.round((d.min || 0) % 60);
  const body = `<form class="form" novalidate>
    <div class="field"><label for="ss-task">What did you work on?</label>
      <select id="ss-task" name="task"><option value="">Something else</option>
        ${TRACK_KEYS.map(k => { const g = tasks.filter(t => t.track === k); return g.length ? `<optgroup label="${TRACKS[k].name}">${g.map(t => `<option value="${t.id}" ${t.id === d.taskId ? "selected" : ""}>${esc(t.title)}</option>`).join("")}</optgroup>` : ""; }).join("")}
      </select></div>
    <div class="field" data-free ${d.taskId ? "hidden" : ""}><label for="ss-label">Focus</label><input id="ss-label" type="text" name="label" value="${esc(task ? "" : d.label)}" placeholder="e.g. Read Just Enough Research" maxlength="160"></div>
    <details class="link-to" ${d.skillId || d.resourceId || d.caseId ? "open" : ""}><summary class="link-btn" style="cursor:pointer">Link to a skill, resource or case study <span class="muted">(optional)</span></summary>
      <div class="row2" style="margin-top:8px">
        <div class="field"><label for="ss-skill">Skill</label><select id="ss-skill" name="skill"><option value="">None</option>${S.skills.list.map(k => `<option value="${k.id}" ${k.id === d.skillId ? "selected" : ""}>${esc(k.name)}</option>`).join("")}</select></div>
        <div class="field"><label for="ss-res">Resource</label><select id="ss-res" name="res"><option value="">None</option>${resOpts.map(r => `<option value="${r.id}" ${r.id === d.resourceId ? "selected" : ""}>${esc(r.title.length > 60 ? r.title.slice(0, 58) + "…" : r.title)}</option>`).join("")}</select></div>
      </div>
      <div class="field" style="margin-top:8px"><label for="ss-case">Case study</label><select id="ss-case" name="caseId"><option value="">None</option>${cases.map(c => `<option value="${c.id}" ${c.id === (d.caseId || task?.caseId || "") ? "selected" : ""}>${esc(c.title)}</option>`).join("")}</select></div>
      <p class="hint">Hours then count toward that skill or case study, and toward every skill the task or resource is tagged with.</p></details>
    <div class="field"><span class="lbl">Track</span>${trackSeg("track", d.track)}</div>
    <div class="row3">
      <div class="field"><label for="ss-date">Date</label><input id="ss-date" type="date" name="date" value="${d.date}" max="${today()}"></div>
      <div class="field"><label for="ss-h">Hours</label><input id="ss-h" type="number" name="h" value="${h}" min="0" max="16" step="1" inputmode="numeric"></div>
      <div class="field"><label for="ss-m">Minutes</label><input id="ss-m" type="number" name="m" value="${m}" min="0" max="59" step="5" inputmode="numeric"></div>
    </div>
    <p class="error" data-err hidden>Add a duration of at least 1 minute.</p>
    <div class="field"><label for="ss-note">Note <span class="muted">(optional)</span></label><textarea id="ss-note" name="note" rows="2" maxlength="600">${esc(d.note)}</textarea></div>
    <label class="switch" data-donewrap ${task && !task.done ? "" : "hidden"}><input type="checkbox" name="markDone"> Mark the task as done</label>
  <button type="submit" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">Save</button></form>`;
  const foot = `${s ? `<button class="btn btn-danger" type="button" data-del>${icon("trash", "sm")}Delete</button>` : ""}<span class="spacer"></span>
    <button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" data-save>${s ? "Save" : "Add hours"}</button>`;
  sheet({
    title: s ? "Edit work session" : prefill?.fromTimer ? "Save this session" : "Add hours", body, foot,
    onMount: (el, api) => {
      const form = $("form", el), F = form.elements;
      F.task.addEventListener("change", () => {
        const t = taskById(F.task.value);
        $("[data-free]", el).hidden = !!t;
        $("[data-donewrap]", el).hidden = !(t && !t.done);
        if (t) { const r = form.querySelector(`input[name=track][value=${t.track}]`); if (r) r.checked = true; }
        if (t && t.caseId && F.caseId) F.caseId.value = t.caseId;
      });
      form.addEventListener("submit", e => { e.preventDefault(); doSave(); });
      const doSave = () => {
        const min = (parseInt(F.h.value, 10) || 0) * 60 + (parseInt(F.m.value, 10) || 0);
        if (min < 1) { $("[data-err]", el).hidden = false; F.m.focus(); return; }
        const t = taskById(F.task.value);
        const rs = S.resources.list.find(r => r.id === F.res.value), sk = S.skills.list.find(k => k.id === F.skill.value);
        const vals = { date: F.date.value || today(), min: Math.min(min, 16 * 60), taskId: t ? t.id : "", skillId: sk ? sk.id : "", resourceId: rs ? rs.id : "", caseId: F.caseId ? F.caseId.value : "", label: t ? t.title : (F.label.value.trim() || (rs ? rs.title : sk ? sk.name : "Focused work")), track: F.track.value || (t ? t.track : "learn"), note: F.note.value.trim() };
        if (s) Object.assign(s, vals);
        else S.sessions.list.unshift({ id: uid("s"), ...vals });
        S.sessions.list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        save("sessions");
        if (t && F.markDone.checked && !t.done) { t.done = true; t.doneAt = today(); save("plan"); }
        api.close(); onSaved && onSaved(); bus.render();
        toast(s ? "Session saved" : `Added ${fmtMin(vals.min)}`);
      };
      $("[data-save]", el).addEventListener("click", doSave);
      if (s) $("[data-del]", el).addEventListener("click", () => {
        api.close();
        const i = S.sessions.list.indexOf(s); S.sessions.list.splice(i, 1); save("sessions"); bus.render();
        toast("Session deleted", { action: "Undo", onAction: () => { S.sessions.list.splice(i, 0, s); save("sessions"); bus.render(); } });
      });
    }
  });
}

export function openAllSessions() {
  const list = S.sessions.list;
  const weeks = [];
  for (let n = weekCount(); n >= 1; n--) {
    const ss = list.filter(s => inWeek(s.date, n));
    if (ss.length) weeks.push({ n, ss });
  }
  const other = list.filter(s => !weeks.some(w => w.ss.includes(s)));
  const row = s => `<li><div class="s-label"><b>${esc(s.label)}</b><span><i class="dot" style="--c:${TRACKS[s.track]?.color || "var(--c-neutral)"}"></i>${esc(TRACKS[s.track]?.name || "Other")} · ${fmtDate(s.date, { dow: true })}${s.note ? " · " + esc(s.note) : ""}</span></div>
    <span class="s-dur">${fmtMin(s.min)}</span><button class="icon-btn sm boxed" type="button" data-edit="${s.id}" aria-label="Edit session: ${esc(s.label)}">${icon("edit", "sm")}</button></li>`;
  const body = list.length ? [...weeks.map(w => `<h3 style="margin:8px 0 4px">Week ${w.n} <span class="muted small">· ${fmtDate(weekStart(w.n))}–${fmtDate(weekEnd(w.n))} · ${fmtMin(sum(w.ss, s => s.min))}</span></h3><ul class="sessions">${w.ss.map(row).join("")}</ul>`),
    other.length ? `<h3 style="margin:8px 0 4px">Outside the plan dates</h3><ul class="sessions">${other.map(row).join("")}</ul>` : ""].join("")
    : `<div class="empty">${icon("clock")}<b>No sessions yet</b>Start the stopwatch or add hours by hand.</div>`;
  sheet({
    title: "Work sessions", sub: `${list.length} sessions · ${fmtMin(sum(list, s => s.min))} in total`, body, wide: true,
    foot: `<button class="btn" type="button" data-close>Close</button><button class="btn btn-primary" type="button" data-add>${icon("plus", "sm")}Add hours</button>`,
    onMount: (el, api) => el.addEventListener("click", e => {
      const ed = e.target.closest("[data-edit]");
      if (ed) { api.close(); openSessionSheet({ id: ed.dataset.edit }); }
      if (e.target.closest("[data-add]")) { api.close(); openSessionSheet(); }
    })
  });
}

// ---------------- Events ----------------
// A best guess at the type of an event found on the web.
export function guessEventType(title = "", about = "", where = "") {
  const t = `${title} ${about}`;
  if (/workshop|hands-on|design jam|\bjam\b|hackathon|bootcamp|\bclass\b|\blab\b/i.test(t)) return "Workshop";
  if (/conference|\bconf\b|summit|festival|expo\b/i.test(t)) return "Conference";
  if (/webinar|livestream|\bama\b/i.test(t) || /online|virtual|zoom/i.test(where)) return "Webinar";
  return "Meetup";
}
export function openEventSheet({ id = null, prefill = null } = {}) {
  const ev = id ? S.events.list.find(x => x.id === id) : null;
  const d = ev || { name: "", type: "Meetup", date: today(), time: "", location: "", link: "", notes: "", status: "planned", group: "", ...(prefill || {}) };
  const groups = S.strategy?.communities || [];
  const body = `<form class="form" novalidate>
    <div class="field"><label for="ef-name">Event</label><input id="ef-name" type="text" name="name" value="${esc(d.name)}" maxlength="160" placeholder="e.g. IxDA: Design Systems Night">
      <p class="error" data-err hidden>Give the event a name.</p></div>
    <div class="row3">
      <div class="field"><label for="ef-type">Type</label><select id="ef-type" name="type">${EVENT_TYPES.map(t => `<option ${t === d.type ? "selected" : ""}>${t}</option>`).join("")}</select></div>
      <div class="field"><label for="ef-date">Date</label><input id="ef-date" type="date" name="date" value="${d.date}"></div>
      <div class="field"><label for="ef-time">Time</label><input id="ef-time" type="time" name="time" value="${d.time}"></div>
    </div>
    <div class="field"><span class="lbl">Status</span><div class="seg-ctl" role="radiogroup" aria-label="Status">${[["planned", "Planned"], ["attended", "Attended"], ["skipped", "Skipped"]].map(([v, l]) => `<label><input type="radio" name="st" value="${v}" ${v === (d.status || "planned") ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></div>
    ${groups.length ? `<div class="field"><label for="ef-grp">Community <span class="muted">(optional)</span></label><select id="ef-grp" name="group"><option value="">None</option>${groups.map(g => `<option value="${esc(g.id)}" ${g.id === d.group ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select></div>` : ""}
    <div class="field"><label for="ef-loc">Location</label><input id="ef-loc" type="text" name="location" value="${esc(d.location)}" maxlength="200" placeholder="Address, venue or Online"></div>
    <div class="field"><label for="ef-link">Link <span class="muted">(optional)</span></label><input id="ef-link" type="url" name="link" value="${esc(d.link)}" placeholder="https://"></div>
    <div class="field" data-img-field hidden><label for="ef-img">Image <span class="muted">(optional)</span></label>
      <div data-img-prev></div>
      <input id="ef-img" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
      <p class="hint">Save the picture from the event page, then choose it here, or copy it and paste it into this window. It shows on the event in Overview.</p>
      <p class="error" data-img-err role="alert" hidden></p></div>
    <div class="field"><label for="ef-notes">Notes <span class="muted">(optional)</span></label><textarea id="ef-notes" name="notes" rows="3" maxlength="1500" placeholder="Who you want to meet, questions to ask, follow-ups">${esc(d.notes)}</textarea></div>
  <button type="submit" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">Save</button></form>`;
  const foot = `${ev ? `<button class="btn btn-danger" type="button" data-del>${icon("trash", "sm")}Delete</button>` : ""}<span class="spacer"></span>
    <button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" data-save>${ev ? "Save" : "Add event"}</button>`;
  // The event image is uploaded to the page's own file store; a picture can't be loaded from another site.
  let img = d.img && d.img.id ? { id: d.img.id, url: d.img.url } : null;
  const fresh = [];
  let saved = false, uploading = false;
  sheet({
    title: ev ? "Edit event" : "Add an event", body, foot,
    onClose: () => { if (!saved) fresh.forEach(dropAsset); },
    onMount: (el, api) => {
      const form = $("form", el), F = form.elements;
      const field = $("[data-img-field]", el), prev = $("[data-img-prev]", el), imgErr = $("[data-img-err]", el), fileIn = $("#ef-img", el), saveBtn = $("[data-save]", el);
      const paintImg = msg => {
        const u = eventImgUrl({ img });
        prev.innerHTML = msg ? `<p class="small muted" role="status">${esc(msg)}</p>` : u ? `<div class="ev-img-prev"><img src="${esc(u)}" alt="Event image preview"><button class="btn btn-sm" type="button" data-img-rm>${icon("trash", "sm")}Remove image</button></div>` : "";
      };
      const addImage = async file => {
        if (!file || uploading) return;
        imgErr.hidden = true;
        if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) { imgErr.textContent = "Choose a PNG, JPG, WebP or GIF picture."; imgErr.hidden = false; return; }
        if (file.size > 8 * 1024 * 1024) { imgErr.textContent = "That picture is over 8 MB. Choose a smaller one."; imgErr.hidden = false; return; }
        const store = await getAssets(); if (!store) return;
        uploading = true; saveBtn.disabled = true; paintImg("Saving the picture…");
        try {
          const r = await store.upload(file);
          img = { id: r.id, url: r.url || "/_blob/" + r.id }; fresh.push(r.id);
        } catch { imgErr.textContent = "Couldn't save the picture. Try again."; imgErr.hidden = false; }
        uploading = false; saveBtn.disabled = false; fileIn.value = ""; paintImg();
      };
      getAssets().then(store => { if (store && el.isConnected) { field.hidden = false; paintImg(); } });
      fileIn.addEventListener("change", () => addImage(fileIn.files && fileIn.files[0]));
      prev.addEventListener("click", e => { if (e.target.closest("[data-img-rm]")) { img = null; paintImg(); fileIn.focus(); } });
      el.addEventListener("paste", e => {
        if (field.hidden) return;
        const f = Array.from(e.clipboardData?.files || []).find(x => x.type.startsWith("image/"));
        if (f) { e.preventDefault(); addImage(f); }
      });
      form.addEventListener("submit", e => { e.preventDefault(); doSave(); });
      const doSave = () => {
        if (uploading) return;
        const name = F.name.value.trim();
        if (!name) { $("[data-err]", el).hidden = false; F.name.focus(); return; }
        const oldImg = ev?.img?.id || "";
        saved = true;
        fresh.filter(x => x !== img?.id).forEach(dropAsset);
        if (oldImg && oldImg !== img?.id) dropAsset(oldImg);
        const vals = { img, name, type: F.type.value, date: F.date.value || today(), time: F.time.value, location: F.location.value.trim(), link: safeUrl(F.link.value.trim()), notes: F.notes.value.trim(), status: (form.querySelector("input[name=st]:checked") || {}).value || "planned", group: F.group ? F.group.value : (d.group || "") };
        if (ev) Object.assign(ev, vals); else S.events.list.push({ id: uid("e"), about: d.about || "", feedId: d.feedId || "", ...vals });
        save("events"); api.close(); bus.render();
        toast(ev ? "Event saved" : "Event added");
      };
      $("[data-save]", el).addEventListener("click", doSave);
      if (ev) $("[data-del]", el).addEventListener("click", () => {
        api.close();
        const i = S.events.list.indexOf(ev); S.events.list.splice(i, 1); save("events"); bus.render();
        toast("Event deleted", { action: "Undo", onAction: () => { S.events.list.splice(i, 0, ev); save("events"); bus.render(); } });
      });
    }
  });
}

export function openAllEvents() {
  const up = upcomingEvents(), past = pastEvents();
  const row = e => `<li><div class="d">${fmtDate(e.date).split(" ")[0]}<b>${e.date ? Number(e.date.slice(8)) : "–"}</b></div>
    <div class="n"><b>${esc(e.name)}</b><span>${[e.time ? fmtTime(e.time) : "", e.location].filter(Boolean).map(esc).join(" · ") || esc(e.type)}</span>
      ${e.date < today() ? (e.status === "attended" ? `<span class="tag good">Attended</span>` : e.status === "skipped" ? `<span class="tag">Skipped</span>` : `<span class="ev-mark"><button class="btn btn-sm" type="button" data-mark="${e.id}" data-v="attended">I went</button><button class="btn btn-sm btn-ghost" type="button" data-mark="${e.id}" data-v="skipped">Skipped</button></span>`) : ""}</div>
    <button class="icon-btn sm boxed" type="button" data-edit="${e.id}" aria-label="Edit event: ${esc(e.name)}">${icon("edit", "sm")}</button></li>`;
  const body = `<h3 style="margin-bottom:4px">Upcoming <span class="muted small">· ${up.length}</span></h3>
    ${up.length ? `<ul class="ev-list">${up.map(row).join("")}</ul>` : `<p class="muted" style="padding:8px 0 12px">Nothing scheduled.</p>`}
    <h3 style="margin:14px 0 4px">Past <span class="muted small">· ${past.length}</span></h3>
    ${past.length ? `<ul class="ev-list">${past.map(row).join("")}</ul>` : `<p class="muted" style="padding:8px 0">No past events yet.</p>`}`;
  sheet({
    title: "All events", body, wide: true,
    foot: `<button class="btn" type="button" data-close>Close</button><button class="btn btn-primary" type="button" data-add>${icon("plus", "sm")}Add event</button>`,
    onMount: (el, api) => el.addEventListener("click", e => {
      const mk = e.target.closest("[data-mark]");
      if (mk) { const ev = S.events.list.find(x => x.id === mk.dataset.mark); if (ev) { ev.status = mk.dataset.v; save("events"); const span = mk.closest(".ev-mark"); span.outerHTML = `<span class="tag ${ev.status === "attended" ? "good" : ""}">${ev.status === "attended" ? "Attended" : "Skipped"}</span>`; } return; }
      const ed = e.target.closest("[data-edit]");
      if (ed) { api.close(); openEventSheet({ id: ed.dataset.edit }); }
      if (e.target.closest("[data-add]")) { api.close(); openEventSheet(); }
    })
  });
}

export function confirmReset(label, fn) {
  confirmSheet({ title: `Reset ${label}?`, message: `This clears ${label} on every device. Download a backup first if you might want it back.`, confirm: "Reset", danger: true, onConfirm: fn });
}
