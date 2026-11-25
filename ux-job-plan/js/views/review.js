// Weekly review: summary, charts for the week, notes, and trends across weeks.

import { S, save } from "../store.js";
import { TRACKS, TRACK_KEYS } from "../content.js";
import { esc, fmtDate, fmtHours, sum, $ } from "../util.js";
import { icon, segmented, legend, groupedBars, hbars, lineChart, toast } from "../ui.js";
import * as M from "../model.js";
import { aiVisible, askText } from "../ai.js";
import { saveFile } from "./settings.js";
import { bus } from "../bus.js";

let sel = null;
export const setReviewWeek = n => { sel = n; };
const week = () => { if (!sel || sel > M.weekCount()) sel = M.currentWeek(); return sel; };
const rv = n => (S.reviews.weeks[n] ||= { summary: "", ai: false, wins: "", blockers: "", focus: "" });
let ctl = null;

export function renderReview() {
  const n = week();
  const R = M.weekReview(n);
  const r = S.reviews.weeks[n] || {};
  const planned = M.plannedTotal(n);
  const total = R.done.length + R.open.length;
  const ai = aiVisible();
  const cur = M.currentWeek();
  const w = M.weekMeta(n);

  const chips = S.plan.weeks.map(x => `<button class="week-chip" type="button" data-act="review-week" data-n="${x.n}" aria-pressed="${x.n === n}">
    ${x.n === cur && !M.beforeStart() ? `<span class="now">NOW</span>` : ""}<b>Week ${x.n}</b><span>${S.reviews.weeks[x.n]?.summary ? "Reviewed" : x.n < cur ? "Not reviewed" : x.n === cur ? "In progress" : "Upcoming"}</span></button>`).join("");

  const taskParts = [
    { label: "Done", value: R.done.length, color: "var(--c-apply)" },
    { label: "Still open", value: R.open.length, color: "var(--c-learn)" },
    { label: "Carried to a later week", value: R.carriedOut.length, color: "var(--c-practice)" },
    { label: "Let go", value: R.dropped.length, color: "var(--c-neutral)" }
  ];

  const lastWeek = Math.max(cur, n);
  const weeksRange = S.plan.weeks.filter(x => x.n <= lastWeek);
  const ap = M.appsPerWeek();
  const trendHours = weeksRange.map(x => ({ label: `Week ${x.n}`, short: String(x.n), y: Math.round(M.workedHours(x.n) * 10) / 10 }));
  const trendDone = weeksRange.map(x => ({ label: `Week ${x.n}`, short: String(x.n), y: Math.round(M.weekProgress(x.n).pct * 100) }));
  const trendApps = weeksRange.map(x => ({ label: `Week ${x.n}`, short: String(x.n), y: ap.counts[x.n - 1] || 0 }));

  return `<header class="page-h"><div><div class="eyebrow">Weekly review · ${fmtDate(M.weekStart(n))} – ${fmtDate(M.weekEnd(n))}</div><h1>Week ${n} review</h1>
      <p class="lead">${esc(w?.theme || "")}${w?.goal ? `: ${esc(w.goal)}` : ""}</p></div>
    <div class="actions"><button class="btn" type="button" data-act="review-download" data-n="${n}">${icon("download", "sm")}Download summary</button></div></header>
  <div class="week-chips" role="group" aria-label="Choose a week">${chips}</div>

  <section class="card" aria-labelledby="rs-h"><div class="card-h"><h2 id="rs-h">${icon("note")}Summary</h2>
      ${ai ? `<button class="btn btn-sm ${r.summary ? "" : "btn-primary"}" type="button" data-act="review-ai" data-n="${n}">${icon("sparkle", "sm")}${r.summary ? "Rewrite with AI" : "Write summary with AI"}</button>` : ""}</div>
    <div class="card-b"><div data-ai-status></div>
      <label for="rv-summary" class="sr-only">Summary for week ${n}</label>
      <textarea id="rv-summary" rows="5" data-change="review-field" data-n="${n}" data-f="summary" placeholder="${ai ? "Press the button for a 4–6 sentence summary from your numbers, or write your own." : "What moved, what slipped, and one thing to change next week."}">${esc(r.summary || "")}</textarea>
      ${r.ai ? `<p class="ai-label small" style="margin-top:6px">${icon("sparkle", "sm")}Written by AI from your numbers. Edit it freely.</p>` : ""}</div></section>

  <div class="tiles" style="margin-top:16px">
    <div class="tile"><span>Hours worked</span><b>${fmtHours(R.pr.worked)} <small>of ${fmtHours(planned)}</small></b></div>
    <div class="tile"><span>Tasks done</span><b>${R.done.length} <small>of ${total}</small></b></div>
    <div class="tile"><span>Productivity</span><b>${R.pr.ratio == null ? "–" : Math.round(R.pr.ratio * 100) + "%"}</b></div>
    <div class="tile"><span>Applications</span><b>${R.apps.sent} <small>${R.apps.target ? `of ${R.apps.target}` : "sent"}</small></b></div>
    <div class="tile"><span>Events attended</span><b>${R.attended.length}</b></div>
  </div>

  <div class="chart-grid">
    <section class="card" aria-labelledby="rc-h1"><div class="card-h"><h2 id="rc-h1">Hours by track</h2></div><div class="card-b">
      ${groupedBars(TRACK_KEYS.map(k => ({ label: TRACKS[k].name, a: R.planned[k], b: Math.round(R.byTrack[k] * 10) / 10, color: TRACKS[k].color })))}
      ${R.byTrack.other ? `<p class="muted small" style="margin-top:6px">Plus ${fmtHours(R.byTrack.other)} not tied to a track.</p>` : ""}</div></section>
    <section class="card" aria-labelledby="rc-h2"><div class="card-h"><h2 id="rc-h2">Tasks</h2></div><div class="card-b">
      ${segmented(taskParts, { tall: true })}<div style="margin-top:10px">${legend(taskParts)}</div>
      ${R.done.length ? `<details class="mini-list"><summary class="link-btn">Done this week (${R.done.length})</summary><ul>${R.done.map(t => `<li>${esc(t.title)}</li>`).join("")}</ul></details>` : ""}
      ${R.open.length ? `<details class="mini-list"><summary class="link-btn">Still open (${R.open.length})</summary><ul>${R.open.map(t => `<li>${esc(t.title)}</li>`).join("")}</ul></details>` : ""}</div></section>
    <section class="card" aria-labelledby="rc-h3"><div class="card-h"><h2 id="rc-h3">Applications</h2></div><div class="card-b">
      <p class="big-num">${R.apps.sent}<small> sent${R.apps.target ? ` · target ${R.apps.target}` : ""}</small></p>
      ${R.apps.list.length ? `<ul class="plain">${R.apps.list.map(a => `<li>${esc(a.company || "")}${a.role ? ` · ${esc(a.role)}` : ""} <span class="muted small">${esc(a.status || "")}</span></li>`).join("")}</ul>` : `<p class="muted small">The Applications tracker arrives in Stage 4. Its numbers will show here.</p>`}</div></section>
    <section class="card" aria-labelledby="rc-h4"><div class="card-h"><h2 id="rc-h4">Skills</h2></div><div class="card-b">
      ${R.rated.length ? `<ul class="plain">${R.rated.map(x => `<li><a href="#skill-${x.id}">${esc(x.name)}</a> <span class="muted">${x.from} → <b>${x.to}</b></span></li>`).join("")}</ul>` : `<p class="muted small">No ratings changed this week.${M.isRerateWeek(n) ? ` Week ${n} is a re-rating week: <a href="#skills">rate your skills</a>.` : ""}</p>`}
      <h3 class="mini-h" style="margin-top:12px">Hours per skill</h3>
      ${hbars(R.skillHrs.slice(0, 8).map(x => ({ label: x.name, value: x.h, max: Math.max(...R.skillHrs.map(y => y.h)), display: fmtHours(x.h), href: `#skill-${x.id}` })), { empty: "No hours linked to skills yet." })}</div></section>
    <section class="card" aria-labelledby="rc-h5"><div class="card-h"><h2 id="rc-h5">Resources</h2><span class="sub">${fmtHours(R.resHours)} logged</span></div><div class="card-b">
      <h3 class="mini-h">Finished <span class="muted">(${R.resFinished.length})</span></h3>${R.resFinished.length ? `<ul class="plain">${R.resFinished.map(x => `<li>${esc(x.title)}</li>`).join("")}</ul>` : `<p class="muted small">None this week.</p>`}
      <h3 class="mini-h" style="margin-top:10px">Started <span class="muted">(${R.resStarted.length})</span></h3>${R.resStarted.length ? `<ul class="plain">${R.resStarted.map(x => `<li>${esc(x.title)}</li>`).join("")}</ul>` : `<p class="muted small">None this week.</p>`}</div></section>
    <section class="card" aria-labelledby="rc-h6"><div class="card-h"><h2 id="rc-h6">Events and networking</h2></div><div class="card-b">
      <p class="big-num">${R.attended.length}<small> attended · ${R.chats.length} coffee chat${R.chats.length === 1 ? "" : "s"}</small></p>
      ${R.unmarked.length ? `<p class="small" style="margin:8px 0 4px">Did you go?</p><ul class="plain">${R.unmarked.map(e => `<li class="ev-row"><span>${esc(e.name)} <span class="muted small">${fmtDate(e.date)}</span></span><span class="actions"><button class="btn btn-sm" type="button" data-act="ev-mark" data-id="${e.id}" data-v="attended">I went</button><button class="btn btn-sm btn-ghost" type="button" data-act="ev-mark" data-id="${e.id}" data-v="skipped">Skipped</button></span></li>`).join("")}</ul>` : ""}
      ${!R.events.length ? `<p class="muted small">No events this week. Contacts and referral asks arrive with Strategy & networking in Stage 4.</p>` : ""}</div></section>
  </div>

  <section class="card" aria-labelledby="rn-h" style="margin-top:16px"><div class="card-h"><h2 id="rn-h">${icon("note")}Your notes</h2></div>
    <div class="card-b"><div class="row3 notes3">
      ${[["wins", "Wins"], ["blockers", "Blockers"], ["focus", "Next week's focus"]].map(([f, l]) => `<div class="field"><label for="rv-${f}">${l}</label><textarea id="rv-${f}" rows="5" data-change="review-field" data-n="${n}" data-f="${f}">${esc(r[f] || "")}</textarea></div>`).join("")}
    </div>
    ${w?.notes ? `<div class="week-notes"><h3 class="mini-h">From the weekly plan notes</h3><p>${esc(w.notes)}</p><a class="small" href="#plan-w${n}">Edit in the weekly plan</a></div>` : ""}
    <p class="muted small" style="margin-top:8px">Saves as you type.</p></div></section>

  <section class="card" aria-labelledby="rt-h" style="margin-top:16px"><div class="card-h"><h2 id="rt-h">Across weeks</h2><span class="sub">Week 1 to ${lastWeek}</span></div>
    <div class="card-b trends">
      <div><h3 class="mini-h">Hours worked</h3>${lineChart(trendHours, { color: "var(--c-learn)", unit: "h", max: Math.max(planned, ...trendHours.map(p => p.y)), yTicks: [0, planned] })}<p class="muted small">Line at ${planned}h is your weekly plan.</p></div>
      <div><h3 class="mini-h">Tasks done</h3>${lineChart(trendDone, { color: "var(--c-apply)", unit: "%", max: 100, yTicks: [0, 50, 100] })}</div>
      <div><h3 class="mini-h">Applications sent</h3>${lineChart(trendApps, { color: "var(--c-practice)", unit: "", max: Math.max(8, ...trendApps.map(p => p.y)), yTicks: [0, 8] })}</div>
    </div></section>`;
}

// ---- AI summary ----
function reviewData(n) {
  const R = M.weekReview(n);
  const w = M.weekMeta(n);
  return {
    week: n, dates: `${M.weekStart(n)} to ${M.weekEnd(n)}`, theme: w?.theme, goal: w?.goal,
    hours: { planned_total: M.plannedTotal(n), worked_total: Math.round(R.pr.worked * 10) / 10, by_track: Object.fromEntries(TRACK_KEYS.map(k => [TRACKS[k].name, { planned: R.planned[k], worked: Math.round(R.byTrack[k] * 10) / 10 }])) },
    productivity: R.pr.ratio == null ? null : Math.round(R.pr.ratio * 100) / 100,
    tasks: { done: R.done.map(t => `${TRACKS[t.track]?.name}: ${t.title} (${t.hours}h)`), open: R.open.map(t => `${TRACKS[t.track]?.name}: ${t.title}`), carried_to_later_week: R.carriedOut.length, let_go: R.dropped.length },
    applications: { sent: R.apps.sent, target: R.apps.target },
    skills_rated: R.rated.map(x => `${x.name}: ${x.from} to ${x.to}`), hours_per_skill: R.skillHrs.slice(0, 6).map(x => `${x.name}: ${Math.round(x.h * 10) / 10}h`),
    resources_finished: R.resFinished.map(x => x.title), resources_started: R.resStarted.map(x => x.title),
    events_attended: R.attended.map(e => `${e.type}: ${e.name}`), notes: { week_notes: w?.notes || "", wins: S.reviews.weeks[n]?.wins || "", blockers: S.reviews.weeks[n]?.blockers || "" }
  };
}

export async function writeSummary(n) {
  const box = $("[data-ai-status]"), ta = $("#rv-summary");
  if (!ta) return;
  ctl?.abort();
  ctl = new AbortController();
  const before = ta.value;
  box.innerHTML = `<div class="ai-wait" role="status"><div class="spinner" aria-hidden="true"></div><p>AI is reading your week. This can take up to a minute.</p><button class="btn btn-sm" type="button" data-stop>Stop</button></div>`;
  $("[data-stop]", box).addEventListener("click", () => ctl.abort());
  try {
    const text = await askText(`Write a short weekly review of ${S.settings.profile.name}'s job-search plan for week ${n}. Use only the data below and don't invent anything. Write 4–6 plain sentences, encouraging but honest: what moved, what slipped, any pattern (for example a track running over or under its planned hours, or tasks taking longer than estimated), and one concrete suggestion for next week. No headings, no lists, no greeting.
Data: ${JSON.stringify(reviewData(n))}`, { signal: ctl.signal, cache: false, onText: ({ text }) => { ta.value = text; } });
    const r = rv(n); r.summary = text.trim(); r.ai = true;
    save("reviews"); box.innerHTML = ""; bus.render();
  } catch (e) {
    ta.value = e.partial && e.code !== "refused" ? e.partial : before;
    box.innerHTML = e.code === "cancelled" ? "" : `<p class="error" role="alert">${esc(e.message)}</p>`;
  }
}

export function setField(n, f, v) {
  const r = rv(n); r[f] = v;
  if (f === "summary") r.ai = false;
  save("reviews");
}

export function downloadSummary(n) {
  const R = M.weekReview(n), r = S.reviews.weeks[n] || {}, w = M.weekMeta(n);
  const lines = [
    `# Week ${n} review: ${w?.theme || ""}`, ``, `${fmtDate(M.weekStart(n), { year: true })} – ${fmtDate(M.weekEnd(n), { year: true })}`, ``,
    r.summary ? `## Summary\n\n${r.summary}\n` : "",
    `## Numbers`, ``,
    `- Hours worked: ${fmtHours(R.pr.worked)} of ${fmtHours(M.plannedTotal(n))} planned`,
    ...TRACK_KEYS.map(k => `  - ${TRACKS[k].name}: ${fmtHours(R.byTrack[k])} of ${R.planned[k]}h`),
    `- Tasks done: ${R.done.length} of ${R.done.length + R.open.length}${R.carriedOut.length ? ` (${R.carriedOut.length} carried to a later week)` : ""}`,
    `- Productivity: ${R.pr.ratio == null ? "n/a" : Math.round(R.pr.ratio * 100) + "%"}`,
    `- Applications sent: ${R.apps.sent}${R.apps.target ? ` of ${R.apps.target}` : ""}`,
    `- Events attended: ${R.attended.length}`, ``,
    R.done.length ? `## Done\n\n${R.done.map(t => `- ${t.title}`).join("\n")}\n` : "",
    R.open.length ? `## Still open\n\n${R.open.map(t => `- ${t.title}`).join("\n")}\n` : "",
    R.rated.length ? `## Skill ratings\n\n${R.rated.map(x => `- ${x.name}: ${x.from} → ${x.to}`).join("\n")}\n` : "",
    R.resFinished.length ? `## Resources finished\n\n${R.resFinished.map(x => `- ${x.title}`).join("\n")}\n` : "",
    r.wins ? `## Wins\n\n${r.wins}\n` : "", r.blockers ? `## Blockers\n\n${r.blockers}\n` : "", r.focus ? `## Next week's focus\n\n${r.focus}\n` : ""
  ].filter(x => x !== "").join("\n");
  saveFile(`week-${n}-review.md`, lines, "text/markdown");
}

export const reviewActions = {
  "review-week": d => { location.hash = `#review-w${d.n}`; },
  "review-ai": d => writeSummary(parseInt(d.n, 10)),
  "review-download": d => downloadSummary(parseInt(d.n, 10)),
  "ev-mark": d => { const e = S.events.list.find(x => x.id === d.id); if (e) { e.status = d.v; save("events"); bus.render(); toast(d.v === "attended" ? "Marked as attended" : "Marked as skipped"); } }
};
