// Resume: versions, structured editor, live Letter preview, one-page meter, exports, checklist.

import { S, save } from "../store.js";
import { SECTION_KINDS } from "../content3.js";
import { esc, uid, clone, fmtDate, today, $, $$ } from "../util.js";
import { icon, sheet, toast } from "../ui.js";
import { aiVisible, askJson, profileLine } from "../ai.js";
import { resumeHTML, resumeText, downloadResume, visible } from "../export.js";
import { PRESETS, presetDesign, normDesign, isPreset, inSide, previewFonts, FONTS, SIZES, SPACING, MARGINS, ACCENTS, HEADINGS, SIDE_WIDTHS } from "../resume-design.js";
import { openReview, openSummary, openNotes, openSkills, openFit } from "./resume-ai.js";
import { copyText } from "./settings.js";
import { checklistHTML } from "../checklist.js";
import { bus } from "../bus.js";
import { openImportSheet } from "../import.js";
import { inPlace, cityName, hasCity, getLoc } from "../locale.js";

let pane = "edit"; // mobile: edit | preview
let tab = "content"; // content | design
// Content height of one page at 96 dpi: 11in minus the top and bottom margins.
const pagePx = m => (11 - 2 * (Number(m) || 0.5)) * 96;

export const curRes = () => S.resume.versions.find(v => v.id === S.resume.current) || S.resume.versions[0];
export const versionById = id => S.resume.versions.find(v => v.id === id);
const touch = r => { r.updated = today(); save("resume"); };

// ---------- Preview helpers (also used by Resume Tailor) ----------
export function previewBlock(res, { style = S.resume.design, diff = null, id = "rp" } = {}) {
  return `<div class="rp-meter" data-meter="${id}" aria-live="polite"></div>
    <div class="rp-wrap" data-rp="${id}">${resumeHTML(res, style, { diff })}</div>`;
}
let fontsFitted = false;
export function fitPreviews(root = document) {
  // Calibri and Times New Roman previews use the same font files as the PDF; measure again once they load.
  if (!fontsFitted && $$(".rp", root).some(p => /ResSerif|ResCal/.test(p.getAttribute("style") || ""))) previewFonts({ font: "times" }).then(ok => { if (ok && !fontsFitted) { fontsFitted = true; fitPreviews(root.isConnected === false ? document : root); } });
  for (const t of $$(".rd-thumb", root)) { const inner = t.firstElementChild; if (inner) inner.style.transform = `scale(${t.clientWidth / 816})`; }
  for (const wrap of $$(".rp-wrap", root)) {
    const page = wrap.querySelector(".rp"); if (!page) continue;
    const PAGE_PX = pagePx(page.dataset.m);
    const scale = Math.min(1, wrap.clientWidth / 816);
    page.style.transform = `scale(${scale})`;
    const inner = page.querySelector(".rp-inner");
    const h = inner.scrollHeight;
    const pages = Math.max(1, Math.ceil(h / PAGE_PX));
    page.style.minHeight = `${pages * 11}in`;
    page.classList.toggle("over", h > PAGE_PX);
    wrap.style.height = `${page.offsetHeight * scale}px`;
    const meter = root.querySelector(`[data-meter="${wrap.dataset.rp}"]`) || wrap.previousElementSibling;
    if (meter && meter.classList.contains("rp-meter")) {
      const pct = Math.round((h / PAGE_PX) * 100);
      const over = h > PAGE_PX;
      meter.innerHTML = `<div class="rp-meter-row"><span class="${over ? "warn" : "ok"}">${icon(over ? "alert" : "check", "sm")}${over ? `Runs about ${pct - 100}% past one page` : `Fits on one page · ${pct}% full`}</span>${over && wrap.dataset.rp === "rp" ? `<button class="btn btn-sm" type="button" data-act="rv-ai-fit">Help me fit it</button>` : ""}</div>
        <div class="meter thin" style="--mc:${over ? "var(--warning)" : "var(--c-apply)"}" role="img" aria-label="${pct}% of one page"><i style="width:${Math.min(100, pct)}%"></i>${over ? "" : ""}</div>`;
    }
  }
}
// How full one page is, measured off screen, so it works when the preview is hidden (mobile edit view).
export function measureFill(res = curRes(), design = S.resume.design) {
  const box = document.createElement("div");
  box.style.cssText = "position:absolute;left:-10000px;top:0;width:8.5in;visibility:hidden;pointer-events:none";
  box.innerHTML = resumeHTML(res, design); document.body.appendChild(box);
  const h = box.querySelector(".rp-inner").scrollHeight; box.remove();
  const px = pagePx(normDesign(design).margin);
  return { pct: Math.round(h / px * 100), over: h > px };
}
export function refreshPreview(res, opts = {}) {
  const wrap = document.querySelector(`[data-rp="${opts.id || "rp"}"]`);
  if (!wrap) return;
  wrap.innerHTML = resumeHTML(res, opts.style || S.resume.design, { diff: opts.diff || null });
  fitPreviews(wrap.parentElement);
}

// ---------- Editor ----------
const vis = (on, label, attrs) => `<button class="icon-btn sm ${on ? "" : "is-hidden"}" type="button" ${attrs} aria-pressed="${!on}" aria-label="${on ? "Hide" : "Show"} ${esc(label)} in this version" data-tip="${on ? "Hide in this version" : "Hidden in this version"}">${icon(on ? "eye" : "eyeOff", "sm")}</button>`;
const mv = (attrs, label, first, last) => `<button class="icon-btn sm" type="button" ${attrs} data-dir="-1" aria-label="Move up: ${esc(label)}" ${first ? "disabled" : ""}>${icon("arrowUp", "sm")}</button><button class="icon-btn sm" type="button" ${attrs} data-dir="1" aria-label="Move down: ${esc(label)}" ${last ? "disabled" : ""}>${icon("arrowDown", "sm")}</button>`;

function bulletRow(s, it, b, i, n) {
  const a = `data-sec="${s.id}" data-item="${it.id}" data-bul="${b.id}"`;
  return `<li class="rb ${b.hidden ? "hid" : ""}">
    <label class="sr-only" for="b-${b.id}">Bullet ${i + 1} for ${esc(it.org)}</label>
    <textarea id="b-${b.id}" rows="2" data-change="rv-bullet" ${a} maxlength="400">${esc(b.text)}</textarea>
    <span class="rb-actions">
      ${aiVisible() ? `<button class="icon-btn sm" type="button" data-act="rv-bullet-ai" ${a} aria-label="Improve this bullet with AI" data-tip="Improve with AI">${icon("sparkle", "sm")}</button>` : ""}
      ${vis(!b.hidden, "this bullet", `data-act="rv-hide-bullet" ${a}`)}
      ${mv(`data-act="rv-move-bullet" ${a}`, "bullet", i === 0, i === n - 1)}
      <button class="icon-btn sm danger" type="button" data-act="rv-del-bullet" ${a} aria-label="Delete bullet">${icon("trash", "sm")}</button>
    </span></li>`;
}

function sectionEditor(s, idx, n) {
  const sa = `data-sec="${s.id}"`;
  const labels = SECTION_KINDS[s.type] || SECTION_KINDS.custom;
  let body = "";
  if (s.kind === "text") body = `<label class="sr-only" for="st-${s.id}">${esc(s.title)}</label><textarea id="st-${s.id}" rows="6" data-change="rv-text" ${sa} maxlength="1200">${esc(s.text)}</textarea>
    ${aiVisible() ? `<div class="re-ai-row"><button class="btn btn-sm btn-ghost" type="button" data-act="rv-ai-summary" ${sa}>${icon("sparkle", "sm")}${(s.text || "").trim() ? "Improve with AI" : "Write with AI"}</button></div>` : ""}`;
  if (s.kind === "entries") body = `<div class="re-items">${s.items.map((it, i) => {
    const ia = `${sa} data-item="${it.id}"`;
    return `<details class="re-item ${it.hidden ? "hid" : ""}" data-item-box="${it.id}" ${i === 0 && s.items.length < 3 ? "open" : ""}>
      <summary><span class="chev">${icon("chev", "sm")}</span><span class="re-sum"><b>${esc(it.org || "New entry")}</b>${it.role ? ` · ${esc(it.role)}` : ""}<span class="muted small">${it.dates ? ` · ${esc(it.dates)}` : ""}${it.hidden ? " · hidden" : ""}</span></span></summary>
      <div class="re-body">
        <div class="row2">${["org", "role", "loc", "dates"].map(f => `<div class="field"><label for="f-${it.id}-${f}">${labels[f]}</label><input id="f-${it.id}-${f}" type="text" value="${esc(it[f] || "")}" data-change="rv-item" ${ia} data-f="${f}" maxlength="160"></div>`).join("")}</div>
        <div class="field"><span class="lbl">Bullets</span><ul class="rb-list">${it.bullets.map((b, j) => bulletRow(s, it, b, j, it.bullets.length)).join("")}</ul>
          <div class="re-ai-row"><button class="btn btn-sm btn-ghost" type="button" data-act="rv-add-bullet" ${ia}>${icon("plus", "sm")}Add bullet</button>${aiVisible() ? `<button class="btn btn-sm btn-ghost" type="button" data-act="rv-ai-notes" ${ia}>${icon("sparkle", "sm")}Write bullets from notes</button>` : ""}</div></div>
        <div class="re-item-actions">${vis(!it.hidden, it.org || "entry", `data-act="rv-hide-item" ${ia}`)}${mv(`data-act="rv-move-item" ${ia}`, it.org || "entry", i === 0, i === s.items.length - 1)}
          <button class="btn btn-sm btn-danger" type="button" data-act="rv-del-item" ${ia}>${icon("trash", "sm")}Delete entry</button></div>
      </div></details>`;
  }).join("")}</div><button class="btn btn-sm" type="button" data-act="rv-add-item" ${sa}>${icon("plus", "sm")}Add ${s.type === "education" ? "school" : s.type === "projects" ? "project" : "entry"}</button>`;
  if (s.kind === "skills") body = `<div class="rg-list">${s.groups.map((g, i) => `<div class="rg ${g.hidden ? "hid" : ""}">
      <div class="field"><label for="g-${g.id}-l">Group</label><input id="g-${g.id}-l" type="text" value="${esc(g.label)}" data-change="rv-group" ${sa} data-g="${g.id}" data-f="label" maxlength="60"></div>
      <div class="field"><label for="g-${g.id}-i">Skills, comma-separated</label><input id="g-${g.id}-i" type="text" value="${esc(g.items)}" data-change="rv-group" ${sa} data-g="${g.id}" data-f="items" maxlength="400"></div>
      <span class="rb-actions">${vis(!g.hidden, g.label, `data-act="rv-hide-group" ${sa} data-g="${g.id}"`)}${mv(`data-act="rv-move-group" ${sa} data-g="${g.id}"`, g.label, i === 0, i === s.groups.length - 1)}<button class="icon-btn sm danger" type="button" data-act="rv-del-group" ${sa} data-g="${g.id}" aria-label="Delete group ${esc(g.label)}">${icon("trash", "sm")}</button></span></div>`).join("")}</div>
    <div class="re-ai-row"><button class="btn btn-sm" type="button" data-act="rv-add-group" ${sa}>${icon("plus", "sm")}Add group</button>${aiVisible() ? `<button class="btn btn-sm btn-ghost" type="button" data-act="rv-ai-skills" ${sa}>${icon("sparkle", "sm")}Suggest skills</button>` : ""}</div>`;
  if (s.kind === "list") body = `<ul class="rb-list">${s.items.map((it, i) => `<li class="rb ${it.hidden ? "hid" : ""}"><label class="sr-only" for="l-${it.id}">Item ${i + 1}</label><input id="l-${it.id}" type="text" value="${esc(it.text)}" data-change="rv-list" ${sa} data-item="${it.id}" maxlength="200">
      <span class="rb-actions">${vis(!it.hidden, it.text, `data-act="rv-hide-li" ${sa} data-item="${it.id}"`)}${mv(`data-act="rv-move-li" ${sa} data-item="${it.id}"`, it.text, i === 0, i === s.items.length - 1)}<button class="icon-btn sm danger" type="button" data-act="rv-del-li" ${sa} data-item="${it.id}" aria-label="Delete item">${icon("trash", "sm")}</button></span></li>`).join("")}</ul>
    <button class="btn btn-sm" type="button" data-act="rv-add-li" ${sa}>${icon("plus", "sm")}Add item</button>`;
  return `<section class="card re-sec ${s.hidden ? "hid" : ""}" aria-label="${esc(s.title)} section">
    <div class="card-h re-sec-h"><label class="sr-only" for="sec-${s.id}">Section title</label><input id="sec-${s.id}" class="re-title" type="text" value="${esc(s.title)}" data-change="rv-sec-title" ${sa} maxlength="60">
      <span class="rb-actions">${vis(!s.hidden, s.title, `data-act="rv-hide-sec" ${sa}`)}${mv(`data-act="rv-move-sec" ${sa}`, s.title, idx === 0, idx === n - 1)}<button class="icon-btn sm danger" type="button" data-act="rv-del-sec" ${sa} aria-label="Delete section ${esc(s.title)}">${icon("trash", "sm")}</button></span></div>
    <div class="card-b">${body}</div></section>`;
}

export function renderResume() {
  const res = curRes();
  const h = res.header;
  const missing = ["phone", "email", "portfolio"].filter(f => !h[f]);
  const versions = S.resume.versions.map(v => `<button class="week-chip ver-chip" type="button" data-act="rv-version" data-id="${v.id}" aria-pressed="${v.id === res.id}">
      <b>${esc(v.name)}</b><span>${v.updated ? `Edited ${fmtDate(v.updated)}` : v.id === "master" ? "Master" : "Not edited yet"}</span></button>`).join("");
  return `<header class="page-h"><div><div class="eyebrow">Materials</div><h1>Resume</h1>
      <p class="lead">Your master resume and its versions, ready to download. To tailor one for a specific job, use <a href="#tailor">Resume Tailor</a>.</p></div>
    <div class="actions"><button class="btn" type="button" data-act="rv-import">${icon("upload", "sm")}Import resume</button>
      <button class="btn" type="button" data-act="rv-quick">${icon("file", "sm")}Quick resume</button>
      <button class="btn btn-primary" type="button" data-act="rv-dl" data-fmt="pdf">${icon("download", "sm")}Download PDF</button></div></header>
  ${res.imported ? `<div class="banner" role="note">${icon("upload")}<p><b>Imported ${fmtDate(res.imported)}.</b> Check each section against your original file. Hidden items, versions and downloads all work as usual.</p></div>` : missing.length ? `<div class="banner" role="note">${icon("info")}<p><b>This is a starting draft from your profile.</b> Check every line, and add your ${missing.join(", ").replace(/, ([^,]*)$/, " and $1")}.</p></div>` : ""}
  <div class="ver-bar"><div class="week-chips" role="group" aria-label="Resume versions">${versions}</div>
    <div class="actions"><button class="btn btn-sm" type="button" data-act="rv-dup">${icon("copy", "sm")}Duplicate</button>
      <button class="btn btn-sm" type="button" data-act="rv-rename">${icon("edit", "sm")}Rename</button>
      ${res.id !== "master" ? `<button class="btn btn-sm btn-danger" type="button" data-act="rv-delver">${icon("trash", "sm")}Delete</button>` : ""}</div></div>
  <div class="seg-ctl mobile-only" role="radiogroup" aria-label="View" style="margin-bottom:12px">${[["edit", "Edit"], ["preview", "Preview"]].map(([v, l]) => `<label><input type="radio" name="rv-pane" value="${v}" data-change="rv-pane" ${pane === v ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>
  <div class="re-grid pane-${pane}">
    <div class="re-edit">
      <div class="seg-ctl re-tabs" role="radiogroup" aria-label="Edit">${[["content", "Content", "file"], ["design", "Design", "palette"]].map(([v, l, ic]) => `<label><input type="radio" name="rv-tab" value="${v}" data-change="rv-tab" ${tab === v ? "checked" : ""}><span>${icon(ic, "sm")}${l}</span></label>`).join("")}</div>
      ${tab === "design" ? designPanel(res) : `${aiCard(res)}
      <section class="card" aria-labelledby="rh-h"><div class="card-h"><h2 id="rh-h">Header</h2></div><div class="card-b"><div class="row2">
        ${[["name", "Name"], ["title", "Title line"], ["location", "Location"], ["phone", "Phone"], ["email", "Email"], ["linkedin", "LinkedIn"], ["portfolio", "Portfolio"]].map(([f, l]) => `<div class="field"><label for="h-${f}">${l}</label><input id="h-${f}" type="text" value="${esc(h[f] || "")}" data-change="rv-head" data-f="${f}" maxlength="120" ${f === "email" ? 'inputmode="email" autocomplete="email"' : f === "phone" ? 'inputmode="tel" autocomplete="tel"' : ""}></div>`).join("")}
      </div></div></section>
      ${res.sections.map((s, i) => sectionEditor(s, i, res.sections.length)).join("")}
      <div class="add-sec"><button class="btn" type="button" data-act="rv-add-sec">${icon("plus", "sm")}Add section</button></div>
      <section class="card" aria-labelledby="rc-chk"><div class="card-h"><h2 id="rc-chk">${icon("check")}Resume checklist</h2></div><div class="card-b">${checklistHTML("resume.checks", { expandable: true })}</div></section>`}
    </div>
    <div class="re-prev">
      <div class="re-prev-in">
        <div class="re-prev-top"><div class="re-tpl-pick"><label for="rv-tpl">Template</label><select id="rv-tpl" data-change="rv-preset-sel">${Object.entries(PRESETS).map(([k, p]) => `<option value="${k}" ${S.resume.design.preset === k ? "selected" : ""}>${p.label}${S.resume.design.preset === k && !isPreset(S.resume.design) ? " (edited)" : ""}</option>`).join("")}</select>
            ${tab !== "design" ? `<button class="btn btn-sm btn-ghost" type="button" data-act="rv-open-design">${icon("palette", "sm")}Design</button>` : ""}</div>
          <details class="dl-menu"><summary class="btn btn-sm">${icon("download", "sm")}Download</summary><div class="dl-pop">
            ${[["pdf", "PDF"], ["docx", "Word (.docx)"], ["txt", "Plain text (.txt)"], ["md", "Markdown (.md)"]].map(([f, l]) => `<button class="btn btn-sm btn-ghost" type="button" data-act="rv-dl" data-fmt="${f}">${l}</button>`).join("")}
            <button class="btn btn-sm btn-ghost" type="button" data-act="rv-copy">${icon("copy", "sm")}Copy as text</button></div></details></div>
        ${previewBlock(res)}
        <p class="muted small" style="margin-top:8px">${S.resume.design.layout === "one" ? "Single column, standard headings, no tables or images, so screening software can read it." : "Two columns: good for printing and networking. For online applications, one column is safer with screening software."} Hidden items stay in this version but don't print.</p>
      </div>
    </div>
  </div>`;
}

// ---------- Model helpers ----------
const sec = (r, id) => r.sections.find(s => s.id === id);
const item = (r, d) => sec(r, d.sec)?.items?.find(i => i.id === d.item);
const bullet = (r, d) => item(r, d)?.bullets.find(b => b.id === d.bul);
const group = (r, d) => sec(r, d.sec)?.groups?.find(g => g.id === d.g);
function moveIn(arr, obj, dir) { const i = arr.indexOf(obj), j = i + dir; if (i < 0 || j < 0 || j >= arr.length) return false; [arr[i], arr[j]] = [arr[j], arr[i]]; return true; }
function removeWithUndo(arr, obj, label) {
  const i = arr.indexOf(obj); if (i < 0) return;
  arr.splice(i, 1); touch(curRes()); bus.render();
  toast(`${label} deleted`, { action: "Undo", onAction: () => { arr.splice(i, 0, obj); touch(curRes()); bus.render(); } });
}
const refocus = sel => setTimeout(() => document.querySelector(sel)?.focus(), 0);

// Typing updates the model and the preview without redrawing the editor.
export const resumeInputs = {
  "rv-head": el => { const r = curRes(); r.header[el.dataset.f] = el.value; touch(r); refreshPreview(r); },
  "rv-text": el => { const r = curRes(); const s = sec(r, el.dataset.sec); if (s) { s.text = el.value; touch(r); refreshPreview(r); } },
  "rv-item": el => { const r = curRes(); const it = item(r, el.dataset); if (it) { it[el.dataset.f] = el.value; touch(r); refreshPreview(r); } },
  "rv-bullet": el => { const r = curRes(); const b = bullet(r, el.dataset); if (b) { b.text = el.value; touch(r); refreshPreview(r); } },
  "rv-group": el => { const r = curRes(); const g = group(r, el.dataset); if (g) { g[el.dataset.f] = el.value; touch(r); refreshPreview(r); } },
  "rv-list": el => { const r = curRes(); const it = sec(r, el.dataset.sec)?.items.find(i => i.id === el.dataset.item); if (it) { it.text = el.value; touch(r); refreshPreview(r); } },
  "rv-sec-title": el => { const r = curRes(); const s = sec(r, el.dataset.sec); if (s) { s.title = el.value; touch(r); refreshPreview(r); } }
};
export const resumeChanges = {
  "rv-style": el => applyPreset(el.value),
  "rv-preset-sel": el => applyPreset(el.value),
  "rv-tab": el => { tab = el.value; bus.render(); },
  "rv-design": el => {
    const d = S.resume.design, k = el.dataset.k;
    d[k] = el.type === "checkbox" ? el.checked : (k === "margin" || k === "sideWidth") ? Number(el.value) : el.value;
    S.resume.design = normDesign(d); save("resume"); bus.render(); refocus(`#${el.id}`);
  },
  "rv-side": el => { S.resume.design.side[el.dataset.sec] = el.value; save("resume"); bus.render(); refocus(`#${el.id}`); },
  "rv-pane": el => { pane = el.value; bus.render(); }
};

export const resumeActions = {
  "rv-version": d => { S.resume.current = d.id; save("resume"); bus.render(); },
  "rv-dup": () => {
    const r = curRes(), c = clone(r);
    c.id = uid("v"); c.name = `Copy of ${r.name}`; c.updated = today();
    S.resume.versions.push(c); S.resume.current = c.id; save("resume"); bus.render();
    toast("Version duplicated. Rename it to something you'll recognize.");
  },
  "rv-rename": () => {
    const r = curRes();
    sheet({
      title: "Rename version", body: `<form class="form" novalidate><div class="field"><label for="vn">Name</label><input id="vn" type="text" value="${esc(r.name)}" maxlength="60"></div><button type="submit" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">Save</button></form>`,
      foot: `<button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" data-save>Save</button>`,
      onMount: (el, api) => { const go = () => { const v = $("#vn", el).value.trim(); if (v) { r.name = v; save("resume"); } api.close(); bus.render(); }; $("form", el).addEventListener("submit", e => { e.preventDefault(); go(); }); $("[data-save]", el).addEventListener("click", go); }
    });
  },
  "rv-delver": () => {
    const r = curRes(); if (r.id === "master") return;
    const i = S.resume.versions.indexOf(r); S.resume.versions.splice(i, 1); S.resume.current = "master"; save("resume"); bus.render();
    toast(`Deleted "${r.name}"`, { action: "Undo", onAction: () => { S.resume.versions.splice(i, 0, r); S.resume.current = r.id; save("resume"); bus.render(); } });
  },
  "rv-dl": d => { document.querySelector(".dl-menu")?.removeAttribute("open"); downloadResume(curRes(), d.fmt, S.resume.design); },
  "rv-preset": d => applyPreset(d.id),
  "rv-open-design": () => { tab = "design"; pane = "edit"; bus.render(); window.scrollTo(0, 0); },
  "rv-ai-review": () => openReview(),
  "rv-ai-last": () => openReview({ last: true }),
  "rv-ai-summary": d => openSummary(d.sec),
  "rv-ai-notes": d => openNotes(d.sec, d.item),
  "rv-ai-skills": d => openSkills(d.sec),
  "rv-ai-fit": () => openFit(),
  "rv-copy": () => { document.querySelector(".dl-menu")?.removeAttribute("open"); copyText(resumeText(curRes())); },
  "rv-quick": () => openQuick(),
  "rv-import": () => openImportSheet(),
  "rv-hide-sec": d => { const r = curRes(), s = sec(r, d.sec); if (s) { s.hidden = !s.hidden; touch(r); bus.render(); } },
  "rv-move-sec": d => { const r = curRes(), s = sec(r, d.sec); if (s && moveIn(r.sections, s, +d.dir)) { touch(r); bus.render(); refocus(`[data-act="rv-move-sec"][data-sec="${d.sec}"][data-dir="${d.dir}"]:not([disabled])`); } },
  "rv-del-sec": d => { const r = curRes(), s = sec(r, d.sec); if (s) removeWithUndo(r.sections, s, `"${s.title}"`); },
  "rv-add-sec": () => openAddSection(),
  "rv-add-item": d => {
    const r = curRes(), s = sec(r, d.sec); if (!s) return;
    const it = { id: uid("x"), org: "", role: "", loc: "", dates: "", hidden: false, bullets: [{ id: uid("b"), text: "", hidden: false }] };
    s.items.unshift(it); touch(r); bus.render();
    setTimeout(() => { const box = document.querySelector(`[data-item-box="${it.id}"]`); if (box) { box.open = true; box.querySelector("input")?.focus(); } }, 0);
  },
  "rv-hide-item": d => { const r = curRes(), it = item(r, d); if (it) { it.hidden = !it.hidden; touch(r); bus.render(); openItem(it.id); } },
  "rv-move-item": d => { const r = curRes(), s = sec(r, d.sec), it = item(r, d); if (it && moveIn(s.items, it, +d.dir)) { touch(r); bus.render(); openItem(it.id); } },
  "rv-del-item": d => { const r = curRes(), s = sec(r, d.sec), it = item(r, d); if (it) removeWithUndo(s.items, it, `"${it.org || "Entry"}"`); },
  "rv-add-bullet": d => { const r = curRes(), it = item(r, d); if (!it) return; const b = { id: uid("b"), text: "", hidden: false }; it.bullets.push(b); touch(r); bus.render(); openItem(it.id); refocus(`#b-${b.id}`); },
  "rv-hide-bullet": d => { const r = curRes(), b = bullet(r, d); if (b) { b.hidden = !b.hidden; touch(r); bus.render(); openItem(d.item); } },
  "rv-move-bullet": d => { const r = curRes(), it = item(r, d), b = bullet(r, d); if (b && moveIn(it.bullets, b, +d.dir)) { touch(r); bus.render(); openItem(it.id); refocus(`[data-act="rv-move-bullet"][data-bul="${b.id}"][data-dir="${d.dir}"]:not([disabled])`); } },
  "rv-del-bullet": d => { const r = curRes(), it = item(r, d), b = bullet(r, d); if (b) { removeWithUndo(it.bullets, b, "Bullet"); openItem(it.id); } },
  "rv-add-group": d => { const r = curRes(), s = sec(r, d.sec); if (!s) return; const g = { id: uid("g"), label: "", items: "", hidden: false }; s.groups.push(g); touch(r); bus.render(); refocus(`#g-${g.id}-l`); },
  "rv-hide-group": d => { const r = curRes(), g = group(r, d); if (g) { g.hidden = !g.hidden; touch(r); bus.render(); } },
  "rv-move-group": d => { const r = curRes(), s = sec(r, d.sec), g = group(r, d); if (g && moveIn(s.groups, g, +d.dir)) { touch(r); bus.render(); } },
  "rv-del-group": d => { const r = curRes(), s = sec(r, d.sec), g = group(r, d); if (g) removeWithUndo(s.groups, g, "Group"); },
  "rv-add-li": d => { const r = curRes(), s = sec(r, d.sec); if (!s) return; const it = { id: uid("l"), text: "", hidden: false }; s.items.push(it); touch(r); bus.render(); refocus(`#l-${it.id}`); },
  "rv-hide-li": d => { const r = curRes(), it = sec(r, d.sec)?.items.find(i => i.id === d.item); if (it) { it.hidden = !it.hidden; touch(r); bus.render(); } },
  "rv-move-li": d => { const r = curRes(), s = sec(r, d.sec), it = s?.items.find(i => i.id === d.item); if (it && moveIn(s.items, it, +d.dir)) { touch(r); bus.render(); } },
  "rv-del-li": d => { const r = curRes(), s = sec(r, d.sec), it = s?.items.find(i => i.id === d.item); if (it) removeWithUndo(s.items, it, "Item"); },
  "rv-bullet-ai": d => openBulletHelper(d)
};
function openItem(id) { setTimeout(() => { const box = document.querySelector(`[data-item-box="${id}"]`); if (box) box.open = true; }, 0); }

// ---------- Add a section ----------
const ADD = [
  { g: "Main sections", id: "summary", label: "Summary", note: "Two or three lines on who you are and what you're looking for", ic: "file", ai: true, match: s => s.kind === "text" && /summary|profile|about/i.test(s.title), make: () => ({ kind: "text", title: "Summary", text: "" }) },
  { g: "Main sections", id: "experience", label: "Experience", note: "Jobs, internships and freelance work", ic: "briefcase", match: s => s.type === "experience", make: () => ({ kind: "entries", type: "experience", title: "Experience", items: [] }) },
  { g: "Main sections", id: "projects", label: "Projects", note: "Your own projects and case studies", ic: "folder", match: s => s.type === "projects", make: () => ({ kind: "entries", type: "projects", title: "Projects", items: [] }) },
  { g: "Main sections", id: "education", label: "Education", note: "Degrees, schools and bootcamps", ic: "book", match: s => s.type === "education", make: () => ({ kind: "entries", type: "education", title: "Education", items: [] }) },
  { g: "Main sections", id: "skills", label: "Skills", note: "Design skills and tools, in groups", ic: "skills", ai: true, match: s => s.kind === "skills", make: () => ({ kind: "skills", title: "Skills", groups: [{ id: uid("g"), label: "Design", items: "", hidden: false }, { id: uid("g"), label: "Tools", items: "", hidden: false }] }) },
  { g: "More sections", id: "certs", label: "Certifications", note: "Certificates with the issuer and year", ic: "award", make: () => ({ kind: "list", title: "Certifications" }) },
  { g: "More sections", id: "courses", label: "Courses and training", note: "Courses you've finished", ic: "book", make: () => ({ kind: "list", title: "Courses and Training" }) },
  { g: "More sections", id: "languages", label: "Languages", note: "e.g. English (fluent)", ic: "globe", make: () => ({ kind: "list", title: "Languages" }) },
  { g: "More sections", id: "awards", label: "Awards", note: "Prizes, honors and rankings", ic: "award", make: () => ({ kind: "list", title: "Awards" }) },
  { g: "More sections", id: "volunteering", label: "Volunteering", note: "Unpaid roles, with what you did", ic: "heart", make: () => ({ kind: "entries", type: "custom", title: "Volunteering", items: [] }) },
  { g: "More sections", id: "leadership", label: "Leadership and community", note: "Organizing, mentoring, clubs", ic: "users", make: () => ({ kind: "entries", type: "custom", title: "Leadership and Community", items: [] }) },
  { g: "More sections", id: "talks", label: "Publications or talks", note: "Articles, talks and workshops you gave", ic: "mic", make: () => ({ kind: "list", title: "Publications and Talks" }) },
  { g: "More sections", id: "interests", label: "Interests", note: "A short line, optional", ic: "target", make: () => ({ kind: "list", title: "Interests" }) },
  { g: "Your own", id: "ctext", label: "Custom text", note: "A paragraph with your own heading", ic: "note", make: () => ({ kind: "text", title: "Additional", text: "" }) },
  { g: "Your own", id: "clist", label: "Custom list", note: "Short items with your own heading", ic: "check", make: () => ({ kind: "list", title: "Additional" }) },
  { g: "Your own", id: "centries", label: "Custom entries", note: "Entries with name, detail, dates and bullets", ic: "idcard", make: () => ({ kind: "entries", type: "custom", title: "Additional", items: [] }) }
];
function openAddSection() {
  const r = curRes();
  const found = o => o.match ? r.sections.find(o.match) : null;
  const groups = [...new Set(ADD.map(o => o.g))];
  const ai = aiVisible();
  sheet({
    title: "Add a section", sub: `Adds it to "${r.name}". You can rename, move or hide any section later.`, wide: true,
    body: `<div class="form">${groups.map(g => `<fieldset class="as-group"><legend>${g}</legend><div class="as-grid">${ADD.filter(o => o.g === g).map(o => {
        const f = found(o);
        return `<label class="as-opt"><input type="radio" name="as" value="${o.id}" ${o.id === (found(ADD[0]) ? "certs" : "summary") ? "checked" : ""}><span class="as-ic">${icon(o.ic)}</span><span class="as-t"><b>${o.label}</b><span>${o.note}</span>${f ? `<span class="tag ${f.hidden ? "warn" : "good"}">${f.hidden ? "Hidden in this version" : "Already in this version"}</span>` : ""}</span></label>`;
      }).join("")}</div></fieldset>`).join("")}
      <div class="field"><label for="as-t">Section heading</label><input id="as-t" type="text" maxlength="60"></div></div>`,
    foot: `<button class="btn btn-ghost" type="button" data-close>Cancel</button>${ai ? `<button class="btn" type="button" data-ok="ai" hidden>${icon("sparkle", "sm")}Add and write with AI</button>` : ""}<button class="btn btn-primary" type="button" data-ok="add">Add section</button>`,
    onMount: (el, api) => {
      const cur = () => ADD.find(o => o.id === (el.querySelector("input[name=as]:checked") || {}).value) || ADD[0];
      const sync = () => {
        const o = cur(), f = found(o);
        $("#as-t", el).value = o.make().title;
        const okBtn = $('[data-ok="add"]', el), aiBtn = $('[data-ok="ai"]', el);
        okBtn.textContent = f ? (f.hidden ? "Show it" : "Go to it") : "Add section";
        $("#as-t", el).closest(".field").hidden = !!f;
        if (aiBtn) aiBtn.hidden = !o.ai;
      };
      sync();
      el.addEventListener("change", e => { if (e.target.name === "as") sync(); });
      el.addEventListener("click", e => {
        const btn = e.target.closest("[data-ok]"); if (!btn) return;
        const o = cur(), f = found(o);
        let target = f;
        if (f) { if (f.hidden) { f.hidden = false; touch(r); toast(`"${f.title}" is showing again`); } }
        else {
          const base = o.make(), id = uid("s");
          target = { id, hidden: false, ...base, title: $("#as-t", el).value.trim() || base.title };
          if (target.kind === "list") target.items = [{ id: uid("l"), text: "", hidden: false }];
          if (target.kind === "entries") target.items = [{ id: uid("x"), org: "", role: "", loc: "", dates: "", hidden: false, bullets: [{ id: uid("b"), text: "", hidden: false }] }];
          // Summary goes first, Experience right after it; everything else at the end.
          const sumIdx = r.sections.findIndex(ADD[0].match);
          const at = o.id === "summary" ? 0 : o.id === "experience" ? sumIdx + 1 : r.sections.length;
          r.sections.splice(at, 0, target); touch(r);
        }
        tab = "content"; api.close(); bus.render();
        setTimeout(() => {
          const box = target.kind === "entries" && target.items[0] ? document.querySelector(`[data-item-box="${target.items[0].id}"]`) : null;
          if (box && !f) { box.open = true; box.querySelector("input")?.focus(); }
          else document.getElementById(`sec-${target.id}`)?.focus();
          document.getElementById(`sec-${target.id}`)?.scrollIntoView({ block: "center" });
          if (btn.dataset.ok === "ai") (target.kind === "skills" ? openSkills : openSummary)(target.id);
        }, 0);
      });
    }
  });
}

// ---------- Design ----------
export const touchRes = r => touch(r);
function applyPreset(id) {
  if (!PRESETS[id]) return;
  const prev = S.resume.design;
  S.resume.design = { ...presetDesign(id), side: { ...prev.side } }; S.resume.style = id;
  save("resume"); bus.render();
  toast(`${PRESETS[id].label} template`, { action: "Undo", onAction: () => { S.resume.design = prev; S.resume.style = prev.preset; save("resume"); bus.render(); } });
}
const fid = v => String(v).replace(/[^a-z0-9]/gi, "_");
function seg(k, label, opts, cur, name = `rd-${k}`) {
  return `<fieldset class="rd-field"><legend>${label}</legend><div class="seg-ctl">${opts.map(([v, l]) => `<label><input type="radio" id="rd-${k}-${fid(v)}" name="${name}" value="${v}" data-change="rv-design" data-k="${k}" ${String(cur) === String(v) ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></fieldset>`;
}
const toggle = (k, label, on) => `<label class="switch rd-switch"><input type="checkbox" id="rd-${k}" data-change="rv-design" data-k="${k}" ${on ? "checked" : ""}><span>${label}</span></label>`;

function designPanel(res) {
  const d = S.resume.design, edited = !isPreset(d);
  const secs = visible(res);
  const tpl = Object.entries(PRESETS).map(([id, p]) => `<button class="rd-tpl" type="button" data-act="rv-preset" data-id="${id}" aria-pressed="${d.preset === id}">
      <span class="rd-thumb" aria-hidden="true"><span class="rd-thumb-in">${resumeHTML(res, { ...presetDesign(id), side: d.side })}</span></span>
      <b>${p.label}${d.preset === id && edited ? ` <span class="muted small">· edited</span>` : ""}</b><span>${p.note}</span></button>`).join("");
  return `<p class="hint mobile-only">Switch to Preview above to see your changes.</p>
  <section class="card" aria-labelledby="rd-t"><div class="card-h"><h2 id="rd-t">${icon("palette")}Template</h2>${edited ? `<button class="btn btn-sm btn-ghost" type="button" data-act="rv-preset" data-id="${d.preset}">${icon("undo", "sm")}Reset to ${PRESETS[d.preset].label}</button>` : ""}</div>
    <div class="card-b"><div class="rd-tpls">${tpl}</div><p class="hint" style="margin-top:10px">A template sets everything below at once. Your content doesn't change, and the design applies to every version and download.</p></div></section>
  <section class="card" aria-labelledby="rd-l"><div class="card-h"><h2 id="rd-l">${icon("columns")}Layout</h2></div><div class="card-b rd-b">
    ${seg("layout", "Columns", [["one", "One column"], ["left", "Sidebar left"], ["right", "Sidebar right"]], d.layout)}
    ${d.layout !== "one" ? `<p class="hint warn-note">${icon("alert", "sm")}<span>Some screening software reads two columns out of order. Use one column for online applications; two columns work well printed, at events and as a portfolio download.</span></p>
      ${seg("sideWidth", "Sidebar width", SIDE_WIDTHS.map(([v, l]) => [v, `${l} · ${v}%`]), d.sideWidth)}
      <fieldset class="rd-field"><legend>Where each section goes</legend><ul class="rd-sides">${secs.map(s => `<li><span>${esc(s.title)}</span><span class="seg-ctl">${[["main", "Main"], ["side", "Sidebar"]].map(([v, l]) => `<label><input type="radio" id="rd-side-${s.id}-${v}" name="rd-side-${s.id}" value="${v}" data-change="rv-side" data-sec="${s.id}" ${(inSide(d, s) ? "side" : "main") === v ? "checked" : ""}><span>${l}</span><span class="sr-only"> for ${esc(s.title)}</span></label>`).join("")}</span></li>`).join("")}</ul></fieldset>` : ""}
    ${seg("headAlign", "Name and contact", [["left", "Left"], ["center", "Centered"]], d.headAlign)}
    ${seg("dates", "Dates", [["right", "Right edge"], ["inline", "After the title"]], d.dates)}
  </div></section>
  <section class="card" aria-labelledby="rd-x"><div class="card-h"><h2 id="rd-x">${icon("type")}Text</h2></div><div class="card-b rd-b">
    <fieldset class="rd-field"><legend>Font</legend><div class="rd-fonts">${Object.entries(FONTS).map(([k, f]) => `<label class="rd-font"><input type="radio" id="rd-font-${k}" name="rd-font" value="${k}" data-change="rv-design" data-k="font" ${d.font === k ? "checked" : ""}><span class="rd-aa" style="font-family:${esc(f.css)}" aria-hidden="true">Aa</span><b>${f.label}</b><span class="muted small">${f.note}</span></label>`).join("")}</div>
      <p class="hint">Downloads use the same font, and Word opens it as ${esc(FONTS[d.font].word)}.</p></fieldset>
    ${seg("size", "Text size", Object.entries(SIZES).map(([k, v]) => [k, `${v.label} · ${v.pt} pt`]), d.size)}
  </div></section>
  <section class="card" aria-labelledby="rd-s"><div class="card-h"><h2 id="rd-s">${icon("move")}Spacing</h2></div><div class="card-b rd-b">
    ${seg("spacing", "Line and section spacing", Object.entries(SPACING).map(([k, v]) => [k, v.label]), d.spacing)}
    ${seg("margin", "Page margins", MARGINS, d.margin)}
  </div></section>
  <section class="card" aria-labelledby="rd-h"><div class="card-h"><h2 id="rd-h">${icon("edit")}Headings and color</h2></div><div class="card-b rd-b">
    <fieldset class="rd-field"><legend>Section headings</legend><div class="rd-heads">${Object.entries(HEADINGS).map(([k, l]) => `<label class="rd-head"><input type="radio" id="rd-heading-${k}" name="rd-heading" value="${k}" data-change="rv-design" data-k="heading" ${d.heading === k ? "checked" : ""}><span class="rd-hs rd-hs-${k}" style="--a:${d.accent}" aria-hidden="true">${d.upper ? "EXPERIENCE" : "Experience"}</span><b>${l}</b></label>`).join("")}</div></fieldset>
    <fieldset class="rd-field"><legend>Color</legend><div class="rd-swatches">${ACCENTS.map(([hex, name]) => `<label class="rd-sw" title="${name}"><input type="radio" id="rd-accent-${hex.slice(1)}" name="rd-accent" value="${hex}" data-change="rv-design" data-k="accent" ${d.accent.toLowerCase() === hex.toLowerCase() ? "checked" : ""}><span style="background:${hex}" aria-hidden="true"></span><span class="sr-only">${name}</span></label>`).join("")}</div></fieldset>
    <div class="rd-toggles">${toggle("upper", "Headings in capitals", d.upper)}${toggle("nameColor", "Name in color", d.nameColor)}${toggle("headLine", "Line under the header", d.headLine)}</div>
    ${seg("bullet", "Bullets", [["dot", "• Dot"], ["dash", "– Dash"]], d.bullet)}
  </div></section>`;
}

function aiCard(res) {
  if (!aiVisible()) return "";
  const last = S.resume.review && S.resume.review.vid === res.id ? S.resume.review : null;
  return `<section class="card re-ai" aria-labelledby="rai-h"><div class="card-b">
    <h2 id="rai-h" class="re-ai-t">${icon("sparkle")}Get help with AI</h2>
    <p class="small muted">Suggestions use this version and what you tell the app. Check that any numbers or facts in a draft are accurate.</p>
    <div class="re-ai-acts"><button class="btn btn-sm" type="button" data-act="rv-ai-review">${icon("review", "sm")}Review my resume</button>
      <button class="btn btn-sm" type="button" data-act="rv-ai-summary">${icon("file", "sm")}${res.sections.some(s => s.kind === "text" && /summary|profile|about/i.test(s.title) && (s.text || "").trim()) ? "Improve my summary" : "Write my summary"}</button>
      <button class="btn btn-sm" type="button" data-act="rv-ai-fit">${icon("move", "sm")}Fit on one page</button></div>
    ${last ? `<p class="small" style="margin:8px 0 0">Last review ${esc(fmtDate(last.at))}. <button class="link-btn" type="button" data-act="rv-ai-last">Open it</button></p>` : ""}
  </div></section>`;
}

function openQuick() {
  const master = versionById("master");
  sheet({
    title: "Quick resume", sub: "The plain Classic template, filled from your master resume. Check it, then download.", wide: true,
    body: `<div class="quick-prev">${previewBlock(master, { style: "classic", id: "rpq" })}</div>`,
    foot: `<button class="btn btn-ghost" type="button" data-close>Close</button><button class="btn" type="button" data-q="docx">Word (.docx)</button><button class="btn btn-primary" type="button" data-q="pdf">${icon("download", "sm")}Download PDF</button>`,
    onMount: el => {
      setTimeout(() => fitPreviews(el), 30);
      el.addEventListener("click", e => { const b = e.target.closest("[data-q]"); if (b) downloadResume(master, b.dataset.q, "classic"); });
    }
  });
}

function openBulletHelper(d) {
  const r = curRes(), it = item(r, d), b = bullet(r, d); if (!b) return;
  let ctl = null;
  sheet({
    title: "Improve this bullet", sub: "AI rewrites it as problem, action, result. Check any numbers or facts before using the draft.", wide: true,
    body: `<div class="form"><div class="field"><span class="lbl">Now</span><p class="quote">${esc(b.text || "(empty)")}</p></div>
      <div class="field"><label for="bh-n">Anything to add? <span class="muted">(optional; only true details)</span></label><input id="bh-n" type="text" maxlength="300" placeholder="e.g. it was used by the sales team every day"></div>
      <div><button class="btn btn-primary" type="button" data-go>${icon("sparkle", "sm")}Suggest rewrites</button></div><div data-out></div></div>`,
    foot: `<button class="btn btn-ghost" type="button" data-close>Close</button>`,
    onClose: () => ctl && ctl.abort(),
    onMount: (el, api) => {
      const out = $("[data-out]", el);
      $("[data-go]", el).addEventListener("click", async () => {
        out.innerHTML = `<div class="ai-wait" role="status"><div class="spinner" aria-hidden="true"></div><p>Rewriting…</p></div>`;
        ctl = new AbortController();
        try {
          const res = await askJson(`Rewrite one resume bullet for a product designer applying to roles${inPlace()}. ${profileLine()}
Role: ${it.role} at ${it.org} (${it.dates}).
Bullet: "${b.text}"
Extra facts from them (true, may be empty): "${$("#bh-n", el).value.trim()}"
Rules: write it as problem or goal, then what they did, then the result. Start with a strong past-tense verb. One sentence, under 28 words. Never add a number, metric, tool, team size or outcome that isn't in the bullet or their extra facts. Keep the claim the same. If there's no result in the facts, end with the purpose instead of inventing one.
Reply with only JSON: {"options":["...","...","..."]} with 3 options.`, { signal: ctl.signal, tier: "quick" });
          const opts = (Array.isArray(res?.options) ? res.options : []).map(String).map(s => s.trim()).filter(Boolean).slice(0, 3);
          if (!opts.length) throw new Error("No suggestions came back. Try again.");
          out.innerHTML = `<div class="ai-draft"><p class="ai-label">${icon("sparkle", "sm")}Pick one to use. Check that every word is true.</p>${opts.map((o, i) => `<div class="opt-row"><p>${esc(o)}</p><button class="btn btn-sm" type="button" data-use="${i}">Use this</button></div>`).join("")}</div>`;
          out.addEventListener("click", e => {
            const u = e.target.closest("[data-use]"); if (!u) return;
            const prev = b.text; b.text = opts[+u.dataset.use]; touch(r); api.close(); bus.render(); openItem(it.id);
            toast("Bullet updated", { action: "Undo", onAction: () => { b.text = prev; touch(r); bus.render(); openItem(it.id); } });
          });
        } catch (e) { out.innerHTML = e.code === "cancelled" ? "" : `<p class="error" role="alert">${esc(e.message)}</p>`; }
      });
    }
  });
}
