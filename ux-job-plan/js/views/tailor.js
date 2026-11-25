// Resume Tailor: job description → keyword match → suggested edits (house rules) → tailored resume.

import { S, save } from "../store.js";
import { COMPANIES } from "../content3.js";
import { esc, uid, clone, fmtDate, today, safeUrl, host, $ } from "../util.js";
import { icon, sheet, toast, confirmSheet, ring } from "../ui.js";
import { aiVisible, askJson, profileLine } from "../ai.js";
import { resumeText, visible, downloadResume } from "../export.js";
import { normApp } from "../store.js";
import { ensureCompany } from "../model4.js";
import { versionById, previewBlock, fitPreviews } from "./resume.js";
import { bus } from "../bus.js";

const JD_MAX = 5000, HISTORY_MAX = 12;
let busy = null;          // { kind: "analyze" | "suggest", ctl }
let kwFilter = "all";     // all | add | on | not
let aiError = "";

// Common terms in design postings, used when AI is off.
const TERMS = ["Product Design", "UX Design", "UI Design", "User Experience", "Interaction Design", "Visual Design", "Figma", "FigJam", "Sketch", "Adobe Creative Cloud", "Framer", "ProtoPie", "Prototyping", "Wireframes", "User Research", "Usability Testing", "Design Systems", "Accessibility", "WCAG", "Information Architecture", "User Flows", "Journey Maps", "Personas", "A/B Testing", "Data Visualization", "Dashboards", "Mobile", "iOS", "Android", "Responsive Design", "Web", "HTML", "CSS", "JavaScript", "React", "Motion Design", "Animation", "After Effects", "Lottie", "Rive", "Generative AI", "AI", "Machine Learning", "Design Thinking", "Agile", "Cross-functional", "Stakeholders", "Storytelling", "Metrics", "Analytics", "Content Design", "Enterprise", "B2B", "SaaS", "E-commerce", "Consumer", "Iteration", "Collaboration", "Communication", "Jira", "Miro", "Portfolio", "Claude Code", "Figma Make", "Codex", "Cursor", "Vercel", "Lovable", "Edge cases", "Design QA", "Handoff", "Design tokens", "Variables", "Conversation design", "Multimodal", "Agentic", "Permissions", "Power BI", "Usability studies", "Heuristic evaluation", "WCAG 2.2"];

const cur = () => S.tailor.current;
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasTerm = (text, term) => new RegExp(`(^|[^\\p{L}\\p{N}])${reEsc(term.toLowerCase())}($|[^\\p{L}\\p{N}])`, "u").test(text);
const words = s => (s || "").trim().split(/\s+/).filter(Boolean).length;
const nums = s => (String(s || "").match(/\d+(?:[.,]\d+)?%?/g) || []);
const newNums = (before, after) => { const b = new Set(nums(before)); return nums(after).filter(n => !b.has(n)); };

// ---------- Draft: base version + accepted changes ----------
const summarySec = r => r.sections.find(s => s.id === "summary") || r.sections.find(s => s.kind === "text");
const skillsSec = r => r.sections.find(s => s.kind === "skills");
function findBullet(r, id) {
  for (const s of r.sections) if (s.kind === "entries") for (const it of s.items) { const b = it.bullets.find(x => x.id === id); if (b) return { b, it, s }; }
  return null;
}
function origText(base, key) {
  if (key === "title") return base.header.title || "";
  const [k, id] = key.split(":");
  if (k === "sec") return base.sections.find(s => s.id === id)?.text || "";
  if (k === "g") return skillsSec(base)?.groups.find(g => g.id === id)?.items || "";
  if (k === "b") return findBullet(base, id)?.b.text || "";
  return "";
}
function sugText(c, key) {
  const s = c.suggest; if (!s) return null;
  if (key === "title") return s.title || null;
  const [k, id] = key.split(":");
  if (k === "sec") return s.summary || null;
  if (k === "g") return s.skills?.find(g => g.id === id)?.items || null;
  if (k === "b") return s.bullets?.find(b => b.id === id)?.text || null;
  return null;
}
function setText(r, key, text) {
  if (key === "title") { r.header.title = text; return; }
  const [k, id] = key.split(":");
  if (k === "sec") { const s = r.sections.find(x => x.id === id); if (s) s.text = text; }
  if (k === "g") { const g = skillsSec(r)?.groups.find(x => x.id === id); if (g) g.items = text; }
  if (k === "b") { const f = findBullet(r, id); if (f) f.b.text = text; }
}
const baseOf = c => versionById(c.baseId) || versionById("master");
export const draftFor = h => buildDraft(h);
function buildDraft(c) {
  const base = baseOf(c), d = clone(base), diff = new Set();
  d.id = "tailored"; d.name = [c.company, c.role].filter(Boolean).join(" – ");
  for (const [key, dec] of Object.entries(c.decisions || {})) {
    const text = dec.s === "accept" ? sugText(c, key) : dec.s === "edit" ? dec.text : null;
    if (text != null && text !== origText(base, key)) { setText(d, key, text); diff.add(key); }
  }
  const sk = skillsSec(d);
  if (sk && c.added?.length) {
    const g = sk.groups.find(x => x.id === c.addGroup) || sk.groups[0];
    if (g) {
      const low = g.items.toLowerCase();
      const extra = c.added.filter(t => !low.includes(t.toLowerCase()));
      if (extra.length) { g.items = [g.items.trim(), ...extra].filter(Boolean).join(", "); diff.add(`g:${g.id}`); }
    }
  }
  return { draft: d, diff, base };
}

// ---------- Keyword status ----------
function kwStatus(c, draft) {
  const text = resumeText(draft).toLowerCase();
  return (c.analysis?.keywords || []).map(k => {
    const on = hasTerm(text, k.term);
    const mine = k.term.toLowerCase() in (c.over || {}) ? c.over[k.term.toLowerCase()] : !!k.has;
    return { ...k, st: on ? "on" : mine ? "add" : "not" };
  });
}
function coverage(list, kind = null) {
  const l = kind ? list.filter(k => k.kind === kind) : list;
  const on = l.filter(k => k.st === "on").length;
  return { on, total: l.length, pct: l.length ? Math.round((on / l.length) * 100) : 0 };
}

// ---------- Render ----------
const STEPS = [["job", "The job"], ["match", "Match"], ["edit", "Suggestions"], ["review", "Review and download"]];
function stepper(c) {
  const can = { job: true, match: !!c?.analysis, edit: !!c?.analysis, review: !!c?.analysis };
  const at = c?.step || "job";
  return `<ol class="stepper" aria-label="Steps">${STEPS.map(([k, l], i) => `<li><button type="button" class="step ${at === k ? "is-on" : ""}" data-act="tl-step" data-step="${k}" ${can[k] ? "" : "disabled"} ${at === k ? 'aria-current="step"' : ""}><span class="step-n">${i + 1}</span><span>${l}</span></button></li>`).join("")}</ol>`;
}

export function renderTailor() {
  const c = cur();
  const hist = S.tailor.history;
  return `<header class="page-h"><div><div class="eyebrow">Materials</div><h1>Resume Tailor</h1>
      <p class="lead">Paste a job description. See which of its keywords your resume already covers, accept the edits you agree with, and download a tailored copy.</p></div>
    <div class="actions">${c ? `<button class="btn" type="button" data-act="tl-new">${icon("plus", "sm")}New tailoring</button>` : ""}</div></header>
  ${stepper(c)}
  ${!c || c.step === "job" ? jobStep(c) : c.step === "match" ? matchStep(c) : c.step === "edit" ? editStep(c) : reviewStep(c)}
  ${historyCard(hist)}
  ${rulesCard()}`;
}

function aiBusy(kind, msg) {
  return busy?.kind === kind ? `<div class="ai-wait" role="status"><div class="spinner" aria-hidden="true"></div><p>${msg}</p><button class="btn btn-sm" type="button" data-act="tl-cancel">Cancel</button></div>` : "";
}
const errBox = () => (aiError ? `<p class="error" role="alert">${esc(aiError)}</p>` : "");

function jobStep(c) {
  const v = { company: "", role: "", link: "", jd: "", baseId: S.resume.current, ...(c ? { company: c.company, role: c.role, link: c.link, jd: c.jd, baseId: c.baseId } : {}), ...(S.tailor.form || {}) };
  const len = (v.jd || "").length;
  return `<section class="card" aria-labelledby="tj-h"><div class="card-h"><h2 id="tj-h">${icon("briefcase")}The job</h2></div><div class="card-b">
    <form class="form" data-form="tl-job" novalidate>
      <div class="row2">
        <div class="field"><label for="tj-co">Company</label><input id="tj-co" name="company" data-change="tl-job-f" data-f="company" type="text" list="tj-cos" value="${esc(v.company)}" maxlength="80" autocomplete="off"><datalist id="tj-cos">${COMPANIES.map(x => `<option value="${esc(x)}">`).join("")}</datalist><p class="error" data-err="company" hidden>Add the company.</p></div>
        <div class="field"><label for="tj-ro">Role</label><input id="tj-ro" name="role" data-change="tl-job-f" data-f="role" type="text" value="${esc(v.role)}" maxlength="120" placeholder="e.g. Product Designer II"><p class="error" data-err="role" hidden>Add the role.</p></div>
        <div class="field"><label for="tj-li">Link to the posting <span class="muted">(optional)</span></label><input id="tj-li" name="link" data-change="tl-job-f" data-f="link" type="url" inputmode="url" value="${esc(v.link)}" maxlength="500" placeholder="https://"></div>
        <div class="field"><label for="tj-base">Start from</label><select id="tj-base" name="baseId" data-change="tl-job-f" data-f="baseId">${S.resume.versions.map(r => `<option value="${r.id}" ${r.id === v.baseId ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label for="tj-jd">Job description</label>
        <p class="hint" id="tj-jd-h">Paste the whole posting, including requirements and nice-to-haves. Up to ${JD_MAX.toLocaleString()} characters are kept.</p>
        <textarea id="tj-jd" name="jd" data-change="tl-job-f" data-f="jd" rows="12" maxlength="${JD_MAX}" aria-describedby="tj-jd-h tj-jd-c">${esc(v.jd)}</textarea>
        <p class="hint" id="tj-jd-c" data-count>${len.toLocaleString()} of ${JD_MAX.toLocaleString()} characters</p>
        <p class="error" data-err="jd" hidden>Paste at least a few lines of the job description.</p></div>
      ${aiBusy("analyze", "Reading the job description and comparing it with your resume…")}${errBox()}
      <div class="actions"><button class="btn btn-primary" type="submit" ${busy ? "disabled" : ""}>${icon(aiVisible() ? "sparkle" : "target", "sm")}${aiVisible() ? "Analyze with AI" : "Check keywords"}</button>
        ${aiVisible() ? `<button class="btn btn-ghost" type="button" data-act="tl-local" ${busy ? "disabled" : ""}>Check keywords without AI</button>` : `<span class="muted small">AI is off, so keywords come from a list of common design terms.</span>`}</div>
    </form></div></section>`;
}

function matchStep(c) {
  const { draft, base } = buildDraft(c);
  const list = kwStatus(c, draft), baseList = kwStatus({ ...c, added: [], decisions: {} }, base);
  const all = coverage(list), req = coverage(list, "required"), pref = coverage(list, "preferred"), before = coverage(baseList);
  const a = c.analysis, m = a.match;
  const shown = list.filter(k => kwFilter === "all" || k.st === kwFilter);
  const counts = { all: list.length, add: list.filter(k => k.st === "add").length, on: list.filter(k => k.st === "on").length, not: list.filter(k => k.st === "not").length };
  const sk = skillsSec(draft);
  const ST = { on: ["check", "In your resume"], add: ["plus", "You have it, add it"], not: ["x", "Not in your experience"] };
  const suggestedBase = a.base && a.base !== c.baseId && versionById(a.base);
  return `${a.local ? `<div class="banner" role="note">${icon("info")}<p>These keywords come from a list of common design terms, without AI. Required and preferred aren't separated.</p></div>` : ""}
  ${a.flags?.length ? `<div class="banner warn" role="note">${icon("alert")}<div><p><b>Worth knowing before you apply</b></p><ul class="plain">${a.flags.map(f => `<li>${esc(f)}</li>`).join("")}</ul></div></div>` : ""}
  <div class="grid-2 tl-top">
    <section class="card" aria-labelledby="tm-cov"><div class="card-h"><h2 id="tm-cov">Keyword coverage</h2><span class="muted small" data-tip="Share of the posting's keywords that appear word for word in your tailored resume. Many screening tools match literally.">${icon("info", "sm")}</span></div>
      <div class="card-b tl-cov">${ring(all.pct, { label: `Keyword coverage ${all.pct}%: ${all.on} of ${all.total} keywords in your resume`, sub: `${all.on} of ${all.total}` })}
        <div class="tl-cov-side">
          ${a.local ? "" : `<div class="tl-bar"><div class="tl-bar-h"><span>Required</span><b>${req.on} of ${req.total}</b></div><div class="meter thin" style="--mc:var(--c-build)" role="img" aria-label="Required keywords: ${req.on} of ${req.total}"><i style="width:${req.pct}%"></i></div></div>
          <div class="tl-bar"><div class="tl-bar-h"><span>Preferred</span><b>${pref.on} of ${pref.total}</b></div><div class="meter thin" style="--mc:var(--c-learn)" role="img" aria-label="Preferred keywords: ${pref.on} of ${pref.total}"><i style="width:${pref.pct}%"></i></div></div>`}
          <p class="small muted">${all.pct > before.pct ? `Up from ${before.pct}% in “${esc(base.name)}”.` : `“${esc(base.name)}” as it is.`} Aim for most of the required ones, using only words that are true for you.</p>
        </div></div></section>
    <section class="card" aria-labelledby="tm-fit"><div class="card-h"><h2 id="tm-fit">How well you match</h2></div><div class="card-b">
      ${m ? `<p class="fit fit-${esc(m.fit)}"><b>${esc({ strong: "Strong fit", good: "Good fit", stretch: "Stretch" }[m.fit] || "Fit")}</b>${Number.isFinite(m.score) ? ` · ${m.score} of 100` : ""}</p>
        ${m.why?.length ? `<ul class="plain small">${m.why.map(w => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}<p class="muted small" style="margin-top:8px">${icon("sparkle", "sm")} AI's read of the posting. Use it as a second opinion.</p>`
        : `<p class="muted">Turn on AI in Settings for a fit read. The keyword check works without it.</p>`}
      ${suggestedBase ? `<div class="tl-base"><p class="small">A better starting point might be <b>${esc(suggestedBase.name)}</b>.</p><button class="btn btn-sm" type="button" data-act="tl-base" data-id="${suggestedBase.id}">Switch to it</button></div>` : ""}
    </div></section>
  </div>
  <section class="card" aria-labelledby="tm-kw"><div class="card-h"><h2 id="tm-kw">Keywords from the posting</h2>
      ${sk ? `<div class="field inline"><label for="tm-grp">Add terms to</label><select id="tm-grp" data-change="tl-group">${sk.groups.map(g => `<option value="${g.id}" ${g.id === (c.addGroup || sk.groups[0]?.id) ? "selected" : ""}>${esc(g.label)}</option>`).join("")}</select></div>` : ""}</div>
    <div class="card-b">
      <div class="seg-ctl" role="radiogroup" aria-label="Show keywords" style="margin-bottom:12px">${[["all", "All"], ["add", "To add"], ["on", "In resume"], ["not", "Not you"]].map(([v, l]) => `<label><input type="radio" name="kwf" value="${v}" data-change="tl-kwf" ${kwFilter === v ? "checked" : ""}><span>${l} <span class="muted">${counts[v]}</span></span></label>`).join("")}</div>
      ${shown.length ? `<ul class="kw-list">${shown.map(k => `<li class="kw kw-${k.st}">
        <span class="kw-ic">${icon(ST[k.st][0], "sm")}</span>
        <span class="kw-main"><b>${esc(k.term)}</b><span class="muted small">${ST[k.st][1]}${k.kind ? ` · ${k.kind}` : ""}${c.added?.includes(k.term) ? " · added" : ""}</span></span>
        <span class="kw-actions">${k.st === "add" && sk ? `<button class="btn btn-sm" type="button" data-act="tl-add-kw" data-term="${esc(k.term)}">${icon("plus", "sm")}Add to skills</button>` : ""}
          ${c.added?.includes(k.term) ? `<button class="btn btn-sm btn-ghost" type="button" data-act="tl-rm-kw" data-term="${esc(k.term)}">Remove</button>` : ""}
          ${k.st !== "on" ? `<button class="btn btn-sm btn-ghost" type="button" data-act="tl-mine" data-term="${esc(k.term)}" aria-pressed="${k.st === "add"}">${k.st === "add" ? "I don't have this" : "I have this"}</button>` : ""}</span></li>`).join("")}</ul>`
        : `<p class="muted small">No keywords in this view.</p>`}
      <p class="muted small" style="margin-top:10px">Only add terms that are true for you. You'll be asked about anything on your resume.</p>
    </div></section>
  <div class="step-foot"><button class="btn" type="button" data-act="tl-step" data-step="job">Back</button><button class="btn btn-primary" type="button" data-act="tl-step" data-step="edit">Next: suggestions${icon("arrowR", "sm")}</button></div>`;
}

function partRow(c, base, key, label, { multi = true } = {}) {
  const before = origText(base, key), sug = sugText(c, key), dec = c.decisions?.[key];
  const changed = sug != null && sug.trim() !== before.trim();
  const after = dec?.s === "edit" ? dec.text : sug;
  const added = changed ? newNums(before, after) : [];
  const state = dec?.s === "accept" ? "Accepted" : dec?.s === "edit" ? "Edited" : dec?.s === "keep" ? "Kept original" : changed ? "Suggested" : "";
  const why = key.startsWith("b:") ? c.suggest?.bullets?.find(b => `b:${b.id}` === key)?.why : "";
  const lost = changed ? (c.analysis?.keywords || []).filter(k => hasTerm(before.toLowerCase(), k.term) && !hasTerm(String(after || "").toLowerCase(), k.term)).map(k => k.term) : [];
  return `<li class="part ${dec ? `is-${dec.s}` : changed ? "is-sug" : ""}">
    <div class="part-h"><b>${esc(label)}</b>${state ? `<span class="chip">${state}</span>` : ""}</div>
    ${changed || dec?.s === "edit" ? `<div class="part-diff">
        <div><span class="lbl">Now</span><p class="${dec?.s === "accept" || dec?.s === "edit" ? "strike" : ""}">${esc(before) || "<span class='muted'>(empty)</span>"}</p></div>
        <div><span class="lbl">${dec?.s === "edit" ? "Your edit" : "Suggested"}</span><p class="${dec?.s === "keep" ? "strike" : "new"}">${esc(after)}</p></div></div>
      ${why ? `<p class="small muted">${esc(why)}</p>` : ""}
      ${added.length ? `<p class="small warn-text">${icon("alert", "sm")}Adds ${added.map(esc).join(", ")}, which isn't in the original. Your rules say never change numbers.</p>` : ""}
      ${lost.length ? `<p class="small warn-text">${icon("alert", "sm")}Drops the keyword${lost.length === 1 ? "" : "s"} ${lost.map(esc).join(", ")} from this part.</p>` : ""}`
    : `<p class="${multi ? "" : "small"}">${esc(before) || "<span class='muted'>(empty)</span>"}</p>`}
    <div class="part-actions">
      ${changed && dec?.s !== "accept" ? `<button class="btn btn-sm ${added.length ? "" : "btn-primary"}" type="button" data-act="tl-dec" data-key="${key}" data-s="accept">${icon("check", "sm")}Accept</button>` : ""}
      <button class="btn btn-sm" type="button" data-act="tl-edit" data-key="${key}" data-label="${esc(label)}">${icon("edit", "sm")}Edit</button>
      ${dec && dec.s !== "keep" ? `<button class="btn btn-sm btn-ghost" type="button" data-act="tl-dec" data-key="${key}" data-s="keep">Keep original</button>` : ""}
      ${changed && !dec ? `<button class="btn btn-sm btn-ghost" type="button" data-act="tl-dec" data-key="${key}" data-s="keep">Keep original</button>` : ""}
    </div></li>`;
}

function editStep(c) {
  const base = baseOf(c), vis = visible(base);
  const sum = summarySec(base), sk = skillsSec(base);
  const sugB = new Set((c.suggest?.bullets || []).map(b => b.id));
  const bullets = [];
  for (const s of vis) if (s.kind === "entries") for (const it of s.items) for (const b of it.bullets) bullets.push({ b, it });
  const pending = c.suggest ? Object.keys(allSugKeys(c)).filter(k => !c.decisions?.[k] && !newNums(origText(base, k), sugText(c, k)).length).length : 0;
  return `<section class="card" aria-labelledby="te-h"><div class="card-h"><h2 id="te-h">${icon("wand")}Suggested edits</h2>
      ${c.suggest && pending ? `<button class="btn btn-sm" type="button" data-act="tl-accept-all">Accept all ${pending} that keep numbers</button>` : ""}</div><div class="card-b">
    <p class="small muted" style="margin-bottom:12px">Edits follow your house rules: they can change ${esc(S.tailor.rules.may.join(", ").toLowerCase())}; never ${esc(S.tailor.rules.never.join(", ").toLowerCase())}. Titles, dates and which job each bullet sits under can't change here.</p>
    ${aiVisible() ? `${aiBusy("suggest", "Writing suggestions that follow your house rules…")}${errBox()}
      ${busy?.kind === "suggest" ? "" : `<div class="actions" style="margin-bottom:12px"><button class="btn ${c.suggest ? "" : "btn-primary"}" type="button" data-act="tl-suggest" ${busy ? "disabled" : ""}>${icon("sparkle", "sm")}${c.suggest ? "Suggest again" : "Suggest edits with AI"}</button></div>`}`
      : `<p class="muted small" style="margin-bottom:12px">AI is off. Edit any part by hand below.</p>`}
    <ul class="parts">
      ${partRow(c, base, "title", "Title line", { multi: false })}
      ${sum ? partRow(c, base, `sec:${sum.id}`, sum.title) : ""}
      ${sk ? sk.groups.filter(g => !g.hidden).map(g => partRow(c, base, `g:${g.id}`, `Skills: ${g.label}`)).join("") : ""}
      ${bullets.filter(x => sugB.has(x.b.id) || c.decisions?.[`b:${x.b.id}`]).map(x => partRow(c, base, `b:${x.b.id}`, `${x.it.org} bullet`)).join("")}
    </ul>
    <details class="more-parts"><summary>${icon("chev", "sm")}Edit any other bullet</summary><ul class="parts">
      ${bullets.filter(x => !sugB.has(x.b.id) && !c.decisions?.[`b:${x.b.id}`]).map(x => partRow(c, base, `b:${x.b.id}`, `${x.it.org} bullet`)).join("") || `<li class="muted small">All bullets are listed above.</li>`}
    </ul></details>
  </div></section>
  <div class="step-foot"><button class="btn" type="button" data-act="tl-step" data-step="match">Back</button><button class="btn btn-primary" type="button" data-act="tl-step" data-step="review">Next: review${icon("arrowR", "sm")}</button></div>`;
}
function allSugKeys(c) {
  const out = {}, s = c.suggest; if (!s) return out;
  const base = baseOf(c);
  const sum = summarySec(base);
  if (s.title && s.title !== origText(base, "title")) out.title = 1;
  if (sum && s.summary && s.summary !== origText(base, `sec:${sum.id}`)) out[`sec:${sum.id}`] = 1;
  for (const g of s.skills || []) if (g.items !== origText(base, `g:${g.id}`)) out[`g:${g.id}`] = 1;
  for (const b of s.bullets || []) if (b.text !== origText(base, `b:${b.id}`)) out[`b:${b.id}`] = 1;
  return out;
}

function changeList(c, diff) {
  const base = baseOf(c), rows = [];
  for (const key of diff) {
    const lbl = key === "title" ? "Title line" : key.startsWith("sec:") ? "Summary" : key.startsWith("g:") ? `Skills: ${skillsSec(base)?.groups.find(g => `g:${g.id}` === key)?.label || ""}` : `${findBullet(base, key.slice(2))?.it.org || ""} bullet`;
    rows.push(`<li>${esc(lbl)}</li>`);
  }
  return rows.length ? `<ul class="plain small">${rows.join("")}</ul>` : `<p class="muted small">No changes yet. This is “${esc(base.name)}” as it is.</p>`;
}

function reviewStep(c) {
  const { draft, diff } = buildDraft(c);
  const list = kwStatus(c, draft), cov = coverage(list);
  const baseOn = new Set(kwStatus({ ...c, added: [], decisions: {} }, baseOf(c)).filter(k => k.st === "on").map(k => k.term));
  const lost = list.filter(k => k.st !== "on" && baseOn.has(k.term)).map(k => k.term);
  const saved = c.savedId && S.tailor.history.some(h => h.id === c.savedId);
  const app = c.appId && S.apps.list.find(a => a.id === c.appId);
  return `<div class="re-grid tl-review">
    <div class="re-edit">
      <section class="card" aria-labelledby="tr-h"><div class="card-h"><h2 id="tr-h">${esc(c.company)} · ${esc(c.role)}</h2></div><div class="card-b">
        <div class="tl-sum">${ring(cov.pct, { label: `Keyword coverage ${cov.pct}%`, size: 84, sub: "keywords" })}
          <div><p class="small"><b>${diff.size}</b> change${diff.size === 1 ? "" : "s"} from “${esc(baseOf(c).name)}”${c.analysis?.match?.fit ? ` · ${esc({ strong: "Strong fit", good: "Good fit", stretch: "Stretch" }[c.analysis.match.fit] || "")}` : ""}</p>
          ${changeList(c, diff)}<p class="muted small">Changes are highlighted in the preview.</p>
          ${lost.length ? `<p class="small warn-text" style="margin-top:6px">${icon("alert", "sm")}No longer in your resume: ${lost.map(esc).join(", ")}. Edit a part to bring ${lost.length === 1 ? "it" : "them"} back.</p>` : ""}</div></div>
      </div></section>
      <section class="card" aria-labelledby="tr-dl"><div class="card-h"><h2 id="tr-dl">${icon("download")}Download</h2></div><div class="card-b">
        <div class="actions">${[["pdf", "PDF"], ["docx", "Word (.docx)"], ["txt", "Text"], ["md", "Markdown"]].map(([f, l], i) => `<button class="btn ${i ? "" : "btn-primary"}" type="button" data-act="tl-dl" data-fmt="${f}">${l}</button>`).join("")}</div>
        <p class="muted small" style="margin-top:8px">Read it once more before you send it. The highlights don't print.</p></div></section>
      <section class="card" aria-labelledby="tr-keep"><div class="card-h"><h2 id="tr-keep">Keep it</h2></div><div class="card-b">
        <div class="actions">
          <button class="btn" type="button" data-act="tl-save" ${saved ? "disabled" : ""}>${icon(saved ? "check" : "folder", "sm")}${saved ? "Saved to history" : "Save to history"}</button>
          <button class="btn" type="button" data-act="tl-version">${icon("copy", "sm")}Save as a resume version</button>
          ${app ? `<span class="chip">${icon("check", "sm")}In Applications · ${esc(app.status)}</span>` : `<button class="btn btn-primary" type="button" data-act="tl-app">${icon("briefcase", "sm")}Add to Applications</button>`}
        </div></div></section>
    </div>
    <div class="re-prev"><div class="re-prev-in"><div class="re-prev-top"><span class="small muted"><mark class="rp-changed" style="padding:0 4px">Highlighted</mark> = changed</span></div>
      ${previewBlock(draft, { diff, id: "rpt" })}</div></div>
  </div>
  <div class="step-foot"><button class="btn" type="button" data-act="tl-step" data-step="edit">Back</button></div>`;
}

function historyCard(hist) {
  if (!hist.length) return "";
  return `<section class="card" aria-labelledby="th-h"><div class="card-h"><h2 id="th-h">${icon("clock")}Past tailorings</h2><span class="muted small">${hist.length} of ${HISTORY_MAX} kept</span></div><div class="card-b">
    <ul class="hist">${hist.map(h => `<li><div class="hist-main"><b>${esc(h.company)}</b> · ${esc(h.role)}<span class="muted small"> · ${fmtDate(h.savedAt)} · ${h.coverage}% keywords${h.changes ? ` · ${h.changes} change${h.changes === 1 ? "" : "s"}` : ""}${h.link && safeUrl(h.link) ? ` · <a href="${esc(safeUrl(h.link))}" target="_blank" rel="noopener">${esc(host(h.link))}</a>` : ""}</span></div>
      <span class="actions"><button class="btn btn-sm" type="button" data-act="tl-open" data-id="${h.id}">Open</button><button class="icon-btn sm danger" type="button" data-act="tl-del" data-id="${h.id}" aria-label="Delete ${esc(h.company)} tailoring">${icon("trash", "sm")}</button></span></li>`).join("")}</ul>
  </div></section>`;
}

function rulesCard() {
  const R = S.tailor.rules;
  const col = (k, title) => `<div><h3 class="h-sm">${title}</h3><ul class="rule-list">${R[k].map((r, i) => `<li><span>${esc(r)}</span><button class="icon-btn sm danger" type="button" data-act="tl-rule-del" data-k="${k}" data-i="${i}" aria-label="Remove rule: ${esc(r)}">${icon("x", "sm")}</button></li>`).join("")}</ul>
    <form class="rule-add" data-form="tl-rule" data-k="${k}"><label class="sr-only" for="ra-${k}">Add a rule to ${title}</label><input id="ra-${k}" type="text" maxlength="120" placeholder="Add a rule"><button class="btn btn-sm" type="submit">${icon("plus", "sm")}Add</button></form></div>`;
  return `<details class="card rules-card"><summary class="card-h"><h2>${icon("flag")}House rules</h2><span class="chev">${icon("chevDown", "sm")}</span></summary><div class="card-b">
    <p class="small muted" style="margin-bottom:12px">Every AI suggestion follows these.</p>
    <div class="grid-2">${col("may", "May change")}${col("never", "Never change")}</div></div></details>`;
}

// ---------- AI ----------
function resumeForPrompt(base) {
  const sk = skillsSec(base), sum = summarySec(base);
  const out = { title: base.header.title, summary: sum?.text || "", skills: (sk?.groups || []).filter(g => !g.hidden).map(g => ({ id: g.id, label: g.label, items: g.items })), bullets: [] };
  for (const s of visible(base)) if (s.kind === "entries") for (const it of s.items) for (const b of it.bullets) out.bullets.push({ id: b.id, under: `${it.role} at ${it.org}`, text: b.text });
  return out;
}
async function analyze(useAi) {
  const c = cur(), base = baseOf(c);
  aiError = "";
  if (!useAi) {
    const jd = c.jd.toLowerCase();
    const resume = resumeText(base).toLowerCase();
    const keywords = TERMS.filter(t => hasTerm(jd, t)).map(t => ({ term: t, kind: "", has: hasTerm(resume, t) || hasTerm(S.settings.profile.summary.toLowerCase(), t) }));
    c.analysis = { keywords, match: null, flags: [], base: null, local: true };
    c.step = "match"; save("tailor"); bus.render(); return;
  }
  const ctl = new AbortController();
  busy = { kind: "analyze", ctl }; bus.render();
  try {
    const res = await askJson(`You help a product designer tailor their resume to one job posting. ${profileLine()}
Their resume versions: ${S.resume.versions.map(v => `${v.id} = "${v.name}"`).join("; ")}.
The resume they're starting from ("${base.name}"):
${resumeText(base).slice(0, 4000)}

Job: ${c.role} at ${c.company}.
Job description:
"""${c.jd.slice(0, JD_MAX)}"""

Pull out the keywords a screening system would match: tools, methods, skills and domain terms, each 1–4 words, written as the posting writes them. Mark each as required (in requirements or must-haves) or preferred (nice-to-have or bonus). Set has to true only if their resume or profile shows they have it. Include at most 24, most important first.
Then judge fit honestly for their level: score 0–100, fit strong, good or stretch, and 2–3 short reasons.
List gaps they should know about (for example years of experience or a domain they haven't worked in), at most 3, in plain words. Never mention visas, work authorization, age or personal traits.
Pick which of their versions is the best starting point (its id).
Reply with only JSON: {"keywords":[{"term":"","kind":"required","has":true}],"match":{"score":0,"fit":"good","why":[""]},"flags":[""],"base":"master"}`, { signal: ctl.signal });
    const kws = (Array.isArray(res?.keywords) ? res.keywords : []).filter(k => k && typeof k.term === "string" && k.term.trim()).slice(0, 24)
      .map(k => ({ term: k.term.trim().slice(0, 60), kind: k.kind === "preferred" ? "preferred" : "required", has: !!k.has }));
    if (!kws.length) throw new Error("No keywords came back. Check that the job description is complete, then try again.");
    const seen = new Set();
    const m = res.match || {};
    c.analysis = {
      keywords: kws.filter(k => { const l = k.term.toLowerCase(); if (seen.has(l)) return false; seen.add(l); return true; }),
      match: { score: Math.max(0, Math.min(100, Math.round(Number(m.score)))) || null, fit: ["strong", "good", "stretch"].includes(m.fit) ? m.fit : "good", why: (Array.isArray(m.why) ? m.why : []).map(String).slice(0, 3) },
      flags: (Array.isArray(res.flags) ? res.flags : []).map(String).filter(Boolean).slice(0, 3),
      base: S.resume.versions.some(v => v.id === res.base) ? res.base : null, local: false
    };
    c.step = "match"; save("tailor");
  } catch (e) { if (!ctl.signal.aborted) aiError = e.message; }
  if (busy?.ctl === ctl) busy = null;
  bus.render();
}
async function suggest() {
  const c = cur(), base = baseOf(c);
  const { draft } = buildDraft(c);
  const list = kwStatus(c, draft);
  const R = S.tailor.rules;
  aiError = "";
  const ctl = new AbortController();
  busy = { kind: "suggest", ctl }; bus.render();
  try {
    const res = await askJson(`Tailor a product designer's resume to one job. ${profileLine()}
Job: ${c.role} at ${c.company}.
Job description (shortened):
"""${c.jd.slice(0, 3500)}"""
Keywords they have but their resume doesn't say yet: ${list.filter(k => k.st === "add").map(k => k.term).join(", ") || "none"}.
Keywords they do NOT have (never add these): ${list.filter(k => k.st === "not").map(k => k.term).join(", ") || "none"}.
Their resume as JSON:
${JSON.stringify(resumeForPrompt(base))}

House rules. You may change: ${R.may.join("; ")}. Never change: ${R.never.join("; ")}.
So: keep every claim true and the same size. Never add or change a number, metric, job title, date, employer or tool they don't have. A bullet stays under the same job. Reword to use the posting's language where it's honest. Plain, specific words; no buzzwords.
Return the title line, the summary (under 60 words), every skill group (same ids, items reordered with the posting's terms first; you may add only keywords from the "has" list), and only the bullets worth changing (at most 6, same ids), each with a short reason.
Reply with only JSON: {"title":"","summary":"","skills":[{"id":"","items":""}],"bullets":[{"id":"","text":"","why":""}]}`, { signal: ctl.signal });
    const ids = new Set(resumeForPrompt(base).bullets.map(b => b.id));
    const gids = new Set((skillsSec(base)?.groups || []).map(g => g.id));
    c.suggest = {
      title: typeof res?.title === "string" ? res.title.trim().slice(0, 120) : "",
      summary: typeof res?.summary === "string" ? res.summary.trim().slice(0, 900) : "",
      skills: (Array.isArray(res?.skills) ? res.skills : []).filter(g => g && gids.has(g.id) && typeof g.items === "string").map(g => ({ id: g.id, items: g.items.trim().slice(0, 400) })),
      bullets: (Array.isArray(res?.bullets) ? res.bullets : []).filter(b => b && ids.has(b.id) && typeof b.text === "string" && b.text.trim()).slice(0, 6).map(b => ({ id: b.id, text: b.text.trim().slice(0, 400), why: String(b.why || "").slice(0, 200) }))
    };
    // Pending decisions on parts with a new suggestion start over; edits stay.
    for (const k of Object.keys(c.decisions || {})) if (c.decisions[k].s !== "edit") delete c.decisions[k];
    save("tailor");
  } catch (e) { if (!ctl.signal.aborted) aiError = e.message; }
  if (busy?.ctl === ctl) busy = null;
  bus.render();
}

// ---------- Actions ----------
function readJob(form) {
  const F = form.elements;
  const v = { company: F.company.value.trim(), role: F.role.value.trim(), link: F.link.value.trim(), baseId: F.baseId.value, jd: F.jd.value.trim().slice(0, JD_MAX) };
  let ok = true;
  for (const [k, bad] of [["company", !v.company], ["role", !v.role], ["jd", words(v.jd) < 25]]) {
    const e = form.querySelector(`[data-err="${k}"]`); if (e) e.hidden = !bad;
    if (bad && ok) { F[k].focus(); ok = false; }
  }
  return ok ? v : null;
}
function startFromForm(useAi) {
  const form = document.querySelector('[data-form="tl-job"]'); if (!form) return;
  const v = readJob(form); if (!v) return;
  const c = cur();
  const same = c && c.jd === v.jd && c.baseId === v.baseId;
  S.tailor.current = { ...(c && same ? c : { id: uid("t"), created: today(), decisions: {}, added: [], over: {}, suggest: null, analysis: null }), ...v, step: "job" };
  S.tailor.form = null;
  if (c && !same) { S.tailor.current.savedId = null; S.tailor.current.appId = null; }
  save("tailor");
  analyze(useAi);
}

export const tailorSubmit = {
  "tl-job": form => startFromForm(aiVisible()),
  "tl-rule": form => {
    const inp = form.querySelector("input"), t = inp.value.trim(); if (!t) return;
    S.tailor.rules[form.dataset.k].push(t); save("tailor"); bus.render();
    setTimeout(() => document.getElementById(`ra-${form.dataset.k}`)?.focus(), 0);
  }
};
// Typing in the job form is kept, so a re-render or a reload doesn't lose it.
export const tailorInputs = {
  "tl-job-f": el => {
    S.tailor.form = { ...(S.tailor.form || {}), [el.dataset.f]: el.value };
    save("tailor");
    if (el.dataset.f === "jd") { const p = el.form?.querySelector("[data-count]"); if (p) p.textContent = `${el.value.length.toLocaleString()} of ${JD_MAX.toLocaleString()} characters`; }
  }
};
export const tailorChanges = {
  "tl-kwf": el => { kwFilter = el.value; bus.render(); },
  "tl-group": el => { cur().addGroup = el.value; save("tailor"); bus.render(); }
};

export const tailorActions = {
  "tl-step": d => { const c = cur(); if (!c) return; aiError = ""; c.step = d.step; save("tailor"); bus.render(); window.scrollTo(0, 0); if (d.step === "review") setTimeout(() => fitPreviews(), 30); },
  "tl-local": () => startFromForm(false),
  "tl-cancel": () => { busy?.ctl.abort(); busy = null; bus.render(); },
  "tl-suggest": () => suggest(),
  "tl-new": () => {
    const c = cur();
    const go = () => { S.tailor.current = null; S.tailor.form = null; aiError = ""; kwFilter = "all"; save("tailor"); bus.render(); setTimeout(() => document.getElementById("tj-co")?.focus(), 0); };
    if (c && !c.savedId && c.analysis) confirmSheet({ title: "Start a new tailoring?", message: `“${c.company} · ${c.role}” isn't saved to history. Starting over clears it.`, confirm: "Start over", danger: true, onConfirm: go });
    else go();
  },
  "tl-base": d => { const c = cur(); c.baseId = d.id; c.decisions = {}; c.suggest = null; save("tailor"); bus.render(); toast(`Now starting from “${versionById(d.id).name}”`); },
  "tl-add-kw": d => { const c = cur(); if (!c.added.includes(d.term)) c.added.push(d.term); save("tailor"); bus.render(); },
  "tl-rm-kw": d => { const c = cur(); c.added = c.added.filter(t => t !== d.term); save("tailor"); bus.render(); },
  "tl-mine": d => {
    const c = cur(), k = d.term.toLowerCase(), kw = c.analysis.keywords.find(x => x.term.toLowerCase() === k);
    const now = k in c.over ? c.over[k] : !!kw?.has;
    c.over[k] = !now;
    if (now) c.added = c.added.filter(t => t.toLowerCase() !== k);
    save("tailor"); bus.render();
  },
  "tl-dec": d => { const c = cur(); c.decisions[d.key] = { s: d.s }; save("tailor"); bus.render(); },
  "tl-accept-all": () => {
    const c = cur(), base = baseOf(c); let n = 0;
    for (const k of Object.keys(allSugKeys(c))) if (!c.decisions[k] && !newNums(origText(base, k), sugText(c, k)).length) { c.decisions[k] = { s: "accept" }; n++; }
    save("tailor"); bus.render(); toast(`Accepted ${n} suggestion${n === 1 ? "" : "s"}`);
  },
  "tl-edit": d => {
    const c = cur(), base = baseOf(c), dec = c.decisions[d.key];
    const start = dec?.s === "edit" ? dec.text : dec?.s === "accept" ? sugText(c, d.key) : sugText(c, d.key) ?? origText(base, d.key);
    sheet({
      title: `Edit: ${d.label}`, sub: "Keep the claim true. Don't change numbers, titles or dates.", wide: true,
      body: `<form class="form" novalidate><div class="field"><label for="te-t">Text</label><textarea id="te-t" rows="${d.key === "title" ? 2 : 5}" maxlength="900">${esc(start)}</textarea></div>
        <div class="field"><span class="lbl">Original</span><p class="quote small">${esc(origText(base, d.key)) || "(empty)"}</p></div></form>`,
      foot: `<button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" data-save>Use this</button>`,
      onMount: (el, api) => $("[data-save]", el).addEventListener("click", () => {
        const t = $("#te-t", el).value.trim();
        c.decisions[d.key] = t === origText(base, d.key) ? { s: "keep" } : { s: "edit", text: t };
        save("tailor"); api.close(); bus.render();
      })
    });
  },
  "tl-dl": d => { const { draft, base } = buildDraft(cur()); downloadResume(draft, d.fmt, S.resume.design, { nameFrom: base }); },
  "tl-save": () => {
    const c = cur(), { draft, diff } = buildDraft(c), cov = coverage(kwStatus(c, draft));
    const rec = { ...clone(c), id: c.savedId || uid("th"), savedAt: today(), coverage: cov.pct, changes: diff.size };
    delete rec.step;
    const H = S.tailor.history;
    const i = H.findIndex(h => h.id === rec.id); if (i >= 0) H.splice(i, 1);
    H.unshift(rec);
    let dropped = null; if (H.length > HISTORY_MAX) dropped = H.pop();
    c.savedId = rec.id; save("tailor"); bus.render();
    toast(dropped ? `Saved. The oldest one (${dropped.company}) was removed to stay under ${HISTORY_MAX}.` : "Saved to history");
  },
  "tl-version": () => {
    const c = cur(), { draft } = buildDraft(c);
    draft.id = uid("v"); draft.name = `${c.company} – ${c.role}`.slice(0, 60); draft.updated = today();
    S.resume.versions.push(draft); save("resume");
    toast(`Saved as the resume version “${draft.name}”`, { action: "Open", onAction: () => { S.resume.current = draft.id; save("resume"); location.hash = "#resume"; } });
  },
  "tl-app": () => {
    const c = cur();
    sheet({
      title: "Add to Applications", sub: `${c.company} · ${c.role}`,
      body: `<div class="form"><div class="field"><span class="lbl">Where is it?</span><div class="seg-ctl" role="radiogroup" aria-label="Status">
        <label><input type="radio" name="as" value="Applied" checked><span>I applied today</span></label><label><input type="radio" name="as" value="Saved"><span>Saved, not applied yet</span></label></div></div></div>`,
      foot: `<button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" data-ok>Add</button>`,
      onMount: (el, api) => $("[data-ok]", el).addEventListener("click", () => {
        const status = el.querySelector("input[name=as]:checked").value;
        // Keep the tailored resume with the application: save it to history first.
        if (!c.savedId || !S.tailor.history.some(h => h.id === c.savedId)) tailorActions["tl-save"]();
        const co = c.company ? ensureCompany(c.company) : null;
        const a = normApp({ id: uid("a"), company: c.company, companyId: co?.id || "", tier: co?.tier || "", role: c.role, link: c.link, description: c.jd.slice(0, 2000), status, source: "", appliedAt: status === "Applied" ? today() : "", created: today(), tailoredId: c.savedId || "", notes: "", log: [{ s: status, d: today() }] });
        S.apps.list.unshift(a); save("apps");
        c.appId = a.id; save("tailor"); api.close(); bus.render();
        toast(status === "Applied" ? "Added. It counts toward this week's applications." : "Saved in Applications");
      })
    });
  },
  "tl-open": d => {
    const h = S.tailor.history.find(x => x.id === d.id); if (!h) return;
    const go = () => { S.tailor.current = { ...clone(h), savedId: h.id, step: "review" }; S.tailor.form = null; save("tailor"); bus.render(); window.scrollTo(0, 0); setTimeout(() => fitPreviews(), 30); };
    const c = cur();
    if (c && !c.savedId && c.analysis) confirmSheet({ title: "Open this one?", message: `“${c.company} · ${c.role}” isn't saved yet. Opening another clears it.`, confirm: "Open", onConfirm: go });
    else go();
  },
  "tl-del": d => {
    const H = S.tailor.history, i = H.findIndex(x => x.id === d.id); if (i < 0) return;
    const [h] = H.splice(i, 1); save("tailor"); bus.render();
    toast(`Deleted ${h.company}`, { action: "Undo", onAction: () => { H.splice(i, 0, h); save("tailor"); bus.render(); } });
  },
  "tl-rule-del": d => {
    const L = S.tailor.rules[d.k], i = +d.i, [r] = L.splice(i, 1); save("tailor"); bus.render();
    toast("Rule removed", { action: "Undo", onAction: () => { L.splice(i, 0, r); save("tailor"); bus.render(); } });
  }
};
