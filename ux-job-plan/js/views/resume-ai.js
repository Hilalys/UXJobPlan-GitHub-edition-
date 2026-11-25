// AI help on the Resume page: review the whole resume, write the summary, turn notes into bullets,
// suggest skills, and fit it on one page. Claude only uses what's in the resume and what they type,
// and any number it adds is flagged so they can check it.

import { S, save } from "../store.js";
import { esc, uid, today, fmtDate, $, $$ } from "../util.js";
import { icon, sheet, toast } from "../ui.js";
import { askJson, profileLine } from "../ai.js";
import { visible } from "../export.js";
import { normDesign, presetDesign, SPACING, SIZES } from "../resume-design.js";
import { curRes, refreshPreview, measureFill, touchRes } from "./resume.js";
import { bus } from "../bus.js";
import { inPlace, cityName, hasCity, getLoc } from "../locale.js";

const RULES = `Rules:
- Use only facts that are in their resume or in what they type here. Never add a number, metric, percentage, team size, tool, employer, title, date, award or outcome that isn't already there.
- Their title is "Product Designer"; don't change it.
- No first person ("I", "my"), no buzzwords (passionate, results-driven, dynamic, guru, rockstar, synergy), no clichés.
- US English and US resume conventions: strong past-tense verbs for past work, short and concrete.`;

// ---------- Helpers ----------
const isSummary = s => s.kind === "text" && /summary|profile|about/i.test(s.title);
const nums = t => (String(t).match(/\d+(?:[.,]\d+)?%?/g) || []);
// Numbers in the new text that weren't in the old text or their notes.
export const addedNumbers = (nw, ...src) => { const have = new Set(src.flatMap(nums)); return [...new Set(nums(nw))].filter(n => !have.has(n)); };
const numWarn = list => list.length ? `<p class="small warn-text">${icon("alert", "sm")}<span>Adds ${list.map(n => `<b>${esc(n)}</b>`).join(", ")}, which isn't in your resume. Only keep it if it's true.</span></p>` : "";
const wait = msg => `<div class="ai-wait" role="status"><div class="spinner" aria-hidden="true"></div><p>${esc(msg)}</p></div>`;
const errHtml = e => e && e.code === "cancelled" ? "" : `<p class="error" role="alert">${esc(e?.message || "Something went wrong. Try again.")}</p>`;
const str = (v, n = 600) => typeof v === "string" ? v.trim().slice(0, n) : "";
const arr = (v, n) => Array.isArray(v) ? v.slice(0, n) : [];

function find(r, id) {
  for (const s of r.sections) {
    if (s.id === id) return { s };
    if (s.kind === "entries") for (const it of s.items) {
      if (it.id === id) return { s, it };
      const b = it.bullets.find(x => x.id === id); if (b) return { s, it, b };
    }
    if (s.kind === "skills") { const g = s.groups.find(x => x.id === id); if (g) return { s, g }; }
    if (s.kind === "list") { const li = s.items.find(x => x.id === id); if (li) return { s, li }; }
  }
  return null;
}
// The resume as Claude sees it: only what prints, with ids it can point at. Phone and email aren't sent.
function asText(r) {
  const h = r.header;
  const L = [`[header] ${h.name} | ${h.title} | ${h.location || "no location"} | phone ${h.phone ? "given" : "missing"} | email ${h.email ? "given" : "missing"} | LinkedIn ${h.linkedin || "missing"} | portfolio ${h.portfolio || "missing"}`];
  for (const s of visible(r)) {
    L.push("", `[${s.id}] SECTION: ${s.title} (${s.kind === "entries" ? s.type || "entries" : s.kind})`);
    if (s.kind === "text") L.push(`  "${s.text}"`);
    if (s.kind === "entries") for (const it of s.items) {
      L.push(`  [${it.id}] ${[it.org, it.role].filter(Boolean).join(" — ")}${it.loc ? ` | ${it.loc}` : ""}${it.dates ? ` | ${it.dates}` : ""}`);
      for (const b of it.bullets) L.push(`    [${b.id}] ${b.text}`);
    }
    if (s.kind === "skills") for (const g of s.groups) L.push(`  [${g.id}] ${g.label}: ${g.items}`);
    if (s.kind === "list") for (const li of s.items) L.push(`  [${li.id}] ${li.text}`);
  }
  return L.join("\n");
}
const fillLine = f => f.over ? `It runs about ${f.pct - 100}% past one page.` : `It fits on one page (${f.pct}% full).`;
function goTo(id) {
  const r = curRes(), hit = find(r, id);
  if (!hit) return;
  setTimeout(() => {
    if (hit.it) { const box = document.querySelector(`[data-item-box="${hit.it.id}"]`); if (box) { box.open = true; box.scrollIntoView({ block: "center" }); (hit.b ? document.getElementById(`b-${hit.b.id}`) : box.querySelector("input"))?.focus(); return; } }
    const el = document.getElementById(`sec-${hit.s.id}`); el?.scrollIntoView({ block: "center" }); el?.focus();
  }, 60);
}
function setText(r, id, text) {
  const hit = find(r, id); if (!hit) return null;
  if (hit.b) { const prev = hit.b.text; hit.b.text = text; return () => { hit.b.text = prev; }; }
  if (hit.s.kind === "text" && !hit.it) { const prev = hit.s.text; hit.s.text = text; return () => { hit.s.text = prev; }; }
  return null;
}
function hide(r, id) {
  const hit = find(r, id); if (!hit) return null;
  const o = hit.b || hit.it || hit.li || hit.g; if (!o) return null;
  o.hidden = true; return () => { o.hidden = false; };
}
const changed = r => { touchRes(r); refreshPreview(r); };

// ---------- Review ----------
const SCORE = { clarity: ["Clarity", "Easy to scan, clear wording"], impact: ["Impact", "Outcomes and specifics, not just tasks"], ats: ["Screening software", "Standard headings and keywords"], length: ["Length", "One page, no filler"] };

export function openReview({ last = false } = {}) {
  const r = curRes();
  let ctl = null;
  sheet({
    title: "Review my resume", sub: `Claude reads "${r.name}" like a design hiring manager and a recruiter, scores it, and suggests fixes you can apply one at a time.`, wide: true,
    body: `<div data-out></div>`,
    foot: `<button class="btn btn-ghost" type="button" data-close>Close</button><button class="btn" type="button" data-again>${icon("sparkle", "sm")}Review again</button>`,
    onClose: () => ctl && ctl.abort(),
    onMount: (el, api) => {
      const out = $("[data-out]", el);
      const show = rv => {
        const res = rv.result;
        out.innerHTML = `<p class="small muted">Reviewed ${esc(fmtDate(rv.at, { year: true }))}${rv.at !== today() ? ". Run it again after you change things." : "."}</p>
          ${res.overall ? `<p class="rv-overall">${esc(res.overall)}</p>` : ""}
          <div class="rv-scores">${Object.entries(SCORE).map(([k, [l, hint]]) => { const v = res.scores[k]; return v ? `<div class="rv-score"><div class="rv-score-top"><b>${l}</b><span>${v} of 5</span></div><div class="meter thin" style="--mc:${v >= 4 ? "var(--success)" : v >= 3 ? "var(--c-build)" : "var(--warning)"}" role="img" aria-label="${l}: ${v} of 5"><i style="width:${v * 20}%"></i></div><span class="muted small">${hint}</span></div>` : ""; }).join("")}</div>
          ${res.strengths.length ? `<h3 class="rv-h">What works</h3><ul class="rv-list">${res.strengths.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
          ${res.fixes.length ? `<h3 class="rv-h">Fixes, most important first</h3><ol class="rv-fixes">${res.fixes.map((f, i) => fixCard(r, f, i)).join("")}</ol>` : `<p>No fixes. It's in good shape.</p>`}`;
      };
      const fixCard = (r, f, i) => {
        const hit = f.target ? find(r, f.target) : null;
        const where = hit ? (hit.it ? `${hit.s.title} · ${hit.it.org || "entry"}` : hit.s.title) : f.where === "header" ? "Header" : (find(r, f.where)?.s.title || "");
        const before = hit ? (hit.b ? hit.b.text : hit.s.kind === "text" && !hit.it ? hit.s.text : hit.it ? `${hit.it.org} — ${hit.it.role}` : "") : "";
        const act = f.done ? `<span class="tag good">${icon("check", "sm")}Done</span>`
          : f.kind === "rewrite" && hit && (hit.b || (hit.s.kind === "text" && !hit.it)) ? `<button class="btn btn-sm btn-primary" type="button" data-fix="${i}">Use this</button>`
          : f.kind === "hide" && hit ? `<button class="btn btn-sm" type="button" data-fix="${i}">${icon("eyeOff", "sm")}Hide it in this version</button>` : "";
        return `<li class="rv-fix"><div class="rv-fix-top">${where ? `<span class="tag">${esc(where)}</span>` : ""}<span class="tag ${f.kind === "advice" ? "info" : ""}">${f.kind === "rewrite" ? "Rewrite" : f.kind === "hide" ? "Cut" : "Your call"}</span></div>
          <p>${esc(f.problem)}</p>
          ${f.kind === "rewrite" && f.text ? `<div class="rv-ba">${before ? `<p class="quote"><span class="sr-only">Now: </span>${esc(before)}</p>` : ""}<p class="quote rv-new"><span class="sr-only">Suggested: </span>${esc(f.text)}</p>${numWarn(addedNumbers(f.text, before))}</div>` : ""}
          <div class="rv-fix-acts">${act}${hit ? `<button class="btn btn-sm btn-ghost" type="button" data-goto="${esc(f.target)}">Go to it</button>` : ""}</div></li>`;
      };
      const run = async () => {
        out.innerHTML = wait("Claude is reading your resume. This takes about half a minute.");
        ctl = new AbortController();
        const fill = measureFill(r);
        try {
          const raw = await askJson(`Review a product designer's resume for jobs${inPlace()}. ${profileLine()}
${fillLine(fill)}
The resume (ids in brackets):
${asText(r)}

Review it like an experienced design hiring manager and a recruiter together. Score each from 1 to 5: clarity (easy to scan, clear wording), impact (outcomes and specifics rather than tasks), ats (standard headings, plain format, keywords that product design job posts use), length (one page, no filler).
Then give up to 8 fixes, most important first. Each fix has:
- "where": a section id, an entry id, or "header"
- "target": the id of the bullet or text section you rewrite or cut, or "" for advice
- "kind": "rewrite" (give the complete new text in "text"), "hide" (target a bullet or entry to cut), or "advice" (something only they can do, like adding a real metric, a link, or a missing detail; say exactly what to add)
- "problem": one or two sentences on what's wrong and why it matters
Use "rewrite" only for wording. If a bullet needs a number they have to supply, use "advice" and say what to measure.
${RULES}
Reply with only JSON: {"overall":"two sentences","scores":{"clarity":3,"impact":2,"ats":4,"length":3},"strengths":["",""],"fixes":[{"where":"","target":"","kind":"rewrite","problem":"","text":""}]}`, { signal: ctl.signal });
          const sc = raw?.scores || {};
          const result = {
            overall: str(raw?.overall, 400),
            scores: Object.fromEntries(Object.keys(SCORE).map(k => [k, Math.min(5, Math.max(0, Math.round(Number(sc[k]) || 0)))])),
            strengths: arr(raw?.strengths, 4).map(x => str(x, 240)).filter(Boolean),
            fixes: arr(raw?.fixes, 8).map(f => ({ where: str(f?.where, 60), target: str(f?.target, 60), kind: ["rewrite", "hide", "advice"].includes(f?.kind) ? f.kind : "advice", problem: str(f?.problem, 400), text: str(f?.text, 600), done: false }))
              .filter(f => f.problem && !(f.kind !== "advice" && !find(r, f.target)))
          };
          if (!result.overall && !result.fixes.length) throw new Error("The review came back empty. Try again.");
          S.resume.review = { at: today(), vid: r.id, result }; save("resume");
          show(S.resume.review); bus.render();
        } catch (e) { out.innerHTML = errHtml(e); }
      };
      out.addEventListener("click", e => {
        const g = e.target.closest("[data-goto]"); if (g) { api.close(); goTo(g.dataset.goto); return; }
        const b = e.target.closest("[data-fix]"); if (!b) return;
        const rv = S.resume.review, f = rv?.result.fixes[+b.dataset.fix]; if (!f) return;
        const undo = f.kind === "rewrite" ? setText(r, f.target, f.text) : hide(r, f.target);
        if (!undo) return;
        f.done = true; save("resume"); changed(r); show(rv);
        toast(f.kind === "rewrite" ? "Rewrite applied" : "Hidden in this version", { action: "Undo", onAction: () => { undo(); f.done = false; save("resume"); changed(r); bus.render(); if (el.isConnected) show(rv); } });
      });
      $("[data-again]", el).addEventListener("click", run);
      const prev = S.resume.review;
      if ((last || prev?.at === today()) && prev && prev.vid === r.id) show(prev); else run();
    }
  });
}

// ---------- Summary (or any text section) ----------
const FOCUS = ["Mobile apps", "Web and dashboards", "Design systems", "AI products", "User research", "Visual design"];
export function openSummary(secId) {
  const r = curRes();
  let s = secId ? r.sections.find(x => x.id === secId) : r.sections.find(isSummary);
  const summary = !s || isSummary(s);
  const title = s ? s.title : "Summary";
  let ctl = null;
  sheet({
    title: summary ? (s && s.text.trim() ? "Improve your summary" : "Write your summary") : `Improve "${title}"`,
    sub: "Claude writes three options from your resume. Pick one, then make it sound like you.", wide: true,
    body: `<div class="form">
      ${summary ? `<div class="field"><label for="sm-role">Roles you're applying for</label><input id="sm-role" type="text" maxlength="160" value="${esc(S.settings.profile.target || "Product Designer roles")}"></div>
      <fieldset class="field as-fs"><legend class="lbl">What to lead with <span class="muted">(optional)</span></legend><div class="chips">${FOCUS.map(f => `<label class="chip evp-chip"><input type="checkbox" value="${esc(f)}">${esc(f)}</label>`).join("")}</div></fieldset>` : ""}
      <div class="field"><label for="sm-x">Anything true to add? <span class="muted">(optional)</span></label><input id="sm-x" type="text" maxlength="300" placeholder="${summary ? "e.g. I moved to Austin in 2026 and I'm authorized to work in the US" : "e.g. what this section should show"}"></div>
      ${summary ? `<div class="field"><span class="lbl">Length</span><div class="seg-ctl">${[["2", "2 sentences"], ["3", "3 sentences"]].map(([v, l], i) => `<label><input type="radio" name="sm-len" value="${v}" ${i === 0 ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></div>` : ""}
      <div><button class="btn btn-primary" type="button" data-go>${icon("sparkle", "sm")}Write options</button></div><div data-out></div></div>`,
    foot: `<button class="btn btn-ghost" type="button" data-close>Close</button>`,
    onClose: () => ctl && ctl.abort(),
    onMount: (el, api) => {
      const out = $("[data-out]", el);
      $("[data-go]", el).addEventListener("click", async () => {
        out.innerHTML = wait("Writing options…");
        ctl = new AbortController();
        const focus = $$("input[type=checkbox]:checked", el).map(i => i.value);
        const extra = $("#sm-x", el).value.trim();
        const len = (el.querySelector("input[name=sm-len]:checked") || {}).value || "2";
        try {
          const raw = await askJson(`Write ${summary ? "the summary at the top of" : `the "${title}" section of`} a product designer's resume. ${profileLine()}
${summary ? `Roles they're applying for: ${$("#sm-role", el).value.trim() || "Product Designer"}.\nLead with: ${focus.join(", ") || "their strongest, most relevant experience"}.\nLength: ${len} sentences, under ${len === "2" ? 45 : 65} words.` : "Keep it about the same length as now."}
${s && s.text.trim() ? `Current text: "${s.text}"` : "There's no text yet."}
True extra facts from them: "${extra}"
Their resume:
${asText(r)}
${summary ? "A summary says what kind of designer they are, their strongest experience, and what they're looking for. No headline-style fragments, no objective statement, no soft-skill lists." : ""}
${RULES}
Give 3 options with different angles. Reply with only JSON: {"options":[{"label":"2–4 words on the angle","text":"..."}]}`, { signal: ctl.signal, tier: "quick" });
          const opts = arr(raw?.options, 3).map(o => ({ label: str(o?.label, 40), text: str(o?.text, 700) })).filter(o => o.text);
          if (!opts.length) throw new Error("No options came back. Try again.");
          const src = [s?.text || "", extra, asText(r)];
          out.innerHTML = `<div class="ai-draft"><p class="ai-label">${icon("sparkle", "sm")}Pick one. Check that every word is true.</p>${opts.map((o, i) => `<div class="opt-row"><div style="flex:1;min-width:0">${o.label ? `<b class="small">${esc(o.label)}</b>` : ""}<p>${esc(o.text)}</p>${numWarn(addedNumbers(o.text, ...src))}</div><button class="btn btn-sm" type="button" data-use="${i}">Use</button></div>`).join("")}</div>`;
          out.onclick = e => {
            const u = e.target.closest("[data-use]"); if (!u) return;
            let created = false;
            if (!s) { s = { id: uid("s"), kind: "text", title: "Summary", hidden: false, text: "" }; r.sections.unshift(s); created = true; }
            const prev = s.text, wasHidden = s.hidden;
            s.text = opts[+u.dataset.use].text; s.hidden = false;
            touchRes(r); api.close(); bus.render();
            const sec = s;
            toast(`${sec.title} updated`, { action: "Undo", onAction: () => { if (created) r.sections.splice(r.sections.indexOf(sec), 1); else { sec.text = prev; sec.hidden = wasHidden; } touchRes(r); bus.render(); } });
          };
        } catch (e) { out.innerHTML = errHtml(e); }
      });
    }
  });
}

// ---------- Bullets from notes ----------
export function openNotes(secId, itemId) {
  const r = curRes(), s = r.sections.find(x => x.id === secId), it = s?.items?.find(x => x.id === itemId);
  if (!it) return;
  let ctl = null;
  const kind = s.type === "projects" ? "project" : s.type === "education" ? "school" : "role";
  sheet({
    title: "Write bullets from notes", sub: `${[it.org, it.role].filter(Boolean).join(" · ") || "This entry"}. Write what you did in your own words; Claude turns it into resume bullets.`, wide: true,
    body: `<div class="form">
      <div class="field"><label for="nt-n">What did you do in this ${kind}?</label><textarea id="nt-n" rows="6" maxlength="2500" placeholder="Rough notes are fine: what you worked on, who with, the tools, what changed because of your work, anything you measured."></textarea>
        <p class="hint">Include real numbers if you have them (users, screens, time saved). Claude won't make any up.</p></div>
      <div class="field"><span class="lbl">How many bullets</span><div class="seg-ctl">${[3, 4, 5].map((n, i) => `<label><input type="radio" name="nt-c" value="${n}" ${i === 0 ? "checked" : ""}><span>${n}</span></label>`).join("")}</div></div>
      <div><button class="btn btn-primary" type="button" data-go>${icon("sparkle", "sm")}Write bullets</button></div><div data-out></div></div>`,
    foot: `<button class="btn btn-ghost" type="button" data-close>Close</button>`,
    onClose: () => ctl && ctl.abort(),
    onMount: (el, api) => {
      const out = $("[data-out]", el);
      setTimeout(() => $("#nt-n", el).focus(), 50);
      $("[data-go]", el).addEventListener("click", async () => {
        const notes = $("#nt-n", el).value.trim();
        if (!notes && !it.bullets.some(b => b.text.trim())) { out.innerHTML = `<p class="error" role="alert">Write a few notes first.</p>`; $("#nt-n", el).focus(); return; }
        const n = (el.querySelector("input[name=nt-c]:checked") || {}).value || "3";
        out.innerHTML = wait("Writing bullets…");
        ctl = new AbortController();
        try {
          const raw = await askJson(`Write resume bullets for one ${kind} on a product designer's resume. ${profileLine()}
Entry: ${[it.org, it.role, it.loc, it.dates].filter(Boolean).join(" | ")}
Bullets they have now: ${it.bullets.filter(b => b.text.trim()).map(b => `"${b.text}"`).join("; ") || "none"}
Their notes (the facts to use): """${notes}"""
Write ${n} bullets. Each: one sentence, under 28 words, starting with a strong verb (past tense for past work), showing what they did and the result where their notes give one. Lead with the most relevant to product design roles. Don't repeat bullets they already have.
For each bullet, add a short "tip" only if a specific real detail would make it stronger (e.g. "If you know how many people used it, add the number."); otherwise leave tip empty.
${RULES}
Reply with only JSON: {"bullets":[{"text":"","tip":""}]}`, { signal: ctl.signal, tier: "quick" });
          const list = arr(raw?.bullets, 6).map(b => ({ text: str(b?.text, 400), tip: str(b?.tip, 200) })).filter(b => b.text);
          if (!list.length) throw new Error("No bullets came back. Try adding a bit more to your notes.");
          const src = [notes, ...it.bullets.map(b => b.text), it.dates || ""];
          out.innerHTML = `<div class="ai-draft"><p class="ai-label">${icon("sparkle", "sm")}Untick any you don't want, then add them.</p>
            <ul class="nt-list">${list.map((b, i) => `<li><label><input type="checkbox" value="${i}" checked><span>${esc(b.text)}</span></label>${b.tip ? `<p class="small muted">${icon("info", "sm")}${esc(b.tip)}</p>` : ""}${numWarn(addedNumbers(b.text, ...src))}</li>`).join("")}</ul>
            <div><button class="btn btn-primary" type="button" data-add>Add to this ${kind}</button></div></div>`;
          $("[data-add]", out).addEventListener("click", () => {
            const picked = $$(".nt-list input:checked", out).map(i => list[+i.value]);
            if (!picked.length) return;
            const prev = it.bullets.slice();
            it.bullets = [...it.bullets.filter(b => b.text.trim()), ...picked.map(b => ({ id: uid("b"), text: b.text, hidden: false }))];
            touchRes(r); api.close(); bus.render();
            setTimeout(() => { const box = document.querySelector(`[data-item-box="${it.id}"]`); if (box) box.open = true; }, 0);
            toast(`Added ${picked.length} bullet${picked.length > 1 ? "s" : ""}`, { action: "Undo", onAction: () => { it.bullets = prev; touchRes(r); bus.render(); } });
          });
        } catch (e) { out.innerHTML = errHtml(e); }
      });
    }
  });
}

// ---------- Skills ----------
export function openSkills(secId) {
  const r = curRes(), s = r.sections.find(x => x.id === secId && x.kind === "skills") || r.sections.find(x => x.kind === "skills");
  if (!s) return;
  let ctl = null;
  sheet({
    title: "Suggest skills", sub: "Claude suggests skills from your resume and your Skills page. Add only what you could talk about in an interview.", wide: true,
    body: `<div data-out></div>`,
    foot: `<button class="btn btn-ghost" type="button" data-close>Close</button>`,
    onClose: () => ctl && ctl.abort(),
    onMount: async (el, api) => {
      const out = $("[data-out]", el);
      out.innerHTML = wait("Looking at your skills…");
      ctl = new AbortController();
      const have = s.groups.flatMap(g => g.items.split(",")).map(x => x.trim().toLowerCase()).filter(Boolean);
      try {
        const raw = await askJson(`Suggest skills for the Skills section of a product designer's resume. ${profileLine()}
Current groups: ${s.groups.map(g => `${g.label}: ${g.items}`).join(" | ") || "none"}
Skills they're working on, from their Skills page (rated now/target out of 5): ${S.skills.list.map(x => `${x.name} ${x.now}/${x.target}`).join("; ")}
Their resume:
${asText(r)}
Suggest up to 12 skills or tools they don't list yet, grouped under their existing group names where they fit (or a new short group name). Only suggest skills their resume or Skills page supports (rated 3 or more, or used in their work or projects), in the words product design job posts use. For each, say in a few words where it shows.
${RULES}
Reply with only JSON: {"groups":[{"label":"","add":[{"skill":"","why":""}]}]}`, { signal: ctl.signal, tier: "quick" });
        const groups = arr(raw?.groups, 5).map(g => ({ label: str(g?.label, 40), add: arr(g?.add, 8).map(a => ({ skill: str(a?.skill, 60), why: str(a?.why, 160) })).filter(a => a.skill && !have.includes(a.skill.toLowerCase())) })).filter(g => g.label && g.add.length);
        if (!groups.length) { out.innerHTML = `<p>Nothing to add. Your skills already cover what your resume shows.</p>`; return; }
        out.innerHTML = `<div class="ai-draft"><p class="ai-label">${icon("sparkle", "sm")}Tick the ones that are true for you.</p>
          ${groups.map((g, gi) => `<fieldset class="as-fs"><legend class="lbl">${esc(g.label)}${s.groups.some(x => x.label.toLowerCase() === g.label.toLowerCase()) ? "" : ` <span class="tag">New group</span>`}</legend>
            <ul class="nt-list">${g.add.map((a, ai) => `<li><label><input type="checkbox" value="${gi}:${ai}"><span><b>${esc(a.skill)}</b>${a.why ? ` <span class="muted small">· ${esc(a.why)}</span>` : ""}</span></label></li>`).join("")}</ul></fieldset>`).join("")}
          <div><button class="btn btn-primary" type="button" data-add>Add selected</button></div></div>`;
        $("[data-add]", out).addEventListener("click", () => {
          const picked = $$(".nt-list input:checked", out).map(i => i.value.split(":").map(Number));
          if (!picked.length) return;
          const prev = s.groups.map(g => ({ ...g }));
          for (const [gi, ai] of picked) {
            const g = groups[gi], skill = g.add[ai].skill;
            let tgt = s.groups.find(x => x.label.toLowerCase() === g.label.toLowerCase());
            if (!tgt) { tgt = { id: uid("g"), label: g.label, items: "", hidden: false }; s.groups.push(tgt); }
            tgt.items = [tgt.items.trim(), skill].filter(Boolean).join(", ");
          }
          touchRes(r); api.close(); bus.render();
          toast(`Added ${picked.length} skill${picked.length > 1 ? "s" : ""}`, { action: "Undo", onAction: () => { s.groups = prev; touchRes(r); bus.render(); } });
        });
      } catch (e) { out.innerHTML = errHtml(e); }
    }
  });
}

// ---------- Fit on one page ----------
export function openFit() {
  const r = curRes();
  let ctl = null;
  // Design changes that save space, tried in order of how little they change the look.
  const quick = () => {
    const d = S.resume.design, list = [];
    if (d.margin > 0.5) list.push(["margin", 0.5, "Narrower margins (0.5 in)"]);
    if (d.spacing !== "tight") list.push(["spacing", d.spacing === "roomy" ? "normal" : "tight", `${d.spacing === "roomy" ? "Normal" : "Tight"} spacing`]);
    if (d.size !== "s") list.push(["size", d.size === "l" ? "m" : "s", `${d.size === "l" ? "Medium" : "Small"} text (${SIZES[d.size === "l" ? "m" : "s"].pt} pt)`]);
    if (d.headLine) list.push(["headLine", false, "Remove the line under the header"]);
    return list;
  };
  sheet({
    title: "Fit on one page", sub: "Recruiters expect one page at your level. Tighten the design first, then cut what matters least.", wide: true,
    body: `<div data-fill class="fit-now"></div>
      <h3 class="rv-h">Tighten the design</h3><div data-quick class="fit-quick"></div>
      ${S.settings.aiOn ? `<h3 class="rv-h">Cut or shorten</h3><p class="small muted">Claude suggests the least important lines to cut or shorten, without losing what's most relevant.</p>
      <div><button class="btn btn-primary" type="button" data-go>${icon("sparkle", "sm")}Suggest cuts</button></div><div data-out></div>` : ""}`,
    foot: `<button class="btn btn-ghost" type="button" data-close>Done</button>`,
    onClose: () => ctl && ctl.abort(),
    onMount: el => {
      const paint = () => {
        const f = measureFill(r);
        $("[data-fill]", el).innerHTML = `<p class="${f.over ? "warn-text" : "ok-text"}">${icon(f.over ? "alert" : "check", "sm")}<span>${f.over ? `Runs about ${f.pct - 100}% past one page` : `Fits on one page · ${f.pct}% full`}</span></p>`;
        const q = quick();
        $("[data-quick]", el).innerHTML = q.length ? q.map(([k, v, l], i) => `<button class="btn btn-sm" type="button" data-q="${i}">${esc(l)}</button>`).join("") : `<p class="small muted">The design is already as compact as it goes.</p>`;
        return f;
      };
      paint();
      $("[data-quick]", el).addEventListener("click", e => {
        const b = e.target.closest("[data-q]"); if (!b) return;
        const [k, v, l] = quick()[+b.dataset.q];
        const prev = { ...S.resume.design, side: { ...S.resume.design.side } };
        S.resume.design = normDesign({ ...S.resume.design, [k]: v }); save("resume"); bus.render(); paint();
        toast(l, { action: "Undo", onAction: () => { S.resume.design = prev; save("resume"); bus.render(); if (el.isConnected) paint(); } });
      });
      const go = $("[data-go]", el); if (!go) return;
      const out = $("[data-out]", el);
      go.addEventListener("click", async () => {
        const f = measureFill(r);
        out.innerHTML = wait("Finding what to cut…");
        ctl = new AbortController();
        try {
          const raw = await askJson(`Help fit a product designer's resume on one page. ${profileLine()}
${fillLine(f)} ${f.over ? "" : "It already fits; suggest only cuts that make it stronger, or none."}
The resume (ids in brackets):
${asText(r)}
Suggest up to 8 changes that save the most space while losing the least for product design roles: cut weak or repeated bullets, cut old or unrelated entries' bullets, shorten long bullets so they fit on one line. Keep the strongest, most relevant lines. Never cut their most recent role, their projects or their education entirely.
Each change: "kind": "hide" (target a bullet or entry id) or "shorten" (target a bullet id and give the shorter "text"), and "why" in a few words.
${RULES}
Reply with only JSON: {"changes":[{"kind":"hide","target":"","text":"","why":""}]}`, { signal: ctl.signal });
          const list = arr(raw?.changes, 8).map(c => ({ kind: c?.kind === "shorten" ? "shorten" : "hide", target: str(c?.target, 60), text: str(c?.text, 400), why: str(c?.why, 160), done: false }))
            .filter(c => { const h = find(r, c.target); return h && (c.kind === "hide" ? (h.b || h.it) : (h.b && c.text)); });
          if (!list.length) { out.innerHTML = `<p>No cuts suggested. Try the design changes above.</p>`; return; }
          const draw = () => {
            out.innerHTML = `<ul class="rv-fixes fit-list">${list.map((c, i) => {
              const h = find(r, c.target), what = h.b ? h.b.text : `${h.it.org}${h.it.role ? ` — ${h.it.role}` : ""} (whole entry)`;
              return `<li class="rv-fix"><div class="rv-fix-top"><span class="tag">${esc(h.s.title)}</span><span class="tag">${c.kind === "hide" ? "Cut" : "Shorten"}</span>${c.why ? `<span class="muted small">${esc(c.why)}</span>` : ""}</div>
                <p class="quote">${esc(what)}</p>${c.kind === "shorten" ? `<p class="quote rv-new">${esc(c.text)}</p>${numWarn(addedNumbers(c.text, what))}` : ""}
                <div class="rv-fix-acts">${c.done ? `<span class="tag good">${icon("check", "sm")}Done</span>` : `<button class="btn btn-sm" type="button" data-c="${i}">${c.kind === "hide" ? "Hide it in this version" : "Use shorter version"}</button>`}</div></li>`;
            }).join("")}</ul>${list.some(c => !c.done) ? `<button class="btn btn-sm" type="button" data-all>Apply all</button>` : ""}`;
          };
          const apply = c => { const undo = c.kind === "hide" ? hide(r, c.target) : setText(r, c.target, c.text); if (undo) { c.done = true; c.undo = undo; } };
          draw();
          out.onclick = e => {
            const one = e.target.closest("[data-c]"), all = e.target.closest("[data-all]");
            if (!one && !all) return;
            const todo = all ? list.filter(c => !c.done) : [list[+one.dataset.c]];
            todo.forEach(apply); changed(r); bus.render(); paint(); draw();
            toast(todo.length > 1 ? `Applied ${todo.length} changes` : "Applied", { action: "Undo", onAction: () => { todo.forEach(c => { c.undo && c.undo(); c.done = false; }); changed(r); bus.render(); if (el.isConnected) { paint(); draw(); } } });
          };
        } catch (e) { out.innerHTML = errHtml(e); }
      });
    }
  });
}
