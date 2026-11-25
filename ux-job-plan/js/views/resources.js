// Courses and resources: in-progress cards, charts, filtered library, add/edit, find with AI.

import { S, save } from "../store.js";
import { RES_TYPES, RES_STATUS } from "../content2.js";
import { esc, uid, today, fmtDate, fmtHours, sum, safeUrl, host, clamp, $, $$ } from "../util.js";
import { icon, sheet, toast, meter, segmented, legend, columns, hbars, stars, weekLabels } from "../ui.js";
import * as M from "../model.js";
import { aiVisible, askJson, profileLine } from "../ai.js";
import { openSessionSheet } from "../forms.js";
import { bus } from "../bus.js";

const F = { q: "", type: "", skill: "", status: "", free: false };
const PAGE = 40;
let limit = PAGE;
export const setResFilter = (k, v) => { F[k] = v; limit = PAGE; };
const STATUS_COLOR = { done: "var(--c-apply)", doing: "var(--c-learn)", todo: "var(--c-neutral)" };
const skillName = id => M.skillById(id)?.name || id;
const isFree = r => /^free/i.test(r.cost || "") || /library/i.test(r.cost || "");

function progressText(r) {
  if (r.units && r.units.total) return `${r.units.done || 0} of ${r.units.total} ${esc(r.units.label || "")}`;
  return RES_STATUS[r.status];
}

export function resRow(r, { compact = false } = {}) {
  const url = safeUrl(r.url);
  return `<li class="res-row s-${r.status}">
    <div class="res-main">
      <div class="res-title">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" data-act="res-open" data-id="${r.id}">${esc(r.title)}<span class="sr-only"> (${esc(host(url))}, opens in a new tab)</span></a>` : `<span>${esc(r.title)}</span>`}
        ${!r.checked ? `<span class="tag warn" title="Suggested by AI. Open it once to check it's right.">Not checked</span>` : ""}</div>
      <div class="t-meta"><span class="chip">${esc(r.type)}</span><span>${esc(r.cost || "")}</span>${r.week ? `<a href="#plan-w${r.week}">Week ${r.week}</a>` : ""}
        ${!compact && r.skills.length ? `<span>${r.skills.map(skillName).map(esc).join(", ")}</span>` : ""}
        ${r.units && r.units.total && r.status !== "todo" ? `<span>${progressText(r)}</span>` : ""}${stars(r.rating)}</div>
    </div>
    <div class="res-ctl">
      <label class="sr-only" for="rs-${r.id}">Status of ${esc(r.title)}</label>
      <select id="rs-${r.id}" class="status-sel" data-change="res-status" data-id="${r.id}">${Object.entries(RES_STATUS).map(([k, l]) => `<option value="${k}" ${k === r.status ? "selected" : ""}>${l}</option>`).join("")}</select>
      <button class="icon-btn sm boxed" type="button" data-act="res-edit" data-id="${r.id}" aria-label="Edit ${esc(r.title)}" data-tip="Edit or delete">${icon("edit", "sm")}</button>
    </div>
  </li>`;
}

function activeCard(r) {
  const pct = M.resPct(r), hrs = M.resHours(r.id);
  return `<article class="card res-card" aria-labelledby="rc-${r.id}">
    <div class="res-card-top"><span class="chip">${esc(r.type)}</span>${!r.checked ? `<span class="tag warn">Not checked</span>` : ""}</div>
    <h3 id="rc-${r.id}">${safeUrl(r.url) ? `<a href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener noreferrer" data-act="res-open" data-id="${r.id}">${esc(r.title)}</a>` : esc(r.title)}</h3>
    <p class="muted small">${r.skills.map(skillName).map(esc).join(", ")}${r.cost ? ` · ${esc(r.cost)}` : ""}</p>
    ${meter(pct, 1, { color: "var(--c-learn)", label: `${Math.round(pct * 100)}% done` })}
    <div class="meter-legend"><span>${progressText(r)}</span><span>${Math.round(pct * 100)}%</span></div>
    <p class="small muted">${r.last ? `Last worked ${fmtDate(r.last)}` : r.started ? `Started ${fmtDate(r.started)}` : ""}${hrs ? ` · ${fmtHours(hrs)} logged` : ""}</p>
    <div class="actions">${r.units && r.units.total ? `<button class="btn btn-sm" type="button" data-act="res-unit" data-id="${r.id}" aria-label="One more ${esc(r.units.label || "unit")} done">+1 ${esc((r.units.label || "unit").replace(/s$/, ""))}</button>` : ""}
      <button class="btn btn-sm" type="button" data-act="res-log" data-id="${r.id}">${icon("clock", "sm")}Log time</button>
      <button class="btn btn-sm btn-primary" type="button" data-act="res-done" data-id="${r.id}">${icon("check", "sm")}Mark done</button></div>
  </article>`;
}

export function renderResources() {
  const all = S.resources.list;
  const done = all.filter(r => r.status === "done"), doing = all.filter(r => r.status === "doing");
  const active = [...doing].sort((a, b) => (b.last || b.started || "").localeCompare(a.last || a.started || ""));
  const overall = all.length ? sum(all, M.resPct) / all.length : 0;

  const typeRows = RES_TYPES.map(t => {
    const rs = all.filter(r => r.type === t);
    if (!rs.length) return "";
    const parts = ["done", "doing", "todo"].map(k => ({ label: RES_STATUS[k], value: rs.filter(r => r.status === k).length, color: STATUS_COLOR[k] }));
    return `<div class="trow stack"><span class="tn">${t}</span>${segmented(parts, { label: `${t}: ${parts.map(p => `${p.value} ${p.label.toLowerCase()}`).join(", ")}` })}<span class="tv">${parts[0].value}/${rs.length}</span></div>`;
  }).join("");

  const skillRows = S.skills.list.map(sk => {
    const rs = M.resourcesForSkill(sk.id);
    return { label: sk.name, value: rs.filter(r => r.status === "done").length, max: Math.max(1, rs.length), display: `${rs.filter(r => r.status === "done").length}/${rs.length}`, href: `#skill-${sk.id}`, color: "var(--c-apply)", total: rs.length };
  }).filter(x => x.total).sort((a, b) => b.value / b.max - a.value / a.max || b.total - a.total);

  const weeks = S.plan.weeks.map(w => Math.round(M.resHoursInWeek(w.n) * 10) / 10);
  const cur = M.currentWeek();

  const q = F.q.trim().toLowerCase();
  const list = all.filter(r => (!q || r.title.toLowerCase().includes(q) || (r.notes || "").toLowerCase().includes(q))
    && (!F.type || r.type === F.type) && (!F.skill || r.skills.includes(F.skill)) && (!F.status || r.status === F.status) && (!F.free || isFree(r)))
    .sort((a, b) => (a.week || 99) - (b.week || 99) || a.title.localeCompare(b.title));
  const ai = aiVisible();

  return `<header class="page-h"><div><div class="eyebrow">Grow</div><h1>Courses & resources</h1>
      <p class="lead">${all.length} resources across your skills, each tied to a week of the plan where it fits. Most are free; books link to WorldCat, which finds copies in libraries near you.</p></div>
    <div class="actions">${ai ? `<button class="btn" type="button" data-act="res-find">${icon("sparkle", "sm")}Find with AI</button>` : ""}<button class="btn btn-primary" type="button" data-act="res-add">${icon("plus", "sm")}Add resource</button></div></header>

  <section aria-labelledby="ip-h" style="margin-bottom:18px">
    <h2 id="ip-h" class="sec-h">In progress <span class="sub">${doing.length}</span></h2>
    ${active.length ? `<div class="res-cards">${active.map(activeCard).join("")}</div>` : `<div class="zone-empty"><b>Nothing in progress.</b>Set a resource to "In progress" in the list below and it shows up here with quick actions.</div>`}
  </section>

  <div class="chart-grid">
    <section class="card" aria-labelledby="rc1"><div class="card-h"><h2 id="rc1">Overall</h2></div><div class="card-b">
      <div class="m-val" style="font-size:28px;font-weight:700">${Math.round(overall * 100)}%<small style="font-size:15px;font-weight:500;color:var(--ink-3);margin-left:6px">done, counting partial progress</small></div>
      <div style="margin:12px 0 8px">${segmented(["done", "doing", "todo"].map(k => ({ label: RES_STATUS[k], value: all.filter(r => r.status === k).length, color: STATUS_COLOR[k] })), { tall: true })}</div>
      ${legend(["done", "doing", "todo"].map(k => ({ label: RES_STATUS[k], value: all.filter(r => r.status === k).length, color: STATUS_COLOR[k] })))}</div></section>
    <section class="card" aria-labelledby="rc2"><div class="card-h"><h2 id="rc2">By type</h2></div><div class="card-b"><div class="trows">${typeRows}</div>
      <div style="margin-top:10px">${legend(["done", "doing", "todo"].map(k => ({ label: RES_STATUS[k], color: STATUS_COLOR[k] })), { showValue: false })}</div></div></section>
    <section class="card" aria-labelledby="rc3"><div class="card-h"><h2 id="rc3">Done by skill</h2></div><div class="card-b scroll-y">${hbars(skillRows)}</div></section>
    <section class="card" aria-labelledby="rc4"><div class="card-h"><h2 id="rc4">Hours on resources</h2><span class="sub">${fmtHours(sum(weeks))} total</span></div><div class="card-b">
      ${columns(weeks, weeks.map(() => 0), weeks.map((_, i) => `Week ${i + 1}`), { cur: cur - 1, unit: "h", color: "var(--c-learn)" })}
      ${weekLabels(weeks.length)}
      <p class="muted small" style="margin-top:8px">From work sessions linked to a resource. Use "Log time" on a card.</p></div></section>
  </div>

  <section class="card" aria-labelledby="rl-h" style="margin-top:16px">
    <div class="card-h"><h2 id="rl-h">Library <span class="sub">${list.length} of ${all.length}</span></h2></div>
    <div class="card-b">
      <div class="filters" role="search">
        <label class="sr-only" for="rf-q">Search resources</label><input id="rf-q" type="search" placeholder="Search" value="${esc(F.q)}" data-change="res-filter" data-k="q">
        <label class="sr-only" for="rf-type">Type</label><select id="rf-type" data-change="res-filter" data-k="type"><option value="">All types</option>${RES_TYPES.map(t => `<option ${t === F.type ? "selected" : ""}>${t}</option>`).join("")}</select>
        <label class="sr-only" for="rf-skill">Skill</label><select id="rf-skill" data-change="res-filter" data-k="skill"><option value="">All skills</option>${S.skills.list.map(s => `<option value="${s.id}" ${s.id === F.skill ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>
        <label class="sr-only" for="rf-status">Status</label><select id="rf-status" data-change="res-filter" data-k="status"><option value="">Any status</option>${Object.entries(RES_STATUS).map(([k, l]) => `<option value="${k}" ${k === F.status ? "selected" : ""}>${l}</option>`).join("")}</select>
        <label class="switch small"><input type="checkbox" data-change="res-filter" data-k="free" ${F.free ? "checked" : ""}> Free or library only</label>
      </div>
      ${list.length ? `<ul class="res-list">${list.slice(0, limit).map(r => resRow(r)).join("")}</ul>
        ${list.length > limit ? `<div style="text-align:center;margin-top:12px"><button class="btn" type="button" data-act="res-more">Show ${Math.min(PAGE, list.length - limit)} more <span class="muted">(${list.length - limit} left)</span></button></div>` : ""}` : `<div class="empty"><b>No resources match</b>Try clearing a filter.</div>`}
    </div>
  </section>`;
}

// ---------------- Status changes ----------------
export function setStatus(r, status) {
  const prev = { status: r.status, started: r.started, finished: r.finished };
  r.status = status;
  if (status !== "todo" && !r.started) r.started = today();
  r.finished = status === "done" ? (r.finished || today()) : "";
  if (status === "done" && r.units && r.units.total) r.units.done = r.units.total;
  return prev;
}

export const resActions = {
  "res-more": () => { limit += PAGE; bus.render(); },
  "res-open": d => { const r = M.resById(d.id); if (r && !r.checked) { r.checked = true; save("resources"); setTimeout(() => bus.render(), 300); } },
  "res-edit": d => openResourceSheet({ id: d.id }),
  "res-add": d => openResourceSheet({ skill: d.skill }),
  "res-find": d => openFindResources({ skill: d.skill }),
  "res-done": d => {
    const r = M.resById(d.id); if (!r) return;
    const prev = setStatus(r, "done"); r.last = today(); save("resources"); bus.render();
    toast(`Done: ${r.title}`, { action: "Undo", onAction: () => { Object.assign(r, prev); save("resources"); bus.render(); } });
  },
  "res-unit": d => {
    const r = M.resById(d.id); if (!r || !r.units) return;
    r.units.done = clamp((r.units.done || 0) + 1, 0, r.units.total || 999); r.last = today();
    if (r.status === "todo") setStatus(r, "doing");
    save("resources"); bus.render();
  },
  "res-log": d => {
    const r = M.resById(d.id); if (!r) return;
    openSessionSheet({ prefill: { resourceId: r.id, label: r.title, track: "learn", min: 60 }, onSaved: () => { r.last = today(); if (r.status === "todo") setStatus(r, "doing"); save("resources"); } });
  }
};

// ---------------- Add / edit ----------------
export function openResourceSheet({ id = null, skill = "" } = {}) {
  const r = id ? M.resById(id) : null;
  const d = r || { title: "", url: "", type: "Course", skills: skill ? [skill] : [], week: 0, cost: "", status: "todo", units: null, notes: "", rating: 0 };
  sheet({
    title: r ? "Edit resource" : "Add a resource", wide: true,
    body: `<form class="form" novalidate>
      <div class="field"><label for="rf-title">Title</label><input id="rf-title" type="text" name="ttl" value="${esc(d.title)}" maxlength="200"><p class="error" data-err hidden>Give the resource a title.</p></div>
      <div class="field"><label for="rf-url">Link</label><input id="rf-url" type="url" name="url" value="${esc(d.url)}" placeholder="https://"></div>
      <div class="row3"><div class="field"><label for="rf-type">Type</label><select id="rf-type" name="type">${RES_TYPES.map(t => `<option ${t === d.type ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        <div class="field"><label for="rf-week">Plan week</label><select id="rf-week" name="week"><option value="0">None</option>${S.plan.weeks.map(w => `<option value="${w.n}" ${w.n === d.week ? "selected" : ""}>Week ${w.n}</option>`).join("")}</select></div>
        <div class="field"><label for="rf-cost">Cost</label><input id="rf-cost" type="text" name="cost" value="${esc(d.cost)}" placeholder="Free, Library, Membership, $30" maxlength="60"></div></div>
      <div class="field"><span class="lbl">Status</span><div class="seg-ctl" role="radiogroup" aria-label="Status">${Object.entries(RES_STATUS).map(([k, l]) => `<label><input type="radio" name="status" value="${k}" ${k === d.status ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></div>
      <div class="row3"><div class="field"><label for="rf-ud">Progress done</label><input id="rf-ud" type="number" name="ud" min="0" max="999" value="${d.units ? d.units.done || 0 : ""}" inputmode="numeric"></div>
        <div class="field"><label for="rf-ut">Out of</label><input id="rf-ut" type="number" name="ut" min="0" max="999" value="${d.units ? d.units.total || "" : ""}" inputmode="numeric"></div>
        <div class="field"><label for="rf-ul">Unit</label><input id="rf-ul" type="text" name="ul" value="${esc(d.units ? d.units.label : "")}" placeholder="lessons, chapters, hours" maxlength="20"></div></div>
      <fieldset class="field" style="border:0;padding:0;margin:0"><legend class="lbl" style="padding:0;margin-bottom:6px;font-weight:700;font-size:13.5px">Skills</legend>
        <div class="chips">${S.skills.list.map(s => `<label class="chip" style="cursor:pointer"><input type="checkbox" name="skills" value="${s.id}" ${d.skills.includes(s.id) ? "checked" : ""} style="margin:0;accent-color:var(--primary)">${esc(s.name)}</label>`).join("")}</div></fieldset>
      <div class="field"><span class="lbl">Your rating</span>${stars(d.rating, { name: "rating", interactive: true })}</div>
      <div class="field"><label for="rf-notes">Notes</label><textarea id="rf-notes" name="notes" rows="3" maxlength="1500">${esc(d.notes)}</textarea></div>
      <button type="submit" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">Save</button></form>`,
    foot: `${r ? `<button class="btn btn-danger" type="button" data-del>${icon("trash", "sm")}Delete</button>` : ""}<span class="spacer"></span>
      <button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" data-save>${r ? "Save" : "Add resource"}</button>`,
    onMount: (el, api) => {
      const form = $("form", el), E = form.elements;
      const doSave = () => {
        const title = E.ttl.value.trim();
        if (!title) { $("[data-err]", el).hidden = false; E.ttl.focus(); return; }
        const ut = parseInt(E.ut.value, 10) || 0;
        const vals = {
          title, url: safeUrl(E.url.value.trim()), type: E.type.value, week: parseInt(E.week.value, 10) || 0, cost: E.cost.value.trim(),
          units: ut ? { done: clamp(parseInt(E.ud.value, 10) || 0, 0, ut), total: ut, label: E.ul.value.trim() || "parts" } : null,
          skills: $$("input[name=skills]:checked", el).map(x => x.value), rating: parseInt((form.querySelector("input[name=rating]:checked") || {}).value, 10) || 0, notes: E.notes.value.trim()
        };
        const status = (form.querySelector("input[name=status]:checked") || {}).value || "todo";
        if (r) {
          if (vals.url !== r.url) r.checked = true;
          Object.assign(r, vals);
          if (status !== r.status) setStatus(r, status);
        } else {
          const nr = { id: uid("r"), ...vals, status: "todo", started: "", finished: "", last: "", checked: true, src: "mine" };
          setStatus(nr, status);
          S.resources.list.push(nr);
        }
        save("resources"); api.close(); bus.render(); toast(r ? "Resource saved" : "Resource added");
      };
      form.addEventListener("submit", e => { e.preventDefault(); doSave(); });
      $("[data-save]", el).addEventListener("click", doSave);
      if (r) $("[data-del]", el).addEventListener("click", () => {
        api.close();
        const i = S.resources.list.indexOf(r); S.resources.list.splice(i, 1);
        if (r.src === "built-in") S.resources.removed.push(r.id);
        save("resources"); bus.render();
        toast("Resource deleted", { action: "Undo", onAction: () => { S.resources.list.splice(i, 0, r); S.resources.removed = S.resources.removed.filter(x => x !== r.id); save("resources"); bus.render(); } });
      });
    }
  });
}

// ---------------- Find with AI ----------------
export function openFindResources({ skill = "" } = {}) {
  const sk = skill ? M.skillById(skill) : null;
  let found = [], ctl = null;
  sheet({
    title: "Find resources with AI", sub: "Claude suggests resources from what it knows. It can't browse the web, so links show \"Not checked\" until you open them.", wide: true,
    body: `<form class="form" novalidate>
      <div class="row2"><div class="field"><label for="fa-topic">Skill or topic</label><input id="fa-topic" type="text" name="topic" value="${esc(sk ? sk.name : "")}" maxlength="160" placeholder="e.g. Figma Motion, usability testing"><p class="error" data-err hidden>Add a topic.</p></div>
        <div class="field"><label for="fa-skill">Tag with skill</label><select id="fa-skill" name="skill"><option value="">None</option>${S.skills.list.map(s => `<option value="${s.id}" ${s.id === skill ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div></div>
      <fieldset class="field" style="border:0;padding:0;margin:0"><legend class="lbl" style="padding:0;margin-bottom:6px;font-weight:700;font-size:13.5px">Limits</legend>
        <div class="chips">${[["free", "Free only"], ["video", "Videos"], ["book", "Books"], ["course", "Courses"], ["short", "Under 5 hours"]].map(([v, l]) => `<label class="chip" style="cursor:pointer"><input type="checkbox" name="lim" value="${v}" style="margin:0;accent-color:var(--primary)">${l}</label>`).join("")}</div></fieldset>
      <div class="field"><label for="fa-n">How many</label><select id="fa-n" name="n" style="max-width:120px">${[5, 8, 10].map(n => `<option ${n === 8 ? "selected" : ""}>${n}</option>`).join("")}</select></div>
      <div><button class="btn btn-primary" type="submit">${icon("sparkle", "sm")}Find resources</button></div>
      <div data-out></div></form>`,
    foot: `<span class="spacer"></span><button class="btn btn-ghost" type="button" data-close>Close</button><button class="btn btn-primary" type="button" data-add hidden>Add selected</button>`,
    onClose: () => ctl && ctl.abort(),
    onMount: (el, api) => {
      const form = $("form", el), E = form.elements, out = $("[data-out]", el), add = $("[data-add]", el);
      form.addEventListener("submit", async e => {
        e.preventDefault();
        const topic = E.topic.value.trim();
        if (!topic) { $("[data-err]", el).hidden = false; E.topic.focus(); return; }
        const lim = $$("input[name=lim]:checked", el).map(x => x.value);
        const limText = { free: "free only", video: "videos", book: "books", course: "courses", short: "under 5 hours each" };
        const have = S.resources.list.map(r => r.title).slice(0, 120);
        out.innerHTML = `<div class="ai-wait" role="status"><div class="spinner" aria-hidden="true"></div><p>Claude is looking through what it knows. This can take up to a minute.</p><button class="btn btn-sm" type="button" data-stop>Stop</button></div>`;
        add.hidden = true;
        ctl = new AbortController();
        $("[data-stop]", out).addEventListener("click", () => ctl.abort());
        try {
          const r = await askJson(`Suggest ${E.n.value} learning resources for a product designer on: "${topic}". ${profileLine()}
Limits: ${lim.length ? lim.map(k => limText[k]).join(", ") : "none; mix formats"}.
Prefer well-known, current resources (2024–2026 where possible) from reputable sources. Give a URL you're confident about; if you're unsure of the exact page, use the site's main page.
Skip anything already in their library: ${JSON.stringify(have)}
Reply with only JSON: {"resources":[{"title":"","type":"${RES_TYPES.join("|")}","url":"https://...","cost":"Free | Paid | Library | Membership | about $X","hours":2,"why":"one sentence on why it fits"}]}`, { signal: ctl.signal });
          found = (Array.isArray(r?.resources) ? r.resources : []).map(x => ({ title: String(x?.title || "").trim(), type: RES_TYPES.includes(x?.type) ? x.type : "Article", url: safeUrl(String(x?.url || "")), cost: String(x?.cost || "").trim() || "Unknown", hours: Number(x?.hours) || null, why: String(x?.why || "").trim() })).filter(x => x.title).slice(0, 12);
          if (!found.length) { out.innerHTML = `<p class="error" role="alert">Nothing came back. Try a broader topic.</p>`; return; }
          out.innerHTML = `<div class="ai-draft"><p class="ai-label">${icon("sparkle", "sm")}AI suggestions. Tick the ones to add.</p>
            ${found.map((x, i) => `<label class="draft-item"><input type="checkbox" data-i="${i}" checked><span><b>${esc(x.title)}</b> <span class="muted small">${esc(x.type)} · ${esc(x.cost)}${x.hours ? ` · about ${x.hours} h` : ""}${x.url ? ` · ${esc(host(x.url))}` : ""}</span>${x.why ? `<br><span class="small">${esc(x.why)}</span>` : ""}</span></label>`).join("")}</div>`;
          add.hidden = false;
        } catch (err) {
          out.innerHTML = err.code === "cancelled" ? "" : `<p class="error" role="alert">${esc(err.message)}</p>`;
        }
      });
      add.addEventListener("click", () => {
        const picked = $$("input[data-i]:checked", out).map(x => found[+x.dataset.i]);
        if (!picked.length) { toast("Tick at least one resource"); return; }
        const sk2 = E.skill.value;
        for (const x of picked) S.resources.list.push({ id: uid("r"), title: x.title, type: x.type, url: x.url, skills: sk2 ? [sk2] : [], week: 0, cost: x.cost, units: x.hours ? { done: 0, total: Math.round(x.hours), label: "hours" } : null, status: "todo", notes: x.why, rating: 0, started: "", finished: "", last: "", checked: false, src: "ai" });
        save("resources"); api.close(); bus.render(); toast(`Added ${picked.length} resource${picked.length > 1 ? "s" : ""}`);
      });
    }
  });
}
