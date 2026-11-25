// Skills list, skill pages, rating, tests and AI-filled new skills.

import { S, save } from "../store.js";
import { RES_TYPES } from "../content2.js";
import { esc, uid, today, fmtDate, fmtHours, sum, safeUrl, host, clamp, $, $$ } from "../util.js";
import { icon, sheet, toast, confirmSheet, levelBar, lineChart, columns, weekLabels } from "../ui.js";
import * as M from "../model.js";
import { aiVisible, askJson, profileLine } from "../ai.js";
import { checkbox } from "./overview.js";
import { resRow } from "./resources.js";
import { bus } from "../bus.js";
import { inPlace, cityName, hasCity, getLoc } from "../locale.js";

let sortBy = "gap";
export const setSort = v => { sortBy = v; };

function spark(sk) {
  const pts = M.ratingPoints(sk);
  if (pts.length < 2) return `<p class="muted small sk-spark-empty">Not re-rated yet</p>`;
  const W = 120, H = 32, x = i => 4 + (i * (W - 8)) / (pts.length - 1), y = v => 4 + (H - 8) * (1 - (v - 1) / 4);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.lvl).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ratings over time: ${pts.map(p => p.lvl).join(", ")}"><path d="${d}" fill="none" stroke="var(--c-learn)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.lvl)}" r="3" fill="var(--c-learn)"/>`).join("")}</svg>`;
}

function skillCard(sk) {
  const res = M.resourcesForSkill(sk.id);
  const rd = res.filter(r => r.status === "done").length;
  const last = M.lastRated(sk);
  return `<article class="card sk-card" aria-labelledby="sk-${sk.id}">
    <div class="sk-top"><h3 id="sk-${sk.id}"><a href="#skill-${sk.id}">${esc(sk.name)}</a></h3>${sk.custom ? `<span class="tag info">Added</span>` : ""}</div>
    <p class="sk-why">${esc(sk.why)}</p>
    <div class="sk-lvl">${levelBar(sk.now, sk.target, { label: `${sk.name}: level ${sk.now} of 5, target ${sk.target}` })}
      <span class="small"><b>${sk.now}</b> now · target <b>${sk.target}</b>${sk.now >= sk.target ? ` <span class="tag good">At target</span>` : ""}</span></div>
    ${spark(sk)}
    <dl class="sk-meta"><div><dt>Hours</dt><dd>${fmtHours(M.skillHours(sk.id))}</dd></div><div><dt>Resources</dt><dd>${rd} of ${res.length}</dd></div><div><dt>Last rated</dt><dd>${last ? fmtDate(last) : "Not yet"}</dd></div></dl>
    <div class="sk-actions"><button class="btn btn-sm" type="button" data-act="skill-rate" data-id="${sk.id}">Rate</button><a class="btn btn-sm btn-ghost" href="#skill-${sk.id}">Open ${icon("arrowR", "sm")}</a></div>
  </article>`;
}

export function renderSkills() {
  const list = [...S.skills.list];
  const sorters = {
    gap: (a, b) => (b.target - b.now) - (a.target - a.now) || a.name.localeCompare(b.name),
    name: (a, b) => a.name.localeCompare(b.name),
    hours: (a, b) => M.skillHours(b.id) - M.skillHours(a.id) || a.name.localeCompare(b.name),
    level: (a, b) => a.now - b.now || a.name.localeCompare(b.name)
  };
  list.sort(sorters[sortBy] || sorters.gap);
  const sm = M.skillSummary();
  const avgNow = sm.total ? sum(sm.list, s => s.now) / sm.total : 0, avgT = sm.total ? sum(sm.list, s => s.target) / sm.total : 0;
  const hrs = sum(S.skills.list, s => M.skillHours(s.id));
  const tests = S.skills.list.flatMap(s => s.tests);
  const n = M.currentWeek();
  return `<header class="page-h"><div><div class="eyebrow">Grow</div><h1>Skills</h1>
      <p class="lead">${sm.total} skills rated 1–5, with what each needs and how to prove it. Re-rate every four weeks: Weeks ${M.rerateWeeks().join(", ")}.</p></div>
    <div class="actions"><label class="sr-only" for="sk-sort">Sort skills</label>
      <select id="sk-sort" data-change="skills-sort" style="width:auto">${[["gap", "Biggest gap first"], ["level", "Lowest level first"], ["hours", "Most hours first"], ["name", "Name"]].map(([v, l]) => `<option value="${v}" ${v === sortBy ? "selected" : ""}>${l}</option>`).join("")}</select>
      <button class="btn" type="button" data-act="skill-rate-all">Rate all</button>
      <button class="btn btn-primary" type="button" data-act="skill-add">${icon("plus", "sm")}Add skill</button></div></header>
  ${M.rerateDue() ? `<div class="banner" role="note">${icon("skills")}<p><b>Week ${n} is a re-rating week.</b> Rate each skill again so you can see how far you've come.</p><button class="btn btn-sm" type="button" data-act="skill-rate-all">Rate all</button></div>` : ""}
  <div class="tiles">
    <div class="tile"><span>At target</span><b>${sm.met} <small>of ${sm.total}</small></b></div>
    <div class="tile"><span>Average level</span><b>${avgNow.toFixed(1)} <small>→ ${avgT.toFixed(1)}</small></b></div>
    <div class="tile"><span>Hours on skills</span><b>${fmtHours(hrs)}</b></div>
    <div class="tile"><span>Tests taken</span><b>${tests.length}</b></div>
  </div>
  <div class="sk-grid">${list.map(skillCard).join("")}</div>`;
}

// ---------------- Skill page ----------------
export function renderSkill(id) {
  const sk = M.skillById(id);
  if (!sk) return `<header class="page-h"><div><h1>Skill not found</h1><p class="lead">It may have been deleted. <a href="#skills">Back to Skills</a></p></div></header>`;
  const res = M.resourcesForSkill(id);
  const tasks = M.tasksForSkill(id);
  const td = tasks.filter(t => t.done).length;
  const rd = res.filter(r => r.status === "done").length;
  const lastTest = sk.tests[sk.tests.length - 1];
  const pts = M.ratingPoints(sk);
  const weeks = S.plan.weeks.map(w => M.skillHoursInWeek(id, w.n));
  const cur = M.currentWeek();
  const sortRes = [...res].sort((a, b) => ({ doing: 0, todo: 1, done: 2 }[a.status] - { doing: 0, todo: 1, done: 2 }[b.status]) || (a.week || 99) - (b.week || 99));

  const projects = sk.projects.map(p => `<li class="proj">
      <details><summary><span class="chev">${icon("chev", "sm")}</span><b>${esc(p.title)}</b>
        <span class="tag ${p.status === "done" ? "good" : p.status === "doing" ? "info" : ""}">${{ idea: "Idea", doing: "In progress", done: "Done" }[p.status] || "Idea"}</span></summary>
        <ol class="steps">${p.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
        <div class="actions" style="margin-top:8px">
          ${p.status !== "done" ? `<button class="btn btn-sm" type="button" data-act="proj-status" data-id="${id}" data-p="${p.id}" data-s="${p.status === "doing" ? "done" : "doing"}">${p.status === "doing" ? "Mark done" : "Start"}</button>` : `<button class="btn btn-sm btn-ghost" type="button" data-act="proj-status" data-id="${id}" data-p="${p.id}" data-s="doing">Reopen</button>`}
          <button class="btn btn-sm" type="button" data-act="proj-plan" data-id="${id}" data-p="${p.id}">${icon("calendar", "sm")}Add to weekly plan</button>
          ${(() => { const cs = S.portfolio.cases.find(c => c.fromProject === p.id); return cs ? `<a class="btn btn-sm" href="#case-${cs.id}">${icon("folder", "sm")}Open case study</a>` : `<button class="btn btn-sm" type="button" data-act="proj-case" data-id="${id}" data-p="${p.id}">${icon("folder", "sm")}Start case study</button>`; })()}
          <button class="btn btn-sm btn-ghost" type="button" data-act="proj-edit" data-id="${id}" data-p="${p.id}">${icon("edit", "sm")}Edit</button>
        </div></details></li>`).join("");

  const practice = sk.practice.map(x => `<li class="prac"><div><b>${esc(x.title)}</b><span class="muted small">${x.count ? `Done ${x.count}×${x.last ? ` · last ${fmtDate(x.last)}` : ""}` : "Not done yet"}</span></div>
      <div class="prac-acts"><button class="icon-btn sm ok" type="button" data-act="prac-did" data-id="${id}" data-p="${x.id}" aria-label="Did it: ${esc(x.title)}" data-tip="Did it">${icon("check", "sm")}</button>
      <button class="icon-btn sm danger" type="button" data-act="prac-del" data-id="${id}" data-p="${x.id}" aria-label="Delete exercise: ${esc(x.title)}" data-tip="Delete">${icon("trash", "sm")}</button></div></li>`).join("");

  const questions = sk.interview.map(q => `<li class="iq"><div><b>${esc(q.q)}</b>${q.tip ? `<span class="muted small">${esc(q.tip)}</span>` : ""}</div>
      <button class="icon-btn sm danger" type="button" data-act="iq-del" data-id="${id}" data-p="${q.id}" aria-label="Delete question">${icon("trash", "sm")}</button></li>`).join("");

  const ai = aiVisible();
  return `<a class="back" href="#skills">${icon("arrowR", "sm flip")}Skills</a>
  <header class="page-h"><div><div class="eyebrow">Skill${sk.custom ? " · added by you" : ""}</div><h1>${esc(sk.name)}</h1>${sk.why ? `<p class="lead">${esc(sk.why)}</p>` : ""}</div>
    <div class="actions"><button class="btn" type="button" data-act="skill-edit" data-id="${id}">${icon("edit", "sm")}Edit</button>
      <button class="btn btn-primary" type="button" data-act="skill-rate" data-id="${id}">Rate now</button></div></header>
  <section class="card sk-hero" aria-label="Summary">
    <div class="sk-hero-lvl">${levelBar(sk.now, sk.target, { size: "lg" })}<p><b>${sk.now}</b> now · target <b>${sk.target}</b> of 5${sk.now >= sk.target ? ` <span class="tag good">At target</span>` : ""}</p></div>
    <div class="tiles in">
      <div class="tile"><span>Hours</span><b>${fmtHours(M.skillHours(id))}</b></div>
      <div class="tile"><span>Plan tasks</span><b>${td} <small>of ${tasks.length}</small></b></div>
      <div class="tile"><span>Resources done</span><b>${rd} <small>of ${res.length}</small></b></div>
      <div class="tile"><span>Last test</span><b>${lastTest ? `${Math.round((lastTest.score / lastTest.total) * 100)}%` : "–"}</b></div>
    </div>
    ${sk.proof ? `<p class="proof">${icon("target", "sm")}<span><b>How to prove it:</b> ${esc(sk.proof)}</span></p>` : ""}
  </section>
  <div class="plan-grid">
    <div>
      <section class="card" aria-labelledby="skr-h"><div class="card-h"><h2 id="skr-h">${icon("book")}Resources <span class="sub">${rd} of ${res.length} done</span></h2>
        <div class="actions">${ai ? `<button class="btn btn-sm" type="button" data-act="res-find" data-skill="${id}">${icon("sparkle", "sm")}Find more with AI</button>` : ""}<button class="btn btn-sm" type="button" data-act="res-add" data-skill="${id}">${icon("plus", "sm")}Add</button></div></div>
        <div class="card-b">${sortRes.length ? `<ul class="res-list">${sortRes.map(r => resRow(r, { compact: true })).join("")}</ul>` : `<p class="muted small">No resources yet.</p>`}</div></section>

      <section class="card" aria-labelledby="skp-h"><div class="card-h"><h2 id="skp-h">${icon("folder")}Projects</h2><button class="btn btn-sm" type="button" data-act="proj-add" data-id="${id}">${icon("plus", "sm")}Add</button></div>
        <div class="card-b">${projects ? `<ul class="proj-list">${projects}</ul>` : `<p class="muted small">No project ideas yet.</p>`}
        <p class="muted small" style="margin-top:8px">Case-study pages arrive with Portfolio in Stage 3. For now, "Add to weekly plan" turns a project into a Build task.</p></div></section>

      <section class="card" aria-labelledby="skx-h"><div class="card-h"><h2 id="skx-h">${icon("check")}Practice</h2><button class="btn btn-sm" type="button" data-act="prac-add" data-id="${id}">${icon("plus", "sm")}Add</button></div>
        <div class="card-b">${practice ? `<ul class="prac-list">${practice}</ul>` : `<p class="muted small">No exercises yet.</p>`}</div></section>

      <section class="card" aria-labelledby="skt-h"><div class="card-h"><h2 id="skt-h">${icon("target")}Test yourself</h2></div>
        <div class="card-b">
          <p class="small muted" style="margin-bottom:10px">${ai ? "AI writes 6 new questions at your level, grades your answers and explains them." : "A short quiz from the built-in question bank."}${sk.bank.length ? ` The built-in bank has ${sk.bank.length} questions.` : ""}</p>
          <div class="actions">${ai ? `<button class="btn btn-primary" type="button" data-act="test-ai" data-id="${id}">${icon("sparkle", "sm")}Start AI test</button>` : ""}
            ${sk.bank.length ? `<button class="btn" type="button" data-act="test-bank" data-id="${id}">Quick quiz (${Math.min(sk.bank.length, 5)} questions)</button>` : ""}</div>
          ${sk.tests.length ? `<h3 style="margin:14px 0 6px;font-size:14px">History</h3><ul class="test-hist">${[...sk.tests].reverse().slice(0, 6).map(t => `<li><span>${fmtDate(t.d)}</span><span>${t.ai ? "AI test" : "Quick quiz"}</span><b>${Math.round((t.score / t.total) * 100)}%</b><span class="muted">${t.score} of ${t.total}</span></li>`).join("")}</ul>` : ""}
        </div></section>

      <section class="card" aria-labelledby="ski-h"><div class="card-h"><h2 id="ski-h">${icon("mic")}Interview questions</h2><button class="btn btn-sm" type="button" data-act="iq-add" data-id="${id}">${icon("plus", "sm")}Add</button></div>
        <div class="card-b">${questions ? `<ul class="iq-list">${questions}</ul>` : `<p class="muted small">No questions yet.</p>`}
          <p class="muted small" style="margin-top:8px">These will also appear in Interview prep, under "By skill", in Stage 4.</p></div></section>
    </div>
    <div class="plan-side">
      <section class="card" aria-labelledby="skg-h"><div class="card-h"><h2 id="skg-h">Progress</h2></div>
        <div class="card-b"><h3 class="mini-h">Ratings</h3>
          ${lineChart(pts.map((p, i) => ({ label: p.d ? fmtDate(p.d) : "Start", short: p.d ? fmtDate(p.d) : "Start", y: p.lvl })), { min: 1, max: 5, yTicks: [1, 3, 5], unit: " of 5", color: "var(--c-learn)", label: `Ratings: ${pts.map(p => p.lvl).join(", ")}` })}
          ${pts.length < 2 ? `<p class="muted small">Rate this skill again to see a trend.</p>` : ""}
          <h3 class="mini-h" style="margin-top:14px">Hours per week</h3>
          ${columns(weeks.map(h => Math.round(h * 10) / 10), weeks.map(() => 0), weeks.map((_, i) => `Week ${i + 1}`), { cur: cur - 1, unit: "h", color: "var(--c-learn)" })}
          ${weekLabels(weeks.length)}
          <p class="muted small" style="margin-top:6px">Counts sessions on this skill and on tasks or resources tagged with it.</p></div></section>
      <section class="card" aria-labelledby="skw-h"><div class="card-h"><h2 id="skw-h">${icon("calendar")}In the weekly plan <span class="sub">${td} of ${tasks.length}</span></h2></div>
        <div class="card-b">${tasks.length ? `<ul class="tasks">${tasks.map(t => `<li class="task compact ${t.done ? "is-done" : ""}">${checkbox(t)}<div class="t-body"><div class="t-title"><button type="button" data-act="task-view" data-id="${t.id}">${esc(t.title)}</button></div><div class="t-meta"><a href="#plan-w${t.week}">Week ${t.week}</a><span>${fmtHours(t.hours)}</span></div></div><span></span></li>`).join("")}</ul>` : `<p class="muted small">No plan tasks are tagged with this skill.</p>`}</div></section>
      <section class="card" aria-labelledby="skn-h"><div class="card-h"><h2 id="skn-h">${icon("note")}Notes</h2></div>
        <div class="card-b"><label for="sk-notes" class="sr-only">Notes on ${esc(sk.name)}</label><textarea id="sk-notes" rows="5" data-change="skill-notes" data-id="${id}" placeholder="What you've learned, questions, links">${esc(sk.notes || "")}</textarea></div></section>
    </div>
  </div>`;
}

// ---------------- Actions ----------------
export function openRate(ids) {
  const list = ids.map(M.skillById).filter(Boolean);
  const one = list.length === 1;
  sheet({
    title: one ? `Rate: ${list[0].name}` : "Rate your skills", sub: "1 = new to it · 3 = can do it with some help · 5 = could teach it", wide: !one,
    body: `<form class="form rate-form" novalidate>${list.map(sk => `<fieldset class="rate-row"><legend>${esc(sk.name)} <span class="muted small">· now ${sk.now}, target ${sk.target}</span></legend>
      <div class="seg-ctl">${[1, 2, 3, 4, 5].map(i => `<label><input type="radio" name="r-${sk.id}" value="${i}" ${i === sk.now ? "checked" : ""}><span>${i}</span></label>`).join("")}</div></fieldset>`).join("")}
      ${one ? `<div class="field"><label for="rate-target">Target</label><select id="rate-target" name="target" style="max-width:120px">${[1, 2, 3, 4, 5].map(i => `<option ${i === list[0].target ? "selected" : ""}>${i}</option>`).join("")}</select></div>` : ""}
      <button type="submit" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">Save</button></form>`,
    foot: `<button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" data-save>Save ratings</button>`,
    onMount: (el, api) => {
      const form = $("form", el);
      const doSave = () => {
        const d = today();
        let changed = 0;
        for (const sk of list) {
          const v = parseInt((form.querySelector(`input[name="r-${sk.id}"]:checked`) || {}).value, 10);
          if (!v) continue;
          sk.history = sk.history.filter(h => h.d !== d);
          sk.history.push({ d, lvl: v });
          if (sk.now !== v) changed++;
          sk.now = v;
        }
        if (one) { const t = parseInt(form.elements.target.value, 10); if (t) list[0].target = t; }
        save("skills"); api.close(); bus.render();
        toast(one ? "Rating saved" : `Saved ${list.length} ratings${changed ? `, ${changed} changed` : ""}`);
      };
      form.addEventListener("submit", e => { e.preventDefault(); doSave(); });
      $("[data-save]", el).addEventListener("click", doSave);
    }
  });
}

export function openEditSkill(id) {
  const sk = M.skillById(id); if (!sk) return;
  sheet({
    title: "Edit skill", wide: true,
    body: `<form class="form" novalidate>
      <div class="field"><label for="se-name">Name</label><input id="se-name" type="text" name="nm" value="${esc(sk.name)}" maxlength="120"><p class="error" data-err hidden>Give the skill a name.</p></div>
      <div class="field"><label for="se-why">Why it matters</label><textarea id="se-why" name="why" rows="2" maxlength="400">${esc(sk.why)}</textarea></div>
      <div class="field"><label for="se-proof">How to prove it</label><textarea id="se-proof" name="proof" rows="2" maxlength="400">${esc(sk.proof)}</textarea></div>
      <div class="row2"><div class="field"><label for="se-now">Level now</label><select id="se-now" name="now">${[1, 2, 3, 4, 5].map(i => `<option ${i === sk.now ? "selected" : ""}>${i}</option>`).join("")}</select></div>
        <div class="field"><label for="se-t">Target</label><select id="se-t" name="target">${[1, 2, 3, 4, 5].map(i => `<option ${i === sk.target ? "selected" : ""}>${i}</option>`).join("")}</select></div></div>
      <button type="submit" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">Save</button></form>`,
    foot: `<button class="btn btn-danger" type="button" data-del>${icon("trash", "sm")}Delete skill</button><span class="spacer"></span>
      <button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" data-save>Save</button>`,
    onMount: (el, api) => {
      const form = $("form", el), F = form.elements;
      const doSave = () => {
        const nm = F.nm.value.trim();
        if (!nm) { $("[data-err]", el).hidden = false; F.nm.focus(); return; }
        Object.assign(sk, { name: nm, why: F.why.value.trim(), proof: F.proof.value.trim(), now: parseInt(F.now.value, 10), target: parseInt(F.target.value, 10) });
        save("skills"); api.close(); bus.render(); toast("Skill saved");
      };
      form.addEventListener("submit", e => { e.preventDefault(); doSave(); });
      $("[data-save]", el).addEventListener("click", doSave);
      $("[data-del]", el).addEventListener("click", () => { api.close(); deleteSkill(id); });
    }
  });
}

function deleteSkill(id) {
  const i = S.skills.list.findIndex(s => s.id === id); if (i < 0) return;
  const [sk] = S.skills.list.splice(i, 1);
  if (!sk.custom) S.skills.removed.push(id);
  save("skills");
  location.hash = "#skills";
  bus.render();
  toast(`Deleted "${sk.name}"`, { action: "Undo", onAction: () => { S.skills.list.splice(i, 0, sk); S.skills.removed = S.skills.removed.filter(x => x !== id); save("skills"); bus.render(); } });
}

// Small one-or-two-field sheet for practice items, questions and projects.
function itemSheet({ title, fields, onSave, del }) {
  sheet({
    title, wide: fields.some(f => f.rows > 2),
    body: `<form class="form" novalidate>${fields.map((f, i) => `<div class="field"><label for="it-${i}">${esc(f.label)}</label>
      ${f.rows ? `<textarea id="it-${i}" name="f${i}" rows="${f.rows}" maxlength="${f.max || 600}" placeholder="${esc(f.ph || "")}">${esc(f.value || "")}</textarea>` : `<input id="it-${i}" type="text" name="f${i}" value="${esc(f.value || "")}" maxlength="${f.max || 200}" placeholder="${esc(f.ph || "")}">`}
      ${f.hint ? `<p class="hint">${esc(f.hint)}</p>` : ""}</div>`).join("")}<p class="error" data-err hidden>Fill in the first field.</p>
      <button type="submit" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">Save</button></form>`,
    foot: `${del ? `<button class="btn btn-danger" type="button" data-del>${icon("trash", "sm")}Delete</button><span class="spacer"></span>` : ""}<button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" data-save>Save</button>`,
    onMount: (el, api) => {
      const form = $("form", el);
      const doSave = () => {
        const vals = fields.map((_, i) => form.elements[`f${i}`].value.trim());
        if (!vals[0]) { $("[data-err]", el).hidden = false; form.elements.f0.focus(); return; }
        onSave(vals); api.close(); bus.render();
      };
      form.addEventListener("submit", e => { e.preventDefault(); doSave(); });
      $("[data-save]", el).addEventListener("click", doSave);
      if (del) $("[data-del]", el).addEventListener("click", () => { api.close(); del(); });
    }
  });
}

export const skillActions = {
  "skill-rate": d => openRate([d.id]),
  "skill-rate-all": () => openRate(S.skills.list.map(s => s.id)),
  "skill-edit": d => openEditSkill(d.id),
  "skill-add": () => openAddSkill(),
  "proj-status": d => { const p = M.skillById(d.id)?.projects.find(x => x.id === d.p); if (p) { p.status = d.s; save("skills"); bus.render(); } },
  "proj-add": d => itemSheet({ title: "Add a project", fields: [{ label: "Project", ph: "e.g. Accessibility pass on the transit planner" }, { label: "Steps, one per line", rows: 5 }],
    onSave: ([t, steps]) => { M.skillById(d.id).projects.push({ id: uid("p"), title: t, steps: steps.split("\n").map(s => s.trim()).filter(Boolean), status: "idea" }); save("skills"); toast("Project added"); } }),
  "proj-edit": d => {
    const sk = M.skillById(d.id), p = sk?.projects.find(x => x.id === d.p); if (!p) return;
    itemSheet({ title: "Edit project", fields: [{ label: "Project", value: p.title }, { label: "Steps, one per line", rows: 6, value: p.steps.join("\n") }],
      onSave: ([t, steps]) => { p.title = t; p.steps = steps.split("\n").map(s => s.trim()).filter(Boolean); save("skills"); toast("Project saved"); },
      del: () => { const i = sk.projects.indexOf(p); sk.projects.splice(i, 1); save("skills"); bus.render(); toast("Project deleted", { action: "Undo", onAction: () => { sk.projects.splice(i, 0, p); save("skills"); bus.render(); } }); } });
  },
  "proj-plan": d => {
    const sk = M.skillById(d.id), p = sk?.projects.find(x => x.id === d.p); if (!p) return;
    const opts = S.plan.weeks.map(w => `<option value="${w.n}" ${w.n === M.currentWeek() ? "selected" : ""}>Week ${w.n}: ${esc(w.theme)}</option>`).join("");
    sheet({
      title: "Add to weekly plan", sub: esc(p.title),
      body: `<div class="form"><div class="field"><label for="pp-week">Week</label><select id="pp-week">${opts}</select></div>
        <div class="field"><label for="pp-h">Planned hours</label><input id="pp-h" type="number" min="0.5" max="40" step="0.5" value="3" style="max-width:120px"></div></div>`,
      foot: `<button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" data-ok>Add Build task</button>`,
      onMount: (el, api) => $("[data-ok]", el).addEventListener("click", () => {
        const week = parseInt($("#pp-week", el).value, 10), hours = clamp(parseFloat($("#pp-h", el).value) || 3, 0.5, 40);
        const order = Math.max(-1, ...S.plan.tasks.filter(x => x.week === week).map(x => x.order)) + 1;
        S.plan.tasks.push({ id: uid("t"), week, origWeek: week, track: "build", title: p.title, detail: p.steps.join(" · "), hours, res: [], skills: [sk.id], done: false, doneAt: "", dropped: false, carriedFrom: 0, carryPending: false, order });
        if (p.status === "idea") p.status = "doing";
        save("plan"); save("skills"); api.close(); bus.render(); toast(`Added to Week ${week}`);
      })
    });
  },
  "prac-add": d => itemSheet({ title: "Add an exercise", fields: [{ label: "Exercise", ph: "Short and repeatable, e.g. Critique one app in 10 minutes" }],
    onSave: ([t]) => { M.skillById(d.id).practice.push({ id: uid("x"), title: t, count: 0, last: "" }); save("skills"); toast("Exercise added"); } }),
  "prac-did": d => { const x = M.skillById(d.id)?.practice.find(p => p.id === d.p); if (x) { x.count++; x.last = today(); save("skills"); bus.render(); toast(`Nice. ${x.count}× so far`, { action: "Undo", onAction: () => { x.count = Math.max(0, x.count - 1); save("skills"); bus.render(); } }); } },
  "prac-del": d => {
    const sk = M.skillById(d.id), x = sk?.practice.find(p => p.id === d.p); if (!x) return;
    confirmSheet({ title: "Delete this exercise?", message: `<b>${esc(x.title)}</b>${x.count ? ` and its record of ${x.count} time${x.count > 1 ? "s" : ""} done` : ""} will be removed from this skill.`, confirm: "Delete", danger: true, onConfirm: () => {
      const i = sk.practice.indexOf(x); if (i < 0) return;
      sk.practice.splice(i, 1); save("skills"); bus.render();
      toast("Exercise deleted", { action: "Undo", onAction: () => { sk.practice.splice(i, 0, x); save("skills"); bus.render(); } });
    } });
  },
  "iq-add": d => itemSheet({ title: "Add an interview question", fields: [{ label: "Question" }, { label: "How to answer (optional)", rows: 3 }],
    onSave: ([q, tip]) => { M.skillById(d.id).interview.push({ id: uid("q"), q, tip }); save("skills"); toast("Question added"); } }),
  "iq-del": d => {
    const sk = M.skillById(d.id), x = sk?.interview.find(p => p.id === d.p); if (!x) return;
    confirmSheet({ title: "Delete this question?", message: `<b>${esc(x.q)}</b> will be removed from this skill.`, confirm: "Delete", danger: true, onConfirm: () => {
      const i = sk.interview.indexOf(x); if (i < 0) return;
      sk.interview.splice(i, 1); save("skills"); bus.render();
      toast("Question deleted", { action: "Undo", onAction: () => { sk.interview.splice(i, 0, x); save("skills"); bus.render(); } });
    } });
  },
  "test-ai": d => openTest(d.id, "ai"),
  "test-bank": d => openTest(d.id, "bank")
};

// ---------------- Tests ----------------
const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

function openTest(id, mode) {
  const sk = M.skillById(id); if (!sk) return;
  let questions = mode === "bank" ? shuffle(sk.bank).slice(0, 5).map(b => ({ type: "mc", q: b.q, options: b.o, answer: b.a, why: b.why })) : null;
  let ctl = null;
  sheet({
    title: `${mode === "ai" ? "AI test" : "Quick quiz"}: ${sk.name}`, wide: true,
    body: `<div data-test></div>`,
    foot: `<span class="spacer"></span><button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" data-submit hidden>Check answers</button>`,
    onClose: () => ctl && ctl.abort(),
    onMount: (el, api) => {
      const box = $("[data-test]", el), submit = $("[data-submit]", el);
      const renderQs = () => {
        box.innerHTML = `<ol class="quiz">${questions.map((q, i) => `<li><fieldset><legend>${esc(q.q)}</legend>
          ${q.type === "mc" ? q.options.map((o, j) => `<label class="opt"><input type="radio" name="q${i}" value="${j}"><span>${esc(o)}</span></label>`).join("")
            : `<label for="qa${i}" class="sr-only">Your answer</label><textarea id="qa${i}" name="q${i}" rows="3" placeholder="A few sentences"></textarea>`}</fieldset></li>`).join("")}</ol>`;
        submit.hidden = false;
        box.querySelector("input,textarea")?.focus();
      };
      if (questions) renderQs();
      else {
        box.innerHTML = `<div class="ai-wait" role="status"><div class="spinner" aria-hidden="true"></div><p>AI is writing your questions. This can take up to a minute.</p></div>`;
        ctl = new AbortController();
        askJson(`You write short skill checks for a product designer preparing for interviews${inPlace()}. ${profileLine()}
Skill: ${sk.name}. Why it matters: ${sk.why}. Their level now: ${sk.now} of 5; target ${sk.target} of 5.
Write 6 questions pitched just above level ${sk.now}: 4 multiple-choice and 2 short-answer. Base them on established practice and well-known sources; each multiple-choice question must have exactly one clearly correct option. No trick questions.
Reply with only JSON in this shape:
{"questions":[{"type":"mc","q":"...","options":["...","...","...","..."],"answer":0,"why":"one sentence"},{"type":"short","q":"...","rubric":"one sentence on what a good answer covers"}]}`, { signal: ctl.signal })
          .then(r => {
            const qs = (r && Array.isArray(r.questions) ? r.questions : []).filter(q => q && typeof q.q === "string" && (q.type === "short" || (Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer))));
            if (!qs.length) throw new Error("No questions came back. Try again.");
            questions = qs.slice(0, 8).map(q => q.type === "short" ? { type: "short", q: q.q, rubric: String(q.rubric || "") } : { type: "mc", q: q.q, options: q.options.map(String), answer: q.answer, why: String(q.why || "") });
            renderQs();
          })
          .catch(e => { if (e.code === "cancelled") return; box.innerHTML = `<p class="error" role="alert">${esc(e.message)}</p>${sk.bank.length ? `<p class="small" style="margin-top:8px">You can take the quick quiz from the built-in bank instead.</p>` : ""}`; });
      }
      submit.addEventListener("click", async () => {
        const answers = questions.map((q, i) => q.type === "mc" ? parseInt((box.querySelector(`input[name="q${i}"]:checked`) || {}).value, 10) : (box.querySelector(`textarea[name="q${i}"]`)?.value || "").trim());
        submit.disabled = true;
        let grades = questions.map((q, i) => q.type === "mc" ? { score: answers[i] === q.answer ? 1 : 0, feedback: q.why } : null);
        const shorts = questions.map((q, i) => q.type === "short" ? i : -1).filter(i => i >= 0);
        if (shorts.length) {
          box.insertAdjacentHTML("afterbegin", `<div class="ai-wait" role="status" data-grading><div class="spinner" aria-hidden="true"></div><p>Grading your written answers…</p></div>`);
          try {
            ctl = new AbortController();
            const r = await askJson(`Grade these short answers from a product designer practicing for interviews. Be fair, specific and brief. Score each 0, 0.5 or 1. An empty answer scores 0.
${JSON.stringify(shorts.map(i => ({ question: questions[i].q, what_a_good_answer_covers: questions[i].rubric, answer: answers[i] || "(no answer)" })))}
Reply with only JSON: {"grades":[{"score":1,"feedback":"one or two sentences"}]} in the same order.`, { signal: ctl.signal });
            shorts.forEach((qi, k) => { const g = r?.grades?.[k]; grades[qi] = { score: [0, 0.5, 1].includes(Number(g?.score)) ? Number(g.score) : 0, feedback: String(g?.feedback || "") }; });
          } catch (e) {
            shorts.forEach(qi => { grades[qi] = { score: 0, feedback: "Couldn't be graded: " + e.message, ungraded: true }; });
          }
        }
        const graded = grades.filter(g => !g.ungraded);
        const score = sum(graded, g => g.score), total = graded.length;
        if (total) { sk.tests.push({ d: today(), score, total, ai: mode === "ai" }); if (sk.tests.length > 30) sk.tests.splice(0, sk.tests.length - 30); save("skills"); }
        box.innerHTML = `<div class="quiz-score"><b>${total ? Math.round((score / total) * 100) : 0}%</b><span>${score} of ${total} points</span></div>
          <ol class="quiz done">${questions.map((q, i) => { const g = grades[i]; const ok = g.score === 1, half = g.score === 0.5;
            return `<li class="${ok ? "ok" : half ? "half" : "bad"}"><p class="qq">${esc(q.q)}</p>
              ${q.type === "mc" ? `<p class="small">${Number.isInteger(answers[i]) ? `Your answer: ${esc(q.options[answers[i]])}` : "No answer"}${ok ? "" : ` · Correct: <b>${esc(q.options[q.answer])}</b>`}</p>` : `<p class="small">Your answer: ${esc(answers[i] || "(none)")}</p>`}
              <p class="small fb"><span class="res-tag">${ok ? `${icon("check", "sm")}Right` : half ? "Partly right" : `${icon("x", "sm")}Not quite`}</span> ${esc(g.feedback)}</p></li>`; }).join("")}</ol>`;
        submit.hidden = true;
        api.el.querySelector(".sheet-f [data-close]").textContent = "Close";
        bus.render();
      });
    }
  });
}

// ---------------- Add a skill (AI fills it in) ----------------
export function openAddSkill() {
  const ai = aiVisible();
  let draft = null, ctl = null;
  sheet({
    title: "Add a skill", sub: ai ? "Type a name. AI can fill in why it matters, resources, projects, practice and questions for you to review." : "", wide: true,
    body: `<form class="form" novalidate>
      <div class="field"><label for="as-name">Skill</label><input id="as-name" type="text" name="nm" maxlength="120" placeholder="e.g. Service design"><p class="error" data-err hidden>Give the skill a name.</p></div>
      <div class="field"><label for="as-why">Why you want it <span class="muted">(optional)</span></label><textarea id="as-why" name="why" rows="2" maxlength="400"></textarea></div>
      <div class="row2 keep"><div class="field"><label for="as-now">Level now</label><select id="as-now" name="now">${[1, 2, 3, 4, 5].map(i => `<option ${i === 1 ? "selected" : ""}>${i}</option>`).join("")}</select></div>
        <div class="field"><label for="as-t">Target</label><select id="as-t" name="target">${[1, 2, 3, 4, 5].map(i => `<option ${i === 3 ? "selected" : ""}>${i}</option>`).join("")}</select></div></div>
      ${ai ? `<div><button class="btn" type="button" data-fill>${icon("sparkle", "sm")}Fill in with AI</button></div>` : ""}
      <div data-draft></div>
      <button type="submit" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">Save</button></form>`,
    foot: `<span class="spacer"></span><button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" data-save>Save skill</button>`,
    onClose: () => ctl && ctl.abort(),
    onMount: (el, api) => {
      const form = $("form", el), F = form.elements, box = $("[data-draft]", el);
      const fill = $("[data-fill]", el);
      if (fill) fill.addEventListener("click", async () => {
        const nm = F.nm.value.trim();
        if (!nm) { $("[data-err]", el).hidden = false; F.nm.focus(); return; }
        fill.disabled = true;
        box.innerHTML = `<div class="ai-wait" role="status"><div class="spinner" aria-hidden="true"></div><p>AI is drafting this skill. This can take up to a minute.</p><button class="btn btn-sm" type="button" data-stop>Stop</button></div>`;
        ctl = new AbortController();
        $("[data-stop]", box).addEventListener("click", () => ctl.abort());
        try {
          const r = await askJson(`Help a product designer add a skill to their learning plan. ${profileLine()}
Skill: "${nm}". Their note on why: "${F.why.value.trim() || "none"}". Their level now: ${F.now.value} of 5, target ${F.target.value} of 5.
Fill in a plan they can act on for the 2026 product design job market${inPlace()}. Don't invent facts about them. Suggest real, well-known resources; if you aren't sure of an exact URL, give the site's main page.
Reply with only JSON in this shape:
{"why":"1–2 sentences on why it matters for product design roles","proof":"one line: what to show in a portfolio or interview",
"resources":[{"title":"","type":"${RES_TYPES.join("|")}","url":"https://...","cost":"Free | Paid | Library | Membership","why":"one short sentence"}],
"projects":[{"title":"","steps":["",""]}],
"practice":["",""],
"interview":[{"q":"","tip":"one sentence on how to answer"}],
"bank":[{"q":"","options":["","","",""],"answer":0,"why":"one sentence"}]}
Give 5–8 resources, 2 projects, 3 practice exercises, 4 interview questions and 4 multiple-choice questions with one clearly correct option each.`, { signal: ctl.signal });
          draft = cleanDraft(r);
          renderDraft();
        } catch (e) {
          if (e.code !== "cancelled") box.innerHTML = `<p class="error" role="alert">${esc(e.message)}</p>`; else box.innerHTML = "";
        } finally { fill.disabled = false; }
      });
      const renderDraft = () => {
        if (!draft) return;
        if (draft.why && !F.why.value.trim()) F.why.value = draft.why;
        box.innerHTML = `<div class="ai-draft"><p class="ai-label">${icon("sparkle", "sm")}AI draft. Untick anything you don't want; you can edit it all after saving.</p>
          <div class="field"><label for="as-proof">How to prove it</label><input id="as-proof" type="text" value="${esc(draft.proof)}" maxlength="300"></div>
          ${draftGroup("Resources", draft.resources.map((r, i) => ({ k: `r${i}`, html: `<b>${esc(r.title)}</b> <span class="muted small">${esc(r.type)} · ${esc(r.cost)}${r.url ? ` · ${esc(host(r.url))}` : ""}</span>${r.why ? `<br><span class="small">${esc(r.why)}</span>` : ""}` })), "Links aren't checked. Open each one before relying on it.")}
          ${draftGroup("Projects", draft.projects.map((p, i) => ({ k: `p${i}`, html: `<b>${esc(p.title)}</b><br><span class="small">${p.steps.map(esc).join(" → ")}</span>` })))}
          ${draftGroup("Practice", draft.practice.map((t, i) => ({ k: `x${i}`, html: esc(t) })))}
          ${draftGroup("Interview questions", draft.interview.map((q, i) => ({ k: `q${i}`, html: `<b>${esc(q.q)}</b>${q.tip ? `<br><span class="small">${esc(q.tip)}</span>` : ""}` })))}
          ${draft.bank.length ? `<p class="small muted">Includes ${draft.bank.length} quiz questions for the quick quiz.</p>` : ""}</div>`;
      };
      const doSave = () => {
        const nm = F.nm.value.trim();
        if (!nm) { $("[data-err]", el).hidden = false; F.nm.focus(); return; }
        const id = slug(nm);
        const pick = k => !box.querySelector(`input[data-k="${k}"]`) || box.querySelector(`input[data-k="${k}"]`).checked;
        const now = parseInt(F.now.value, 10), target = parseInt(F.target.value, 10);
        const sk = { id, name: nm, why: F.why.value.trim(), proof: draft ? ($("#as-proof", el)?.value || "").trim() : "", now, target, start: now, history: [], tests: [], notes: "", custom: true, ai: !!draft,
          projects: draft ? draft.projects.filter((_, i) => pick(`p${i}`)).map(p => ({ id: uid("p"), title: p.title, steps: p.steps, status: "idea" })) : [],
          practice: draft ? draft.practice.filter((_, i) => pick(`x${i}`)).map(t => ({ id: uid("x"), title: t, count: 0, last: "" })) : [],
          interview: draft ? draft.interview.filter((_, i) => pick(`q${i}`)).map(q => ({ id: uid("q"), q: q.q, tip: q.tip })) : [],
          bank: draft ? draft.bank : [] };
        S.skills.list.push(sk);
        if (draft) {
          const added = draft.resources.filter((_, i) => pick(`r${i}`));
          for (const r of added) S.resources.list.push({ id: uid("r"), title: r.title, type: r.type, url: r.url, skills: [id], week: 0, cost: r.cost, units: null, status: "todo", notes: r.why || "", rating: 0, started: "", finished: "", last: "", checked: false, src: "ai" });
          if (added.length) save("resources");
        }
        save("skills"); api.close();
        location.hash = `#skill-${id}`;
        bus.render(); toast("Skill added");
      };
      form.addEventListener("submit", e => { e.preventDefault(); doSave(); });
      $("[data-save]", el).addEventListener("click", doSave);
    }
  });
}

function draftGroup(title, items, note = "") {
  if (!items.length) return "";
  return `<fieldset class="draft-group"><legend>${esc(title)} <span class="muted small">· ${items.length}</span></legend>${note ? `<p class="hint small">${esc(note)}</p>` : ""}
    ${items.map(it => `<label class="draft-item"><input type="checkbox" checked data-k="${it.k}"><span>${it.html}</span></label>`).join("")}</fieldset>`;
}

function cleanDraft(r) {
  const str = v => (typeof v === "string" ? v.trim() : "");
  const arr = v => (Array.isArray(v) ? v : []);
  return {
    why: str(r?.why), proof: str(r?.proof),
    resources: arr(r?.resources).map(x => ({ title: str(x?.title), type: RES_TYPES.includes(x?.type) ? x.type : "Article", url: safeUrl(str(x?.url)), cost: str(x?.cost) || "Unknown", why: str(x?.why) })).filter(x => x.title).slice(0, 10),
    projects: arr(r?.projects).map(p => ({ title: str(p?.title), steps: arr(p?.steps).map(str).filter(Boolean) })).filter(p => p.title).slice(0, 4),
    practice: arr(r?.practice).map(str).filter(Boolean).slice(0, 6),
    interview: arr(r?.interview).map(q => ({ q: str(q?.q), tip: str(q?.tip) })).filter(q => q.q).slice(0, 8),
    bank: arr(r?.bank).filter(b => b && typeof b.q === "string" && Array.isArray(b.options) && b.options.length >= 2 && Number.isInteger(b.answer) && b.answer < b.options.length).map(b => ({ q: b.q, o: b.options.map(String), a: b.answer, why: str(b.why) })).slice(0, 8)
  };
}

function slug(name) {
  let base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "skill";
  let id = base, i = 2;
  while (S.skills.list.some(s => s.id === id) || S.skills.removed.includes(id)) id = `${base}-${i++}`;
  return id;
}
