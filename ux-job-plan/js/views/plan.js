// Weekly plan: week chips, tasks by track, week details, notes, let-go list.

import { S, save } from "../store.js";
import { TRACKS, TRACK_KEYS, SKILLS, PHASES, DOCS } from "../content.js";
import { esc, fmtDate, fmtHours, sum, safeUrl, host, $ } from "../util.js";
import { icon, meter, sheet, toast, confirmSheet } from "../ui.js";
import * as M from "../model.js";
import { checkbox } from "./overview.js";
import { bus } from "../bus.js";
import { phaseSpan, normMe } from "../personalize.js";

let sel = null;
export const setWeek = n => { sel = n; };
export const selectedWeek = () => {
  if (!sel || sel > M.weekCount()) sel = M.currentWeek();
  return sel;
};

const skillName = id => SKILLS.find(s => s.id === id)?.name || S.skills.list.find(s => s.id === id)?.name || id;

function planItem(t) {
  const inT = M.inToday(t.id);
  const res = t.res.filter(r => safeUrl(r.u));
  return `<li class="task compact ${t.done ? "is-done" : ""}" data-id="${t.id}">
    ${checkbox(t)}
    <div class="t-body"><div class="t-title"><button type="button" data-act="task-view" data-id="${t.id}">${esc(t.title)}</button></div>
      ${t.detail ? `<p class="t-detail">${esc(t.detail)}</p>` : ""}
      ${res.length ? `<div class="t-res">${res.map(r => `<a href="${esc(safeUrl(r.u))}" target="_blank" rel="noopener noreferrer">${icon("ext", "sm")}${esc(r.l)}<span class="sr-only"> (${esc(host(r.u))}, opens in a new tab)</span></a>`).join("")}</div>` : ""}
      <div class="t-meta"><span>${fmtHours(t.hours)}</span>${t.carriedFrom ? `<span class="carry-tag">From Week ${t.carriedFrom}</span>` : ""}
        ${t.skills.length ? `<span>${t.skills.slice(0, 3).map(skillName).map(esc).join(", ")}${t.skills.length > 3 ? ` +${t.skills.length - 3}` : ""}</span>` : ""}
        ${t.done && t.doneAt ? `<span>Done ${fmtDate(t.doneAt)}</span>` : ""}</div></div>
    <div class="t-actions">
      ${t.done ? "" : inT ? `<span class="tag">In Today</span>` : `<button class="btn btn-sm" type="button" data-act="today-add" data-id="${t.id}" aria-label="Add ${esc(t.title)} to today">${icon("plus", "sm")}Today</button>`}
      <button class="icon-btn sm boxed" type="button" data-act="task-edit" data-id="${t.id}" aria-label="Edit ${esc(t.title)}">${icon("edit", "sm")}</button>
    </div></li>`;
}

export function renderPlan() {
  const n = selectedWeek();
  const w = M.weekMeta(n);
  const cur = M.currentWeek();
  let lastPhase = -1;
  const chips = S.plan.weeks.map(x => {
    const p = M.weekProgress(x.n);
    const ph = M.phaseOf(x.n);
    const label = ph && ph.id !== lastPhase ? `<span class="chip-phase" aria-hidden="true">Phase ${ph.id}<small>${esc(ph.short)}</small></span>` : "";
    lastPhase = ph ? ph.id : lastPhase;
    return `${label}<button class="week-chip" type="button" data-act="week-select" data-n="${x.n}" aria-pressed="${x.n === n}" aria-label="Week ${x.n}${ph ? `, phase ${ph.id}` : ""}: ${esc(x.theme)}, ${Math.round(p.pct * 100)}% done">
      ${x.n === cur && !M.beforeStart() ? `<span class="now">NOW</span>` : ""}<b>Week ${x.n}</b>${meter(p.done, p.total, { thin: true, label: "" })}<span>${Math.round(p.pct * 100)}%</span></button>`;
  }).join("");

  const sections = TRACK_KEYS.map(k => {
    const ts = M.tasksByTrack(n, k);
    const d = ts.filter(t => t.done).length;
    const h = sum(ts, t => t.hours);
    const target = M.trackTarget(n, k);
    return `<section class="card track-sec" aria-labelledby="ts-${k}">
      <div class="ts-h"><h2 id="ts-${k}"><i class="dot" style="--c:${TRACKS[k].color};width:10px;height:10px"></i>${TRACKS[k].name}</h2>
        <div class="meta"><span>${d}/${ts.length} done</span>${meter(d, ts.length, { color: TRACKS[k].color, thin: true, label: `${d} of ${ts.length} done` })}
          <span data-tip="${esc(`${fmtHours(h)} planned`)}|${esc(`${TRACKS[k].name} target for Week ${n}: ${fmtHours(target)}`)}">${fmtHours(h)} / ${fmtHours(target)}</span></div></div>
      ${ts.length ? `<ul class="tasks">${ts.map(planItem).join("")}</ul>` : `<p class="muted small" style="padding:0 18px 12px">No ${TRACKS[k].name.toLowerCase()} tasks this week.</p>`}
      <div style="padding:0 12px 14px"><button class="btn btn-sm btn-ghost" type="button" data-act="add-task" data-week="${n}" data-track="${k}">${icon("plus", "sm")}Add ${TRACKS[k].name.toLowerCase()} task</button></div>
    </section>`;
  }).join("");

  const dropped = M.weekTasks(n, { dropped: true });
  const droppedCard = dropped.length ? `<section class="card track-sec dropped" aria-labelledby="ts-drop">
      <div class="ts-h"><h2 id="ts-drop">${icon("x")}Let go <span class="sub">${dropped.length}</span></h2></div>
      <ul class="tasks">${dropped.map(t => `<li class="task compact" data-id="${t.id}"><span></span>
        <div class="t-body"><div class="t-title">${esc(t.title)}</div><div class="t-meta"><span class="trk"><i class="dot" style="--c:${TRACKS[t.track].color}"></i>${TRACKS[t.track].name}</span><span>${fmtHours(t.hours)}</span></div></div>
        <div class="t-actions"><button class="btn btn-sm" type="button" data-act="task-restore" data-id="${t.id}">${icon("restore", "sm")}Restore</button>
          <button class="icon-btn sm danger" type="button" data-act="task-delete" data-id="${t.id}" aria-label="Delete ${esc(t.title)} for good">${icon("trash", "sm")}</button></div></li>`).join("")}</ul>
    </section>` : "";

  const carry = n === cur ? M.carryPending() : [];
  const p = M.weekProgress(n);
  const hoursRows = TRACK_KEYS.map(k => {
    const h = sum(M.tasksByTrack(n, k), t => t.hours);
    return `<div class="trow"><span class="tn"><i class="dot" style="--c:${TRACKS[k].color}"></i>${TRACKS[k].name}</span>${meter(h, M.trackTarget(n, k), { color: TRACKS[k].color, thin: true, label: `${fmtHours(h)} planned of ${fmtHours(M.trackTarget(n, k))}` })}<span class="tv">${fmtHours(h)} / ${fmtHours(M.trackTarget(n, k))}</span></div>`;
  }).join("");

  return `<header class="page-h">
      <div><div class="eyebrow">Weekly plan · ${fmtDate(M.weekStart(n))} – ${fmtDate(M.weekEnd(n))}${n === cur && !M.beforeStart() ? " · this week" : ""}</div>
        <h1>Week ${n}: ${esc(w.theme)}</h1>${w.goal ? `<p class="lead">${esc(w.goal)}</p>` : ""}</div>
      <div class="actions"><button class="btn btn-primary" type="button" data-act="add-task" data-week="${n}">${icon("plus", "sm")}Add task</button>
        <button class="btn" type="button" data-act="add-week">${icon("plus", "sm")}Add week</button></div>
    </header>
    ${phaseBanner(n)}
    <div class="week-chips" role="group" aria-label="Choose a week">${chips}</div>
    ${carry.length ? `<div class="banner warn" role="note">${icon("undo")}<p><b>${carry.length} task${carry.length > 1 ? "s" : ""} carried over</b> from earlier weeks. Decide on them in Overview, or edit them below.</p><a class="btn btn-sm" href="#overview">Review</a></div>` : ""}
    <div class="plan-grid">
      <div>${sections}${droppedCard}</div>
      <div class="plan-side">
        <section class="card wk-meta" aria-labelledby="wm-h">
          <div class="card-h"><h2 id="wm-h">This week's focus</h2><button class="btn btn-sm" type="button" data-act="week-edit" data-n="${n}">${icon("edit", "sm")}Edit</button></div>
          <div class="card-b"><dl>
            <div><dt>Goal</dt><dd>${esc(w.goal) || `<span class="muted">Not set</span>`}</dd></div>
            <div><dt>Deliverable</dt><dd>${esc(w.deliv) || `<span class="muted">Not set</span>`}</dd></div>
            <div><dt>Skills</dt><dd><div class="chips">${w.skills.length ? w.skills.map(id => `<span class="chip">${esc(skillName(id))}</span>`).join("") : `<span class="muted">None picked</span>`}</div></dd></div>
            ${(w.study || []).length ? `<div><dt>Study topics</dt><dd><ul class="plain study-list">${w.study.map(x => `<li><b>${esc(x.t)}:</b> ${esc(x.w)}${safeUrl(x.q) ? ` <a href="${esc(safeUrl(x.q))}" target="_blank" rel="noopener noreferrer">${icon("ext", "sm")}Recent videos<span class="sr-only"> on ${esc(x.t)}, YouTube (opens in a new tab)</span></a>` : ""}</li>`).join("")}</ul></dd></div>` : ""}
            <div><dt>Progress</dt><dd>${p.done} of ${p.total} tasks · ${fmtHours(p.doneHours)} of ${fmtHours(p.hours)}</dd></div>
          </dl>
          <hr class="divider"><h3 style="margin-bottom:8px;font-size:14px">Planned task hours vs weekly target</h3><div class="trows">${hoursRows}</div></div>
        </section>
        <section class="card" aria-labelledby="wn-h">
          <div class="card-h"><h2 id="wn-h">${icon("note")}Notes</h2></div>
          <div class="card-b"><label for="wk-notes" class="sr-only">Notes for week ${n}</label>
            <textarea id="wk-notes" rows="6" data-change="week-notes" data-n="${n}" placeholder="Wins, blockers, links, ideas for next week">${esc(w.notes || "")}</textarea>
            <p class="muted small" style="margin-top:6px">Saves as you type.</p></div>
        </section>
      </div>
    </div>`;
}

function phaseBanner(n) {
  const ph = M.phaseOf(n);
  const hired = S.plan.hired;
  const doc = DOCS.estimates ? `<a href="${esc(DOCS.estimates)}" target="_blank" rel="noopener noreferrer">How every task's hours were worked out<span class="sr-only"> (opens in a new tab)</span></a>` : "";
  const total = M.weekCount();
  return `<section class="phase-banner card" aria-labelledby="ph-h">
    <div class="ph-steps" aria-hidden="true">${PHASES.map(p => { const sp = phaseSpan(S.plan, p.id); return sp ? `<span class="${ph && p.id === ph.id ? "on" : ""}" style="flex:${sp.to - sp.from + 1}"></span>` : ""; }).join("")}</div>
    <div class="ph-body">
      <div><h2 id="ph-h">${ph ? `Phase ${ph.id} of ${PHASES.length}: ${esc(ph.name)} <span class="sub">${(sp => sp ? `Weeks ${sp.from}–${sp.to} of ${total}` : `Week ${n} of ${total}`)(phaseSpan(S.plan, ph.id))}</span>` : `Week ${n} of ${total}`}</h2>
        ${ph ? `<p class="small">${esc(ph.goal)}</p>` : ""}
        <p class="small muted">Every course, book and task has its real length, at ${normMe(S.settings.me).hours} hours a week. Each phase splits the hours differently, so this week's targets come from the week itself. ${doc}</p></div>
      <div class="ph-act">${hired ? `<p class="small"><b>Offer accepted.</b> Job-search tasks from Week ${hired} on are set aside.</p><button class="btn btn-sm" type="button" data-act="plan-unhire">${icon("restore", "sm")}Bring them back</button>`
        : `<button class="btn btn-sm btn-ghost" type="button" data-act="plan-hire">${icon("check", "sm")}I accepted an offer</button>`}</div>
    </div></section>`;
}

const searchTask = t => !t.done && (t.track === "apply" || t.search);
export const planActions = {
  "plan-hire": () => {
    const from = Math.max(1, M.currentWeek());
    const list = S.plan.tasks.filter(t => t.week >= from && !t.dropped && searchTask(t));
    confirmSheet({
      title: "Congratulations! Set the job search aside?",
      message: `${list.length} applying and interview-practice tasks from Week ${from} on move to Let go. Learning and building tasks stay, so you can keep studying at your own pace. You can bring them back any time.`,
      confirm: "Set them aside",
      onConfirm: () => {
        for (const t of list) { t.dropped = true; t.droppedBy = "hired"; }
        S.plan.hired = from; save("plan"); bus.render(); toast(`${list.length} job-search tasks set aside`);
      }
    });
  },
  "plan-unhire": () => {
    let k = 0;
    for (const t of S.plan.tasks) if (t.droppedBy === "hired") { t.dropped = false; delete t.droppedBy; k++; }
    delete S.plan.hired; save("plan"); bus.render(); toast(`${k} job-search tasks back in the plan`);
  }
};

export function openWeekSheet(n, { isNew = false } = {}) {
  const w = M.weekMeta(n); if (!w) return;
  const tasksIn = S.plan.tasks.filter(t => t.week === n).length;
  const canDelete = n === M.weekCount() && n > 1 && tasksIn === 0;
  sheet({
    title: isNew ? `Week ${n} added` : `Edit Week ${n}`, sub: isNew ? "Give it a theme and a goal, then add tasks." : "",
    wide: true,
    body: `<form class="form" novalidate>
      <div class="field"><label for="wf-theme">Theme</label><input id="wf-theme" type="text" name="theme" value="${esc(w.theme)}" maxlength="120"></div>
      <div class="field"><label for="wf-goal">Goal</label><textarea id="wf-goal" name="goal" rows="2" maxlength="400">${esc(w.goal)}</textarea></div>
      <div class="field"><label for="wf-deliv">Deliverable</label><input id="wf-deliv" type="text" name="deliv" value="${esc(w.deliv)}" maxlength="240"></div>
      <fieldset class="field" style="border:0;padding:0;margin:0"><legend class="lbl" style="padding:0;margin-bottom:6px;font-weight:700;font-size:13.5px">Skills in focus</legend>
        <div class="chips">${SKILLS.map(s => `<label class="chip" style="cursor:pointer"><input type="checkbox" name="skills" value="${s.id}" ${w.skills.includes(s.id) ? "checked" : ""} style="margin:0;accent-color:var(--primary)">${esc(s.name)}</label>`).join("")}</div></fieldset>
      <button type="submit" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">Save</button>
    </form>`,
    foot: `${canDelete ? `<button class="btn btn-danger" type="button" data-del>${icon("trash", "sm")}Delete week</button>` : ""}<span class="spacer"></span>
      <button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" data-save>Save</button>`,
    onMount: (el, api) => {
      const form = $("form", el), F = form.elements;
      const doSave = () => {
        w.theme = F.theme.value.trim() || `Week ${n}`;
        w.goal = F.goal.value.trim(); w.deliv = F.deliv.value.trim();
        w.skills = Array.from(el.querySelectorAll("input[name=skills]:checked")).map(x => x.value);
        save("plan"); api.close(); bus.render(); toast("Week saved");
      };
      form.addEventListener("submit", e => { e.preventDefault(); doSave(); });
      $("[data-save]", el).addEventListener("click", doSave);
      const del = $("[data-del]", el);
      if (del) del.addEventListener("click", () => {
        S.plan.weeks = S.plan.weeks.filter(x => x.n !== n); setWeek(n - 1);
        save("plan"); api.close(); bus.render(); toast(`Week ${n} deleted`);
      });
    }
  });
}

export function addWeek() {
  const n = M.weekCount() + 1;
  S.plan.weeks.push({ n, phase: 0, theme: `Week ${n}`, goal: "", deliv: "", skills: [], split: null, goals: null, notes: "" });
  save("plan");
  setWeek(n);
  location.hash = `#plan-w${n}`;
  bus.render();
  openWeekSheet(n, { isNew: true });
}
