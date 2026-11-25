// Editable checklists with optional "why" and "how" (resume, LinkedIn, case studies, website).

import { S, save } from "./store.js";
import { esc, uid, $ } from "./util.js";
import { icon, sheet, toast, CHECK_SVG } from "./ui.js";
import { bus } from "./bus.js";

// path: "resume.checks", "linkedin.checks", "portfolio.site.pages", "portfolio.site.launch", "case:<id>"
function resolve(path) {
  if (path.startsWith("case:")) {
    const c = S.portfolio.cases.find(x => x.id === path.slice(5));
    return c ? { list: c.checklist, key: "portfolio" } : null;
  }
  const [key, ...rest] = path.split(".");
  let ref = S[key];
  for (const k of rest) ref = ref?.[k];
  return Array.isArray(ref) ? { list: ref, key } : null;
}

export function checklistHTML(path, { expandable = false, empty = "No items yet." } = {}) {
  const r = resolve(path); if (!r) return "";
  const items = r.list, done = items.filter(i => i.done).length;
  return `<div class="chk" data-path="${esc(path)}">
    <div class="chk-top"><span class="small"><b>${done}</b> of ${items.length} done</span><button class="btn btn-sm btn-ghost" type="button" data-act="chk-add" data-path="${esc(path)}">${icon("plus", "sm")}Add item</button></div>
    <div class="meter thin" style="--mc:var(--c-apply);margin:6px 0 10px" role="img" aria-label="${done} of ${items.length} done"><i style="width:${items.length ? (done / items.length) * 100 : 0}%"></i></div>
    ${items.length ? `<ul class="chk-list">${items.map((it, i) => `<li class="chk-item ${it.done ? "is-done" : ""}">
      <span class="check"><input type="checkbox" data-change="chk-toggle" data-path="${esc(path)}" data-id="${it.id}" ${it.done ? "checked" : ""} aria-label="${esc(it.text)}"><span>${CHECK_SVG}</span></span>
      ${expandable && (it.why || it.how) ? `<details><summary>${esc(it.text)}</summary><div class="chk-more">${it.why ? `<p><b>Why:</b> ${esc(it.why)}</p>` : ""}${it.how ? `<p><b>How:</b> ${esc(it.how)}</p>` : ""}</div></details>` : `<span class="chk-text">${esc(it.text)}</span>`}
      <span class="chk-actions">
        <button class="icon-btn sm" type="button" data-act="chk-move" data-path="${esc(path)}" data-id="${it.id}" data-dir="-1" aria-label="Move up: ${esc(it.text)}" ${i === 0 ? "disabled" : ""}>${icon("arrowUp", "sm")}</button>
        <button class="icon-btn sm" type="button" data-act="chk-move" data-path="${esc(path)}" data-id="${it.id}" data-dir="1" aria-label="Move down: ${esc(it.text)}" ${i === items.length - 1 ? "disabled" : ""}>${icon("arrowDown", "sm")}</button>
        <button class="icon-btn sm" type="button" data-act="chk-edit" data-path="${esc(path)}" data-id="${it.id}" aria-label="Edit: ${esc(it.text)}">${icon("edit", "sm")}</button>
      </span></li>`).join("")}</ul>` : `<p class="muted small">${esc(empty)}</p>`}
  </div>`;
}

function editSheet(path, id) {
  const r = resolve(path); if (!r) return;
  const it = id ? r.list.find(x => x.id === id) : null;
  const withWhy = r.list.some(x => "why" in x) || path.endsWith("checks");
  sheet({
    title: it ? "Edit item" : "Add an item", wide: withWhy,
    body: `<form class="form" novalidate>
      <div class="field"><label for="ck-t">Item</label><input id="ck-t" type="text" name="t" value="${esc(it?.text || "")}" maxlength="240"><p class="error" data-err hidden>Write the item.</p></div>
      ${withWhy ? `<div class="field"><label for="ck-w">Why it matters <span class="muted">(optional)</span></label><textarea id="ck-w" name="w" rows="2" maxlength="400">${esc(it?.why || "")}</textarea></div>
      <div class="field"><label for="ck-h">How to do it <span class="muted">(optional)</span></label><textarea id="ck-h" name="h" rows="2" maxlength="400">${esc(it?.how || "")}</textarea></div>` : ""}
      <button type="submit" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">Save</button></form>`,
    foot: `${it ? `<button class="btn btn-danger" type="button" data-del>${icon("trash", "sm")}Delete</button><span class="spacer"></span>` : ""}<button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" data-save>Save</button>`,
    onMount: (el, api) => {
      const form = $("form", el), F = form.elements;
      const doSave = () => {
        const t = F.t.value.trim();
        if (!t) { $("[data-err]", el).hidden = false; F.t.focus(); return; }
        const vals = { text: t, ...(withWhy ? { why: F.w.value.trim(), how: F.h.value.trim() } : {}) };
        if (it) Object.assign(it, vals); else r.list.push({ id: uid("ck"), done: false, ...vals });
        save(r.key); api.close(); bus.render();
      };
      form.addEventListener("submit", e => { e.preventDefault(); doSave(); });
      $("[data-save]", el).addEventListener("click", doSave);
      if (it) $("[data-del]", el).addEventListener("click", () => {
        api.close();
        const i = r.list.indexOf(it); r.list.splice(i, 1); save(r.key); bus.render();
        toast("Item deleted", { action: "Undo", onAction: () => { r.list.splice(i, 0, it); save(r.key); bus.render(); } });
      });
    }
  });
}

export const checklistActions = {
  "chk-add": d => editSheet(d.path, null),
  "chk-edit": d => editSheet(d.path, d.id),
  "chk-move": d => {
    const r = resolve(d.path); if (!r) return;
    const i = r.list.findIndex(x => x.id === d.id), j = i + parseInt(d.dir, 10);
    if (i < 0 || j < 0 || j >= r.list.length) return;
    [r.list[i], r.list[j]] = [r.list[j], r.list[i]];
    save(r.key); bus.render();
    setTimeout(() => document.querySelector(`[data-act="chk-move"][data-id="${d.id}"][data-dir="${d.dir}"]:not([disabled])`)?.focus() || document.querySelector(`[data-act="chk-edit"][data-id="${d.id}"]`)?.focus(), 0);
  }
};
export function toggleCheck(path, id, on) {
  const r = resolve(path); if (!r) return;
  const it = r.list.find(x => x.id === id); if (!it) return;
  it.done = on; save(r.key); bus.render();
}
