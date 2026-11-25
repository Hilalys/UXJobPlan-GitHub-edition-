// Practice sessions for Interview prep: a timer with sections or phase markers, a transcript
// (typed, pasted or dictated), recordings and attachments, and AI scoring against a rubric.
// A session in progress lives in a sheet and is kept in this browser until it's finished.

import { S, save, saveNow, txGet, txSet, txDel } from "./store.js";
import { RUBRICS, SCORE_WORDS, PHASES, WORDS_PER_MIN } from "./content4.js";
import { esc, uid, today, fmtDate, sum, $, $$ } from "./util.js";
import { icon, sheet, toast, confirmSheet, meter, closeSheet } from "./ui.js";
import { aiVisible, askJson, profileLine } from "./ai.js";
import { saveFile } from "./views/settings.js";
import { bus } from "./bus.js";
import { inPlace } from "./locale.js";

export const KINDS = {
  presentation: { name: "Portfolio presentation", rubric: "presentation", icon: "mic" },
  challenge: { name: "Design challenge", rubric: "challenge", icon: "edit" },
  story: { name: "Story practice", rubric: "story", icon: "note" },
  critique: { name: "App critique", rubric: "critique", icon: "eye" },
  answer: { name: "Recruiter-screen answer", rubric: null, icon: "mic" }
};
const LIVE_KEY = "sjp2:live";
const TX_MAX = 60000;

// ---------- Capabilities (resolved once; dictation must start straight from a click) ----------
let dict = null, dictState = "idle", dictDenied = false, dictMsg = "";
let assets = null, assetsReady = false;
export async function initPractice() {
  try { if (window.claude?.use) dict = await window.claude.use("dictation"); } catch { dict = null; }
  try { if (window.claude?.use) assets = await window.claude.use("assets"); } catch { assets = null; }
  assetsReady = true;
  if (dict) {
    try {
      dict.onPartial(({ text }) => { if (live) { live.partial = text || ""; paintPartial(); } });
      dict.onFinal(({ text }) => { if (live && text) { live.partial = ""; appendText(text); } });
      dict.onState(({ state, reason }) => {
        dictState = state;
        dictMsg = state === "idle" && reason === "hidden" ? "Dictation stopped when the page was hidden. Press Dictate to continue." : "";
        paintMic();
      });
    } catch { dict = null; }
  }
  bus.render();
}
export const canDictate = () => !!dict && !dictDenied;
export const canAttach = () => !!assets;

// ---------- The session in progress ----------
export let live = null;
try { const v = JSON.parse(localStorage.getItem(LIVE_KEY) || "null"); if (v && v.kind) { live = v; live.running = false; } } catch { live = null; }
let persistT = null;
function persist(now = false) {
  clearTimeout(persistT);
  const go = () => { try { if (live) localStorage.setItem(LIVE_KEY, JSON.stringify({ ...live, partial: "" })); else localStorage.removeItem(LIVE_KEY); } catch { /* full */ } };
  if (now) go(); else persistT = setTimeout(go, 600);
}
const elapsedMs = () => live ? (live.acc || 0) + (live.running ? Date.now() - live.startedAt : 0) : 0;
const fmt = ms => { const s = Math.max(0, Math.round(ms / 1000)); const m = Math.floor(s / 60); return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
export const fmtSec = sec => fmt(sec * 1000);
const words = t => (t.trim().match(/\S+/g) || []).length;

// plan: [{name, min}] sections; total minutes is their sum.
export function openPractice({ kind, ref = "", title = "", plan = [], context = "" }) {
  if (live && (live.kind !== kind || live.ref !== ref)) {
    confirmSheet({
      title: "Finish the session in progress first?", message: `You have a ${esc(KINDS[live.kind].name.toLowerCase())} session in progress${live.title ? `: “${esc(live.title)}”` : ""}. Discard it and start this one?`,
      confirm: "Discard and start", danger: true,
      onConfirm: () => { discardLive(true); setTimeout(() => openPractice({ kind, ref, title, plan, context }), 0); }
    });
    return;
  }
  if (!live) {
    live = { id: uid("ps"), kind, ref, title, plan: plan.map(p => ({ name: p.name, min: Number(p.min) || 0 })), context, created: new Date().toISOString(), startedAt: 0, acc: 0, running: false, laps: [], lapIdx: 0, lapStartMs: 0, text: "", partial: "", attachments: [] };
    persist(true);
  }
  showLiveSheet();
}
export function resumeLive() { if (live) showLiveSheet(); }

function startClock() { if (!live || live.running) return; live.startedAt = Date.now(); live.running = true; persist(true); paintControls(); }
function pauseClock() { if (!live || !live.running) return; live.acc = elapsedMs(); live.running = false; persist(true); paintControls(); }
function nextLap() {
  if (!live || !live.plan.length) return;
  const now = elapsedMs();
  const i = live.lapIdx;
  if (i >= live.plan.length) return;
  live.laps[i] = { name: live.plan[i].name, planned: live.plan[i].min * 60, actual: Math.round((now - (live.lapStartMs || 0)) / 1000) };
  live.lapIdx = i + 1; live.lapStartMs = now;
  persist(true); paintSections();
}
function appendText(t) {
  live.text = (live.text ? live.text.replace(/\s+$/, "") + " " : "") + t.trim();
  const ta = $("#pr-text");
  if (ta) { ta.value = live.text; ta.scrollTop = ta.scrollHeight; }
  paintPartial(); paintWords(); persist();
}
export function discardLive(silent = false) {
  if (!live) return;
  stopRec(true);
  if (dict && dictState === "listening") { try { Promise.resolve(dict.stop()).catch(() => {}); } catch { /* already stopped */ } }
  const atts = live.attachments || [];
  live = null; persist(true);
  if (assets) for (const a of atts) { try { assets.delete(a.id); } catch { /* gone */ } }
  if (!silent) { toast("Practice session discarded"); bus.render(); }
}

// ---------- Recording (falls back to attaching a file) ----------
let rec = null, recMsg = "";
async function startRec(video) {
  recMsg = "";
  if (!assets) { recMsg = "Recordings can't be saved in this view. You can still dictate or type the transcript."; paintRec(); return; }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { recMsg = "Recording isn't supported in this browser. Attach a recording instead."; paintRec(); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia(video ? { audio: true, video: { width: 640 } } : { audio: true }); }
  catch { recMsg = "Recording is blocked here. Record on your phone or computer, then attach the file."; paintRec(); return; }
  const chunks = [];
  let mr;
  try { mr = new MediaRecorder(stream); } catch { stream.getTracks().forEach(t => t.stop()); recMsg = "Recording isn't supported here. Attach a file instead."; paintRec(); return; }
  mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  mr.onstop = async () => {
    stream.getTracks().forEach(t => t.stop());
    const cancelled = rec?.cancel;
    rec = null; paintRec();
    if (cancelled || !chunks.length || !live) return;
    // An audio-only WebM is still a WebM file; stored as video so the asset store accepts it.
    const blob = new Blob(chunks, { type: "video/webm" });
    await uploadBlob(blob, `${video ? "video" : "audio"}-${today()}.webm`, video ? "video" : "audio");
  };
  mr.start(1000);
  rec = { mr, video, cancel: false, started: Date.now() };
  paintRec();
}
function stopRec(cancel = false) { if (rec) { rec.cancel = cancel; try { rec.mr.stop(); } catch { /* stopped */ } } }

async function uploadBlob(blob, name, role) {
  if (!assets || !live) return;
  if (blob.size > 20 * 1024 * 1024) { recMsg = `${name} is over 20 MB. Attach a shorter or smaller file.`; paintRec(); return; }
  recMsg = `Saving ${name}…`; paintRec();
  try {
    const r = await assets.upload(blob);
    live.attachments.push({ id: r.id, url: r.url || "/_blob/" + r.id, name, type: r.contentType || blob.type, size: r.sizeBytes || blob.size, role });
    recMsg = ""; persist(true); paintAttachments(); paintRec();
  } catch (e) {
    recMsg = e && /type|unsupported|content/i.test(String(e.message || e.code)) ? `${name} is a file type that can't be stored. Attach a video (MP4, WebM), an image or a PDF.` : `Couldn't save ${name}. Try again.`;
    paintRec();
  }
}

// ---------- Live sheet ----------
let tick = null;
function phaseAt(min) { return Math.max(0, PHASES.findIndex(p => min >= p.from && min < p.to)); }
function planTotal() { return sum(live.plan, p => p.min); }

function showLiveSheet() {
  const k = KINDS[live.kind];
  const body = `<div class="pr">
    ${live.title ? `<p class="pr-title">${esc(live.title)}</p>` : ""}
    ${live.context ? `<details class="pr-ctx"><summary>Your notes for this</summary><div class="pre small">${esc(live.context)}</div></details>` : ""}
    <div class="pr-clock-row">
      <div><span class="muted small">Elapsed</span><b class="pr-clock" data-pclock aria-live="off">${fmt(elapsedMs())}</b><span class="muted small" data-pplan>of ${planTotal()} min</span></div>
      <div class="actions" data-pctl></div>
    </div>
    ${live.kind === "challenge" ? `<ol class="pr-phases" aria-label="Phases" style="--rows:${Math.ceil(PHASES.length / 2)}">${PHASES.map((p, i) => `<li data-phase="${i}"><b>${p.from}–${p.to}</b><span>${esc(p.name)}<small>${esc(p.tip)}</small></span></li>`).join("")}</ol>` : ""}
    ${live.kind !== "challenge" && live.plan.length > 1 ? `<ol class="pr-secs" data-psecs aria-label="Sections" style="--rows:${Math.ceil(live.plan.length / 2)}"></ol>` : ""}
    <div class="field pr-tx">
      <div class="li-part-h"><label for="pr-text"><b>Transcript</b></label><span class="muted small" data-pwords></span></div>
      <p class="hint">${canDictate() ? "Press Dictate and talk, or type and paste. " : "Dictation works in Chrome-based browsers and the Claude desktop app. Here, type or paste what you said. "}The AI scores what's written here.</p>
      <textarea id="pr-text" rows="9" maxlength="${TX_MAX}">${esc(live.text)}</textarea>
      <p class="pr-partial muted small" data-ppartial aria-live="polite"></p>
      <div class="actions" data-pmic></div>
    </div>
    <div class="field"><span class="lbl">Recording and attachments</span>
      <div class="actions" data-prec></div>
      <p class="small muted" data-precmsg role="status"></p>
      <ul class="pr-atts" data-patts></ul>
      <input type="file" id="pr-file" hidden accept="video/*,audio/*,image/*,application/pdf" multiple>
    </div>
  </div>`;
  sheet({
    title: k.name, sub: live.kind === "challenge" ? "45 minutes. Spend the first 5–8 on questions only, and end with metrics." : live.kind === "presentation" ? "Press Next section as you move on; the times are kept per section." : "", wide: true, body,
    foot: `<button class="btn btn-danger" type="button" data-pdiscard>${icon("trash", "sm")}Discard</button><span class="spacer"></span><button class="btn btn-ghost" type="button" data-close>Keep for later</button><button class="btn btn-primary" type="button" data-pfinish>${icon("check", "sm")}Finish and save</button>`,
    onClose: () => { clearInterval(tick); tick = null; stopRec(false); bus.render(); },
    onMount: (el, api) => {
      paintControls(); paintSections(); paintMic(); paintRec(); paintAttachments(); paintWords(); paintTick();
      const ta = $("#pr-text", el);
      ta.addEventListener("input", () => { live.text = ta.value; paintWords(); persist(); });
      el.addEventListener("click", e => {
        const b = e.target.closest("button"); if (!b) return;
        if (b.hasAttribute("data-pstart")) startClock();
        else if (b.hasAttribute("data-ppause")) pauseClock();
        else if (b.hasAttribute("data-plap")) nextLap();
        else if (b.hasAttribute("data-pdict")) {
          if (!dict) return;
          if (dictState === "listening") { Promise.resolve(dict.stop()).catch(() => {}); return; }
          // Start straight from the click: nothing awaited before it.
          const pr = dict.start();
          if (!live.running) startClock();
          Promise.resolve(pr).catch(err => {
            if (err && err.code === "not_granted") { dictDenied = true; dictMsg = "Microphone access was declined, so dictation is off. You can still type or paste."; }
            else if (err && err.code === "dismissed") dictMsg = "Dictation was dismissed. Press Dictate to try again.";
            else dictMsg = "Dictation couldn't start. Type or paste instead.";
            paintMic();
          });
        }
        else if (b.hasAttribute("data-prec-a")) startRec(false);
        else if (b.hasAttribute("data-prec-v")) startRec(true);
        else if (b.hasAttribute("data-prec-stop")) stopRec(false);
        else if (b.hasAttribute("data-pattach")) $("#pr-file", el).click();
        else if (b.dataset.pdel) {
          const i = live.attachments.findIndex(a => a.id === b.dataset.pdel); if (i < 0) return;
          const [a] = live.attachments.splice(i, 1); persist(true); paintAttachments();
          if (assets) { try { assets.delete(a.id); } catch { /* gone */ } }
        }
        else if (b.hasAttribute("data-pdiscard")) { api.close(); confirmSheet({ title: "Discard this session?", message: "The timer, transcript and attachments are deleted.", confirm: "Discard", danger: true, onConfirm: () => discardLive() }); }
        else if (b.hasAttribute("data-pfinish")) {
          if (!live.text.trim() && !live.attachments.length && elapsedMs() < 5000) { toast("Nothing to save yet. Start the timer, then dictate or type what you said."); return; }
          const s = finishLive(); api.close(); if (s) setTimeout(() => openSession(s.id), 0);
        }
      });
      $("#pr-file", el).addEventListener("change", async e => {
        const files = Array.from(e.target.files || []); e.target.value = "";
        if (!assets) { recMsg = "Attachments can't be saved in this view."; paintRec(); return; }
        for (const f of files.slice(0, 6)) await uploadBlob(f, f.name, f.type.startsWith("image/") ? "sketch" : f.type.startsWith("video/") ? "video" : f.type.startsWith("audio/") ? "audio" : "file");
      });
      tick = setInterval(paintTick, 500);
    }
  });
}

function paintControls() {
  const c = $("[data-pctl]"); if (!c || !live) return;
  const lap = live.kind !== "challenge" && live.plan.length > 1 && live.lapIdx < live.plan.length;
  c.innerHTML = `${live.running ? `<button class="btn" type="button" data-ppause>${icon("pause", "sm")}Pause</button>` : `<button class="btn btn-primary" type="button" data-pstart>${icon("play", "sm")}${live.acc ? "Resume" : "Start"}</button>`}
    ${lap ? `<button class="btn" type="button" data-plap ${live.running ? "" : "disabled"}>${icon("arrowR", "sm")}${live.lapIdx === live.plan.length - 1 ? "End last section" : "Next section"}</button>` : ""}`;
}
function paintSections() {
  const ol = $("[data-psecs]"); if (!ol || !live) return;
  ol.innerHTML = live.plan.map((p, i) => {
    const lap = live.laps[i], now = i === live.lapIdx;
    const over = lap && lap.actual > lap.planned * 1.15;
    return `<li class="${now ? "is-now" : ""} ${lap ? "is-done" : ""}"><span>${esc(p.name)}</span><span class="pr-sec-t">${lap ? `<b class="${over ? "warn-text" : ""}">${fmt(lap.actual * 1000)}</b> / ` : now ? `<b data-plapclock>00:00</b> / ` : ""}${p.min} min</span></li>`;
  }).join("");
  paintControls();
}
function paintTick() {
  if (!live) return;
  const ms = elapsedMs();
  $$("[data-pclock]").forEach(el => { el.textContent = fmt(ms); el.classList.toggle("over", planTotal() > 0 && ms > planTotal() * 60000); });
  const lc = $("[data-plapclock]");
  if (lc) {
    lc.textContent = fmt(ms - (live.lapStartMs || 0));
    const p = live.plan[live.lapIdx]; lc.classList.toggle("warn-text", !!p && ms - (live.lapStartMs || 0) > p.min * 60000);
  }
  if (live.kind === "challenge") {
    const i = phaseAt(ms / 60000);
    $$("[data-phase]").forEach(li => { const j = +li.dataset.phase; li.classList.toggle("is-now", j === i && ms > 0); li.classList.toggle("is-done", j < i); });
  }
  if (rec) { const r = $("[data-precclock]"); if (r) r.textContent = fmt(Date.now() - rec.started); }
}
function paintPartial() { const p = $("[data-ppartial]"); if (p) p.textContent = live?.partial ? `Hearing: ${live.partial}` : ""; }
function paintWords() {
  const w = $("[data-pwords]"); if (!w || !live) return;
  const n = words(live.text);
  w.textContent = n ? `${n.toLocaleString()} words · about ${Math.max(1, Math.round(n / WORDS_PER_MIN))} min spoken` : "";
}
function paintMic() {
  const m = $("[data-pmic]"); if (!m) return;
  m.innerHTML = canDictate() ? `<button class="btn ${dictState === "listening" ? "btn-primary" : ""}" type="button" data-pdict aria-pressed="${dictState === "listening"}">${dictState === "listening" ? `<span class="pulse" aria-hidden="true"></span>Stop dictation` : `${icon("mic", "sm")}Dictate`}</button>${dictMsg ? `<p class="small muted" role="status">${esc(dictMsg)}</p>` : ""}`
    : dictMsg ? `<p class="small muted" role="status">${esc(dictMsg)}</p>` : "";
}
function paintRec() {
  const r = $("[data-prec]"); if (!r) return;
  if (!assetsReady) { r.innerHTML = ""; return; }
  r.innerHTML = rec ? `<span class="pr-recording"><span class="pulse" aria-hidden="true"></span>Recording ${rec.video ? "video" : "audio"} <b data-precclock>00:00</b></span><button class="btn" type="button" data-prec-stop>${icon("stop", "sm")}Stop recording</button>`
    : assets ? `<button class="btn btn-sm" type="button" data-prec-a>${icon("mic", "sm")}Record audio</button><button class="btn btn-sm" type="button" data-prec-v>${icon("play", "sm")}Record video</button><button class="btn btn-sm" type="button" data-pattach>${icon("upload", "sm")}${live?.kind === "challenge" ? "Add sketch photo or file" : "Attach a file"}</button>`
    : `<p class="small muted">Recordings and attachments can't be saved in this view. Open the tool in Claude to attach files.</p>`;
  const msg = $("[data-precmsg]"); if (msg) msg.textContent = recMsg;
}
function attachHTML(a, removable) {
  const kb = a.size ? ` · ${a.size > 1048576 ? (a.size / 1048576).toFixed(1) + " MB" : Math.round(a.size / 1024) + " KB"}` : "";
  const media = /^image\//.test(a.type) ? `<img src="${esc(a.url)}" alt="${esc(a.role === "sketch" ? "Sketch" : a.name)}" loading="lazy">`
    : /^(video|audio)\//.test(a.type) ? `<video src="${esc(a.url)}" controls preload="metadata" aria-label="${esc(a.name)}"></video>` : "";
  return `<li>${media}<span class="small"><a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.name)}</a><span class="muted">${kb}</span></span>${removable ? `<button class="icon-btn sm danger" type="button" data-pdel="${esc(a.id)}" aria-label="Remove ${esc(a.name)}">${icon("x", "sm")}</button>` : ""}</li>`;
}
function paintAttachments() { const u = $("[data-patts]"); if (u && live) u.innerHTML = live.attachments.map(a => attachHTML(a, true)).join(""); }

export function finishLive() {
  if (!live) return null;
  if (live.running) pauseClock();
  if (live.plan.length > 1 && live.lapIdx < live.plan.length && live.kind !== "challenge") nextLap();
  stopRec(false);
  if (dict && dictState === "listening") { try { Promise.resolve(dict.stop()).catch(() => {}); } catch { /* stopped */ } }
  const text = (live.text || "").slice(0, TX_MAX);
  const s = {
    id: live.id, kind: live.kind, ref: live.ref, title: live.title, date: today(), sec: Math.round(elapsedMs() / 1000), planned: planTotal() * 60,
    laps: live.laps.filter(Boolean), words: words(text), hasTx: !!text.trim(), preview: text.slice(0, 240),
    attachments: live.attachments.slice(), scores: null, why: null, strengths: [], fixes: [], summary: "", delivery: [], content: [], scoredAt: "", notes: ""
  };
  S.practice.list.unshift(s);
  saveNow("practice");
  if (s.hasTx) txSet(s.id, text);
  if (live.kind === "story") {
    const st = S.stories.list.find(x => x.id === live.ref);
    if (st) { st.practiced = (st.practiced || 0) + 1; st.lastPracticed = today(); if (st.status === "ready") st.status = "rehearsed"; save("stories"); }
  }
  live = null; persist(true);
  bus.render(); toast("Practice session saved");
  return s;
}

// ---------- Saved sessions ----------
export const sessionById = id => S.practice.list.find(s => s.id === id);
export const sessionsOf = (kind, ref = null) => S.practice.list.filter(s => s.kind === kind && (ref == null || s.ref === ref));
export function avgScore(s) {
  if (!s.scores) return null;
  const v = Object.values(s.scores).map(Number).filter(n => n >= 1 && n <= 4);
  return v.length ? sum(v) / v.length : null;
}
let scoring = null; // { id, ctl }

export function scoresHTML(s) {
  const rub = KINDS[s.kind].rubric && RUBRICS[KINDS[s.kind].rubric];
  const avg = avgScore(s);
  return `${s.summary ? `<p>${esc(s.summary)}</p>` : ""}
    ${rub && s.scores ? `<div class="score-head"><b class="big-num">${avg.toFixed(1)}<small> / 4 average</small></b></div>
      <ul class="rubric">${rub.rows.map(([k, l]) => { const v = Number(s.scores[k]) || 0; return `<li><span class="rb-l">${esc(l)}${s.why?.[k] ? `<small>${esc(s.why[k])}</small>` : ""}</span><span class="rb-v" aria-label="${v} of 4, ${SCORE_WORDS[v] || "not scored"}">${[1, 2, 3, 4].map(i => `<i class="${i <= v ? "on" : ""}"></i>`).join("")}<b>${v || "–"}</b></span></li>`; }).join("")}</ul>` : ""}
    ${s.strengths?.length ? `<h3 class="h-sm">What worked</h3><ul class="plain">${s.strengths.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    ${s.delivery?.length ? `<h3 class="h-sm">Delivery</h3><ul class="plain">${s.delivery.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    ${s.content?.length ? `<h3 class="h-sm">Content</h3><ul class="plain">${s.content.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    ${s.fixes?.length ? `<h3 class="h-sm">${s.fixes.length} fixes for next time</h3><ol class="fixes">${s.fixes.map(x => `<li>${esc(x)}</li>`).join("")}</ol>` : ""}
    ${s.scoredAt ? `<p class="small muted">AI feedback from ${fmtDate(s.scoredAt, { year: true })}. It judges the transcript only, so it can't see slides or hear your voice.</p>` : ""}`;
}

export function openSession(id) {
  const s = sessionById(id); if (!s) return;
  const k = KINDS[s.kind];
  let ctl = null;
  const lapChart = s.laps?.length ? `<div class="trows hb lap-rows">${s.laps.map(l => { const over = l.actual > l.planned * 1.15; return `<div class="trow"><span class="tn" title="${esc(l.name)}">${esc(l.name)}</span>
      ${meter(l.actual, Math.max(l.planned, l.actual, 1), { color: over ? "var(--c-practice)" : "var(--c-apply)", marker: l.planned, thin: true, label: `${l.name}: ${fmtSec(l.actual)} of ${fmtSec(l.planned)} planned` })}
      <span class="tv ${over ? "warn-text" : ""}">${fmtSec(l.actual)} / ${Math.round(l.planned / 60)}m</span></div>`; }).join("")}</div><p class="small muted">Bars are the time you spent; ticks mark the plan. Amber means over by more than 15%.</p>` : "";
  sheet({
    title: k.name, sub: `${fmtDate(s.date, { dow: true, year: true })} · ${fmtSec(s.sec)}${s.planned ? ` of ${Math.round(s.planned / 60)} min planned` : ""}${s.words ? ` · ${s.words.toLocaleString()} words` : ""}`, wide: true,
    body: `${s.title ? `<p class="pr-title">${esc(s.title)}</p>` : ""}
      ${lapChart ? `<h3 class="h-sm" style="margin-top:12px">Time per section</h3><div class="pr-laps">${lapChart}</div>` : ""}
      <div data-sfb>${s.scoredAt ? scoresHTML(s) : ""}</div>
      ${aiVisible() && (s.hasTx || s.attachments.some(a => a.role === "sketch")) ? `<div class="actions" style="margin:8px 0 12px"><button class="btn ${s.scoredAt ? "" : "btn-primary"}" type="button" data-sscore>${icon("sparkle", "sm")}${s.scoredAt ? "Score again" : "Get AI feedback"}</button></div><div data-swait></div>` : !s.hasTx ? `<p class="muted small">No transcript, so there's nothing for the AI to score. Add notes below on how it went.</p>` : ""}
      <details class="pr-ctx" ${s.hasTx && !s.scoredAt ? "open" : ""}><summary>Transcript</summary><div class="pre small" data-stx>${s.hasTx ? "Loading…" : "No transcript."}</div></details>
      ${s.attachments?.length ? `<h3 class="h-sm" style="margin-top:12px">Attachments</h3><ul class="pr-atts">${s.attachments.map(a => attachHTML(a, false)).join("")}</ul>` : ""}
      <div class="field" style="margin-top:12px"><label for="s-notes">Your notes</label><textarea id="s-notes" rows="3" maxlength="2000" placeholder="How it felt, what to change">${esc(s.notes || "")}</textarea></div>`,
    foot: `<button class="btn btn-danger" type="button" data-sdel>${icon("trash", "sm")}Delete</button><span class="spacer"></span><button class="btn" type="button" data-sdl>${icon("download", "sm")}Download</button><button class="btn btn-primary" type="button" data-close>Done</button>`,
    onClose: () => { if (ctl) ctl.abort(); },
    onMount: async (el, api) => {
      const notes = $("#s-notes", el);
      notes.addEventListener("input", () => { s.notes = notes.value; save("practice"); });
      $("[data-sdl]", el).addEventListener("click", async () => saveFile(`practice-${s.kind}-${s.date}.md`, sessionMarkdown(s, await txGet(s.id)), "text/markdown"));
      $("[data-sdel]", el).addEventListener("click", () => {
        api.close();
        confirmSheet({ title: "Delete this practice session?", message: "Its transcript, scores and attachments are deleted.", confirm: "Delete", danger: true, onConfirm: () => {
          const i = S.practice.list.indexOf(s); if (i >= 0) S.practice.list.splice(i, 1);
          saveNow("practice"); txDel(s.id);
          if (assets) for (const a of s.attachments || []) { try { assets.delete(a.id); } catch { /* gone */ } }
          bus.render(); toast("Session deleted");
        } });
      });
      const sb = $("[data-sscore]", el);
      if (sb) sb.addEventListener("click", async () => {
        const wait = $("[data-swait]", el);
        ctl = new AbortController(); sb.disabled = true;
        wait.innerHTML = `<div class="ai-wait" role="status"><div class="spinner" aria-hidden="true"></div><p>Scoring against the rubric… this can take up to a minute.</p><button class="btn btn-sm" type="button" data-scancel>Cancel</button></div>`;
        $("[data-scancel]", wait).addEventListener("click", () => ctl.abort());
        try {
          await scoreSession(s, ctl.signal);
          $("[data-sfb]", el).innerHTML = scoresHTML(s); wait.innerHTML = ""; sb.textContent = "Score again";
          bus.render();
        } catch (e) { wait.innerHTML = ctl.signal.aborted ? "" : `<p class="error" role="alert">${esc(e.message)}</p>`; }
        sb.disabled = false; ctl = null;
      });
      if (s.hasTx) { const t = await txGet(s.id); const box = $("[data-stx]", el); if (box) box.textContent = t || "The transcript isn't available on this device yet."; }
    }
  });
}

export function sessionMarkdown(s, text) {
  const k = KINDS[s.kind], rub = k.rubric && RUBRICS[k.rubric];
  const L = [`# ${k.name}${s.title ? `: ${s.title}` : ""}`, "", `${fmtDate(s.date, { dow: true, year: true })} · ${fmtSec(s.sec)}${s.planned ? ` of ${Math.round(s.planned / 60)} min planned` : ""}`, ""];
  if (s.laps?.length) { L.push("## Time per section", "", "| Section | Planned | Actual |", "| --- | --- | --- |", ...s.laps.map(l => `| ${l.name} | ${fmtSec(l.planned)} | ${fmtSec(l.actual)} |`), ""); }
  if (s.scoredAt) {
    L.push("## AI feedback", "");
    if (s.summary) L.push(s.summary, "");
    if (rub && s.scores) { L.push("| Area | Score (1–4) | Why |", "| --- | --- | --- |", ...rub.rows.map(([key, l]) => `| ${l} | ${s.scores[key] ?? "–"} | ${(s.why?.[key] || "").replace(/\|/g, "/")} |`), ""); }
    for (const [h, arr] of [["What worked", s.strengths], ["Delivery", s.delivery], ["Content", s.content], ["Fixes", s.fixes]]) if (arr?.length) L.push(`### ${h}`, "", ...arr.map(x => `- ${x}`), "");
  }
  if (s.notes) L.push("## Notes", "", s.notes, "");
  if (s.attachments?.length) L.push("## Attachments", "", ...s.attachments.map(a => `- ${a.name}`), "");
  L.push("## Transcript", "", text || "(none)", "");
  return L.join("\n");
}

// ---------- AI scoring ----------
async function sketchImages(s) {
  const out = [];
  for (const a of (s.attachments || []).filter(a => a.role === "sketch" && /^image\//.test(a.type)).slice(0, 3)) {
    try {
      const blob = await (await fetch(a.url)).blob();
      out.push(await shrink(blob));
    } catch { /* skip this one */ }
  }
  return out;
}
function shrink(blob, max = 1600) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob), img = new Image();
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      if (r >= 1 && blob.size < 1.5 * 1048576) { URL.revokeObjectURL(url); resolve(blob); return; }
      const c = document.createElement("canvas"); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => { URL.revokeObjectURL(url); resolve(b || blob); }, "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
    img.src = url;
  });
}
const clean = (arr, n, len = 300) => (Array.isArray(arr) ? arr : []).map(x => String(x || "").trim()).filter(Boolean).slice(0, n).map(x => x.slice(0, len));

export async function scoreSession(s, signal) {
  const text = (await txGet(s.id)).slice(0, 30000);
  const k = KINDS[s.kind], rub = k.rubric && RUBRICS[k.rubric];
  const images = s.kind === "challenge" ? await sketchImages(s) : [];
  const timing = s.laps?.length ? `\nPlanned vs actual time per section: ${s.laps.map(l => `${l.name}: planned ${fmtSec(l.planned)}, actual ${fmtSec(l.actual)}`).join("; ")}.` : "";
  const what = {
    presentation: "a practice portfolio presentation (spoken, transcribed)",
    challenge: `a practice design challenge. The prompt: "${s.title}". Phases they aimed for: ${PHASES.map(p => `${p.name} (${p.from}–${p.to} min)`).join(", ")}`,
    story: `a spoken practice answer to the behavioral question "${s.title}"`,
    critique: `a spoken app critique of ${s.title || "an app"}. A good critique covers who it's for and the job it does, strengths with reasons, problems ranked by impact, a fix and how to measure it, business awareness, and a clear structure`,
    answer: `a spoken practice answer for a recruiter screen: "${s.title}". Aim for about a minute, clear and specific`
  }[s.kind];
  const keys = rub ? rub.rows.map(r => r[0]) : [];
  const shape = rub
    ? `{"scores":{${keys.map(x => `"${x}":1`).join(",")}},"why":{${keys.map(x => `"${x}":"one sentence"`).join(",")}},"strengths":["",""],"fixes":["","",""],"summary":"two sentences"${s.kind === "story" ? `,"delivery":["",""]` : ""}}`
    : `{"delivery":["",""],"content":["",""],"fixes":["","",""],"summary":"two sentences"}`;
  const prompt = `You are an interview coach for product designers applying${inPlace()}. Give honest, specific feedback on ${what}.
${profileLine()}
Elapsed time: ${fmtSec(s.sec)}${s.planned ? ` of ${Math.round(s.planned / 60)} minutes planned` : ""}. Words: ${s.words}.${timing}
${rub ? `Score each rubric row from 1 to 4 (1 missing, 2 partly there, 3 solid, 4 strong). Rows:\n${rub.rows.map(([key, l]) => `- ${key}: ${l}`).join("\n")}\nIf the transcript is too short to judge a row, give it 1 and say so in "why".` : "Comment on delivery (pace, filler words, clarity, length) and content (relevance, specifics, structure)."}
${images.length ? `${images.length} photo(s) of their sketches are attached; use them when judging ideas, flows and trade-offs.` : ""}
Quote short phrases from the transcript as evidence. Exactly 3 fixes, each one concrete thing to do differently next time. Don't invent facts about their work.
Transcript: """${text || "(no transcript)"}"""
Reply with only JSON in this shape: ${shape}`;
  scoring = { id: s.id };
  try {
    const res = await askJson(prompt, { signal, images, tier: "default" });
    if (rub) {
      const sc = {}, why = {};
      for (const key of keys) { const v = Math.round(Number(res?.scores?.[key])); sc[key] = v >= 1 && v <= 4 ? v : 1; why[key] = String(res?.why?.[key] || "").slice(0, 240); }
      s.scores = sc; s.why = why; s.strengths = clean(res?.strengths, 3);
    }
    s.fixes = clean(res?.fixes, 3); s.summary = String(res?.summary || "").slice(0, 500);
    s.delivery = clean(res?.delivery, 4); s.content = clean(res?.content, 4);
    if (!s.fixes.length && !s.scores) throw new Error("The feedback came back empty. Try again.");
    s.scoredAt = today();
    saveNow("practice");
  } finally { scoring = null; }
  return s;
}

// History list for a kind (or one item, such as one story).
export function historyHTML(list, { empty = "No practice sessions yet.", showTitle = true, max = 8 } = {}) {
  if (!list.length) return `<p class="muted small">${esc(empty)}</p>`;
  return `<ul class="hist">${list.slice(0, max).map(s => {
    const avg = avgScore(s);
    return `<li><div class="hist-main"><b>${fmtDate(s.date, { dow: true })}</b>${showTitle && s.title ? ` · <span>${esc(s.title.length > 70 ? s.title.slice(0, 68) + "…" : s.title)}</span>` : ""}<div class="small muted">${fmtSec(s.sec)}${s.planned ? ` of ${Math.round(s.planned / 60)} min` : ""}${s.words ? ` · ${s.words.toLocaleString()} words` : ""}${s.attachments?.length ? ` · ${s.attachments.length} attachment${s.attachments.length > 1 ? "s" : ""}` : ""}</div></div>
      ${avg != null ? `<span class="tag ${avg >= 3 ? "good" : avg >= 2 ? "info" : "warn"}">${avg.toFixed(1)} / 4</span>` : s.scoredAt ? `<span class="tag info">Feedback</span>` : ""}
      <button class="btn btn-sm" type="button" data-act="pr-open" data-id="${s.id}">Open</button></li>`;
  }).join("")}</ul>${list.length > max ? `<p class="small muted">${list.length - max} older session${list.length - max > 1 ? "s" : ""} not shown.</p>` : ""}`;
}

export function liveBanner() {
  if (!live) return "";
  return `<div class="banner warn" role="note">${icon("clock")}<p><b>Practice in progress:</b> ${esc(KINDS[live.kind].name)}${live.title ? ` · ${esc(live.title.length > 60 ? live.title.slice(0, 58) + "…" : live.title)}` : ""} · <span data-pclock>${fmt(elapsedMs())}</span>${live.running ? "" : " (paused)"}</p><button class="btn btn-sm btn-primary" type="button" data-act="pr-resume">Open</button></div>`;
}
setInterval(() => { if (live && live.running && !document.querySelector(".pr")) { const t = fmt(elapsedMs()); $$("[data-pclock]").forEach(el => { el.textContent = t; }); } }, 1000);

export const practiceActions = {
  "pr-open": d => openSession(d.id),
  "pr-resume": () => resumeLive()
};
export { closeSheet };
