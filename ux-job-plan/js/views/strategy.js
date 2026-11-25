// Strategy & networking: target companies in tiers, weekly goals, contacts, referral asks,
// message templates, local design communities, agencies and hints from your own numbers.

import { S, save, saveNow } from "../store.js";
import { L } from "../content.js";
import { TIERS, V1_SHARES, RESEARCH_SHARES, GOAL_DEFAULT, AGENCIES, CONTRACT_NOTE, WARM_NETWORK, HOW_TO_APPLY, whereToFind, EVENTS_TIP, TEMPLATES, CONTACT_HOW, REF_STATUS } from "../content4.js";
import { esc, uid, today, fmtDate, relDay, safeUrl, host, toCsv, sum, $ } from "../util.js";
import { icon, sheet, toast, confirmSheet, meter, groupedBars } from "../ui.js";
import * as M from "../model.js";
import * as A from "../model4.js";
import { openCompany } from "./interview.js";
import { openEventSheet } from "../forms.js";
import { saveFile, copyText } from "./settings.js";
import { bus } from "../bus.js";
import { inPlace, cityName, hasCity, getLoc } from "../locale.js";

const UI = { q: "", tier: "", showAll: false };
const extLink = (u, l) => { const s = safeUrl(u); return s ? `<a href="${esc(s)}" target="_blank" rel="noopener">${esc(l || host(s))}${icon("ext", "sm")}</a>` : ""; };
const dueTag = d => (!d ? "" : d < today() ? `<span class="tag bad">${icon("alert", "sm")}Overdue · ${relDay(d)}</span>` : d === today() ? `<span class="tag warn">Today</span>` : `<span class="tag">${relDay(d)}</span>`);

// ---------- Hints ----------
function hintsCard() {
  const hs = A.hints();
  const off = S.strategy.hintsOff.length;
  return `<section class="card" aria-labelledby="sg-h"><div class="card-h"><h2 id="sg-h">${icon("sparkle")}Hints from your numbers</h2>${off ? `<button class="link-btn small" type="button" data-act="sg-hints-reset">Show ${off} hidden</button>` : ""}</div><div class="card-b">
    ${hs.length ? `<ul class="hint-list">${hs.map(h => `<li class="${h.level}">${icon(h.level === "warn" ? "alert" : "info", "sm")}<span>${esc(h.text)}</span><button class="icon-btn sm" type="button" data-act="sg-hint-off" data-k="${h.key}" aria-label="Hide this hint">${icon("x", "sm")}</button></li>`).join("")}</ul>`
      : `<p class="muted small">Nothing to flag right now. Hints appear from your own numbers, for example no replies after 20 applications, or screens without portfolio rounds.</p>`}
  </div></section>`;
}

// ---------- Weekly goals ----------
function goalsCard() {
  const n = M.currentWeek(), wc = A.weekCounts(n), fa = A.fastApply();
  const g = S.strategy.goals;
  const rows = [["apps", "Applications", "var(--c-apply)", "#applications"], ["chats", "Coffee chats", "var(--c-learn)", ""], ["events", "Events", "var(--c-build)", ""], ["refs", "Referral asks", "var(--c-practice)", ""]];
  return `<section class="card" aria-labelledby="sg-g"><div class="card-h"><h2 id="sg-g">${icon("target")}This week's goals</h2><span class="sub">Week ${n}</span></div><div class="card-b">
    <div class="goal-rows">${rows.map(([k, l, c, href]) => { const v = wc[k], t = wc.goal[k]; return `<div class="goal-row"><span class="gl">${href ? `<a href="${href}">${l}</a>` : l}</span>${meter(v, Math.max(t, v, 1), { color: c, marker: t || null, label: `${l}: ${v} of ${t}` })}<b class="gv">${v}<small> / ${t}</small></b>${t && v >= t ? `<span class="tag good">${icon("check", "sm")}Done</span>` : ""}</div>`; }).join("")}</div>
    <p class="small muted" style="margin-top:8px">Coffee chats and events count when you mark them attended in Events. Each plan week sets its own goals: none in Weeks 1–2 while you build the target list, 4 applications a week until your portfolio is live, 3 over the holidays, then ${g.apps}.</p>
    ${fa.n ? `<p class="small"><b>${fa.fast} of ${fa.n}</b> applications went in within a day of the posting date. Contract roles fill within a day, so set alerts and apply fast.</p>` : `<p class="small muted">Log a posting date on applications to see how often you apply within 24 hours.</p>`}
    <details class="pr-ctx"><summary>Change the full-pace goals</summary><div class="row4" style="margin-top:8px">${rows.map(([k, l]) => `<div class="field"><label for="sg-g-${k}">${l}</label><input id="sg-g-${k}" type="number" min="0" max="40" step="1" inputmode="numeric" value="${g[k]}" data-change="sg-goal" data-k="${k}"></div>`).join("")}</div>
      <button class="link-btn small" type="button" data-act="sg-goal-reset">Back to the plan's targets (${GOAL_DEFAULT.apps} applications, ${GOAL_DEFAULT.chats} chats, ${GOAL_DEFAULT.events} event, ${GOAL_DEFAULT.refs} referral asks, about 9–10 hours a week)</button></details>
  </div></section>`;
}

// ---------- Target companies ----------
function sharesCard() {
  const ts = A.tierShares(), total = sum(ts, t => t.n);
  const sh = S.strategy.shares, shTotal = sum(Object.values(sh).map(Number));
  return `<section class="card" aria-labelledby="sg-t"><div class="card-h"><h2 id="sg-t">${icon("compass")}Tiers and your mix</h2></div><div class="card-b">
    <div class="scroll-x"><table class="loop-t"><thead><tr><th scope="col">Tier</th><th scope="col">Titles to search</th><th scope="col">Target share</th></tr></thead><tbody>
      ${Object.entries(TIERS).map(([k, t]) => `<tr><th scope="row"><i class="dot" style="--c:${t.color}"></i> ${t.short} · ${t.name}</th><td>${esc(t.titles)}</td><td><label class="sr-only" for="sg-sh-${k}">${t.short} share</label><input id="sg-sh-${k}" type="number" min="0" max="100" step="5" inputmode="numeric" value="${sh[k]}" data-change="sg-share" data-k="${k}" style="width:76px"> %</td></tr>`).join("")}</tbody></table></div>
    ${shTotal !== 100 ? `<p class="small warn-text">The shares add up to ${shTotal}%, not 100%.</p>` : ""}
    <div class="actions" style="margin:8px 0 12px"><button class="btn btn-sm" type="button" data-act="sg-share-set" data-k="v1">v1 split (40 / 30 / 30)</button><button class="btn btn-sm" type="button" data-act="sg-share-set" data-k="research">Research mix (20 / 45 / 35)</button></div>
    <p class="small muted">With 0–3 years of experience, mid-size product companies and agency contracts are often the quickest way in, with big tech as the next step: big tech's plain titles usually ask for 4–5+ years.</p>
    <h3 class="h-sm" style="margin-top:12px">Target vs. what you've sent</h3>
    ${total ? groupedBars(ts.map(t => ({ label: TIERS[t.tier].short, a: t.target, b: Math.round(t.share), color: TIERS[t.tier].color })), { aLabel: "Target", bLabel: "Sent", unit: "%", label: ts.map(t => `${TIERS[t.tier].short}: target ${t.target}%, sent ${Math.round(t.share)}%`).join("; ") })
      : `<p class="small muted">Shows once you've sent applications with a tier.</p>`}
  </div></section>`;
}
function targetsCard() {
  const q = UI.q.trim().toLowerCase();
  const list = S.companies.list.filter(c => (UI.showAll || c.target) && (!UI.tier || c.tier === UI.tier) && (!q || c.name.toLowerCase().includes(q)))
    .sort((a, b) => a.tier.localeCompare(b.tier) || a.name.localeCompare(b.name));
  const nTarget = S.companies.list.filter(c => c.target).length;
  const byTier = Object.keys(TIERS).map(k => S.companies.list.filter(c => c.target && c.tier === k).length);
  return `<section class="card" aria-labelledby="sg-co"><div class="card-h"><h2 id="sg-co">${icon("briefcase")}Target companies</h2><span class="sub">${nTarget} on your list · ${byTier.map((n, i) => `${TIERS[i + 1].short} ${n}`).join(", ")}</span>
      <button class="btn btn-sm btn-primary" type="button" data-act="sg-co-add">${icon("plus", "sm")}Add company</button></div><div class="card-b">
    <div class="filters" role="group" aria-label="Filter companies"><label class="sr-only" for="sg-q">Search</label><input id="sg-q" type="search" placeholder="Search companies" value="${esc(UI.q)}" data-change="sg-q">
      <label class="sr-only" for="sg-ti">Tier</label><select id="sg-ti" data-change="sg-ui" data-k="tier"><option value="">All tiers</option>${Object.entries(TIERS).map(([k, t]) => `<option value="${k}" ${UI.tier === k ? "selected" : ""}>${t.short}</option>`).join("")}</select>
      <label class="check-inline"><input type="checkbox" data-change="sg-ui-all" ${UI.showAll ? "checked" : ""}> Include companies not on my list</label></div>
    ${list.length ? Object.entries(TIERS).map(([k, t]) => { const g = list.filter(c => c.tier === k); return g.length ? `<h3 class="h-sm tg-h"><i class="dot" style="--c:${t.color}"></i>${t.short} · ${t.name} <span class="muted">${g.length}</span></h3><ul class="tg-list">${g.map(c => {
      const apps = A.appsFor(c), cts = A.contactsFor(c);
      return `<li class="${c.target ? "" : "off"}"><div class="tg-main"><b>${esc(c.name)}</b>${c.loop ? ` <a class="tag info" href="#interview-loops" aria-label="${esc(c.name)} interview loop">Loop</a>` : ""}${c.target ? "" : ` <span class="tag">Not on list</span>`}
          <div class="small muted">${[c.careers ? extLink(c.careers, "Careers") : "", apps.length ? `Applied: ${apps.map(a => esc(a.status)).join(", ")}` : "Not applied", cts.length ? `Contact: ${cts.map(x => esc(x.name)).join(", ")}` : c.contact ? `Contact: ${esc(c.contact)}` : ""].filter(Boolean).join(" · ")}${c.fit ? ` · ${esc(c.fit)}` : ""}</div></div>
        <div class="tg-next"><label class="sr-only" for="tg-n-${c.id}">Next step at ${esc(c.name)}</label><input id="tg-n-${c.id}" type="text" value="${esc(c.next)}" maxlength="140" placeholder="Next step" data-change="sg-co-f" data-id="${c.id}" data-f="next">
          <label class="sr-only" for="tg-d-${c.id}">Due date for ${esc(c.name)}</label><input id="tg-d-${c.id}" type="date" value="${esc(c.nextDate)}" data-change="sg-co-f" data-id="${c.id}" data-f="nextDate"></div>
        <span class="actions">${c.next && c.nextDate && c.nextDate <= today() ? dueTag(c.nextDate) : ""}<button class="icon-btn sm boxed" type="button" data-act="sg-co-edit" data-id="${c.id}" aria-label="Edit ${esc(c.name)}">${icon("edit", "sm")}</button>
          <button class="icon-btn sm boxed" type="button" data-act="sg-co-target" data-id="${c.id}" aria-label="${c.target ? `Remove ${esc(c.name)} from my list` : `Add ${esc(c.name)} to my list`}" data-tip="${c.target ? "Remove from my list" : "Add to my list"}">${icon(c.target ? "x" : "plus", "sm")}</button></span></li>`;
    }).join("")}</ul>` : ""; }).join("") : `<p class="muted">No companies match.</p>`}
  </div></section>`;
}

// ---------- Contacts and referrals ----------
function contactsCard() {
  const cs = S.network.contacts.slice().sort((a, b) => (a.nextDate || "9999") < (b.nextDate || "9999") ? -1 : 1);
  return `<section class="card" aria-labelledby="sg-ct"><div class="card-h"><h2 id="sg-ct">${icon("idcard")}Contacts</h2><span class="sub">${cs.length}</span>
      <div class="actions"><button class="btn btn-sm" type="button" data-act="sg-csv" ${cs.length ? "" : "disabled"}>${icon("download", "sm")}CSV</button><button class="btn btn-sm btn-primary" type="button" data-act="sg-ct-add">${icon("plus", "sm")}Add contact</button></div></div><div class="card-b">
    ${cs.length ? `<ul class="ct-list">${cs.map(c => `<li><div class="ct-main"><b>${esc(c.name)}</b>${c.company ? ` · ${esc(c.company)}` : ""}<div class="small muted">${[c.how, c.last ? `last contact ${fmtDate(c.last)}` : "", c.linkedin ? extLink(c.linkedin, "LinkedIn") : ""].filter(Boolean).join(" · ")}</div>
        ${c.next ? `<div class="small">${icon("flag", "sm")}${esc(c.next)} ${dueTag(c.nextDate)}</div>` : ""}</div>
      <span class="actions"><button class="btn btn-sm" type="button" data-act="sg-ct-chat" data-id="${c.id}">Log chat today</button><button class="icon-btn sm boxed" type="button" data-act="sg-ct-edit" data-id="${c.id}" aria-label="Edit ${esc(c.name)}">${icon("edit", "sm")}</button></span></li>`).join("")}</ul>`
      : `<p class="muted small">People you've met or want to talk to. Add a next step and a date, and the follow-up shows on Overview when it's due. Nothing here sends messages.</p>`}
  </div></section>`;
}
function referralsCard() {
  const rs = S.network.referrals.slice().sort((a, b) => (a.date || "9") < (b.date || "9") ? 1 : -1);
  return `<section class="card" aria-labelledby="sg-rf"><div class="card-h"><h2 id="sg-rf">${icon("send")}Referral asks</h2><span class="sub">${rs.filter(r => r.status === "referred").length} referred</span>
      <button class="btn btn-sm btn-primary" type="button" data-act="sg-rf-add">${icon("plus", "sm")}Add</button></div><div class="card-b">
    <p class="small muted">Referrals are reported to reach interviews at 30–50%, far above cold applications. Ask on every big-tech application where you know someone.</p>
    ${rs.length ? `<ul class="ct-list">${rs.map(r => `<li><div class="ct-main"><b>${esc(r.company)}</b>${r.person ? ` · ${esc(r.person)}` : ""}<div class="small muted">${r.date ? `Asked ${fmtDate(r.date)}` : "Not asked yet"}${r.notes ? ` · ${esc(r.notes)}` : ""}</div></div>
      <span class="actions"><label class="sr-only" for="rf-s-${r.id}">Status for ${esc(r.company)}</label><select id="rf-s-${r.id}" class="status-sel" data-change="sg-rf-status" data-id="${r.id}">${Object.entries(REF_STATUS).map(([k, l]) => `<option value="${k}" ${k === r.status ? "selected" : ""}>${l}</option>`).join("")}</select>
        <button class="icon-btn sm boxed" type="button" data-act="sg-rf-edit" data-id="${r.id}" aria-label="Edit referral ask at ${esc(r.company)}">${icon("edit", "sm")}</button></span></li>`).join("")}</ul>` : `<p class="muted small">No referral asks yet.</p>`}
  </div></section>`;
}

// ---------- Templates, communities, reference ----------
function templatesCard() {
  return `<section class="card" aria-labelledby="sg-tp"><div class="card-h"><h2 id="sg-tp">${icon("note")}Message templates</h2><button class="btn btn-sm" type="button" data-act="sg-tp-add">${icon("plus", "sm")}Add template</button></div><div class="card-b">
    <p class="small muted">Three sentences works best: who you are, why them, a small ask. Replace the [brackets] before sending. Many hiring posts say “No DMs, apply at the link”: apply first, then comment thoughtfully.</p>
    <div class="tp-list">${S.network.templates.map(t => { const b = TEMPLATES.find(x => x.id === t.id); return `<div class="tp"><div class="li-part-h">${b ? `<label for="tp-${t.id}"><b>${esc(t.name)}</b></label>` : `<label class="sr-only" for="tpn-${t.id}">Template name</label><input id="tpn-${t.id}" class="tp-name" type="text" value="${esc(t.name)}" maxlength="60" data-change="sg-tp-name" data-id="${t.id}">`}
      <span class="actions"><button class="btn btn-sm" type="button" data-act="sg-tp-copy" data-id="${t.id}">${icon("copy", "sm")}Copy</button>${b ? (b.text !== t.text ? `<button class="btn btn-sm btn-ghost" type="button" data-act="sg-tp-reset" data-id="${t.id}">Reset</button>` : "") : `<button class="icon-btn sm danger" type="button" data-act="sg-tp-del" data-id="${t.id}" aria-label="Delete ${esc(t.name)} template">${icon("trash", "sm")}</button>`}</span></div>
      <textarea id="tp-${t.id}" rows="4" maxlength="2000" data-change="sg-tp" data-id="${t.id}">${esc(t.text)}</textarea></div>`; }).join("")}</div>
  </div></section>`;
}
function communitiesCard() {
  const evs = S.events.list;
  return `<section class="card" aria-labelledby="sg-cm"><div class="card-h"><h2 id="sg-cm">${icon("flag")}${hasCity() ? `${esc(cityName())} design communities` : "Design communities"}</h2><span class="sub">One event and two coffee chats a week</span></div><div class="card-b">
    <p class="small muted">${esc(EVENTS_TIP)}</p>
    <ul class="cm-list">${S.strategy.communities.map(c => {
      const mine = evs.filter(e => e.group === c.id);
      const went = mine.filter(e => e.status === "attended").length;
      const next = mine.filter(e => e.date >= today() && e.status !== "skipped").sort((a, b) => (a.date < b.date ? -1 : 1))[0];
      return `<li><div><b>${esc(c.name)}</b> ${extLink(c.u, host(c.u))}<div class="small muted">${esc(c.desc)}</div>
        <div class="small">${went ? `Attended ${went}` : "Not attended yet"}${next ? ` · Next: <b>${esc(next.name)}</b>, ${relDay(next.date)}` : ""}</div></div>
        <button class="btn btn-sm" type="button" data-act="sg-cm-event" data-id="${c.id}">${icon("plus", "sm")}Event</button></li>`;
    }).join("")}</ul>
  </div></section>`;
}
function referenceCards() {
  return `<div class="grid-2">
    <section class="card" aria-labelledby="sg-wn"><div class="card-h"><h2 id="sg-wn">${icon("idcard")}Start with your warm network</h2></div><div class="card-b">
      <ul class="plain">${WARM_NETWORK.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <p class="small muted">From the LinkedIn research, Nov 14, 2026. Add people as contacts when you decide to reach out.</p></div></section>
    <section class="card" aria-labelledby="sg-ag"><div class="card-h"><h2 id="sg-ag">${icon("briefcase")}Agencies and contract roles</h2></div><div class="card-b">
      <ul class="plain">${AGENCIES.map(a => `<li><b>${extLink(a.u, a.name)}</b> ${esc(a.note)}</li>`).join("")}</ul>
      <p class="small">${esc(CONTRACT_NOTE)}</p></div></section>
  </div>
  <details class="card fold"><summary class="card-h"><h2>${icon("book")}How to apply well, and where to find roles</h2></summary><div class="card-b grid-2 in">
    <div><h3 class="h-sm">How to apply well</h3><ol class="plain-ol">${HOW_TO_APPLY.map(x => `<li>${esc(x)}</li>`).join("")}</ol></div>
    <div><h3 class="h-sm">Where to find roles</h3><ul class="plain">${whereToFind().map(x => `<li>${extLink(x.u, x.l)}</li>`).join("")}</ul>
      <p class="small muted">Set LinkedIn alerts for “product designer” and “UX designer”${esc(hasCity() ? ` in ${cityName()}` : "")}, plus contract agency postings.</p></div></div></details>`;
}

export function renderStrategy() {
  return `<header class="page-h"><div><div class="eyebrow">Land the job</div><h1>Strategy & networking</h1>
      <p class="lead">Apply across three tiers at once, keep a weekly rhythm of applications, coffee chats and events, and follow up on time. Nothing here messages or connects with anyone for you.</p></div></header>
  <div class="grid-2">${hintsCard()}${goalsCard()}</div>
  ${sharesCard()}
  ${targetsCard()}
  <div class="grid-2">${contactsCard()}${referralsCard()}</div>
  ${communitiesCard()}
  ${templatesCard()}
  ${referenceCards()}`;
}

// ---------- Sheets ----------
function openContact(id) {
  const c = id ? S.network.contacts.find(x => x.id === id) : null;
  const d = c || { name: "", company: "", how: "Coffee chat", linkedin: "", last: "", next: "", nextDate: "", notes: "" };
  sheet({
    title: c ? `Edit ${c.name}` : "Add a contact", wide: true,
    body: `<form class="form" novalidate><datalist id="sg-cos">${S.companies.list.map(x => `<option value="${esc(x.name)}"></option>`).join("")}</datalist>
      <div class="row3"><div class="field"><label for="ct-n">Name</label><input id="ct-n" name="name" type="text" value="${esc(d.name)}" maxlength="100"><p class="error" data-err hidden>Add a name.</p></div>
        <div class="field"><label for="ct-c">Company</label><input id="ct-c" name="company" type="text" list="sg-cos" value="${esc(d.company)}" maxlength="100"></div>
        <div class="field"><label for="ct-h">How you met</label><select id="ct-h" name="how">${CONTACT_HOW.map(h => `<option ${h === d.how ? "selected" : ""}>${h}</option>`).join("")}</select></div>
        <div class="field"><label for="ct-l">Last contact</label><input id="ct-l" name="last" type="date" value="${esc(d.last)}"></div>
        <div class="field"><label for="ct-x">Next step</label><input id="ct-x" name="next" type="text" value="${esc(d.next)}" maxlength="140" placeholder="e.g. Send a thank-you"></div>
        <div class="field"><label for="ct-d">Due</label><input id="ct-d" name="nextDate" type="date" value="${esc(d.nextDate)}"></div></div>
      <div class="field"><label for="ct-li">LinkedIn profile <span class="muted">(optional)</span></label><input id="ct-li" name="linkedin" type="url" value="${esc(d.linkedin)}" placeholder="https://www.linkedin.com/in/…"></div>
      <div class="field"><label for="ct-no">Notes</label><textarea id="ct-no" name="notes" rows="3" maxlength="2000" placeholder="What you talked about, what they suggested">${esc(d.notes)}</textarea></div>
      <button type="submit" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">Save</button></form>`,
    foot: `${c ? `<button class="btn btn-danger" type="button" data-del>${icon("trash", "sm")}Delete</button><span class="spacer"></span>` : ""}<button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" data-save>${c ? "Save" : "Add contact"}</button>`,
    onMount: (el, api) => {
      const form = $("form", el), E = form.elements;
      const doSave = () => {
        const name = E.name.value.trim(); if (!name) { $("[data-err]", el).hidden = false; E.name.focus(); return; }
        const company = E.company.value.trim(), co = company ? A.companyByName(company) : null;
        const vals = { name, company, companyId: co?.id || "", how: E.how.value, last: E.last.value, next: E.next.value.trim(), nextDate: E.nextDate.value, linkedin: safeUrl(E.linkedin.value.trim()) || "", notes: E.notes.value.trim() };
        if (c) Object.assign(c, vals); else S.network.contacts.push({ id: uid("ct"), ...vals });
        save("network"); api.close(); bus.render(); toast(c ? "Contact saved" : "Contact added");
      };
      form.addEventListener("submit", e => { e.preventDefault(); doSave(); });
      $("[data-save]", el).addEventListener("click", doSave);
      if (c) $("[data-del]", el).addEventListener("click", () => {
        api.close(); const i = S.network.contacts.indexOf(c); S.network.contacts.splice(i, 1); save("network"); bus.render();
        toast("Contact deleted", { action: "Undo", onAction: () => { S.network.contacts.splice(i, 0, c); save("network"); bus.render(); } });
      });
    }
  });
}
function openReferral(id) {
  const r = id ? S.network.referrals.find(x => x.id === id) : null;
  const d = r || { company: "", person: "", status: "toask", date: "", notes: "", appId: "" };
  sheet({
    title: r ? "Edit referral ask" : "Add a referral ask",
    body: `<form class="form" novalidate><datalist id="rf-cos">${S.companies.list.map(x => `<option value="${esc(x.name)}"></option>`).join("")}</datalist>
      <div class="row2"><div class="field"><label for="rf-c">Company</label><input id="rf-c" name="company" type="text" list="rf-cos" value="${esc(d.company)}" maxlength="100"><p class="error" data-err hidden>Add the company.</p></div>
        <div class="field"><label for="rf-p">Person</label><input id="rf-p" name="person" type="text" list="rf-people" value="${esc(d.person)}" maxlength="100"><datalist id="rf-people">${S.network.contacts.map(x => `<option value="${esc(x.name)}"></option>`).join("")}</datalist></div>
        <div class="field"><label for="rf-s">Status</label><select id="rf-s" name="status">${Object.entries(REF_STATUS).map(([k, l]) => `<option value="${k}" ${k === d.status ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="field"><label for="rf-d">Date asked</label><input id="rf-d" name="date" type="date" value="${esc(d.date)}"></div></div>
      <div class="field"><label for="rf-a">Application <span class="muted">(optional)</span></label><select id="rf-a" name="appId"><option value="">None</option>${S.apps.list.map(a => `<option value="${a.id}" ${a.id === d.appId ? "selected" : ""}>${esc(a.company)} · ${esc(a.role)}</option>`).join("")}</select></div>
      <div class="field"><label for="rf-n">Notes</label><textarea id="rf-n" name="notes" rows="2" maxlength="800">${esc(d.notes)}</textarea></div>
      <button type="submit" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">Save</button></form>`,
    foot: `${r ? `<button class="btn btn-danger" type="button" data-del>${icon("trash", "sm")}Delete</button><span class="spacer"></span>` : ""}<button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" data-save>${r ? "Save" : "Add"}</button>`,
    onMount: (el, api) => {
      const form = $("form", el), E = form.elements;
      const doSave = () => {
        const company = E.company.value.trim(); if (!company) { $("[data-err]", el).hidden = false; E.company.focus(); return; }
        const status = E.status.value;
        const vals = { company, person: E.person.value.trim(), status, date: E.date.value || (status !== "toask" ? today() : ""), notes: E.notes.value.trim(), appId: E.appId.value };
        if (r) Object.assign(r, vals); else S.network.referrals.push({ id: uid("rf"), followed: false, ...vals });
        if (vals.appId && vals.person) { const a = A.appById(vals.appId); if (a && !a.referral) { a.referral = vals.person; save("apps"); } }
        save("network"); api.close(); bus.render(); toast(r ? "Saved" : "Referral ask added");
      };
      form.addEventListener("submit", e => { e.preventDefault(); doSave(); });
      $("[data-save]", el).addEventListener("click", doSave);
      if (r) $("[data-del]", el).addEventListener("click", () => {
        api.close(); const i = S.network.referrals.indexOf(r); S.network.referrals.splice(i, 1); save("network"); bus.render();
        toast("Deleted", { action: "Undo", onAction: () => { S.network.referrals.splice(i, 0, r); save("network"); bus.render(); } });
      });
    }
  });
}

// ---------- Handlers ----------
export const strategyActions = {
  "sg-hint-off": d => { if (!S.strategy.hintsOff.includes(d.k)) S.strategy.hintsOff.push(d.k); save("strategy"); bus.render(); },
  "sg-hints-reset": () => { S.strategy.hintsOff = []; save("strategy"); bus.render(); },
  "sg-goal-reset": () => { S.strategy.goals = { ...GOAL_DEFAULT }; save("strategy"); bus.render(); toast("Goals reset to the plan's targets"); },
  "sg-share-set": d => { S.strategy.shares = { ...(d.k === "v1" ? V1_SHARES : RESEARCH_SHARES) }; save("strategy"); bus.render(); },
  "sg-co-add": () => openCompany(null),
  "sg-co-edit": d => openCompany(d.id),
  "sg-co-target": d => { const c = A.companyById(d.id); if (!c) return; c.target = !c.target; save("companies"); bus.render(); toast(c.target ? `${c.name} added to your list` : `${c.name} removed from your list`); },
  "sg-ct-add": () => openContact(null),
  "sg-ct-edit": d => openContact(d.id),
  "sg-ct-chat": d => {
    const c = S.network.contacts.find(x => x.id === d.id); if (!c) return;
    const prev = c.last; c.last = today();
    const ev = { id: uid("e"), name: `Coffee chat: ${c.name}`, type: "Coffee chat", date: today(), time: "", location: c.company || "", link: "", notes: "", status: "attended", contactId: c.id };
    S.events.list.push(ev); save("events"); save("network"); bus.render();
    toast("Coffee chat logged for today", { action: "Undo", onAction: () => { c.last = prev; S.events.list = S.events.list.filter(e => e !== ev); save("events"); save("network"); bus.render(); } });
  },
  "sg-rf-add": () => openReferral(null),
  "sg-rf-edit": d => openReferral(d.id),
  "sg-csv": () => saveFile(`ux-job-plan-contacts-${today()}.csv`, toCsv(S.network.contacts, [
    { label: "Name", get: c => c.name }, { label: "Company", get: c => c.company }, { label: "How met", get: c => c.how }, { label: "Last contact", get: c => c.last },
    { label: "Next step", get: c => c.next }, { label: "Next date", get: c => c.nextDate }, { label: "LinkedIn", get: c => c.linkedin }, { label: "Notes", get: c => c.notes }]), "text/csv"),
  "sg-tp-copy": d => { const t = S.network.templates.find(x => x.id === d.id); if (t) copyText(t.text); },
  "sg-tp-reset": d => { const t = S.network.templates.find(x => x.id === d.id), b = TEMPLATES.find(x => x.id === d.id); if (t && b) { t.text = b.text; save("network"); bus.render(); } },
  "sg-tp-add": () => { S.network.templates.push({ id: uid("tp"), name: "My template", text: "" }); save("network"); bus.render(); setTimeout(() => { const all = document.querySelectorAll(".tp textarea"); all[all.length - 1]?.focus(); }, 0); },
  "sg-tp-del": d => {
    const i = S.network.templates.findIndex(x => x.id === d.id); if (i < 0) return;
    const [t] = S.network.templates.splice(i, 1); save("network"); bus.render();
    toast("Template deleted", { action: "Undo", onAction: () => { S.network.templates.splice(i, 0, t); save("network"); bus.render(); } });
  },
  "sg-cm-event": d => { const c = S.strategy.communities.find(x => x.id === d.id); if (c) openEventSheet({ prefill: { name: c.name, type: "Meetup", group: c.id, link: c.u } }); }
};
export const strategyChanges = {
  "sg-goal": el => { S.strategy.goals[el.dataset.k] = Math.max(0, Math.min(40, Math.round(Number(el.value) || 0))); save("strategy"); bus.render(); },
  "sg-share": el => { S.strategy.shares[el.dataset.k] = Math.max(0, Math.min(100, Math.round(Number(el.value) || 0))); save("strategy"); bus.render(); },
  "sg-ui": el => { UI[el.dataset.k] = el.value; bus.render(); },
  "sg-ui-all": el => { UI.showAll = el.checked; bus.render(); },
  "sg-co-f": el => { const c = A.companyById(el.dataset.id); if (!c) return; c[el.dataset.f] = el.value; saveNow("companies"); if (el.dataset.f === "nextDate") bus.render(); },
  "sg-rf-status": el => {
    const r = S.network.referrals.find(x => x.id === el.dataset.id); if (!r) return;
    const was = r.status; r.status = el.value;
    if (r.status !== "toask" && !r.date) r.date = today();
    if (was === "asked" && r.status !== "asked") r.followed = true;
    if (r.status === "referred" && r.appId) { const a = A.appById(r.appId); if (a && !a.referral) { a.referral = r.person; save("apps"); } }
    save("network"); bus.render();
  }
};
let qT = null;
export const strategyInputs = {
  "sg-q": el => { UI.q = el.value; clearTimeout(qT); qT = setTimeout(() => bus.render(), 220); },
  "sg-co-f": el => { const c = A.companyById(el.dataset.id); if (c && el.dataset.f === "next") { c.next = el.value; save("companies"); } },
  "sg-tp": el => { const t = S.network.templates.find(x => x.id === el.dataset.id); if (t) { t.text = el.value; save("network"); } },
  "sg-tp-name": el => { const t = S.network.templates.find(x => x.id === el.dataset.id); if (t) { t.name = el.value; save("network"); } }
};
