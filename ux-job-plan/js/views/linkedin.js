// LinkedIn: profile checklist, drafts with AI suggestions, voice rules and a post planner and log.
// Nothing here posts, connects or messages anyone.

import { S, save } from "../store.js";
import { DOCS } from "../content.js";
import { esc, uid, fmtDate, today, safeUrl, host, daysBetween, $ } from "../util.js";
import { icon, sheet, toast, meter } from "../ui.js";
import { aiVisible, askJson, profileLine } from "../ai.js";
import { copyText } from "./settings.js";
import { checklistHTML } from "../checklist.js";
import { bus } from "../bus.js";
import { writerHTML, mountWriter } from "../post-writer.js";
import { inPlace, cityName, hasCity, getLoc } from "../locale.js";

const PARTS = {
  headline: { label: "Headline", max: 220, rows: 2, hint: "Shows under your name everywhere. Up to 220 characters." },
  about: { label: "About", max: 2600, rows: 9, hint: "Three short paragraphs: what you design, how you work, what you're looking for." },
  skills: { label: "Top skills, in order", max: 600, rows: 3, hint: "One per line. The first few show on your profile and feed recruiter search." },
  featured: { label: "Featured", max: 800, rows: 4, hint: "One item per line: your portfolio, best case study, a live prototype." }
};
const POST_STATUS = { idea: "Idea", draft: "Draft", posted: "Posted" };
let busy = null;     // { part, ctl }
let pending = {};    // part -> AI suggestion waiting for Use or Discard
let aiErr = {};
let ideas = null;    // AI post ideas, not saved until added

const L = () => S.linkedin;
const monthKey = d => (d || "").slice(0, 7);

function postsStats() {
  const posted = L().posts.filter(p => p.status === "posted" && p.date).sort((a, b) => (a.date < b.date ? 1 : -1));
  const month = posted.filter(p => monthKey(p.date) === monthKey(today())).length;
  const last = posted[0];
  return { month, last, since: last ? daysBetween(last.date, today()) : null, total: posted.length };
}

function draftCard(key) {
  const p = PARTS[key], v = L().drafts[key] || "";
  const sug = pending[key];
  const busyHere = busy?.part === key;
  return `<div class="li-part">
    <div class="li-part-h"><label for="ld-${key}"><b>${p.label}</b></label><span class="muted small" data-count="${key}">${v.length.toLocaleString()} / ${p.max.toLocaleString()}</span></div>
    <p class="hint" id="ld-${key}-h">${p.hint}</p>
    <textarea id="ld-${key}" rows="${p.rows}" maxlength="${p.max}" data-change="li-draft" data-k="${key}" aria-describedby="ld-${key}-h">${esc(v)}</textarea>
    <div class="actions">
      ${aiVisible() ? `<button class="btn btn-sm" type="button" data-act="li-suggest" data-k="${key}" ${busy ? "disabled" : ""}>${icon("sparkle", "sm")}${v.trim() ? "Improve with AI" : "Suggest with AI"}</button>` : ""}
      <button class="btn btn-sm btn-ghost" type="button" data-act="li-copy" data-k="${key}" ${v.trim() ? "" : "disabled"}>${icon("copy", "sm")}Copy</button></div>
    ${busyHere ? `<div class="ai-wait" role="status"><div class="spinner" aria-hidden="true"></div><p>Drafting your ${p.label.toLowerCase()}…</p><button class="btn btn-sm" type="button" data-act="li-cancel">Cancel</button></div>` : ""}
    ${aiErr[key] ? `<p class="error" role="alert">${esc(aiErr[key])}</p>` : ""}
    ${sug ? `<div class="ai-draft"><p class="ai-label">${icon("sparkle", "sm")}Suggestion. Check every word is true before you use it.</p>
      ${sug.options ? sug.options.map((o, i) => `<div class="opt-row"><p>${esc(o)}</p><button class="btn btn-sm" type="button" data-act="li-use" data-k="${key}" data-i="${i}">Use this</button></div>`).join("")
        : `<p class="pre">${esc(sug.text)}</p>`}
      ${sug.note ? `<p class="small muted">${esc(sug.note)}</p>` : ""}
      <div class="actions">${sug.options ? "" : `<button class="btn btn-sm btn-primary" type="button" data-act="li-use" data-k="${key}">Use this</button>`}<button class="btn btn-sm btn-ghost" type="button" data-act="li-discard" data-k="${key}">Discard</button></div></div>` : ""}
  </div>`;
}

function postRow(p) {
  const link = safeUrl(p.link);
  return `<li class="post-row">
    <span class="post-date">${p.date ? `<b>${fmtDate(p.date)}</b>` : `<span class="muted">No date</span>`}</span>
    <span class="post-main"><b>${esc(p.topic)}</b><span class="muted small">${POST_STATUS[p.status]}${link ? ` · <a href="${esc(link)}" target="_blank" rel="noopener">${esc(host(link))}${icon("ext", "sm")}</a>` : ""}${p.text ? " · has a draft" : ""}${p.versions?.length ? ` · ${p.versions.length} version${p.versions.length > 1 ? "s" : ""}` : ""}</span></span>
    <span class="actions"><select class="status-sel status-${p.status}" data-change="li-post-status" data-id="${p.id}" aria-label="Status of ${esc(p.topic)}">${Object.entries(POST_STATUS).map(([k, l]) => `<option value="${k}" ${k === p.status ? "selected" : ""}>${l}</option>`).join("")}</select>
      <button class="icon-btn sm boxed" type="button" data-act="li-post-edit" data-id="${p.id}" aria-label="Edit post: ${esc(p.topic)}">${icon("edit", "sm")}</button></span></li>`;
}

export function renderLinkedin() {
  const st = postsStats();
  const upcoming = L().posts.filter(p => p.status !== "posted").sort((a, b) => (a.date || "9") < (b.date || "9") ? -1 : 1);
  const posted = L().posts.filter(p => p.status === "posted").sort((a, b) => (a.date < b.date ? 1 : -1));
  return `<header class="page-h"><div><div class="eyebrow">Materials</div><h1>LinkedIn</h1>
      <p class="lead">Get your profile ready, draft each part, and keep a steady rhythm of posts. This page never posts, connects or messages anyone for you.</p></div>
    <div class="actions">${DOCS.linkedin ? `<a class="btn btn-ghost" href="${DOCS.linkedin}" target="_blank" rel="noopener">${icon("file", "sm")}LinkedIn research</a>` : ""}<a class="btn" href="https://www.linkedin.com/in/me/" target="_blank" rel="noopener">${icon("ext", "sm")}Open my profile</a></div></header>
  <div class="grid-2">
    <section class="card" aria-labelledby="li-chk"><div class="card-h"><h2 id="li-chk">${icon("check")}Profile checklist</h2></div><div class="card-b">${checklistHTML("linkedin.checks", { expandable: true })}</div></section>
    <section class="card" aria-labelledby="li-rhythm"><div class="card-h"><h2 id="li-rhythm">${icon("calendar")}Posting rhythm</h2></div><div class="card-b">
      <div class="li-stats"><div><span class="muted small">This month</span><b class="big-num">${st.month}<small> post${st.month === 1 ? "" : "s"}</small></b></div>
        <div><span class="muted small">Last post</span><b class="big-num">${st.since == null ? "–" : st.since === 0 ? "Today" : `${st.since}<small> day${st.since === 1 ? "" : "s"} ago</small>`}</b></div></div>
      ${meter(st.month, 4, { color: "var(--c-apply)", marker: 2, label: `${st.month} posts this month. Goal: 2 to 4.` })}
      <p class="small muted" style="margin-top:6px">Goal: one post every 1–2 weeks, so 2–4 a month.${st.since != null && st.since > 14 ? ` <b class="warn-text">It's been over two weeks.</b>` : ""}</p>
      <h3 class="h-sm" style="margin-top:16px">Voice rules</h3>
      <ul class="rule-list">${L().rules.map((r, i) => `<li><span>${esc(r)}</span><button class="icon-btn sm danger" type="button" data-act="li-rule-del" data-i="${i}" aria-label="Remove rule: ${esc(r)}">${icon("x", "sm")}</button></li>`).join("")}</ul>
      <form class="rule-add" data-form="li-rule"><label class="sr-only" for="li-rule-in">Add a voice rule</label><input id="li-rule-in" type="text" maxlength="160" placeholder="Add a rule"><button class="btn btn-sm" type="submit">${icon("plus", "sm")}Add</button></form>
      <p class="muted small" style="margin-top:6px">AI drafts follow these rules.</p>
    </div></section>
  </div>
  <section class="card" aria-labelledby="li-drafts"><div class="card-h"><h2 id="li-drafts">${icon("edit")}Drafts</h2><span class="muted small">Saved here as you type. Copy each part into LinkedIn when it's ready.</span></div>
    <div class="card-b li-drafts">${Object.keys(PARTS).map(draftCard).join("")}</div></section>
  <section class="card" aria-labelledby="li-posts"><div class="card-h"><h2 id="li-posts">${icon("note")}Posts</h2>
      <div class="actions">${aiVisible() ? `<button class="btn btn-sm" type="button" data-act="li-ideas" ${busy ? "disabled" : ""}>${icon("sparkle", "sm")}Post ideas</button>` : ""}<button class="btn btn-sm btn-primary" type="button" data-act="li-post-add">${icon("plus", "sm")}Add a post</button></div></div>
    <div class="card-b">
      ${busy?.part === "ideas" ? `<div class="ai-wait" role="status"><div class="spinner" aria-hidden="true"></div><p>Looking at what you've been working on…</p><button class="btn btn-sm" type="button" data-act="li-cancel">Cancel</button></div>` : ""}
      ${aiErr.ideas ? `<p class="error" role="alert">${esc(aiErr.ideas)}</p>` : ""}
      ${ideas ? `<div class="ai-draft"><p class="ai-label">${icon("sparkle", "sm")}Ideas from your current work</p>${ideas.map((d, i) => `<div class="opt-row"><p><b>${esc(d.topic)}</b><br><span class="small muted">${esc(d.angle)}</span></p><button class="btn btn-sm" type="button" data-act="li-idea-add" data-i="${i}" ${d.added ? "disabled" : ""}>${d.added ? "Added" : "Add as idea"}</button></div>`).join("")}
        <div class="actions"><button class="btn btn-sm btn-ghost" type="button" data-act="li-ideas-close">Close ideas</button></div></div>` : ""}
      <h3 class="h-sm">Planned</h3>
      ${upcoming.length ? `<ul class="post-list">${upcoming.map(postRow).join("")}</ul>` : `<p class="muted small">Nothing planned. Add a post idea, or ask for ideas from your recent work.</p>`}
      <h3 class="h-sm" style="margin-top:16px">Posted</h3>
      ${posted.length ? `<ul class="post-list">${posted.map(postRow).join("")}</ul>` : `<p class="muted small">No posts logged yet. When you post, add it here with the date.</p>`}
    </div></section>`;
}

// ---------- AI ----------
function context() {
  const d = L().drafts;
  const doneRes = S.resources.list.filter(r => r.status === "done").slice(-6).map(r => r.title);
  const doing = S.resources.list.filter(r => r.status === "doing").slice(0, 4).map(r => r.title);
  const cases = S.portfolio.cases.filter(c => !c.archived).map(c => `${c.title} (${c.status})`);
  return { d, doneRes, doing, cases };
}
async function suggestPart(key) {
  const p = PARTS[key], cur = L().drafts[key] || "", rules = L().rules.join("; ");
  const ask = {
    headline: `Write 3 LinkedIn headline options, each under 200 characters. Lead with "Product Designer"; add their focus areas. Reply with only JSON: {"options":["","",""]}`,
    about: `Write their LinkedIn About section: three short paragraphs (what they design, how they work, what they're looking for${inPlace()}), under 1,600 characters. Reply with only JSON: {"text":"","note":"one line on what to check"}`,
    skills: `List their top 10 LinkedIn skills in order, most important for product design roles${inPlace()} first, using LinkedIn's standard skill names. Only skills their profile shows. Reply with only JSON: {"text":"one skill per line","note":"one line on why this order"}`,
    featured: `Suggest what to pin in their LinkedIn Featured section, 3 to 4 items, one per line as "Item: why it helps". Use what exists in their portfolio list; for missing items, say what to create. Reply with only JSON: {"text":"","note":""}`
  }[key];
  const { doneRes, cases } = context();
  busy = { part: key, ctl: new AbortController() }; aiErr[key] = ""; delete pending[key]; bus.render();
  const ctl = busy.ctl;
  try {
    const res = await askJson(`You help a product designer write their LinkedIn profile. ${profileLine()}
Case studies they're working on: ${cases.join("; ") || "none yet"}. Recently finished learning: ${doneRes.join("; ") || "none"}.
Their current ${p.label.toLowerCase()} draft: """${cur.slice(0, 2600)}"""
Their voice rules (follow every one): ${rules}.
Never invent employers, numbers, clients, awards or skills. Plain, warm, first person; no buzzwords, no emoji.
${ask}`, { signal: ctl.signal });
    if (key === "headline") {
      const options = (Array.isArray(res?.options) ? res.options : []).map(String).map(s => s.trim().slice(0, p.max)).filter(Boolean).slice(0, 3);
      if (!options.length) throw new Error("No options came back. Try again.");
      pending[key] = { options };
    } else {
      const text = String(res?.text || "").trim().slice(0, p.max);
      if (!text) throw new Error("Nothing came back. Try again.");
      pending[key] = { text, note: String(res?.note || "").slice(0, 200) };
    }
  } catch (e) { if (!ctl.signal.aborted) aiErr[key] = e.message; }
  if (busy?.ctl === ctl) busy = null;
  bus.render();
}
async function postIdeas() {
  const { doneRes, doing, cases } = context();
  const recent = L().posts.slice(0, 8).map(p => p.topic);
  busy = { part: "ideas", ctl: new AbortController() }; aiErr.ideas = ""; bus.render();
  const ctl = busy.ctl;
  try {
    const res = await askJson(`Suggest 5 LinkedIn post ideas for a product designer who is job hunting${inPlace()}. ${profileLine()}
What they're doing now: case studies ${cases.join("; ") || "none"}; learning ${doing.join("; ") || "nothing logged"}; finished ${doneRes.join("; ") || "nothing logged"}.
Recent post topics to avoid repeating: ${recent.join("; ") || "none"}.
Their voice rules: ${L().rules.join("; ")}.
Each idea shares one specific insight from their own work or learning; no generic advice, no humble-bragging, nothing about confidential client details.
Reply with only JSON: {"ideas":[{"topic":"short title","angle":"one sentence on what the post says"}]}`, { signal: ctl.signal, tier: "quick" });
    ideas = (Array.isArray(res?.ideas) ? res.ideas : []).filter(d => d && d.topic).slice(0, 5).map(d => ({ topic: String(d.topic).slice(0, 120), angle: String(d.angle || "").slice(0, 240) }));
    if (!ideas.length) { ideas = null; throw new Error("No ideas came back. Try again."); }
  } catch (e) { if (!ctl.signal.aborted) aiErr.ideas = e.message; }
  if (busy?.ctl === ctl) busy = null;
  bus.render();
}

function openPost(id) {
  const p = id ? L().posts.find(x => x.id === id) : null;
  const d = p || { topic: "", status: "idea", date: "", link: "", text: "", notes: "" };
  // Versions written for this post. A new post keeps them once it's added.
  const versions = p ? (p.versions = Array.isArray(p.versions) ? p.versions : []) : [];
  let writer = null;
  sheet({
    title: p ? "Edit post" : "Add a post", wide: true,
    body: `<form class="form" novalidate>
      <div class="field"><label for="lp-t">Topic</label><input id="lp-t" name="topic" type="text" value="${esc(d.topic)}" maxlength="160"><p class="error" data-err hidden>Add a topic.</p></div>
      <div class="row3">
        <div class="field"><label for="lp-s">Status</label><select id="lp-s" name="status">${Object.entries(POST_STATUS).map(([k, l]) => `<option value="${k}" ${k === d.status ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="field"><label for="lp-d">Date <span class="muted">(planned or posted)</span></label><input id="lp-d" name="date" type="date" value="${esc(d.date)}"></div>
        <div class="field"><label for="lp-l">Link <span class="muted">(once posted)</span></label><input id="lp-l" name="link" type="url" inputmode="url" value="${esc(d.link)}" placeholder="https://"></div>
      </div>
      ${writerHTML()}
      <div class="field"><div class="li-part-h"><label for="lp-x">Draft</label><span class="muted small" data-lp-count></span></div>
        <textarea id="lp-x" name="text" rows="8" maxlength="3000" placeholder="Write it yourself, or use a version from above and edit it here.">${esc(d.text)}</textarea></div>
      <button type="submit" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">Save</button></form>`,
    foot: `${p ? `<button class="btn btn-danger" type="button" data-del>${icon("trash", "sm")}Delete</button><span class="spacer"></span>` : ""}<button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" data-save>${p ? "Save" : "Add post"}</button>`,
    onClose: () => writer && writer.abort(),
    onMount: (el, api) => {
      const form = $("form", el), F = form.elements;
      const count = () => { const n = (F.text.value.trim().match(/\S+/g) || []).length; $("[data-lp-count]", el).textContent = n ? `${n} words` : ""; };
      count(); F.text.addEventListener("input", count);
      writer = mountWriter({
        root: el, versions,
        getTopic: () => F.topic.value.trim(), getDraft: () => F.text.value,
        setDraft: t => { F.text.value = t; count(); if (F.status.value === "idea") F.status.value = "draft"; },
        persist: () => { if (p) save("linkedin"); }
      });
      const doSave = () => {
        const topic = F.topic.value.trim();
        if (!topic) { $("[data-err]", el).hidden = false; F.topic.focus(); return; }
        const vals = { topic, status: F.status.value, date: F.date.value || (F.status.value === "posted" ? today() : ""), link: safeUrl(F.link.value.trim()) || "", text: F.text.value.trim() };
        if (p) Object.assign(p, vals); else L().posts.unshift({ id: uid("p"), notes: "", ...vals, versions });
        save("linkedin"); api.close(); bus.render(); toast(p ? "Post saved" : "Post added");
      };
      form.addEventListener("submit", e => { e.preventDefault(); doSave(); });
      $("[data-save]", el).addEventListener("click", doSave);
      if (p) $("[data-del]", el).addEventListener("click", () => {
        api.close(); const i = L().posts.indexOf(p); L().posts.splice(i, 1); save("linkedin"); bus.render();
        toast("Post deleted", { action: "Undo", onAction: () => { L().posts.splice(i, 0, p); save("linkedin"); bus.render(); } });
      });
    }
  });
}

// ---------- Handlers ----------
export const linkedinInputs = {
  "li-draft": el => {
    const k = el.dataset.k; L().drafts[k] = el.value; save("linkedin");
    const c = document.querySelector(`[data-count="${k}"]`); if (c) c.textContent = `${el.value.length.toLocaleString()} / ${PARTS[k].max.toLocaleString()}`;
  }
};
export const linkedinChanges = {
  "li-post-status": el => {
    const p = L().posts.find(x => x.id === el.dataset.id); if (!p) return;
    p.status = el.value; if (p.status === "posted" && !p.date) p.date = today();
    save("linkedin"); bus.render(); if (p.status === "posted") toast("Logged as posted");
  }
};
export const linkedinSubmit = {
  "li-rule": form => { const inp = form.querySelector("input"), t = inp.value.trim(); if (!t) return; L().rules.push(t); save("linkedin"); bus.render(); setTimeout(() => document.getElementById("li-rule-in")?.focus(), 0); }
};
export const linkedinActions = {
  "li-suggest": d => suggestPart(d.k),
  "li-cancel": () => { busy?.ctl.abort(); busy = null; bus.render(); },
  "li-copy": d => copyText(L().drafts[d.k] || ""),
  "li-use": d => {
    const sug = pending[d.k]; if (!sug) return;
    const prev = L().drafts[d.k];
    L().drafts[d.k] = sug.options ? sug.options[+d.i] : sug.text;
    delete pending[d.k]; save("linkedin"); bus.render();
    toast(`${PARTS[d.k].label} updated`, { action: "Undo", onAction: () => { L().drafts[d.k] = prev; save("linkedin"); bus.render(); } });
  },
  "li-discard": d => { delete pending[d.k]; bus.render(); },
  "li-ideas": () => postIdeas(),
  "li-ideas-close": () => { ideas = null; bus.render(); },
  "li-idea-add": d => {
    const idea = ideas?.[+d.i]; if (!idea || idea.added) return;
    L().posts.unshift({ id: uid("p"), topic: idea.topic, status: "idea", date: "", link: "", text: idea.angle, notes: "" });
    idea.added = true; save("linkedin"); bus.render(); toast("Added to planned posts");
  },
  "li-post-add": () => openPost(null),
  "li-post-edit": d => openPost(d.id),
  "li-rule-del": d => {
    const i = +d.i, [r] = L().rules.splice(i, 1); save("linkedin"); bus.render();
    toast("Rule removed", { action: "Undo", onAction: () => { L().rules.splice(i, 0, r); save("linkedin"); bus.render(); } });
  }
};
