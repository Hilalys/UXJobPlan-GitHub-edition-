// LinkedIn post writer: pick a post type, say what to include, drag preference chips
// (length, tone, format, opening, extras) into the prompt, then write and compare versions.

import { S, save } from "./store.js";
import { esc, uid, fmtDate, today, $, $$ } from "./util.js";
import { icon, toast } from "./ui.js";
import { aiVisible, askJson, profileLine } from "./ai.js";
import { copyText } from "./views/settings.js";

export const POST_TYPES = [
  { id: "insight", label: "Insight", p: "an insight post: one specific thing they learned or noticed, and why it matters to designers" },
  { id: "project", label: "Project update", p: "a project update: what they are building or researching, one decision they made and what's next" },
  { id: "lesson", label: "Lesson learned", p: "a lesson-learned post: something that didn't go as planned and what they changed" },
  { id: "resource", label: "Resource I recommend", p: "a recommendation: a course, book, article or tool, what they took from it and who it's for" },
  { id: "event", label: "Event recap", p: "an event recap: the event, two or three takeaways and a thank-you to the hosts or speakers by role" },
  { id: "question", label: "Question to the community", p: "a question post: a real question they're working through, with their current thinking, inviting answers" },
  { id: "milestone", label: "Career update", p: "a career update: a milestone or what they're looking for next, without sounding like a bulletin" },
  { id: "behind", label: "Behind the scenes", p: "a behind-the-scenes post: how they work, a process or a tool setup, shown step by step" }
];

// Preference chips. "one" groups keep a single chip; "many" groups keep up to max.
export const PREF_GROUPS = [
  { id: "length", label: "Length", one: true, chips: [
    { id: "len-short", label: "Short", sub: "~80 words", p: "about 80 words" },
    { id: "len-med", label: "Medium", sub: "~150 words", p: "about 150 words" },
    { id: "len-long", label: "Long", sub: "~250 words", p: "about 250 words" }] },
  { id: "tone", label: "Tone", max: 2, chips: [
    { id: "tone-warm", label: "Warm", p: "warm" }, { id: "tone-pro", label: "Professional", p: "professional" },
    { id: "tone-curious", label: "Curious", p: "curious" }, { id: "tone-confident", label: "Confident", p: "confident but not boastful" },
    { id: "tone-reflective", label: "Reflective", p: "reflective" }, { id: "tone-playful", label: "Light and playful", p: "light and a little playful" }] },
  { id: "format", label: "Format", one: true, chips: [
    { id: "fmt-story", label: "Short story", p: "a short story with a beginning, a turn and a takeaway" },
    { id: "fmt-list", label: "Numbered takeaways", p: "a one-line intro, then 3 to 5 numbered takeaways" },
    { id: "fmt-plain", label: "Plain paragraphs", p: "two or three short paragraphs" },
    { id: "fmt-before", label: "Before and after", p: "how they used to think or work, then what changed" }] },
  { id: "open", label: "Opening", one: true, chips: [
    { id: "open-line", label: "Concrete first line", p: "open with one concrete, specific line (no throat-clearing)" },
    { id: "open-q", label: "Open with a question", p: "open with a short question" },
    { id: "open-fact", label: "Open with a fact", p: "open with a fact or detail that is already in their notes (never an invented statistic)" }] },
  { id: "extras", label: "Extras", max: 4, chips: [
    { id: "x-ask", label: "End with a question", p: "end with a question that invites replies" },
    { id: "x-cta", label: "Light call to action", p: "end with a light invitation (to connect, comment or share a resource)" },
    { id: "x-tags", label: "2–3 hashtags", p: "add 2 or 3 relevant hashtags at the very end" },
    { id: "x-link", label: "Room for a link", p: "leave a line for a link, written as [link]" }] },
  { id: "emoji", label: "Emoji", one: true, chips: [
    { id: "emo-none", label: "No emoji", p: "no emoji" }, { id: "emo-few", label: "One or two emoji", p: "at most two emoji" }] }
];
const CHIP = Object.fromEntries(PREF_GROUPS.flatMap(g => g.chips.map(c => [c.id, { ...c, group: g }])));
const DEFAULT_PREFS = { type: "insight", chips: ["len-med", "tone-warm", "fmt-plain", "open-line", "x-ask", "emo-none"], notes: "" };

const L = () => S.linkedin;
export const lastPrefs = () => {
  const p = L().postPrefs || {};
  return { type: POST_TYPES.some(t => t.id === p.type) ? p.type : DEFAULT_PREFS.type, chips: Array.isArray(p.chips) ? p.chips.filter(id => CHIP[id]) : [...DEFAULT_PREFS.chips], notes: "" };
};
const words = t => (t.trim().match(/\S+/g) || []).length;
export const versionLabel = v => [POST_TYPES.find(t => t.id === v.type)?.label, ...(v.chips || []).filter(id => /^(len|tone)-/.test(id)).map(id => CHIP[id]?.label)].filter(Boolean).join(" · ");

// Adding a chip respects its group: one-only groups swap, capped groups drop the oldest.
function addChip(list, id) {
  const c = CHIP[id]; if (!c || list.includes(id)) return list;
  let out = list.filter(x => !(c.group.one && CHIP[x]?.group.id === c.group.id));
  const same = out.filter(x => CHIP[x]?.group.id === c.group.id);
  if (c.group.max && same.length >= c.group.max) out = out.filter(x => x !== same[0]);
  return [...out, id];
}

export function buildPrompt({ type, chips, notes, topic, draft, earlier = [] }, { forPreview = false } = {}) {
  const t = POST_TYPES.find(x => x.id === type) || POST_TYPES[0];
  const byGroup = PREF_GROUPS.map(g => {
    const sel = chips.filter(id => CHIP[id]?.group.id === g.id).map(id => CHIP[id].p);
    return sel.length ? `- ${g.label}: ${sel.join("; ")}` : "";
  }).filter(Boolean);
  const lines = [
    `Write a LinkedIn post for a product designer, in their voice, first person.${forPreview ? " (AI also gets your profile from Settings.)" : " " + profileLine()}`,
    "",
    `Post type: ${t.p}.`,
    `Topic: ${topic || "(add a topic)"}`,
    notes ? `What to include or avoid, in their words: ${notes}` : "",
    draft ? `Their notes or current draft (use their facts; keep any phrasing they clearly like): """${draft.slice(0, 2000)}"""` : "",
    byGroup.length ? `\nPreferences:\n${byGroup.join("\n")}` : "",
    L().rules.length ? `\nHer voice rules (follow every one): ${L().rules.join("; ")}.` : "",
    "\nNever invent results, numbers, names, employers or quotes. Nothing confidential about past clients. No buzzwords.",
    earlier.length ? `\nShe already has ${earlier.length} version${earlier.length > 1 ? "s" : ""}. Make this one clearly different in angle and first line. Earlier first lines: ${earlier.map(v => `"${v.text.split("\n")[0].slice(0, 120)}"`).join("; ")}.` : "",
    forPreview ? "" : `\nReply with only JSON: {"text":""}`
  ];
  return lines.filter(x => x !== "").join("\n").replace(/\n{3,}/g, "\n\n");
}

// ---------- Markup ----------
function chipBtn(id, inZone) {
  const c = CHIP[id];
  return `<button class="pchip${inZone ? " in" : ""}" type="button" draggable="true" data-pchip="${id}" data-g="${c.group.id}" aria-pressed="${inZone}" aria-label="${esc(`${c.group.label}: ${c.label}${c.sub ? `, ${c.sub}` : ""}. ${inZone ? "In your prompt. Press to remove." : "Press to add to your prompt."}`)}">
    <span>${esc(c.label)}${c.sub ? `<small>${esc(c.sub)}</small>` : ""}</span>${inZone ? `<i aria-hidden="true">${icon("x", "sm")}</i>` : ""}</button>`;
}
export function writerHTML() {
  return `<details class="pw" open data-pw>
    <summary class="pw-sum"><span class="chev">${icon("chev", "sm")}</span><b>${icon("sparkle", "sm")}Write it with AI</b><span class="muted small" data-pw-count></span></summary>
    <div class="pw-body">
      <div class="field"><span class="lbl" id="pw-type-l">What kind of post?</span>
        <div class="pw-types" role="radiogroup" aria-labelledby="pw-type-l" data-pw-types></div></div>
      <div class="field"><label for="pw-notes">What should it say? <span class="muted">(what to include, what to leave out)</span></label>
        <textarea id="pw-notes" rows="3" placeholder="e.g. Mention the 5 commuter interviews and the one surprise. Don't name the companies I talked to."></textarea></div>
      <div class="field"><span class="lbl" id="pw-pref-l">Preferences</span>
        <p class="hint">Drag options into your prompt, or press one to add it. Length, format, opening and emoji keep one choice each; tone keeps up to two.</p>
        <div class="pw-pref">
          <div class="pw-tray" data-pw-tray aria-label="Options"></div>
          <div class="pw-zone" data-pw-zone role="group" aria-labelledby="pw-zone-l"><p class="pw-zone-h" id="pw-zone-l">${icon("target", "sm")}Your prompt uses</p><div class="pw-zone-chips" data-pw-zone-chips></div></div>
        </div></div>
      <details class="pw-prev"><summary class="link-btn">See the prompt</summary><pre class="pw-pre" data-pw-pre></pre>
        <button class="btn btn-sm btn-ghost" type="button" data-pw-copy>${icon("copy", "sm")}Copy prompt</button></details>
      <div class="actions"><button class="btn btn-primary" type="button" data-pw-go>${icon("sparkle", "sm")}Write a version</button><span class="muted small" data-pw-msg></span></div>
      <div data-pw-wait></div>
      <div class="pw-vers" data-pw-vers></div>
    </div></details>`;
}

// ---------- Behaviour ----------
// opts: { root, getTopic, getDraft, setDraft, versions (array, mutated), persist() }
export function mountWriter({ root, getTopic, getDraft, setDraft, versions, persist }) {
  const st = lastPrefs();
  let sel = versions.length ? versions.length - 1 : -1, ctl = null;
  const q = s => $(s, root);
  const ai = aiVisible();
  if (!ai) { q("[data-pw-go]").hidden = true; q("[data-pw-msg]").textContent = "AI is off in Settings. You can still build the prompt and copy it."; q(".pw-prev").open = true; }

  const paintTypes = () => {
    q("[data-pw-types]").innerHTML = POST_TYPES.map(t => `<button class="pchip pchip-type" type="button" role="radio" aria-checked="${t.id === st.type}" data-pw-type="${t.id}" tabindex="${t.id === st.type ? 0 : -1}">${esc(t.label)}</button>`).join("");
  };
  const paintChips = () => {
    q("[data-pw-tray]").innerHTML = PREF_GROUPS.map(g => {
      const free = g.chips.filter(c => !st.chips.includes(c.id));
      return `<div class="pw-grp"><span class="pw-grp-l">${esc(g.label)}</span><div class="pw-grp-c">${free.length ? free.map(c => chipBtn(c.id, false)).join("") : `<span class="muted small">All in your prompt</span>`}</div></div>`;
    }).join("");
    q("[data-pw-zone-chips]").innerHTML = st.chips.length ? st.chips.map(id => chipBtn(id, true)).join("") : `<span class="muted small pw-empty">Drop options here</span>`;
    paintPrompt();
  };
  const paintPrompt = () => {
    q("[data-pw-pre]").textContent = buildPrompt({ ...st, notes: q("#pw-notes").value.trim(), topic: getTopic(), draft: getDraft(), earlier: versions }, { forPreview: true });
  };
  const paintVersions = () => {
    const box = q("[data-pw-vers]");
    q("[data-pw-count]").textContent = versions.length ? `${versions.length} version${versions.length > 1 ? "s" : ""}` : "";
    q("[data-pw-go]").innerHTML = `${icon("sparkle", "sm")}${versions.length ? "Write another version" : "Write a version"}`;
    if (!versions.length) { box.innerHTML = ""; return; }
    if (sel < 0 || sel >= versions.length) sel = versions.length - 1;
    const v = versions[sel];
    box.innerHTML = `<div class="pw-vh"><h4>Versions</h4><div class="pw-tabs" role="tablist" aria-label="Versions">${versions.map((x, i) => `<button class="pw-tab" type="button" role="tab" aria-selected="${i === sel}" tabindex="${i === sel ? 0 : -1}" data-pw-v="${i}" id="pw-tab-${x.id}" aria-controls="pw-panel">${x.mine ? "Your draft" : `Version ${i + 1}`}</button>`).join("")}</div></div>
      <div class="pw-panel" role="tabpanel" id="pw-panel" aria-labelledby="pw-tab-${v.id}">
        <p class="pw-meta small muted">${v.mine ? "What was in the draft box before you used a version" : esc(versionLabel(v))} · ${words(v.text)} words · ${esc(fmtDate(v.at))}</p>
        <p class="pre pw-text">${esc(v.text)}</p>
        <div class="actions"><button class="btn btn-sm btn-primary" type="button" data-pw-use>${icon("check", "sm")}Use this version</button>
          <button class="btn btn-sm" type="button" data-pw-copyv>${icon("copy", "sm")}Copy</button>
          <span class="spacer"></span>
          <button class="btn btn-sm btn-ghost" type="button" data-pw-prev ${sel === 0 ? "disabled" : ""} aria-label="Previous version">${icon("arrowL", "sm")}</button>
          <button class="btn btn-sm btn-ghost" type="button" data-pw-next ${sel === versions.length - 1 ? "disabled" : ""} aria-label="Next version">${icon("arrowR", "sm")}</button>
          <button class="icon-btn sm boxed danger" type="button" data-pw-del aria-label="Delete this version" data-tip="Delete version">${icon("trash", "sm")}</button></div></div>`;
  };
  const remember = () => { L().postPrefs = { type: st.type, chips: [...st.chips] }; save("linkedin"); };
  const toggle = (id, toZone) => {
    const inZone = st.chips.includes(id);
    if (toZone === undefined) toZone = !inZone;
    st.chips = toZone ? addChip(st.chips, id) : st.chips.filter(x => x !== id);
    paintChips(); remember();
    setTimeout(() => (root.querySelector(`[data-pchip="${id}"]`) || q(toZone ? "[data-pw-zone]" : "[data-pw-tray]"))?.focus?.(), 0);
  };

  paintTypes(); paintChips(); paintVersions();
  q("#pw-notes").addEventListener("input", paintPrompt);
  root.addEventListener("input", e => { if (e.target.matches("#lp-t, #lp-x")) paintPrompt(); });

  root.addEventListener("click", e => {
    const t = e.target.closest("[data-pw-type]");
    if (t) { st.type = t.dataset.pwType; paintTypes(); paintPrompt(); remember(); root.querySelector(`[data-pw-type="${st.type}"]`)?.focus(); return; }
    const c = e.target.closest("[data-pchip]");
    if (c) { toggle(c.dataset.pchip); return; }
    if (e.target.closest("[data-pw-copy]")) { copyText(buildPrompt({ ...st, notes: q("#pw-notes").value.trim(), topic: getTopic(), draft: getDraft(), earlier: versions })); return; }
    const vt = e.target.closest("[data-pw-v]");
    if (vt) { sel = +vt.dataset.pwV; paintVersions(); q(`[data-pw-v="${sel}"]`)?.focus(); return; }
    if (e.target.closest("[data-pw-prev]")) { sel--; paintVersions(); return; }
    if (e.target.closest("[data-pw-next]")) { sel++; paintVersions(); return; }
    if (e.target.closest("[data-pw-copyv]")) { copyText(versions[sel].text); return; }
    if (e.target.closest("[data-pw-use]")) {
      const v = versions[sel], cur = getDraft().trim();
      if (cur && cur !== v.text.trim() && !versions.some(x => x.text.trim() === cur)) versions.push({ id: uid("pv"), text: cur, at: today(), mine: true });
      setDraft(v.text); persist(); paintVersions(); toast("Draft replaced. Your earlier draft is kept as a version.");
      return;
    }
    if (e.target.closest("[data-pw-del]")) {
      const i = sel, [v] = versions.splice(i, 1); persist(); paintVersions();
      toast("Version deleted", { action: "Undo", onAction: () => { versions.splice(i, 0, v); sel = i; persist(); paintVersions(); } });
    }
  });
  // Arrow keys move between post types and between version tabs.
  root.addEventListener("keydown", e => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const d = e.key === "ArrowRight" ? 1 : -1;
    if (e.target.matches("[data-pw-type]")) { e.preventDefault(); const i = POST_TYPES.findIndex(t => t.id === st.type); st.type = POST_TYPES[(i + d + POST_TYPES.length) % POST_TYPES.length].id; paintTypes(); paintPrompt(); remember(); root.querySelector(`[data-pw-type="${st.type}"]`)?.focus(); }
    else if (e.target.matches("[data-pw-v]")) { e.preventDefault(); sel = Math.max(0, Math.min(versions.length - 1, sel + d)); paintVersions(); q(`[data-pw-v="${sel}"]`)?.focus(); }
  });

  // Drag and drop between the tray and the prompt.
  let dragId = null;
  root.addEventListener("dragstart", e => { const c = e.target.closest?.("[data-pchip]"); if (!c) return; dragId = c.dataset.pchip; e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", dragId); } catch { /* ignore */ } c.classList.add("dragging"); });
  root.addEventListener("dragend", () => { dragId = null; $$(".pchip.dragging, .pw-zone.over, .pw-tray.over", root).forEach(x => x.classList.remove("dragging", "over")); });
  for (const [sel_, toZone] of [["[data-pw-zone]", true], ["[data-pw-tray]", false]]) {
    const zone = q(sel_);
    zone.addEventListener("dragover", e => { if (!dragId) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; zone.classList.add("over"); });
    zone.addEventListener("dragleave", e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove("over"); });
    zone.addEventListener("drop", e => { if (!dragId) return; e.preventDefault(); zone.classList.remove("over"); const id = dragId; dragId = null; if (st.chips.includes(id) !== toZone) toggle(id, toZone); });
  }

  q("[data-pw-go]").addEventListener("click", async () => {
    const topic = getTopic();
    if (!topic) { q("[data-pw-msg]").textContent = "Add a topic first."; root.querySelector("#lp-t")?.focus(); return; }
    q("[data-pw-msg]").textContent = "";
    const go = q("[data-pw-go]"); go.disabled = true;
    q("[data-pw-wait]").innerHTML = `<div class="ai-wait" role="status"><div class="spinner" aria-hidden="true"></div><p>Writing a version…</p><button class="btn btn-sm" type="button" data-pw-stop>Stop</button></div>`;
    ctl = new AbortController(); const mine = ctl;
    q("[data-pw-stop]").addEventListener("click", () => mine.abort());
    try {
      const notes = q("#pw-notes").value.trim();
      const res = await askJson(buildPrompt({ ...st, notes, topic, draft: getDraft(), earlier: versions.filter(v => !v.mine).slice(-4) }), { signal: mine.signal });
      const text = String(res?.text || "").trim().slice(0, 3000);
      if (!text) throw new Error("Nothing came back. Try again.");
      versions.push({ id: uid("pv"), text, at: today(), type: st.type, chips: [...st.chips], notes });
      while (versions.length > 12) versions.shift();
      sel = versions.length - 1; persist(); paintVersions(); paintPrompt();
      q(`[data-pw-v="${sel}"]`)?.focus();
    } catch (e) { if (!mine.signal.aborted) q("[data-pw-msg]").textContent = e.message || "Couldn't write a version. Try again."; }
    if (ctl === mine) ctl = null;
    q("[data-pw-wait]").innerHTML = ""; go.disabled = false;
  });
  return { abort: () => ctl && ctl.abort() };
}
