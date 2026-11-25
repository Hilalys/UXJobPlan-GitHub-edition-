// Interview prep: company loops, portfolio presentation, design challenge, story bank,
// other interview rounds and the mock interview log. Practice sessions run in practice.js.

import { S, save, saveNow } from "../store.js";
import { L } from "../content.js";
import { TIERS, MIDSIZE_LOOP, PRES_LONG, PRES_SHORT, PROMPTS, PROMPT_FILTERS, PHASES, RUBRICS, STORY_FORMATS, STORY_STATUS, THEMES, QUESTIONS, LPS, COMPETENCIES, ROUND_NAMES, WORDS_PER_MIN, STORY_MAX_WORDS, ROUND_TYPES, CRITIQUE_STEPS, CRITIQUE_APPS, ANSWERS, QUESTIONS_TO_ASK, MOCK_TYPES, MOCK_BY_WEEK, SCORE_WORDS } from "../content4.js";
import { esc, uid, today, fmtDate, safeUrl, host, sum, clone, $, $$ } from "../util.js";
import { icon, sheet, toast, confirmSheet, meter, lineChart, hbars } from "../ui.js";
import { aiVisible, askJson, profileLine } from "../ai.js";
import * as M from "../model.js";
import * as A from "../model4.js";
import { openPractice, historyHTML, sessionsOf, avgScore, liveBanner, live, KINDS } from "../practice.js";
import { bus } from "../bus.js";
import { inPlace, cityName, hasCity, getLoc } from "../locale.js";
import { mapWeek } from "../personalize.js";

export const IV_TABS = [["loops", "Company loops"], ["presentation", "Presentation"], ["challenge", "Design challenge"], ["stories", "Story bank"], ["rounds", "Other rounds"], ["mocks", "Mock interviews"]];
let tab = "loops";
export const setTab = t => { tab = IV_TABS.some(x => x[0] === t) ? t : "loops"; };
const UI = { coQ: "", coTier: "", coAll: false, presMode: "long", pf: "all", critApp: CRITIQUE_APPS[0] };
let busy = null;   // { kind, id, ctl }
const aiErr = {};

const words = t => ((t || "").trim().match(/\S+/g) || []).length;
const extLink = (u, l) => { const s = safeUrl(u); return s ? `<a href="${esc(s)}" target="_blank" rel="noopener">${esc(l || host(s))}${icon("ext", "sm")}</a>` : ""; };

// ================= Company loops =================
export function loopHTML(c) {
  const lp = c.loop;
  if (!lp || !lp.steps?.length) return `<p class="small muted">No loop researched yet. Typical at mid-size companies and startups: ${esc(MIDSIZE_LOOP)}</p>`;
  return `<div class="loop">
    ${lp.ai ? `<p class="banner warn small" role="note">${icon("sparkle")}<span>AI draft, check before relying on it. Ask the recruiter for the exact format.</span></p>` : ""}
    <div class="scroll-x"><table class="loop-t"><thead><tr><th scope="col">Round</th><th scope="col">What it tests</th><th scope="col">Prep focus</th></tr></thead>
      <tbody>${lp.steps.map((s, i) => `<tr><th scope="row"><span class="loop-n">${i + 1}</span>${esc(s.name)}</th><td>${esc(s.tests)}</td><td>${esc(s.prep)}</td></tr>`).join("")}</tbody></table></div>
    ${lp.distinctive ? `<p class="small"><b>What's distinctive:</b> ${esc(lp.distinctive)}</p>` : ""}
    <p class="small muted">${lp.sources?.length ? `Sources: ${lp.sources.map(s => extLink(s.u, s.l)).filter(Boolean).join(" · ")}${lp.ai ? " (suggested by AI, not checked)" : ""}. ` : ""}Checked ${fmtDate(lp.checked || today(), { year: true })}.</p>
  </div>`;
}
function companyRow(c) {
  const apps = A.appsFor(c), t = TIERS[c.tier];
  const busyHere = busy?.kind === "loop" && busy.id === c.id;
  return `<details class="co-row" data-co="${c.id}" ${busyHere ? "open" : ""}><summary>
      <span class="co-name"><b>${esc(c.name)}</b>${t ? `<span class="tag">${t.short}</span>` : ""}${c.loop?.ai ? `<span class="tag warn">AI draft</span>` : ""}${!c.loop ? `<span class="tag">No loop yet</span>` : ""}</span>
      <span class="small muted">${c.loop ? `${c.loop.steps.length} rounds · checked ${fmtDate(c.loop.checked)}` : ""}${apps.length ? ` · ${apps.length} application${apps.length > 1 ? "s" : ""}` : ""}</span></summary>
    <div class="co-body">
      ${c.fit ? `<p class="small"><b>Fit now:</b> ${esc(c.fit)}</p>` : ""}
      ${loopHTML(c)}
      ${apps.length ? `<p class="small">Your applications: ${apps.map(a => `${esc(a.role || "Role")} (${esc(a.status)})`).join(", ")} · <a href="#applications">Applications</a></p>` : ""}
      <div class="actions">
        ${c.careers ? extLink(c.careers, "Careers") : ""}
        ${aiVisible() ? `<button class="btn btn-sm" type="button" data-act="iv-co-ai" data-id="${c.id}" ${busy ? "disabled" : ""}>${icon("sparkle", "sm")}${c.loop ? "Redraft loop with AI" : "Draft loop with AI"}</button>` : ""}
        <button class="btn btn-sm" type="button" data-act="iv-co-edit" data-id="${c.id}">${icon("edit", "sm")}Edit</button>
        <button class="btn btn-sm btn-ghost" type="button" data-act="iv-co-del" data-id="${c.id}">${icon("trash", "sm")}${c.builtIn ? "Remove" : "Delete"}</button></div>
      ${busyHere ? `<div class="ai-wait" role="status"><div class="spinner" aria-hidden="true"></div><p>Drafting the ${esc(c.name)} loop from what's publicly known…</p><button class="btn btn-sm" type="button" data-act="iv-cancel">Cancel</button></div>` : ""}
      ${aiErr["loop-" + c.id] ? `<p class="error" role="alert">${esc(aiErr["loop-" + c.id])}</p>` : ""}
    </div></details>`;
}
function loopsTab() {
  const q = UI.coQ.trim().toLowerCase();
  const all = S.companies.list.filter(c => (!UI.coTier || c.tier === UI.coTier) && (!q || c.name.toLowerCase().includes(q)));
  const looped = A.loopCompanies().filter(c => all.includes(c));
  const rest = all.filter(c => !looped.includes(c)).sort((a, b) => a.name.localeCompare(b.name));
  const showAll = UI.coAll || q || UI.coTier;
  const list = showAll ? [...looped, ...rest] : looped.slice(0, 5);
  return `<section class="card" aria-labelledby="iv-lp"><div class="card-h"><h2 id="iv-lp">${icon("compass")}Company loops</h2>
      <button class="btn btn-sm btn-primary" type="button" data-act="iv-co-add">${icon("plus", "sm")}Add company</button></div><div class="card-b">
    <p class="muted">Every big-tech loop centers on a portfolio presentation. Most add a design exercise and behavioral rounds; Meta and Google also use app critiques and hiring committees. Processes vary by team, so always ask the recruiter for the exact format.</p>
    <div class="filters" role="group" aria-label="Find a company"><label class="sr-only" for="iv-coq">Search companies</label><input id="iv-coq" type="search" placeholder="Search companies" value="${esc(UI.coQ)}" data-change="iv-coq">
      <label class="sr-only" for="iv-cot">Tier</label><select id="iv-cot" data-change="iv-ui" data-k="coTier"><option value="">All tiers</option>${Object.entries(TIERS).map(([k, t]) => `<option value="${k}" ${UI.coTier === k ? "selected" : ""}>${t.short} · ${t.name}</option>`).join("")}</select></div>
    ${list.length ? `<div class="co-list">${list.map(companyRow).join("")}</div>` : `<p class="muted">No companies match.</p>`}
    ${!showAll && S.companies.list.length > list.length ? `<button class="btn" type="button" data-act="iv-co-all" style="margin-top:10px">See all (${S.companies.list.length})</button>` : ""}
    ${UI.coAll && !q && !UI.coTier ? `<button class="link-btn" type="button" data-act="iv-co-all" style="margin-top:10px">Show the 5 detailed loops only</button>` : ""}
    <p class="small muted" style="margin-top:10px">These are the same companies as your target list in Strategy & networking and the companies in Applications.</p>
  </div></section>
  <section class="card" aria-labelledby="iv-rw"><div class="card-h"><h2 id="iv-rw">${icon("target")}What every loop rewards</h2></div><div class="card-b">
    <ul class="plain"><li>A tight 30–45 minute story for two projects, with goals, decisions, results and lessons.</li><li>Clarifying questions before solving, in exercises and critiques.</li><li>Business awareness: why a design choice helps the company, not only the user.</li><li>Stories that show collaboration, disagreement handled well and ownership.</li></ul></div></section>`;
}

export function openCompany(id) {
  const c = id ? A.companyById(id) : null;
  const d = c || { name: "", tier: "2", careers: "", target: true, loop: null, notes: "" };
  const stepsTxt = (d.loop?.steps || []).map(s => [s.name, s.tests, s.prep].join(" | ")).join("\n");
  const srcTxt = (d.loop?.sources || []).map(s => `${s.l} | ${s.u}`).join("\n");
  sheet({
    title: c ? `Edit ${c.name}` : "Add a company", wide: true,
    body: `<form class="form" novalidate>
      <div class="row3"><div class="field"><label for="co-n">Company</label><input id="co-n" name="name" type="text" value="${esc(d.name)}" maxlength="100"><p class="error" data-err hidden>Add a name.</p></div>
        <div class="field"><label for="co-t">Tier</label><select id="co-t" name="tier">${Object.entries(TIERS).map(([k, t]) => `<option value="${k}" ${k === d.tier ? "selected" : ""}>${t.short} · ${t.name}</option>`).join("")}</select></div>
        <div class="field"><label for="co-c">Careers link</label><input id="co-c" name="careers" type="url" value="${esc(d.careers)}" placeholder="https://"></div></div>
      <label class="check-inline"><input type="checkbox" name="target" ${d.target ? "checked" : ""}> On my target list</label>
      <div class="field"><label for="co-s">Loop rounds <span class="muted">(one per line: Round | What it tests | Prep focus)</span></label><textarea id="co-s" name="steps" rows="6" maxlength="4000" placeholder="Recruiter screen | Background and why us | 60-second intro">${esc(stepsTxt)}</textarea></div>
      <div class="field"><label for="co-d">What's distinctive</label><input id="co-d" name="distinctive" type="text" value="${esc(d.loop?.distinctive || "")}" maxlength="400"></div>
      <div class="field"><label for="co-src">Sources <span class="muted">(one per line: Label | URL)</span></label><textarea id="co-src" name="sources" rows="3" maxlength="2000">${esc(srcTxt)}</textarea></div>
      ${!c && aiVisible() ? `<label class="check-inline"><input type="checkbox" name="ai" checked> Draft the loop with AI if I leave the rounds empty</label>` : ""}
      <div class="field"><label for="co-no">Notes</label><textarea id="co-no" name="notes" rows="2" maxlength="1500">${esc(d.notes || "")}</textarea></div>
      <button type="submit" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">Save</button></form>`,
    foot: `<button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" data-save>${c ? "Save" : "Add company"}</button>`,
    onMount: (el, api) => {
      const form = $("form", el), E = form.elements;
      const doSave = () => {
        const name = E.name.value.trim(); if (!name) { $("[data-err]", el).hidden = false; E.name.focus(); return; }
        if (!c && A.companyByName(name)) { toast(`${name} is already in your list`); return; }
        const steps = E.steps.value.split("\n").map(l => l.split("|").map(x => x.trim())).filter(p => p[0]).map(([n, t = "", p = ""]) => ({ name: n, tests: t, prep: p }));
        const sources = E.sources.value.split("\n").map(l => l.split("|").map(x => x.trim())).filter(p => p[0]).map(([l, u = ""]) => ({ l, u: safeUrl(u) || "" }));
        const stepsChanged = !c || JSON.stringify(steps) !== JSON.stringify((c.loop?.steps || []).map(s => ({ name: s.name, tests: s.tests, prep: s.prep })));
        const loop = steps.length ? { steps, distinctive: E.distinctive.value.trim(), sources, checked: stepsChanged ? today() : (c.loop?.checked || today()), ai: stepsChanged ? false : !!c?.loop?.ai } : null;
        const vals = { name, tier: E.tier.value, careers: safeUrl(E.careers.value.trim()) || "", target: E.target.checked, notes: E.notes.value.trim(), loop };
        let rec = c;
        if (c) Object.assign(c, vals); else { rec = { id: uid("co"), builtIn: false, fit: "", contact: "", next: "", nextDate: "", ...vals }; S.companies.list.push(rec); }
        saveNow("companies"); api.close(); UI.coAll = true; bus.render();
        toast(c ? "Company saved" : `${name} added`);
        if (!c && !loop && E.ai?.checked) draftLoop(rec);
      };
      form.addEventListener("submit", e => { e.preventDefault(); doSave(); });
      $("[data-save]", el).addEventListener("click", doSave);
    }
  });
}
async function draftLoop(c) {
  busy = { kind: "loop", id: c.id, ctl: new AbortController() }; aiErr["loop-" + c.id] = ""; bus.render();
  const ctl = busy.ctl;
  try {
    const res = await askJson(`Describe the typical interview loop for a Product Designer or UX Designer at ${c.name}, for roles${hasCity() ? ` in the ${cityName()} area` : ""}, as publicly reported by candidates and interview guides up to your knowledge. If you don't know this company's process, describe what's typical for a company of its kind and say so in "distinctive".
Give 3 to 7 rounds in order. For each: the round's name, what it tests, and what to focus on when preparing. Keep each field under 140 characters. Plain English.
Sources: up to 3 public pages someone could check (interview guides, the company's careers site). Only include URLs you're confident exist; otherwise leave sources empty.
Reply with only JSON: {"steps":[{"name":"","tests":"","prep":""}],"distinctive":"one or two sentences","sources":[{"l":"label","u":"https://..."}]}`, { signal: ctl.signal });
    const steps = (Array.isArray(res?.steps) ? res.steps : []).filter(s => s && s.name).slice(0, 8).map(s => ({ name: String(s.name).slice(0, 120), tests: String(s.tests || "").slice(0, 200), prep: String(s.prep || "").slice(0, 200) }));
    if (!steps.length) throw new Error("No rounds came back. Try again, or add them yourself with Edit.");
    const sources = (Array.isArray(res?.sources) ? res.sources : []).map(s => ({ l: String(s?.l || "").slice(0, 100), u: safeUrl(String(s?.u || "")) || "" })).filter(s => s.l && s.u).slice(0, 3);
    c.loop = { steps, distinctive: String(res?.distinctive || "").slice(0, 400), sources, checked: today(), ai: true };
    saveNow("companies");
  } catch (e) { if (!ctl.signal.aborted) aiErr["loop-" + c.id] = e.message; }
  if (busy?.ctl === ctl) busy = null;
  bus.render();
  setTimeout(() => { const d = document.querySelector(`[data-co="${CSS.escape(c.id)}"]`); if (d) { d.open = true; d.scrollIntoView({ block: "nearest" }); } }, 30);
}

// ================= Portfolio presentation =================
const presList = () => (UI.presMode === "long" ? S.interview.pres.long : S.interview.pres.short);
function presentationTab() {
  const list = presList(), total = sum(list, s => s.min), goal = UI.presMode === "long" ? 45 : 15;
  const cases = S.portfolio.cases.filter(c => !c.archived).slice(0, 2).map(c => c.title);
  const hist = sessionsOf("presentation");
  const pts = hist.filter(s => avgScore(s) != null).slice(0, 12).reverse().map(s => ({ label: fmtDate(s.date), short: fmtDate(s.date).replace(/^\w+ /, ""), y: avgScore(s) }));
  return `<section class="card" aria-labelledby="iv-pr"><div class="card-h"><h2 id="iv-pr">${icon("mic")}Portfolio presentation</h2>
      <div class="seg-ctl" role="radiogroup" aria-label="Version">${[["long", "45 minutes"], ["short", "15 minutes"]].map(([k, l]) => `<label><input type="radio" name="pres-mode" value="${k}" data-change="iv-ui" data-k="presMode" ${UI.presMode === k ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></div>
    <div class="card-b">
      <p class="muted">${UI.presMode === "long" ? "Two case studies in 45 minutes, the core of most loops." : "One case study in 15 minutes, for recruiter-led or short portfolio reviews."}${cases.length ? ` Your case studies: ${cases.map(esc).join(" and ")}.` : ""} Edit the sections to fit your deck.</p>
      <div class="pres-total"><span><b>${total}</b> of ${goal} minutes planned</span>${meter(total, Math.max(goal, total), { color: total > goal ? "var(--c-practice)" : "var(--c-apply)", marker: goal, label: `${total} of ${goal} minutes planned` })}${total > goal ? `<span class="tag warn">${total - goal} min over</span>` : ""}</div>
      <ol class="pres-list">${list.map((s, i) => `<li>
        <span class="pres-n">${i + 1}</span>
        <div class="pres-f"><label class="sr-only" for="ps-n-${s.id}">Section name</label><input id="ps-n-${s.id}" type="text" value="${esc(s.name)}" maxlength="80" data-change="iv-pres" data-id="${s.id}" data-f="name">
          <label class="sr-only" for="ps-o-${s.id}">Notes for ${esc(s.name)}</label><input id="ps-o-${s.id}" type="text" value="${esc(s.notes)}" maxlength="200" placeholder="What to cover" data-change="iv-pres" data-id="${s.id}" data-f="notes"></div>
        <div class="pres-m"><label class="sr-only" for="ps-m-${s.id}">Minutes for ${esc(s.name)}</label><input id="ps-m-${s.id}" type="number" min="0" max="60" step="1" inputmode="numeric" value="${s.min}" data-change="iv-pres" data-id="${s.id}" data-f="min"><span class="small muted">min</span></div>
        <span class="actions"><button class="icon-btn sm" type="button" data-act="iv-pres-mv" data-id="${s.id}" data-d="-1" ${i ? "" : "disabled"} aria-label="Move ${esc(s.name)} up">${icon("arrowUp", "sm")}</button><button class="icon-btn sm" type="button" data-act="iv-pres-mv" data-id="${s.id}" data-d="1" ${i < list.length - 1 ? "" : "disabled"} aria-label="Move ${esc(s.name)} down">${icon("arrowDown", "sm")}</button><button class="icon-btn sm danger" type="button" data-act="iv-pres-del" data-id="${s.id}" aria-label="Remove ${esc(s.name)}">${icon("x", "sm")}</button></span></li>`).join("")}</ol>
      <div class="actions"><button class="btn btn-sm" type="button" data-act="iv-pres-add">${icon("plus", "sm")}Add section</button><button class="btn btn-sm btn-ghost" type="button" data-act="iv-pres-reset">${icon("restore", "sm")}Reset to default</button>
        <span class="spacer"></span><button class="btn btn-primary" type="button" data-act="iv-pres-go">${icon("play", "sm")}Practice the ${goal}-minute version</button></div>
    </div></section>
  <div class="grid-2">
    <section class="card" aria-labelledby="iv-prh"><div class="card-h"><h2 id="iv-prh">${icon("clock")}Practice sessions</h2><span class="sub">${hist.length}</span></div><div class="card-b">
      ${pts.length > 1 ? `<h3 class="h-sm">Average score over time</h3>${lineChart(pts, { min: 1, max: 4, yTicks: [1, 2, 3, 4], color: "var(--c-practice)", label: "Average presentation score by session" })}` : ""}
      ${historyHTML(hist, { empty: "No sessions yet. Practice with the timer: it records each section's time, and the AI scores your transcript.", showTitle: true })}</div></section>
    ${rubricCard("presentation", "What the AI scores")}
  </div>`;
}
function rubricCard(k, title) {
  const r = RUBRICS[k];
  return `<section class="card" aria-labelledby="rb-${k}"><div class="card-h"><h2 id="rb-${k}">${icon("check")}${esc(title)}</h2><span class="sub">Each scored 1–4</span></div><div class="card-b">
    <ul class="plain">${r.rows.map(([, l]) => `<li>${esc(l)}</li>`).join("")}</ul>
    <p class="small muted">${Object.entries(SCORE_WORDS).map(([n, w]) => `${n} ${w.toLowerCase()}`).join(" · ")}. Built from interview guides by Amazon and Microsoft designers.</p></div></section>`;
}

// ================= Design challenge =================
const allPrompts = () => [...PROMPTS, ...S.interview.prompts.map(p => ({ ...p, builtIn: false }))];
function challengeTab() {
  const ps = allPrompts().filter(p => UI.pf === "all" || (UI.pf === "mine" ? !p.builtIn : p.tags.includes(UI.pf)));
  const hist = sessionsOf("challenge");
  const done = {};
  for (const s of hist) { const a = avgScore(s); done[s.ref] = { n: (done[s.ref]?.n || 0) + 1, best: Math.max(done[s.ref]?.best || 0, a || 0) }; }
  return `<section class="card" aria-labelledby="iv-ch"><div class="card-h"><h2 id="iv-ch">${icon("edit")}Design challenge</h2>
      <button class="btn btn-primary" type="button" data-act="iv-ch-random">${icon("play", "sm")}Random prompt</button></div><div class="card-b">
    <p class="muted">45 minutes each, timer on. Spend the first 5–8 minutes on clarifying questions only, and end with success metrics. Rotate categories so you practice mobile, web, enterprise and AI.</p>
    <ol class="phase-strip" aria-label="Phases">${PHASES.map(p => `<li style="flex:${p.to - p.from}" data-tip="${esc(`${p.from}–${p.to} min`)}|${esc(p.tip)}"><b>${esc(p.name)}</b><span>${p.from}–${p.to}</span></li>`).join("")}</ol>
    <div class="filters" role="group" aria-label="Filter prompts"><div class="seg-ctl" role="radiogroup" aria-label="Category">${PROMPT_FILTERS.map(([k, l]) => `<label><input type="radio" name="pf" value="${k}" data-change="iv-ui" data-k="pf" ${UI.pf === k ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></div>
    ${ps.length ? `<ul class="prompt-list">${ps.map(p => `<li><div><p>${esc(p.text)}</p><span class="small muted">${esc(p.label || "My prompt")}${p.note ? ` · ${esc(p.note)}` : ""}${done[p.id] ? ` · practiced ${done[p.id].n}×${done[p.id].best ? `, best ${done[p.id].best.toFixed(1)} / 4` : ""}` : ""}</span></div>
      <span class="actions"><button class="btn btn-sm" type="button" data-act="iv-ch-go" data-id="${p.id}">${icon("play", "sm")}Practice</button>${p.builtIn ? "" : `<button class="icon-btn sm danger" type="button" data-act="iv-ch-del" data-id="${p.id}" aria-label="Delete prompt">${icon("trash", "sm")}</button>`}</span></li>`).join("")}</ul>`
      : `<p class="muted">${UI.pf === "mine" ? "You haven't added any prompts yet." : "No prompts in this category."}</p>`}
    <form class="rule-add" data-form="iv-prompt" style="margin-top:12px"><label class="sr-only" for="iv-pin">Add your own prompt</label><input id="iv-pin" type="text" maxlength="240" placeholder="Add your own prompt, e.g. one a candidate reported">
      <label class="sr-only" for="iv-ptag">Category</label><select id="iv-ptag" style="width:auto">${PROMPT_FILTERS.filter(f => !["all", "mine"].includes(f[0])).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select><button class="btn btn-sm" type="submit">${icon("plus", "sm")}Add</button></form>
  </div></section>
  <div class="grid-2">
    <section class="card" aria-labelledby="iv-chh"><div class="card-h"><h2 id="iv-chh">${icon("clock")}Practice sessions</h2><span class="sub">${hist.length}</span></div><div class="card-b">
      ${historyHTML(hist, { empty: "No challenges yet. Pick a prompt: the timer marks each phase, and you can add photos of your sketches for the AI to look at." })}</div></section>
    ${rubricCard("challenge", "What the AI scores")}
  </div>`;
}

// ================= Story bank =================
const allQuestions = () => [...QUESTIONS, ...S.stories.questions.map(q => ({ ...q, custom: true }))];
const storyFor = qid => S.stories.list.find(s => s.qid === qid);
const storyText = st => STORY_FORMATS[st.format].fields.map(([k]) => st.fields?.[k] || "").join(" ");
const lastScore = st => (st.scores?.length ? st.scores[st.scores.length - 1].avg : null);
function coverage() {
  const counted = S.stories.list.filter(s => s.status !== "idea" && words(storyText(s)) > 20);
  const c = tag => counted.filter(s => (s.tags || []).includes(tag)).length;
  return { lps: LPS.map(t => ({ t, n: c(t) })), comps: COMPETENCIES.map(t => ({ t, n: c(t) })) };
}
function storiesTab() {
  const qs = allQuestions(), cov = coverage();
  const byStatus = Object.keys(STORY_STATUS).map(k => ({ k, n: S.stories.list.filter(s => s.status === k).length }));
  const lpHave = cov.lps.filter(x => x.n).length;
  return `<div class="tiles">${byStatus.map(x => `<div class="tile"><span>${STORY_STATUS[x.k]}</span><b>${x.n}</b></div>`).join("")}<div class="tile"><span>Questions</span><b>${qs.length}</b></div></div>
  <section class="card" aria-labelledby="iv-cov"><div class="card-h"><h2 id="iv-cov">${icon("target")}Coverage</h2><span class="sub">${lpHave} of ${LPS.length} Leadership Principles have a drafted story</span></div><div class="card-b">
    <p class="small muted">${esc(ROUND_NAMES)} A story counts once it's drafted and tagged. Aim for 2–3 per key principle.</p>
    <h3 class="h-sm" style="margin-top:12px">Amazon Leadership Principles</h3><div class="cov">${cov.lps.map(x => `<span class="cov-i ${x.n ? (x.n >= 2 ? "good" : "ok") : "gap"}">${esc(x.t)}<b>${x.n}</b></span>`).join("")}</div>
    <h3 class="h-sm" style="margin-top:12px">Other competencies</h3><div class="cov">${cov.comps.map(x => `<span class="cov-i ${x.n ? (x.n >= 2 ? "good" : "ok") : "gap"}">${esc(x.t)}<b>${x.n}</b></span>`).join("")}</div>
  </div></section>
  <details class="card fold"><summary class="card-h"><h2>${icon("book")}Answer formats</h2><span class="sub">STAR is the safe default</span></summary><div class="card-b">
    <p class="small muted">No company requires a format. Interviewers listen for the situation, what you personally did, and what happened as a result.</p>
    <div class="scroll-x"><table class="loop-t"><thead><tr><th scope="col">Format</th><th scope="col">Parts</th><th scope="col">Best for</th></tr></thead><tbody>${Object.values(STORY_FORMATS).map(f => `<tr><th scope="row">${f.name}</th><td>${f.fields.map(x => x[1]).join(", ")}</td><td>${esc(f.best)}</td></tr>`).join("")}</tbody></table></div></div></details>
  ${THEMES.map(([k, name]) => {
    const tq = qs.filter(q => q.theme === k);
    return `<section class="card" aria-labelledby="th-${k}"><div class="card-h"><h2 id="th-${k}">${esc(name)}</h2><span class="sub">${tq.filter(q => { const s = storyFor(q.id); return s && s.status !== "idea"; }).length} of ${tq.length} drafted</span></div><div class="card-b">
      <ul class="q-list">${tq.map(q => {
        const st = storyFor(q.id), sc = st && lastScore(st);
        return `<li><div class="q-main"><p>${esc(q.q)}</p><span class="small muted">${st ? `<span class="tag ${st.status === "rehearsed" ? "good" : st.status === "ready" ? "info" : ""}">${STORY_STATUS[st.status]}</span> ${st.format} · ${words(storyText(st))} words${sc != null ? ` · score ${sc.toFixed(1)} / 4` : ""}${st.practiced ? ` · practiced ${st.practiced}×` : ""}` : "Not started"}${q.custom ? " · your question" : ""}</span></div>
          <span class="actions"><button class="btn btn-sm" type="button" data-act="iv-st-open" data-q="${q.id}">${st ? "Open" : `${icon("edit", "sm")}Write`}</button>${st && words(storyText(st)) > 10 ? `<button class="btn btn-sm" type="button" data-act="iv-st-practice" data-id="${st.id}">${icon("mic", "sm")}Practice</button>` : ""}</span></li>`;
      }).join("")}</ul></div></section>`;
  }).join("")}
  <section class="card" aria-labelledby="iv-qadd"><div class="card-h"><h2 id="iv-qadd">${icon("plus")}Add your own question</h2></div><div class="card-b">
    <form class="rule-add" data-form="iv-q"><label class="sr-only" for="iv-qin">Question</label><input id="iv-qin" type="text" maxlength="240" placeholder="e.g. Tell me about a time you designed for a new market">
      <label class="sr-only" for="iv-qth">Theme</label><select id="iv-qth" style="width:auto">${THEMES.map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join("")}</select><button class="btn btn-sm" type="submit">${icon("plus", "sm")}Add</button></form></div></section>`;
}

function newStory(q) {
  return { id: uid("st"), qid: q.id, format: q.theme === "failure" ? "STARL" : "STAR", fields: {}, tags: [...(q.tags || [])], status: "idea", scores: [], last: null, created: today(), updated: today(), practiced: 0 };
}
function openStory(qid) {
  const q = allQuestions().find(x => x.id === qid); if (!q) return;
  let st = storyFor(qid);
  const isNew = !st;
  if (!st) { st = newStory(q); S.stories.list.push(st); }
  let ctl = null;
  const fieldsHTML = () => STORY_FORMATS[st.format].fields.map(([k, l]) => `<div class="field"><label for="sf-${k}">${l}</label><textarea id="sf-${k}" data-sf="${k}" rows="${k === "a" ? 5 : 3}" maxlength="3000">${esc(st.fields[k] || "")}</textarea></div>`).join("");
  const countHTML = () => { const n = words(storyText(st)); const min = n / WORDS_PER_MIN; return `${n} words · about ${min < 1 ? "under a minute" : `${min.toFixed(1)} min`} spoken${n > STORY_MAX_WORDS ? ` · <b class="warn-text">over 3 minutes; trim the setup</b>` : ""}`; };
  const histHTML = () => st.scores?.length ? `<h3 class="h-sm">Score history</h3>${st.scores.length > 1 ? lineChart(st.scores.slice(-10).map(s => ({ label: fmtDate(s.d), short: fmtDate(s.d).replace(/^\w+ /, ""), y: s.avg })), { min: 1, max: 4, yTicks: [1, 2, 3, 4], color: "var(--c-practice)", height: 100, label: "Story score over time" }) : ""}
    <ul class="plain small">${st.scores.slice(-5).reverse().map(s => `<li>${fmtDate(s.d, { year: true })}: <b>${s.avg.toFixed(1)}</b> / 4</li>`).join("")}</ul>` : "";
  const reviewHTML = () => {
    const r = st.last; if (!r) return "";
    const rows = RUBRICS.story.rows;
    return `<div class="ai-draft"><p class="ai-label">${icon("sparkle", "sm")}Review · ${fmtDate(r.d, { year: true })}</p>
      <ul class="rubric">${rows.map(([k, l]) => { const v = Number(r.scores[k]) || 0; return `<li><span class="rb-l">${esc(l)}${r.why?.[k] ? `<small>${esc(r.why[k])}</small>` : ""}</span><span class="rb-v" aria-label="${v} of 4">${[1, 2, 3, 4].map(i => `<i class="${i <= v ? "on" : ""}"></i>`).join("")}<b>${v}</b></span></li>`; }).join("")}</ul>
      ${r.suggestions?.length ? `<h3 class="h-sm">Suggestions</h3><ul class="plain">${r.suggestions.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${r.rewrite ? `<h3 class="h-sm">Sample rewrite, from your facts only</h3>${r.newNums?.length ? `<p class="banner warn small">${icon("alert")}<span>The rewrite has numbers you didn't write: ${r.newNums.map(esc).join(", ")}. Remove them unless they're true.</span></p>` : ""}
        ${STORY_FORMATS[st.format].fields.filter(([k]) => r.rewrite[k]).map(([k, l]) => `<p><b>${l}:</b> ${esc(r.rewrite[k])}</p>`).join("")}
        <div class="actions"><button class="btn btn-sm btn-primary" type="button" data-use-rw>Use this rewrite</button></div>` : ""}</div>`;
  };
  sheet({
    title: q.custom ? "Your question" : "Story", sub: esc(q.q), wide: true,
    body: `<div class="form">
      ${q.custom ? `<div class="field"><label for="sq">Question</label><input id="sq" type="text" value="${esc(q.q)}" maxlength="240"></div>` : ""}
      <div class="row2"><div class="field"><label for="s-fmt">Format</label><select id="s-fmt">${Object.values(STORY_FORMATS).map(f => `<option value="${f.name}" ${f.name === st.format ? "selected" : ""}>${f.name}: ${f.fields.map(x => x[1]).join(", ")}</option>`).join("")}</select><p class="hint" data-fmt-best>${esc(STORY_FORMATS[st.format].best)}</p></div>
        <div class="field"><span class="lbl">Status</span><div class="seg-ctl" role="radiogroup" aria-label="Status">${Object.entries(STORY_STATUS).map(([k, l]) => `<label><input type="radio" name="sst" value="${k}" ${k === st.status ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></div></div>
      <div data-fields>${fieldsHTML()}</div>
      <p class="small muted" data-count>${countHTML()}</p>
      <details class="pr-ctx"><summary>Tags <span class="muted small" data-tagcount>· ${st.tags.length} selected</span></summary>
        <h3 class="h-sm" style="margin-top:8px">Amazon Leadership Principles</h3><div class="tag-picks">${LPS.map(t => `<label class="check-inline"><input type="checkbox" value="${esc(t)}" data-tag ${st.tags.includes(t) ? "checked" : ""}>${esc(t)}</label>`).join("")}</div>
        <h3 class="h-sm" style="margin-top:8px">Other competencies</h3><div class="tag-picks">${COMPETENCIES.map(t => `<label class="check-inline"><input type="checkbox" value="${esc(t)}" data-tag ${st.tags.includes(t) ? "checked" : ""}>${esc(t)}</label>`).join("")}</div></details>
      ${aiVisible() ? `<div class="actions"><button class="btn" type="button" data-review>${icon("sparkle", "sm")}${st.last ? "Review again" : "Review and score"}</button></div><div data-wait></div>` : ""}
      <div data-review-out>${reviewHTML()}</div>
      <div data-hist>${histHTML()}</div>
    </div>`,
    foot: `<button class="btn btn-danger" type="button" data-del>${icon("trash", "sm")}Delete story</button><span class="spacer"></span><button class="btn" type="button" data-practice>${icon("mic", "sm")}Practice out loud</button><button class="btn btn-primary" type="button" data-close>Done</button>`,
    onClose: () => {
      if (ctl) ctl.abort();
      const empty = !words(storyText(st)) && st.status === "idea" && !st.scores.length;
      if (empty && isNew) { const i = S.stories.list.indexOf(st); if (i >= 0) S.stories.list.splice(i, 1); }
      else if (st.status === "idea" && words(storyText(st)) > 20) st.status = "drafted";
      save("stories"); bus.render();
    },
    onMount: (el, api) => {
      const touch = () => { st.updated = today(); save("stories"); };
      el.addEventListener("input", e => {
        const t = e.target;
        if (t.dataset.sf) { st.fields[t.dataset.sf] = t.value; $("[data-count]", el).innerHTML = countHTML(); touch(); }
        if (t.id === "sq") { const cq = S.stories.questions.find(x => x.id === q.id); if (cq) { cq.q = t.value; touch(); } }
      });
      el.addEventListener("change", e => {
        const t = e.target;
        if (t.id === "s-fmt") { st.format = t.value; $("[data-fields]", el).innerHTML = fieldsHTML(); $("[data-fmt-best]", el).textContent = STORY_FORMATS[st.format].best; $("[data-count]", el).innerHTML = countHTML(); touch(); }
        if (t.name === "sst") { st.status = t.value; touch(); }
        if (t.dataset.tag != null) { st.tags = $$("[data-tag]:checked", el).map(x => x.value); $("[data-tagcount]", el).textContent = `· ${st.tags.length} selected`; touch(); }
      });
      $("[data-del]", el).addEventListener("click", () => {
        api.close();
        const i = S.stories.list.indexOf(st); if (i < 0) return;
        S.stories.list.splice(i, 1);
        const cqi = q.custom ? S.stories.questions.findIndex(x => x.id === q.id) : -1; const cq = cqi >= 0 ? S.stories.questions.splice(cqi, 1)[0] : null;
        save("stories"); bus.render();
        toast(q.custom ? "Question and story deleted" : "Story deleted", { action: "Undo", onAction: () => { S.stories.list.splice(i, 0, st); if (cq) S.stories.questions.splice(cqi, 0, cq); save("stories"); bus.render(); } });
      });
      $("[data-practice]", el).addEventListener("click", () => { api.close(); practiceStory(st, q); });
      el.addEventListener("click", e => {
        if (e.target.closest("[data-use-rw]")) {
          const prev = clone(st.fields);
          for (const [k] of STORY_FORMATS[st.format].fields) if (st.last.rewrite[k]) st.fields[k] = st.last.rewrite[k];
          touch(); $("[data-fields]", el).innerHTML = fieldsHTML(); $("[data-count]", el).innerHTML = countHTML();
          toast("Rewrite applied", { action: "Undo", onAction: () => { st.fields = prev; save("stories"); const f = $("[data-fields]", el); if (f) f.innerHTML = fieldsHTML(); } });
        }
      });
      const rb = $("[data-review]", el);
      if (rb) rb.addEventListener("click", async () => {
        if (words(storyText(st)) < 25) { toast("Write a bit more first: at least a few sentences."); return; }
        const wait = $("[data-wait]", el);
        ctl = new AbortController(); rb.disabled = true;
        wait.innerHTML = `<div class="ai-wait" role="status"><div class="spinner" aria-hidden="true"></div><p>Scoring your story…</p></div>`;
        try {
          await reviewStory(st, q, ctl.signal);
          $("[data-review-out]", el).innerHTML = reviewHTML(); $("[data-hist]", el).innerHTML = histHTML(); wait.innerHTML = "";
          rb.innerHTML = `${icon("sparkle", "sm")}Review again`;
        } catch (e) { wait.innerHTML = ctl.signal.aborted ? "" : `<p class="error" role="alert">${esc(e.message)}</p>`; }
        rb.disabled = false; ctl = null;
      });
    }
  });
}
const nums = t => new Set((String(t).match(/\$?\d[\d,.]*%?[KkMm]?/g) || []).map(x => x.replace(/[.,]$/, "")));
async function reviewStory(st, q, signal) {
  const fmt = STORY_FORMATS[st.format], n = words(storyText(st));
  const parts = fmt.fields.map(([k, l]) => `${l} (${k}): ${st.fields[k] || "(empty)"}`).join("\n");
  const keys = RUBRICS.story.rows.map(r => r[0]);
  const res = await askJson(`You coach product designers on behavioral interview answers. Score this written story honestly.
${profileLine()}
Question: "${q.q}"
Format: ${fmt.name} (${fmt.fields.map(x => x[1]).join(", ")}). Tags: ${st.tags.join(", ") || "none"}. Length: ${n} words (about ${(n / WORDS_PER_MIN).toFixed(1)} min spoken; target under ${STORY_MAX_WORDS} words).
Story:
${parts}
Score each row 1–4 (1 missing, 2 partly there, 3 solid, 4 strong):
${RUBRICS.story.rows.map(([k, l]) => `- ${k}: ${l}`).join("\n")}
Then give 3–5 short suggestions, and a sample rewrite in the same format with the same field keys (${fmt.fields.map(x => x[0]).join(", ")}). The rewrite must use ONLY facts they wrote: no new numbers, names, tools or results. Where something is missing, write [add: what's missing] instead of inventing it. Keep it under ${STORY_MAX_WORDS} words, first person, plain English.
Reply with only JSON: {"scores":{${keys.map(k => `"${k}":1`).join(",")}},"why":{${keys.map(k => `"${k}":"one sentence"`).join(",")}},"suggestions":["",""],"rewrite":{${fmt.fields.map(x => `"${x[0]}":""`).join(",")}}}`, { signal });
  const scores = {}, why = {};
  for (const k of keys) { const v = Math.round(Number(res?.scores?.[k])); scores[k] = v >= 1 && v <= 4 ? v : 1; why[k] = String(res?.why?.[k] || "").slice(0, 240); }
  // Length is counted, not guessed.
  scores.length = n <= STORY_MAX_WORDS ? 4 : n <= 550 ? 3 : n <= 700 ? 2 : 1;
  why.length = `${n} words, about ${(n / WORDS_PER_MIN).toFixed(1)} minutes spoken.`;
  const rewrite = {};
  for (const [k] of fmt.fields) { const v = String(res?.rewrite?.[k] || "").trim(); if (v) rewrite[k] = v.slice(0, 3000); }
  const orig = nums(storyText(st));
  const newNums = [...nums(Object.values(rewrite).join(" "))].filter(x => !orig.has(x));
  const avg = sum(Object.values(scores)) / keys.length;
  st.last = { d: today(), scores, why, suggestions: (Array.isArray(res?.suggestions) ? res.suggestions : []).map(String).filter(Boolean).slice(0, 5).map(x => x.slice(0, 300)), rewrite: Object.keys(rewrite).length ? rewrite : null, newNums };
  st.scores = [...(st.scores || []), { d: today(), avg: Math.round(avg * 100) / 100, rows: scores }].slice(-20);
  saveNow("stories");
}
function practiceStory(st, q) {
  const context = STORY_FORMATS[st.format].fields.map(([k, l]) => (st.fields[k] ? `${l}: ${st.fields[k]}` : "")).filter(Boolean).join("\n\n");
  openPractice({ kind: "story", ref: st.id, title: q.q, plan: [{ name: "Answer", min: 3 }], context });
}

// ================= Other rounds =================
function roundsTab() {
  const crit = sessionsOf("critique");
  const A2 = S.interview.answers;
  const bySkill = S.skills.list.filter(k => k.interview?.length);
  return `<div class="grid-2">
    <section class="card" aria-labelledby="iv-cr"><div class="card-h"><h2 id="iv-cr">${icon("eye")}App critique, 10 minutes</h2></div><div class="card-b">
      <ol class="plain-ol">${CRITIQUE_STEPS.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
      <div class="actions" style="margin-top:10px"><label class="sr-only" for="iv-capp">App to critique</label><input id="iv-capp" type="text" list="iv-capps" value="${esc(UI.critApp)}" data-change="iv-capp" style="flex:1 1 180px;width:auto" maxlength="80">
        <datalist id="iv-capps">${CRITIQUE_APPS.map(a => `<option value="${esc(a)}"></option>`).join("")}</datalist>
        <button class="btn btn-primary" type="button" data-act="iv-crit-go">${icon("play", "sm")}Start critique</button></div>
      <p class="small muted">Meta asks for critiques of apps such as Google Maps, DoorDash, Airbnb, Spotify, Pinterest or Yelp. ${extLink(L.ytCritique.u, "Mock critiques on YouTube")}</p>
      <h3 class="h-sm" style="margin-top:12px">Practice log <span class="muted">· ${crit.length}</span></h3>${historyHTML(crit, { empty: "No critiques yet.", max: 5 })}</div></section>
    <section class="card" aria-labelledby="iv-rs"><div class="card-h"><h2 id="iv-rs">${icon("mic")}Recruiter-screen answers</h2></div><div class="card-b form">
      ${ANSWERS.map(([k, l, h]) => `<div class="field"><div class="li-part-h"><label for="ans-${k}">${esc(l)}</label>${k === "intro" ? `<button class="btn btn-sm" type="button" data-act="iv-ans-go" data-k="${k}">${icon("mic", "sm")}Practice out loud</button>` : ""}</div>${h ? `<p class="hint">${esc(h)}</p>` : ""}
        <textarea id="ans-${k}" rows="${k === "intro" || k === "qs" ? 4 : 2}" maxlength="2000" data-change="iv-ans" data-k="${k}">${esc(A2[k] || "")}</textarea></div>`).join("")}
      <details class="pr-ctx"><summary>Question ideas</summary><ul class="opt-list">${QUESTIONS_TO_ASK.map((x, i) => `<li><span>${esc(x)}</span><button class="btn btn-sm" type="button" data-act="iv-ans-q" data-i="${i}" ${(A2.qs || "").includes(x) ? "disabled" : ""}>${(A2.qs || "").includes(x) ? "Added" : "Add"}</button></li>`).join("")}</ul></details>
      <h3 class="h-sm" style="margin-top:8px">Practice log</h3>${historyHTML(sessionsOf("answer"), { empty: "Practice your 60-second intro out loud; the AI comments on delivery and content.", max: 4 })}
    </div></section>
  </div>
  <section class="card" aria-labelledby="iv-types"><div class="card-h"><h2 id="iv-types">${icon("flag")}More interview types</h2><span class="sub">${ROUND_TYPES.filter(t => S.interview.types[t.id]?.ready).length} of ${ROUND_TYPES.length} marked ready</span></div><div class="card-b">
    <div class="type-grid">${ROUND_TYPES.map(t => { const v = S.interview.types[t.id] || {}; return `<article class="type-card ${v.ready ? "is-ready" : ""}"><h3>${esc(t.name)}</h3><p class="small">${esc(t.what)}</p>
      <ul class="plain small">${t.prep.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      ${t.links.length ? `<p class="small">${t.links.map(l => extLink(l.u, l.l)).join(" · ")}</p>` : ""}
      <label class="sr-only" for="ty-${t.id}">Notes for ${esc(t.name)}</label><textarea id="ty-${t.id}" rows="2" maxlength="1200" placeholder="Your notes" data-change="iv-type" data-id="${t.id}">${esc(v.notes || "")}</textarea>
      <div class="actions"><label class="check-inline"><input type="checkbox" data-change="iv-type-ready" data-id="${t.id}" ${v.ready ? "checked" : ""}> Ready</label>${t.practice ? `<a class="btn btn-sm" href="#interview-${t.practice === "story" ? "stories" : t.practice}">${t.practice === "story" ? "Story bank" : "Practice"}</a>` : ""}</div></article>`; }).join("")}</div></div></section>
  <section class="card" aria-labelledby="iv-sk"><div class="card-h"><h2 id="iv-sk">${icon("skills")}Questions by skill</h2><span class="sub">From your skill pages</span></div><div class="card-b">
    ${bySkill.length ? bySkill.map(k => `<details class="sk-q"><summary><b>${esc(k.name)}</b> <span class="muted small">· ${k.interview.length} questions</span></summary><ul class="plain">${k.interview.map(x => `<li><b>${esc(x.q)}</b>${x.tip ? `<br><span class="small muted">${esc(x.tip)}</span>` : ""}</li>`).join("")}</ul><a class="small" href="#skill-${esc(k.id)}">Open ${esc(k.name)}</a></details>`).join("") : `<p class="muted small">No skill questions yet.</p>`}
  </div></section>`;
}

// ================= Mock interviews =================
function mocksTab() {
  const mocks = S.interview.mocks.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const target = S.interview.mockTarget || 6, n = M.currentWeek();
  const byWeek = mapWeek(S.plan, MOCK_BY_WEEK);
  const pace = Math.min(target, Math.round((target * n) / byWeek));
  const done = mocks.filter(m => m.date <= today()).length;
  const counts = Object.keys(KINDS).map(k => ({ k, n: sessionsOf(k).length }));
  return `<section class="card" aria-labelledby="iv-mk"><div class="card-h"><h2 id="iv-mk">${icon("review")}Mock interviews</h2><button class="btn btn-primary btn-sm" type="button" data-act="iv-mock-add">${icon("plus", "sm")}Log a mock</button></div><div class="card-b">
    <div class="li-stats"><div><span class="muted small">Done</span><b class="big-num">${done}<small> of ${target} by Week ${byWeek}</small></b></div><div><span class="muted small">On pace for this week</span><b class="big-num">${pace}</b></div></div>
    ${meter(done, target, { color: "var(--c-practice)", marker: pace, label: `${done} of ${target} mock interviews; ${pace} expected by now` })}
    <p class="small muted" style="margin-top:6px">ADPList has free mock interviews with designers, including at companies on your target list. ${extLink(L.adplist.u, "ADPList")}</p>
    ${mocks.length ? `<div class="scroll-x" style="margin-top:12px"><table class="loop-t"><thead><tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col">With</th><th scope="col">Company</th><th scope="col">Score</th><th scope="col">Main lesson</th><th scope="col"><span class="sr-only">Edit</span></th></tr></thead>
      <tbody>${mocks.map(m => `<tr><td>${fmtDate(m.date)}</td><td>${esc(m.type)}</td><td>${esc(m.who)}</td><td>${esc(m.company)}</td><td>${m.score ? `${m.score} / 5` : "–"}</td><td>${esc(m.lesson)}</td><td><button class="icon-btn sm boxed" type="button" data-act="iv-mock-edit" data-id="${m.id}" aria-label="Edit mock from ${fmtDate(m.date)}">${icon("edit", "sm")}</button></td></tr>`).join("")}</tbody></table></div>`
      : `<p class="muted" style="margin-top:12px">No mock interviews logged yet. Week 10 of the plan has the first one.</p>`}
  </div></section>
  <section class="card" aria-labelledby="iv-tot"><div class="card-h"><h2 id="iv-tot">${icon("clock")}Practice so far</h2></div><div class="card-b">
    ${hbars(counts.map(c => ({ label: KINDS[c.k].name, value: c.n, max: Math.max(1, ...counts.map(x => x.n)), color: "var(--c-practice)", display: String(c.n) })))}
  </div></section>`;
}
function openMock(id) {
  const m = id ? S.interview.mocks.find(x => x.id === id) : null;
  const d = m || { date: today(), type: MOCK_TYPES[0], who: "", company: "", score: 0, lesson: "" };
  sheet({
    title: m ? "Edit mock interview" : "Log a mock interview",
    body: `<form class="form" novalidate><div class="row2"><div class="field"><label for="mk-d">Date</label><input id="mk-d" name="date" type="date" value="${esc(d.date)}"></div>
      <div class="field"><label for="mk-t">Type</label><select id="mk-t" name="type">${MOCK_TYPES.map(t => `<option ${t === d.type ? "selected" : ""}>${t}</option>`).join("")}</select></div>
      <div class="field"><label for="mk-w">Who ran it</label><input id="mk-w" name="who" type="text" value="${esc(d.who)}" maxlength="100" placeholder="e.g. ADPList mentor"></div>
      <div class="field"><label for="mk-c">Company style</label><input id="mk-c" name="company" type="text" list="mk-cos" value="${esc(d.company)}" maxlength="80"><datalist id="mk-cos">${S.companies.list.map(c => `<option value="${esc(c.name)}"></option>`).join("")}</datalist></div></div>
      <div class="field"><label for="mk-s">Score</label><select id="mk-s" name="score" style="max-width:200px"><option value="0">Not scored</option>${[1, 2, 3, 4, 5].map(i => `<option value="${i}" ${i === Number(d.score) ? "selected" : ""}>${i} of 5</option>`).join("")}</select></div>
      <div class="field"><label for="mk-l">Main lesson</label><textarea id="mk-l" name="lesson" rows="3" maxlength="600">${esc(d.lesson)}</textarea></div>
      <button type="submit" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">Save</button></form>`,
    foot: `${m ? `<button class="btn btn-danger" type="button" data-del>${icon("trash", "sm")}Delete</button><span class="spacer"></span>` : ""}<button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" data-save>${m ? "Save" : "Log it"}</button>`,
    onMount: (el, api) => {
      const form = $("form", el), E = form.elements;
      const doSave = () => {
        const vals = { date: E.date.value || today(), type: E.type.value, who: E.who.value.trim(), company: E.company.value.trim(), score: Number(E.score.value) || 0, lesson: E.lesson.value.trim() };
        if (m) Object.assign(m, vals); else S.interview.mocks.push({ id: uid("mk"), ...vals });
        save("interview"); api.close(); bus.render(); toast(m ? "Saved" : "Mock interview logged");
      };
      form.addEventListener("submit", e => { e.preventDefault(); doSave(); });
      $("[data-save]", el).addEventListener("click", doSave);
      if (m) $("[data-del]", el).addEventListener("click", () => {
        api.close(); const i = S.interview.mocks.indexOf(m); S.interview.mocks.splice(i, 1); save("interview"); bus.render();
        toast("Deleted", { action: "Undo", onAction: () => { S.interview.mocks.splice(i, 0, m); save("interview"); bus.render(); } });
      });
    }
  });
}

// ================= Page =================
export function renderInterview() {
  const st = S.stories.list.filter(s => s.status === "ready" || s.status === "rehearsed").length;
  const wk = S.practice.list.filter(s => M.inWeek(s.date, M.currentWeek())).length;
  const body = { loops: loopsTab, presentation: presentationTab, challenge: challengeTab, stories: storiesTab, rounds: roundsTab, mocks: mocksTab }[tab]();
  return `<header class="page-h"><div><div class="eyebrow">Land the job</div><h1>Interview prep</h1>
      <p class="lead">Product design loops test a portfolio presentation, a design challenge, behavioral stories and how you talk about impact. Practice each with a timer, a transcript and AI feedback.</p></div>
    <div class="iv-stats small muted"><span><b>${st}</b> stories ready</span><span><b>${wk}</b> practice sessions this week</span><span><b>${S.interview.mocks.length}</b> mocks</span></div></header>
  ${liveBanner()}
  <nav class="subnav" aria-label="Interview prep sections">${IV_TABS.map(([k, l]) => `<a href="#interview-${k}" ${k === tab ? `aria-current="page"` : ""}>${esc(l)}</a>`).join("")}</nav>
  ${body}`;
}

// ================= Handlers =================
export const interviewActions = {
  "iv-co-all": () => { UI.coAll = !UI.coAll; bus.render(); },
  "iv-co-add": () => openCompany(null),
  "iv-co-edit": d => openCompany(d.id),
  "iv-co-ai": d => { const c = A.companyById(d.id); if (c) draftLoop(c); },
  "iv-cancel": () => { busy?.ctl.abort(); busy = null; bus.render(); },
  "iv-co-del": d => {
    const c = A.companyById(d.id); if (!c) return;
    const apps = A.appsFor(c).length;
    confirmSheet({ title: `${c.builtIn ? "Remove" : "Delete"} ${esc(c.name)}?`, message: `It's removed from Interview prep and your target list.${apps ? ` Your ${apps} application${apps > 1 ? "s" : ""} there stay.` : ""}`, confirm: c.builtIn ? "Remove" : "Delete", danger: true, onConfirm: () => {
      const i = S.companies.list.indexOf(c); S.companies.list.splice(i, 1); if (c.builtIn) S.companies.removed.push(c.id);
      save("companies"); bus.render();
      toast(`${c.name} removed`, { action: "Undo", onAction: () => { S.companies.list.splice(i, 0, c); S.companies.removed = S.companies.removed.filter(x => x !== c.id); save("companies"); bus.render(); } });
    } });
  },
  "iv-pres-add": () => { presList().push({ id: uid("sec"), name: "New section", min: 2, notes: "" }); save("interview"); bus.render(); },
  "iv-pres-del": d => {
    const l = presList(), i = l.findIndex(s => s.id === d.id); if (i < 0) return;
    const [s] = l.splice(i, 1); save("interview"); bus.render();
    toast("Section removed", { action: "Undo", onAction: () => { l.splice(i, 0, s); save("interview"); bus.render(); } });
  },
  "iv-pres-mv": d => {
    const l = presList(), i = l.findIndex(s => s.id === d.id), j = i + Number(d.d); if (i < 0 || j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]]; save("interview"); bus.render();
    setTimeout(() => document.querySelector(`[data-act="iv-pres-mv"][data-id="${CSS.escape(d.id)}"][data-d="${d.d}"]`)?.focus(), 0);
  },
  "iv-pres-reset": () => confirmSheet({ title: "Reset this structure?", message: "Your section names, minutes and notes for this version go back to the default.", confirm: "Reset", onConfirm: () => {
    if (UI.presMode === "long") S.interview.pres.long = clone(PRES_LONG); else S.interview.pres.short = clone(PRES_SHORT);
    save("interview"); bus.render();
  } }),
  "iv-pres-go": () => {
    const list = presList().filter(s => s.min > 0);
    openPractice({ kind: "presentation", ref: UI.presMode, title: `${UI.presMode === "long" ? "45" : "15"}-minute presentation`, plan: list.map(s => ({ name: s.name, min: s.min })) });
  },
  "iv-ch-go": d => { const p = allPrompts().find(x => x.id === d.id); if (p) openPractice({ kind: "challenge", ref: p.id, title: p.text, plan: [{ name: "Challenge", min: 45 }] }); },
  "iv-ch-random": () => {
    const ps = allPrompts().filter(p => UI.pf === "all" || (UI.pf === "mine" ? !p.builtIn : p.tags.includes(UI.pf)));
    const done = new Set(sessionsOf("challenge").map(s => s.ref));
    const fresh = ps.filter(p => !done.has(p.id)), pool = fresh.length ? fresh : ps;
    if (!pool.length) return;
    const p = pool[Math.floor(Math.random() * pool.length)];
    openPractice({ kind: "challenge", ref: p.id, title: p.text, plan: [{ name: "Challenge", min: 45 }] });
  },
  "iv-ch-del": d => {
    const i = S.interview.prompts.findIndex(p => p.id === d.id); if (i < 0) return;
    const [p] = S.interview.prompts.splice(i, 1); save("interview"); bus.render();
    toast("Prompt deleted", { action: "Undo", onAction: () => { S.interview.prompts.splice(i, 0, p); save("interview"); bus.render(); } });
  },
  "iv-st-open": d => openStory(d.q),
  "iv-st-practice": d => { const st = S.stories.list.find(s => s.id === d.id); const q = st && allQuestions().find(x => x.id === st.qid); if (st && q) practiceStory(st, q); },
  "iv-crit-go": () => { const app = (UI.critApp || "").trim() || CRITIQUE_APPS[0]; openPractice({ kind: "critique", ref: app, title: app, plan: [{ name: "Critique", min: 10 }], context: CRITIQUE_STEPS.map((s, i) => `${i + 1}. ${s}`).join("\n") }); },
  "iv-ans-go": d => { const [, l] = ANSWERS.find(a => a[0] === d.k) || []; openPractice({ kind: "answer", ref: d.k, title: l || "Answer", plan: [{ name: "Answer", min: 1 }], context: S.interview.answers[d.k] || "" }); },
  "iv-ans-q": d => {
    const x = QUESTIONS_TO_ASK[+d.i]; if (!x) return;
    const cur = S.interview.answers.qs || ""; if (cur.includes(x)) return;
    S.interview.answers.qs = (cur.trim() ? cur.trim() + "\n" : "") + "- " + x; save("interview"); bus.render();
  },
  "iv-mock-add": () => openMock(null),
  "iv-mock-edit": d => openMock(d.id)
};
export const interviewChanges = {
  "iv-ui": el => { UI[el.dataset.k] = el.value; bus.render(); },
  "iv-pres": el => {
    const s = presList().find(x => x.id === el.dataset.id); if (!s) return;
    if (el.dataset.f === "min") { s.min = Math.max(0, Math.min(60, Math.round(Number(el.value) || 0))); save("interview"); bus.render(); return; }
    s[el.dataset.f] = el.value; save("interview");
  },
  "iv-type-ready": el => { const t = S.interview.types[el.dataset.id] = S.interview.types[el.dataset.id] || {}; t.ready = el.checked; save("interview"); bus.render(); },
  "iv-capp": el => { UI.critApp = el.value; }
};
let qT = null;
export const interviewInputs = {
  "iv-coq": el => { UI.coQ = el.value; clearTimeout(qT); qT = setTimeout(() => bus.render(), 220); },
  "iv-pres": el => { const s = presList().find(x => x.id === el.dataset.id); if (s && el.dataset.f !== "min") { s[el.dataset.f] = el.value; save("interview"); } },
  "iv-ans": el => { S.interview.answers[el.dataset.k] = el.value; save("interview"); },
  "iv-type": el => { const t = S.interview.types[el.dataset.id] = S.interview.types[el.dataset.id] || {}; t.notes = el.value; save("interview"); },
  "iv-capp": el => { UI.critApp = el.value; }
};
export const interviewSubmit = {
  "iv-prompt": form => {
    const inp = form.querySelector("input"), tag = form.querySelector("select").value, t = inp.value.trim(); if (!t) return;
    const label = PROMPT_FILTERS.find(f => f[0] === tag)?.[1] || "";
    S.interview.prompts.push({ id: uid("pp"), text: t, label: `My prompt · ${label}`, tags: [tag], note: "" }); save("interview");
    UI.pf = "mine"; bus.render(); toast("Prompt added"); setTimeout(() => document.getElementById("iv-pin")?.focus(), 0);
  },
  "iv-q": form => {
    const inp = form.querySelector("input"), theme = form.querySelector("select").value, t = inp.value.trim(); if (!t) return;
    const qn = { id: uid("cq"), theme, q: t, tags: [] }; S.stories.questions.push(qn); save("stories"); bus.render();
    toast("Question added", { action: "Write the story", onAction: () => openStory(qn.id) });
  }
};
