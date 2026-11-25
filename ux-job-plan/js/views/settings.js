// Settings: location, about you (rebuilds the plan), plan dates and hours, appearance, AI,
// backup, restore, start over and reset.

import { S, KEYS, save, saveNow, backup, backupFull, inspectBackup, restore, resetKey, getStatus, hasCloud, txDel, mondayOf } from "../store.js";
import { SKILLS, CREDIT } from "../content.js";
import { normMe, levelOf, targetOf, MODES, HAVES, LEVEL_WORDS, phaseSpan } from "../personalize.js";
import { previewPlan, rebuildPlan, restartPlan, relocalize } from "../plan-tools.js";
import { closeSheet } from "../ui.js";
import { STORY_FORMATS, QUESTIONS, STORY_STATUS } from "../content4.js";
import { TRACKS, TRACK_KEYS, PHASES, DOCS } from "../content.js";
import { esc, fmtDate, dowLong, parseYmd, today, toCsv, sum, $ } from "../util.js";
import { icon, sheet, toast, confirmSheet } from "../ui.js";
import * as M from "../model.js";
import { bus } from "../bus.js";
import { usesClaude } from "../ai.js";
import { browserAiStatus, prepareBrowserAi } from "../browser-ai.js";

let pendingRestore = null;
let restoreError = "";
let aiSetup = "";

function aiSettings(st) {
  const status = browserAiStatus();
  if (usesClaude() || status === "available") return `
    <label class="switch"><input type="checkbox" data-change="set-ai" ${st.aiOn ? "checked" : ""}> AI suggestions</label>
    <p class="hint muted small">${usesClaude() ? "Suggestions you request use Claude." : "Suggestions use Chrome's built-in model and stay on this device."} AI doesn't search the web, so check what it suggests.</p>`;
  if (status === "unavailable") return `<p class="hint muted small">On-device AI needs a supported desktop version of Chrome and compatible hardware. You can still use the planner without AI. <a href="https://developer.chrome.com/docs/ai/get-started#hardware" target="_blank" rel="noopener noreferrer">Check Chrome's requirements</a>.</p>${aiSetup ? `<p role="alert">${esc(aiSetup)}</p>` : ""}`;
  return `<p class="hint muted small">Chrome needs to download its AI model once. After that, AI suggestions run on this device without an account or API key.</p>
    <div class="actions"><button type="button" class="btn" data-act="prepare-browser-ai" ${aiSetup.startsWith("Downloading") ? "disabled" : ""}>Set up on-device AI</button></div>
    <p class="hint" id="browser-ai-status" role="status">${esc(aiSetup)}</p>`;
}

export function renderSettings() {
  const st = S.settings;
  const start = st.startDate;
  const isMon = parseYmd(start)?.getDay() === 1;
  const where = M.beforeStart() ? `Week 1 starts ${dowLong(start)}, ${fmtDate(start, { year: true })}.` : `Today is in Week ${Math.max(1, M.weekRaw(today()))}.`;
  const total = sum(TRACK_KEYS, k => st.hours[k]);
  const phaseRows = PHASES.map(p => { const sp = phaseSpan(S.plan, p.id); if (!sp) return ""; const ws = S.plan.weeks.filter(w => w.phase === p.id && w.split); const avg = k => ws.length ? Math.round(sum(ws, w => w.split[k]) / ws.length * 2) / 2 : 0; return `<tr><th scope="row">${p.id}. ${esc(p.name)}<span class="muted small"> · Weeks ${sp.from}–${sp.to}</span></th>${TRACK_KEYS.map(k => `<td>${avg(k)}h</td>`).join("")}</tr>`; }).join("");
  const me = normMe(st.me);
  const statusText = { synced: "Saved to your account", saving: "Saving…", local: "Saved in this browser only", offline: "Couldn't reach your account. Saved in this browser.", slow: "Still connecting to your account", loading: "Loading…" }[getStatus()] || "";
  const sections = [["plan", "Weekly plan", "Back to the plan built from your profile, with its tasks. Removes your edits, ticks and added tasks."], ["today", "Today's tasks", "Empties today's list."], ["sessions", "Work sessions", "Deletes all logged hours."], ["events", "Events", "Deletes all events."], ["skills", "Skills", `Back to the ${SKILLS.length} built-in skills at the levels in About you, with their projects and tests.`], ["resources", "Courses & resources", "Back to the original library and statuses."], ["reviews", "Weekly reviews", "Deletes summaries and notes."], ["resume", "Resume", "Back to the empty starter resume and its three versions. Deletes versions you added."], ["tailor", "Resume Tailor", "Clears the current tailoring, history and house rules."], ["linkedin", "LinkedIn", "Clears drafts, the checklist and the post log."], ["portfolio", "Portfolio", "Back to the starter case studies. Deletes notes, plans and reviews."], ["apps", "Applications", "Deletes every application, its notes and job-fit suggestions."], ["companies", "Companies and loops", "Back to the built-in companies and their researched loops. Deletes companies you added."], ["interview", "Interview prep", "Resets the presentation structure, your prompts, recruiter answers, round notes and mock interview log."], ["stories", "Story bank", "Deletes your stories, scores and your own questions."], ["practice", "Practice sessions", "Deletes every practice session with its transcript, scores and attachments."], ["network", "Contacts and referrals", "Deletes contacts and referral asks and resets the message templates."], ["strategy", "Strategy", "Resets tier shares, weekly goals, communities and hidden hints."]];
  const p = pendingRestore;
  return `<header class="page-h"><div><div class="eyebrow">Settings</div><h1>Settings</h1><p class="lead">Where you're looking, where you're starting from, plan dates, appearance and your data.</p></div></header>
  <div class="set-grid">
    ${locationCard(st)}
    ${aboutCard(st, me)}
    <section class="card" aria-labelledby="sp-h"><div class="card-h"><h2 id="sp-h">${icon("calendar")}Plan</h2></div>
      <div class="card-b form">
        <div class="field"><label for="set-start">Week 1 starts on</label>
          <input id="set-start" type="date" value="${esc(start)}" data-change="set-start" style="max-width:220px">
          <p class="hint">${where}${isMon ? "" : " Weeks run 7 days from this date; a Monday keeps them aligned with the calendar."} Moving it later doesn't move tasks back; moving it earlier carries unfinished tasks into the new current week.</p></div>
        <div class="field"><span class="lbl">Start over</span>
          <p class="hint" style="margin-top:0">Begin again from Week 1 with a fresh plan: clears ticks and today's list, and optionally logged hours and reviews. Your profile, resume, portfolio and applications stay.</p>
          <div class="actions"><button class="btn btn-sm" type="button" data-act="plan-restart">${icon("restore", "sm")}Start the plan over…</button></div></div>
        <div class="field"><span class="lbl" id="ph-l">Hours by phase</span>
          <div class="scroll-x"><table class="loop-t ph-t" aria-labelledby="ph-l"><thead><tr><th scope="col">Phase</th>${TRACK_KEYS.map(k => `<th scope="col"><i class="dot" style="--c:${TRACKS[k].color}"></i>${TRACKS[k].name}</th>`).join("")}</tr></thead><tbody>${phaseRows}</tbody></table></div>
          <p class="hint">Average hours a week. Every week adds up to about ${me.hours} hours (set in About you), but the split moves with the work: more building while the case studies get made, more practice before interviews, more learning at the end. Each week's own split is on the Plan page.${DOCS.estimates ? ` <a href="${esc(DOCS.estimates)}" target="_blank" rel="noopener noreferrer">How the hours were worked out<span class="sr-only"> (opens in a new tab)</span></a>` : ""}</p></div>
        <div class="field"><span class="lbl">Default split for weeks you add yourself</span>
          <div class="hours-edit">${TRACK_KEYS.map(k => `<div class="he"><label for="h-${k}"><i class="dot" style="--c:${TRACKS[k].color}"></i>${TRACKS[k].name}</label>
            <input id="h-${k}" type="number" min="0" max="60" step="0.5" inputmode="decimal" value="${st.hours[k]}" data-change="set-hours" data-k="${k}"></div>`).join("")}
            <div class="total-line"><span>Total per week</span><span data-total>${total}h</span></div></div></div>
      </div></section>

    <section class="card" aria-labelledby="sa-h"><div class="card-h"><h2 id="sa-h">${icon("sun")}Appearance</h2></div>
      <div class="card-b form">
        <div class="field"><span class="lbl" id="theme-l">Theme</span>
          <div class="seg-ctl" role="radiogroup" aria-labelledby="theme-l">${[["system", "Match device"], ["light", "Light"], ["dark", "Dark"]].map(([v, l]) =>
            `<label><input type="radio" name="theme" value="${v}" ${st.theme === v ? "checked" : ""} data-change="set-theme"><span>${l}</span></label>`).join("")}</div></div>
      </div></section>

    <section class="card" aria-labelledby="sai-h"><div class="card-h"><h2 id="sai-h">${icon("sparkle")}AI</h2></div>
      <div class="card-b form">
        ${aiSettings(st)}
      </div></section>

    <section class="card" aria-labelledby="sb-h"><div class="card-h"><h2 id="sb-h">${icon("download")}Backup and export</h2></div>
      <div class="card-b form">
        <dl class="kv"><dt>Storage</dt><dd>${esc(statusText)}</dd>
          <dt>Tasks</dt><dd>${S.plan.tasks.length} (${S.plan.tasks.filter(t => t.done).length} done)</dd>
          <dt>Work sessions</dt><dd>${S.sessions.list.length}</dd><dt>Events</dt><dd>${S.events.list.length}</dd></dl>
        <p class="hint muted small">${hasCloud() ? "Your data is saved to your account, where only you can see it, with a copy in this browser." : "Your data is saved in this browser."} A backup file lets you restore everything later.</p>
        <div class="actions"><button class="btn btn-primary" type="button" data-act="backup">${icon("download", "sm")}Download backup</button>
          <button class="btn" type="button" data-act="backup-copy">${icon("copy", "sm")}Copy backup</button></div>
        <div class="field"><span class="lbl">Export a spreadsheet (CSV)</span>
          <div class="actions"><button class="btn btn-sm" type="button" data-act="csv" data-k="tasks">Tasks</button>
            <button class="btn btn-sm" type="button" data-act="csv" data-k="sessions">Work sessions</button>
            <button class="btn btn-sm" type="button" data-act="csv" data-k="events">Events</button>
            <button class="btn btn-sm" type="button" data-act="csv" data-k="resources">Resources</button>
            <button class="btn btn-sm" type="button" data-act="csv" data-k="skills">Skills</button>
            <button class="btn btn-sm" type="button" data-act="csv" data-k="apps">Applications</button>
            <button class="btn btn-sm" type="button" data-act="csv" data-k="contacts">Contacts</button>
            <button class="btn btn-sm" type="button" data-act="csv" data-k="stories">Stories</button>
            <button class="btn btn-sm" type="button" data-act="csv" data-k="practice">Practice sessions</button></div></div>
      </div></section>

    <section class="card" aria-labelledby="sr-h"><div class="card-h"><h2 id="sr-h">${icon("upload")}Restore from a backup</h2></div>
      <div class="card-b form">
        <div class="file-drop"><label for="restore-file" class="lbl" style="font-weight:700">Choose a backup file (.json)</label>
          <input id="restore-file" type="file" accept=".json,application/json" data-change="restore-file"></div>
        <details><summary class="link-btn" style="cursor:pointer">Or paste the backup text</summary>
          <div class="field" style="margin-top:8px"><label for="restore-text" class="sr-only">Backup text</label><textarea id="restore-text" rows="4" placeholder='{"app":"ux-job-plan", …}'></textarea>
          <div><button class="btn btn-sm" type="button" data-act="restore-check">Check backup</button></div></div></details>
        ${restoreError ? `<p class="error" role="alert">${esc(restoreError)}</p>` : ""}
        ${p ? `<div class="card" style="box-shadow:none;background:var(--surface-2)"><div class="card-b">
          <h3 style="margin-bottom:6px">Backup found${p.info.exportedAt ? ` · ${esc(new Date(p.info.exportedAt).toLocaleString())}` : ""}</h3>
          <p class="small muted" style="margin-bottom:10px">${p.info.counts.tasks} tasks (${p.info.counts.done} done) · ${p.info.counts.sessions} sessions · ${p.info.counts.events} events</p>
          <fieldset style="border:0;padding:0;margin:0 0 10px"><legend class="lbl" style="font-weight:700;font-size:13.5px;margin-bottom:6px">Sections to restore</legend><div class="chips">
            ${p.info.keys.map(k => `<label class="chip" style="cursor:pointer"><input type="checkbox" name="rk" value="${k}" checked style="margin:0;accent-color:var(--primary)">${esc(labelFor(k))}</label>`).join("")}</div></fieldset>
          <div class="actions"><button class="btn btn-primary" type="button" data-act="restore-apply">Restore</button><button class="btn btn-ghost" type="button" data-act="restore-cancel">Cancel</button></div>
        </div></div>` : ""}
      </div></section>

    <section class="card" aria-labelledby="sabout-h"><div class="card-h"><h2 id="sabout-h">${icon("info")}About</h2></div>
      <div class="card-b">
        <p style="margin-top:0"><b>${esc(CREDIT.app)}</b> by <a href="${esc(CREDIT.github)}" target="_blank" rel="noopener noreferrer">${esc(CREDIT.author)}<span class="sr-only"> on GitHub (opens in a new tab)</span></a>.</p>
        <p class="small muted">Free and open source under the ${esc(CREDIT.license)} License: use it, change it and share it, keeping the copyright notice. © ${CREDIT.year} ${esc(CREDIT.author)}.</p>
        <div class="actions"><a class="btn btn-sm" href="${esc(CREDIT.repo)}" target="_blank" rel="noopener noreferrer">${icon("ext", "sm")}Source on GitHub</a>
          <a class="btn btn-sm btn-ghost" href="${esc(CREDIT.repo)}/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">License</a>
          <a class="btn btn-sm btn-ghost" href="${esc(CREDIT.repo)}/issues" target="_blank" rel="noopener noreferrer">Report an issue</a></div>
      </div></section>

    <section class="card" aria-labelledby="sx-h"><div class="card-h"><h2 id="sx-h">${icon("alert")}Reset</h2></div>
      <div class="card-b"><div class="reset-list">
        ${sections.map(([k, l, d]) => `<div class="rl"><div><b>${l}</b><p>${d}</p></div><button class="btn btn-sm btn-danger" type="button" data-act="reset" data-k="${k}">Reset</button></div>`).join("")}
        <div class="rl"><div><b>Everything</b><p>All sections, including settings.</p></div><button class="btn btn-sm btn-danger" type="button" data-act="reset" data-k="all">${icon("trash", "sm")}Reset all</button></div>
      </div></div></section>
  </div>`;
}

const LABELS = { settings: "Settings", plan: "Weekly plan", today: "Today's tasks", timer: "Stopwatch", sessions: "Work sessions", events: "Events", skills: "Skills", apps: "Applications", resources: "Courses & resources", reviews: "Weekly reviews", resume: "Resume", tailor: "Resume Tailor", linkedin: "LinkedIn", portfolio: "Portfolio", companies: "Companies and loops", interview: "Interview prep", stories: "Story bank", practice: "Practice sessions", network: "Contacts and referrals", strategy: "Strategy", feed: "What's new: likes and read marks", evprep: "Event prep" };
const labelFor = k => LABELS[k] || k;

// ---- Files ----
export async function saveFile(filename, text, mime = "text/plain") {
  let dl = null;
  try { if (window.claude?.use) dl = await window.claude.use("downloads"); } catch { dl = null; }
  if (dl) {
    try { await dl.save({ filename, data: new Blob([text], { type: mime }) }); return; }
    catch (e) {
      if (e && e.code === "declined") return;
      if (e && e.code === "rate_limited") { toast("Too many downloads at once. Try again in a moment."); return; }
    }
  }
  showText(filename, text);
}

function showText(filename, text) {
  sheet({
    title: "Copy your file", sub: `Downloads aren't available here. Copy the text and save it as ${esc(filename)}.`, wide: true,
    body: `<label for="ft" class="sr-only">File contents</label><textarea id="ft" rows="12" readonly style="font-family:ui-monospace,Menlo,monospace;font-size:12px">${esc(text)}</textarea>`,
    foot: `<button class="btn btn-ghost" type="button" data-close>Close</button><button class="btn btn-primary" type="button" data-copy>${icon("copy", "sm")}Copy</button>`,
    initialFocus: "[data-copy]",
    onMount: (el) => $("[data-copy]", el).addEventListener("click", () => copyText(text))
  });
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast("Copied"); }
  catch { toast("Couldn't copy. Select the text and copy it instead."); }
}

const stamp = () => today();
export async function doBackup() { saveFile(`ux-job-plan-backup-${stamp()}.json`, JSON.stringify(await backupFull(), null, 2), "application/json"); }
export async function doBackupCopy() { copyText(JSON.stringify(await backupFull())); }

export function doCsv(k) {
  const tracks = k => TRACKS[k]?.name || "";
  if (k === "tasks") {
    const rows = [...S.plan.tasks].sort((a, b) => a.week - b.week || a.order - b.order);
    return saveFile(`ux-job-plan-tasks-${stamp()}.csv`, toCsv(rows, [
      { label: "Week", get: t => t.week }, { label: "Track", get: t => tracks(t.track) }, { label: "Task", get: t => t.title },
      { label: "Planned hours", get: t => t.hours }, { label: "Done", get: t => (t.done ? "Yes" : "No") }, { label: "Done on", get: t => t.doneAt },
      { label: "Let go", get: t => (t.dropped ? "Yes" : "") }, { label: "Carried from week", get: t => t.carriedFrom || "" },
      { label: "Details", get: t => t.detail }, { label: "Links", get: t => t.res.map(r => r.u).join(" ") }]), "text/csv");
  }
  if (k === "sessions") return saveFile(`ux-job-plan-sessions-${stamp()}.csv`, toCsv(S.sessions.list, [
    { label: "Date", get: s => s.date }, { label: "Minutes", get: s => s.min }, { label: "Hours", get: s => (s.min / 60).toFixed(2) },
    { label: "Track", get: s => tracks(s.track) }, { label: "Focus", get: s => s.label }, { label: "Note", get: s => s.note }]), "text/csv");
  if (k === "resources") return saveFile(`ux-job-plan-resources-${stamp()}.csv`, toCsv(S.resources.list, [
    { label: "Title", get: r => r.title }, { label: "Type", get: r => r.type }, { label: "Status", get: r => ({ todo: "Not started", doing: "In progress", done: "Done" }[r.status]) },
    { label: "Skills", get: r => r.skills.map(id => S.skills.list.find(s => s.id === id)?.name || id).join("; ") }, { label: "Plan week", get: r => r.week || "" },
    { label: "Cost", get: r => r.cost }, { label: "Progress", get: r => (r.units ? `${r.units.done}/${r.units.total} ${r.units.label}` : "") }, { label: "Rating", get: r => r.rating || "" },
    { label: "Started", get: r => r.started }, { label: "Finished", get: r => r.finished }, { label: "Link", get: r => r.url }, { label: "Notes", get: r => r.notes }]), "text/csv");
  if (k === "skills") return saveFile(`ux-job-plan-skills-${stamp()}.csv`, toCsv(S.skills.list, [
    { label: "Skill", get: s => s.name }, { label: "Level now", get: s => s.now }, { label: "Target", get: s => s.target }, { label: "Starting level", get: s => s.start ?? "" },
    { label: "Ratings", get: s => s.history.map(h => `${h.d}: ${h.lvl}`).join("; ") }, { label: "Hours", get: s => M.skillHours(s.id).toFixed(1) },
    { label: "Last test", get: s => { const t = s.tests[s.tests.length - 1]; return t ? `${t.score}/${t.total} on ${t.d}` : ""; } }, { label: "Why it matters", get: s => s.why }, { label: "How to prove it", get: s => s.proof }]), "text/csv");
  if (k === "apps") return bus.csvApps && bus.csvApps();
  if (k === "contacts") return saveFile(`ux-job-plan-contacts-${stamp()}.csv`, toCsv(S.network.contacts, [
    { label: "Name", get: c => c.name }, { label: "Company", get: c => c.company }, { label: "How met", get: c => c.how }, { label: "Last contact", get: c => c.last },
    { label: "Next step", get: c => c.next }, { label: "Next date", get: c => c.nextDate }, { label: "LinkedIn", get: c => c.linkedin }, { label: "Notes", get: c => c.notes }]), "text/csv");
  if (k === "stories") {
    const qText = st => (QUESTIONS.find(q => q.id === st.qid) || S.stories.questions.find(q => q.id === st.qid) || {}).q || "";
    return saveFile(`ux-job-plan-stories-${stamp()}.csv`, toCsv(S.stories.list, [
      { label: "Question", get: qText }, { label: "Format", get: st => st.format }, { label: "Status", get: st => STORY_STATUS[st.status] || st.status },
      { label: "Story", get: st => (STORY_FORMATS[st.format]?.fields || []).map(([f, l]) => (st.fields?.[f] ? `${l}: ${st.fields[f]}` : "")).filter(Boolean).join("\n") },
      { label: "Tags", get: st => (st.tags || []).join("; ") }, { label: "Last score", get: st => st.scores?.length ? st.scores[st.scores.length - 1].avg : "" }, { label: "Practiced", get: st => st.practiced || 0 }]), "text/csv");
  }
  if (k === "practice") return saveFile(`ux-job-plan-practice-${stamp()}.csv`, toCsv(S.practice.list, [
    { label: "Date", get: p => p.date }, { label: "Kind", get: p => p.kind }, { label: "Title", get: p => p.title }, { label: "Minutes", get: p => Math.round(p.sec / 6) / 10 },
    { label: "Planned minutes", get: p => Math.round(p.planned / 60) }, { label: "Words", get: p => p.words }, { label: "Average score", get: p => { const v = p.scores ? Object.values(p.scores) : []; return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : ""; } },
    { label: "Fixes", get: p => (p.fixes || []).join(" | ") }, { label: "Notes", get: p => p.notes }]), "text/csv");
  if (k === "events") return saveFile(`ux-job-plan-events-${stamp()}.csv`, toCsv(S.events.list, [
    { label: "Date", get: e => e.date }, { label: "Time", get: e => e.time }, { label: "Event", get: e => e.name }, { label: "Type", get: e => e.type },
    { label: "Location", get: e => e.location }, { label: "Link", get: e => e.link }, { label: "Status", get: e => e.status || "planned" }, { label: "Notes", get: e => e.notes }]), "text/csv");
}

// ---- Restore ----
export function checkRestoreText(text) {
  restoreError = ""; pendingRestore = null;
  let obj;
  try { obj = JSON.parse(text); } catch { restoreError = "That isn't valid backup text. Make sure you copied all of it."; bus.render(); return; }
  const info = inspectBackup(obj);
  if (!info.ok) { restoreError = info.reason; bus.render(); return; }
  pendingRestore = { obj, info };
  bus.render();
}
export async function readRestoreFile(file) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { restoreError = "That file is too large to be a backup."; bus.render(); return; }
  checkRestoreText(await file.text());
}
export function applyRestore(keys) {
  if (!pendingRestore || !keys.length) return;
  const { obj } = pendingRestore;
  confirmSheet({
    title: "Restore this backup?", message: `This replaces ${keys.map(labelFor).join(", ")} with the backup, on every device.`, confirm: "Restore",
    onConfirm: () => {
      restore(obj, keys);
      pendingRestore = null; restoreError = "";
      bus.applyTheme && bus.applyTheme();
      M.syncToday(); M.rollover();
      bus.render(); toast("Backup restored");
    }
  });
}
export const cancelRestore = () => { pendingRestore = null; restoreError = ""; bus.render(); };

export function doReset(k) {
  const keys = k === "all" ? KEYS : k === "plan" ? ["plan", "today"] : k === "sessions" ? ["sessions", "timer"] : [k];
  const label = k === "all" ? "everything" : labelFor(k).toLowerCase();
  confirmSheet({
    title: `Reset ${label}?`, message: `This clears ${esc(label)} on every device. Download a backup first if you might want it back.`, confirm: "Reset", danger: true,
    onConfirm: () => {
      if (keys.includes("practice")) for (const p of S.practice.list) if (p.hasTx) txDel(p.id);
      keys.forEach(resetKey);
      bus.applyTheme && bus.applyTheme();
      bus.render(); toast(`Reset ${label}`);
    }
  });
}

export function setHours(k, v) {
  S.settings.hours[k] = Math.max(0, Math.min(60, Math.round((parseFloat(v) || 0) * 2) / 2));
  save("settings");
  const el = document.querySelector("[data-total]");
  if (el) el.textContent = sum(TRACK_KEYS, x => S.settings.hours[x]) + "h";
}
export function setStart(v) {
  if (!parseYmd(v)) return;
  S.settings.startDate = v;
  saveNow("settings");
  M.rollover();
  bus.render();
  toast(`Week 1 starts ${fmtDate(v, { dow: true, year: true })}`);
}

// ---- Location ----
function locationCard(st) {
  const l = st.location || {};
  const f = (k, label, ph, hint = "") => `<div class="field"><label for="loc-${k}">${label}</label><input id="loc-${k}" type="text" value="${esc(l[k] || "")}" data-change="set-loc" data-f="${k}" maxlength="80" placeholder="${esc(ph)}" autocomplete="off">${hint ? `<p class="hint">${hint}</p>` : ""}</div>`;
  return `<section class="card" aria-labelledby="sl-h"><div class="card-h"><h2 id="sl-h">${icon("compass")}Location</h2></div>
    <div class="card-b form">
      <p class="hint muted small" style="margin-top:0">Where you're looking for work. Job alerts, meetups, events, the library card task and AI advice use it. Leave it empty for a location-free plan.</p>
      <div class="loc-grid">${f("city", "City", "e.g. Austin")}${f("region", "State or region", "e.g. TX")}${f("country", "Country", "e.g. United States")}</div>
      ${f("nearby", "Nearby cities you'd work in", "e.g. Round Rock, San Marcos", "Separate with commas. Used for job alerts and your LinkedIn location.")}
      <label class="switch"><input type="checkbox" data-change="set-loc" data-f="remote" ${l.remote ? "checked" : ""}> Open to remote roles</label>
    </div></section>`;
}

// ---- About you: profile and the inputs that shape the plan ----
function aboutCard(st, me) {
  const pv = previewPlan();
  const p = st.profile;
  const rows = SKILLS.map(sk => `<li class="about-skill">
    <span class="about-skill-name">${esc(sk.name)}</span>
    <div class="about-skill-controls">
      <select aria-label="Level for ${esc(sk.name)}" data-change="set-me-level" data-id="${sk.id}">${LEVEL_WORDS.map((w, i) => `<option value="${i}" ${levelOf(me, sk.id) === i ? "selected" : ""}>${i} · ${w}</option>`).join("")}</select>
      <label class="about-option"><input type="checkbox" data-change="set-me-focus" data-id="${sk.id}" ${me.focus.includes(sk.id) ? "checked" : ""}><span>Focus<span class="sr-only"> on ${esc(sk.name)}</span></span></label>
      <span class="about-skill-target">Target <b>${targetOf(me, sk)}</b></span>
    </div></li>`).join("");
  return `<section class="card about-card" aria-labelledby="sme-h"><div class="card-h"><h2 id="sme-h">${icon("idcard")}About you</h2><span class="sub">Shapes your plan</span></div>
    <div class="card-b about-form">
      <p class="about-hint">Optional. You can use the full plan as it is or customize it here and rebuild. Your planner data is saved ${hasCloud() ? "on this device and in your account" : "on this device"}.</p>
      <section class="about-section" aria-labelledby="me-profile">
      <h3 id="me-profile">Your background</h3>
      <div class="loc-grid">
        <div class="field"><label for="pf-name">Name</label><input id="pf-name" type="text" value="${esc(p.name)}" data-change="set-profile" data-f="name" maxlength="80" autocomplete="name"></div>
        <div class="field"><label for="pf-role">Current title</label><input id="pf-role" type="text" value="${esc(p.role)}" data-change="set-profile" data-f="role" maxlength="120" placeholder="e.g. UI/UX Designer, student"></div>
      </div>
      <div class="field"><label for="pf-target">What you're looking for</label><input id="pf-target" type="text" value="${esc(p.target)}" data-change="set-profile" data-f="target" maxlength="200" placeholder="e.g. Product or UX Designer roles, mobile and web"></div>
      <div class="field"><label for="pf-summary">Your experience, in a few lines</label><textarea id="pf-summary" rows="4" data-change="set-profile" data-f="summary" maxlength="4000" aria-describedby="me-summary-hint" placeholder="Roles, years, tools, projects, what you're building now.">${esc(p.summary || "")}</textarea>
        <p class="about-hint" id="me-summary-hint">Optional AI suggestions use this context. Review suggestions for accuracy.</p></div>
      </section>

      <section class="about-section" aria-labelledby="me-plan">
      <h3 id="me-plan">Your plan</h3>
      <div class="about-plan-fields">
        <div class="field"><label for="me-hours">Hours a week</label><input id="me-hours" type="number" min="5" max="60" step="1" inputmode="numeric" value="${me.hours}" data-change="set-me-hours" aria-describedby="me-hours-hint">
          <p class="about-hint" id="me-hours-hint">The default is 35 hours. Fewer hours spread the plan over more weeks.</p></div>
        <fieldset><legend>Goal</legend>
          ${Object.entries(MODES).map(([k, l]) => `<label class="about-option"><input id="me-mode-${k}" type="radio" name="me-mode" value="${k}" data-change="set-me-mode" ${me.mode === k ? "checked" : ""}><span>${l}</span></label>`).join("")}</fieldset>
        <fieldset><legend>I already have</legend>
          ${HAVES.map(([k, l, h]) => `<label class="about-option" data-tip="${esc(h)}"><input type="checkbox" data-change="set-me-have" data-k="${k}" ${me.have.includes(k) ? "checked" : ""}><span>${l}</span></label>`).join("")}</fieldset>
      </div>
      </section>

      <section class="about-section" aria-labelledby="me-sk-l">
        <div><h3 id="me-sk-l">Your skill levels</h3>
        <p class="about-hint">Choose your level from 0 (new) to 5 (expert). Reaching the target skips that skill's learning tasks. Focus raises the target by one and keeps those tasks.</p></div>
        <ul class="about-skills" role="list">${rows}</ul>
      </section>
      <div class="rebuild-bar">
        <p role="status"><b>${pv.weeks} weeks</b> · ${pv.tasks} tasks · ${Math.round(pv.hours)} hours${pv.skipped ? ` · ${pv.skipped} left out` : ""}<br><span class="about-hint">${me.built ? "Your plan was built from this profile. Rebuild after changes." : "Changes apply when you rebuild the plan."}</span></p>
        <button class="btn btn-primary" type="button" data-act="plan-rebuild">${icon("wand", "sm")}Rebuild my plan</button>
      </div>
    </div></section>`;
}

const startChoices = () => {
  const keep = S.settings.startDate, thisW = mondayOf(), nextW = mondayOf(undefined, 1);
  const opts = [[thisW, `This week (${fmtDate(thisW, { dow: true })})`], [nextW, `Next week (${fmtDate(nextW, { dow: true })})`]];
  if (keep !== thisW && keep !== nextW) opts.unshift([keep, `Keep the current start (${fmtDate(keep, { dow: true, year: true })})`]);
  return opts;
};

function openRebuild() {
  const pv = previewPlan();
  const anyDone = S.plan.tasks.some(t => t.done);
  const opts = startChoices();
  const def = anyDone ? S.settings.startDate : mondayOf();
  sheet({
    title: "Rebuild your plan?",
    sub: `${pv.weeks} weeks, ${pv.tasks} tasks${pv.skipped ? `, ${pv.skipped} left out for your profile` : ""}.`,
    body: `<p class="small">Tasks you ticked stay ticked, tasks you added stay in their week, and edits you made to built-in tasks are kept. Skill levels and targets are set from About you.</p>
      <div class="field"><label for="rb-start">Week 1 starts</label><select id="rb-start">${opts.map(([v, l]) => `<option value="${v}" ${v === def ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>`,
    foot: `<button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" data-go>Rebuild</button>`,
    initialFocus: "[data-go]",
    onMount: el => $("[data-go]", el).addEventListener("click", () => {
      const start = $("#rb-start", el).value;
      rebuildPlan({ start });
      closeSheet(); bus.render();
      toast(`Plan rebuilt: ${S.plan.weeks.length} weeks`);
    })
  });
}

function openRestart() {
  const opts = startChoices().filter(([v]) => v !== S.settings.startDate || v === mondayOf());
  sheet({
    title: "Start the plan over?",
    sub: "A fresh Week 1, built from your profile.",
    body: `<div class="field"><label for="rs-start">Week 1 starts</label><select id="rs-start">${opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select></div>
      <fieldset style="border:0;padding:0;margin:0"><legend class="lbl" style="font-weight:700;margin-bottom:6px">Also clear</legend>
        <label class="switch" style="display:flex"><input type="checkbox" id="rs-sessions" checked> Logged work sessions (hours)</label>
        <label class="switch" style="display:flex"><input type="checkbox" id="rs-reviews" checked> Weekly reviews</label>
        <label class="switch" style="display:flex"><input type="checkbox" id="rs-ratings"> Skill re-ratings and test scores</label></fieldset>
      <p class="small muted">Ticks, today's list and the stopwatch are always cleared. Download a backup first if you might want them back.</p>`,
    foot: `<button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary btn-danger" type="button" data-go>Start over</button>`,
    initialFocus: "[data-close]",
    onMount: el => $("[data-go]", el).addEventListener("click", () => {
      restartPlan({ start: $("#rs-start", el).value, sessions: $("#rs-sessions", el).checked, reviews: $("#rs-reviews", el).checked, ratings: $("#rs-ratings", el).checked });
      closeSheet(); bus.render();
      toast(`Fresh start: Week 1 begins ${fmtDate(S.settings.startDate, { dow: true })}`);
    })
  });
}

function setLoc(el) {
  const old = { ...S.settings.location };
  const k = el.dataset.f;
  S.settings.location = { ...old, [k]: el.type === "checkbox" ? el.checked : el.value.trim() };
  saveNow("settings");
  const n = relocalize(old);
  bus.render();
  if (n && k !== "remote") toast("Plan, links and checklists updated for the new location");
}
const meSet = fn => { const me = normMe(S.settings.me); fn(me); S.settings.me = me; save("settings"); bus.render(); };

export const settingsActions = {
  "prepare-browser-ai": async (_data, event) => {
    if (!["downloadable", "downloading"].includes(browserAiStatus()) || aiSetup.startsWith("Downloading")) return;
    event.target.closest("button").disabled = true;
    const progress = percent => {
      aiSetup = percent == null ? "Downloading Chrome's AI model…" : `Downloading Chrome's AI model… ${percent}%`;
      const status = document.getElementById("browser-ai-status");
      if (status) status.textContent = aiSetup;
    };
    progress();
    try {
      await prepareBrowserAi(progress);
      S.settings.aiOn = true;
      save("settings");
      aiSetup = "";
      toast("On-device AI is ready");
    } catch {
      aiSetup = "Chrome couldn't set up its AI model. Check your connection and available disk space, then try again.";
      toast(aiSetup);
    }
    bus.render();
    document.querySelector('[data-change="set-ai"], [data-act="prepare-browser-ai"]')?.focus();
  },
  "plan-rebuild": () => openRebuild(),
  "plan-restart": () => openRestart(),
  "setup-hide": () => { S.settings.setupHidden = true; save("settings"); bus.render(); }
};
export const settingsChanges = {
  "set-loc": el => setLoc(el),
  "set-me-hours": el => meSet(me => { me.hours = Math.max(5, Math.min(60, Math.round(parseFloat(el.value) || 35))); }),
  "set-me-mode": el => meSet(me => { me.mode = el.value; }),
  "set-me-have": el => meSet(me => { me.have = el.checked ? [...new Set([...me.have, el.dataset.k])] : me.have.filter(x => x !== el.dataset.k); }),
  "set-me-level": el => meSet(me => { me.levels = { ...me.levels, [el.dataset.id]: parseInt(el.value, 10) || 0 }; }),
  "set-me-focus": el => meSet(me => { me.focus = el.checked ? [...new Set([...me.focus, el.dataset.id])] : me.focus.filter(x => x !== el.dataset.id); })
};
