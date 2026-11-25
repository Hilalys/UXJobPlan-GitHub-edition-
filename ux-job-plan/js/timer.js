// Stopwatch. Writes only on start, pause, stop and focus changes.

import { S, saveNow } from "./store.js";
import { today } from "./util.js";
import { openSessionSheet } from "./forms.js";
import { toast } from "./ui.js";
import { taskById, resById, skillById } from "./model.js";
import { bus } from "./bus.js";

export const elapsed = () => (S.timer.acc || 0) + (S.timer.running ? Date.now() - S.timer.start : 0);
export const active = () => S.timer.running || (S.timer.acc || 0) > 0;
export const focusLabel = () => {
  const f = S.timer.focus;
  if (!f) return "";
  if (f.kind === "task") { const t = taskById(f.id); return t ? t.title : f.label || ""; }
  if (f.kind === "res") { const r = resById(f.id); return r ? r.title : f.label || ""; }
  if (f.kind === "skill") { const k = skillById(f.id); return k ? k.name : f.label || ""; }
  if (f.kind === "case") { const c = S.portfolio.cases.find(x => x.id === f.id); return c ? c.title : f.label || ""; }
  return f.label || "";
};

export function start(focus) {
  if (focus) S.timer.focus = focus;
  if (S.timer.running) { saveNow("timer"); bus.render(); return; }
  S.timer.running = true;
  S.timer.start = Date.now();
  saveNow("timer"); bus.render();
}
export function startTask(id) {
  const t = taskById(id); if (!t) return;
  if (active() && S.timer.focus?.id !== id) {
    toast("The stopwatch is already running. Stop and save it first.");
    return;
  }
  start({ kind: "task", id, label: t.title, track: t.track });
}
export function pause() {
  if (!S.timer.running) return;
  S.timer.acc = elapsed();
  S.timer.running = false; S.timer.start = 0;
  saveNow("timer"); bus.render();
}
export function reset() {
  S.timer.running = false; S.timer.start = 0; S.timer.acc = 0; S.timer.focus = null;
  saveNow("timer"); bus.render();
}
export function discard() {
  const snap = { ...S.timer, acc: elapsed(), running: false, start: 0 };
  reset();
  toast("Stopwatch cleared", { action: "Undo", onAction: () => { Object.assign(S.timer, snap); saveNow("timer"); bus.render(); } });
}
export function stopAndSave() {
  const ms = elapsed();
  if (ms < 60000) { toast("Less than a minute recorded. Keep going, or clear it."); return; }
  if (S.timer.running) pause();
  const f = S.timer.focus || {};
  const t = f.kind === "task" ? taskById(f.id) : null;
  const r = f.kind === "res" ? resById(f.id) : null;
  const k = f.kind === "skill" ? skillById(f.id) : null;
  const cs = f.kind === "case" ? S.portfolio.cases.find(x => x.id === f.id) : null;
  openSessionSheet({
    prefill: { fromTimer: true, date: today(), min: Math.round(ms / 60000), taskId: t ? t.id : "", resourceId: r ? r.id : "", skillId: k ? k.id : "", caseId: cs ? cs.id : (t?.caseId || ""), label: t ? t.title : r ? r.title : k ? k.name : cs ? `Case study: ${cs.title}` : f.label || "", track: t ? t.track : f.track || "learn" },
    onSaved: () => {
      reset();
      if (r) { r.last = today(); if (r.status === "todo") { r.status = "doing"; r.started = r.started || today(); } saveNow("resources"); }
    }
  });
}
