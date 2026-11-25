// Icons, dialogs, toasts, tooltips and small charts.

import { esc, $ } from "./util.js";
import { bus } from "./bus.js";

const P = {
  award: '<circle cx="12" cy="9" r="5.5"/><path d="M8.6 13.4 7.5 21l4.5-2.5 4.5 2.5-1.1-7.6"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.3-1-1.6-1-2.8 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="14.5" cy="7" r="1.2"/>',
  columns: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M10 4v16"/>',
  type: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M15.5 4.9a3.2 3.2 0 0 1 0 6.2M17.5 14.8c2 .6 3.5 2.4 3.5 5.2"/>',
  ticket: '<path d="M3 7.5h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z"/><path d="M14.5 7.5v10" stroke-dasharray="1.6 2.2"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  review: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  skills: '<path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20"/>',
  file: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M8.5 13h7M8.5 17h5"/>',
  wand: '<path d="m4 20 11-11"/><path d="m13.5 7.5 3 3"/><path d="M18 2.5v3M16.5 4h3M20.5 9v2M19.5 10h2M9 2.5v2M8 3.5h2"/>',
  idcard: '<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><circle cx="8.5" cy="11" r="2.2"/><path d="M5.5 16.5c.6-1.6 1.7-2.4 3-2.4s2.4.8 3 2.4M14.5 10h4M14.5 13.5h3"/>',
  folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>',
  mic: '<rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  chevDown: '<path d="m6 9 6 6 6-6"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowL: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  more: '<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  today: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="m9 15 2 2 4-4"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  alert: '<path d="M12 3 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.5"/>',
  sparkle: '<path d="M12 3c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  note: '<path d="M5 3.5h14v17H5z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  move: '<path d="M5 12h14M15 8l4 4-4 4M9 8 5 12l4 4"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M10.6 6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.4 7.4C3.9 9.1 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.4-1.1M3 3l18 18"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  archive: '<rect x="3" y="4" width="18" height="4.5" rx="1"/><path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 12.5h4"/>',
  send: '<path d="M21 3 10 14M21 3l-6.5 18-4.5-7-7-4.5z"/>',
  heart: '<path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.8 4.5 7.1 4.5c2 0 3.5 1.1 4.9 3 1.4-1.9 2.9-3 4.9-3 3.3 0 5.5 3.1 4.3 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/>',
  news: '<path d="M4 5.5h13v13a1.5 1.5 0 0 0 1.5 1.5H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v9.5a1.5 1.5 0 0 1-3 0M7.5 9h6M7.5 12.5h6M7.5 16h4"/>'
};
export const icon = (name, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${P[name] || ""}</svg>`;
export const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

// ---------- Toasts ----------
export function toast(msg, opts = {}) {
  const host = $("#toasts");
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.innerHTML = `<p>${esc(msg)}</p>${opts.action ? `<button type="button">${esc(opts.action)}</button>` : ""}`;
  host.appendChild(el);
  const close = () => { el.remove(); };
  const t = setTimeout(close, opts.ms || (opts.action ? 7000 : 3500));
  if (opts.action) el.querySelector("button").addEventListener("click", () => { clearTimeout(t); close(); opts.onAction && opts.onAction(); });
  while (host.children.length > 3) host.firstChild.remove();
}

// ---------- Sheets (modal dialogs) ----------
let openSheet = null;
export function sheet({ title, sub = "", body, foot, wide = false, onMount, onClose, initialFocus }) {
  closeSheet();
  const root = $("#sheet-root");
  const prev = document.activeElement;
  const wrap = document.createElement("div");
  wrap.className = "sheet-wrap";
  const id = "sh-" + Math.random().toString(36).slice(2, 7);
  wrap.innerHTML = `<div class="sheet-scrim" data-close></div>
    <div class="sheet ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="${id}">
      <div class="sheet-h"><div><h2 id="${id}">${esc(title)}</h2>${sub ? `<p>${sub}</p>` : ""}</div>
        <button class="icon-btn" type="button" data-close aria-label="Close">${icon("x")}</button></div>
      <div class="sheet-b">${body}</div>
      ${foot ? `<div class="sheet-f">${foot}</div>` : ""}
    </div>`;
  root.appendChild(wrap);
  document.body.style.overflow = "hidden";
  const dlg = wrap.querySelector(".sheet");
  const api = {
    el: dlg,
    close: () => {
      if (!wrap.isConnected) return;
      wrap.remove(); document.body.style.overflow = ""; document.removeEventListener("keydown", onKey, true);
      openSheet = null; onClose && onClose();
      if (prev && prev.isConnected) prev.focus();
      bus.afterSheet && bus.afterSheet();
    }
  };
  const onKey = e => {
    if (e.key === "Escape") { e.preventDefault(); api.close(); }
    if (e.key === "Tab") {
      const f = Array.from(dlg.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])')).filter(x => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener("keydown", onKey, true);
  wrap.addEventListener("click", e => { if (e.target.closest("[data-close]")) api.close(); });
  openSheet = api;
  onMount && onMount(dlg, api);
  const focusEl = (initialFocus && dlg.querySelector(initialFocus)) || dlg.querySelector("input:not([type=hidden]),select,textarea") || dlg.querySelector(".sheet-f .btn-primary") || dlg.querySelector("[data-close]");
  setTimeout(() => focusEl && focusEl.focus(), 30);
  return api;
}
export function closeSheet() { if (openSheet) openSheet.close(); }
export const sheetOpen = () => !!openSheet;

export function confirmSheet({ title, message, confirm = "Confirm", danger = false, onConfirm }) {
  sheet({
    title, body: `<p>${message}</p>`,
    foot: `<button class="btn btn-ghost" type="button" data-close>Cancel</button>
      <button class="btn ${danger ? "btn-danger" : "btn-primary"}" type="button" data-ok>${danger ? icon("trash", "sm") : ""}${esc(confirm)}</button>`,
    initialFocus: "[data-ok]",
    onMount: (el, api) => el.querySelector("[data-ok]").addEventListener("click", () => { api.close(); onConfirm(); })
  });
}

// ---------- Tooltip (hover + keyboard focus) ----------
export function initTooltips() {
  const tip = document.createElement("div");
  tip.className = "tip"; tip.setAttribute("aria-hidden", "true");
  document.body.appendChild(tip);
  let cur = null;
  const show = (el, x, y) => {
    cur = el;
    const [a, b] = el.dataset.tip.split("|");
    tip.textContent = "";
    const s = document.createElement("strong"); s.textContent = a; tip.appendChild(s);
    if (b) tip.appendChild(document.createTextNode(b));
    tip.classList.add("on");
    const r = tip.getBoundingClientRect();
    let left = x + 12, top = y - r.height - 10;
    if (left + r.width > innerWidth - 8) left = x - r.width - 12;
    if (top < 8) top = y + 16;
    tip.style.left = Math.max(8, left) + "px"; tip.style.top = top + "px";
  };
  const hide = () => { cur = null; tip.classList.remove("on"); };
  document.addEventListener("pointermove", e => {
    const el = e.target.closest && e.target.closest("[data-tip]");
    if (el) show(el, e.clientX, e.clientY); else if (cur) hide();
  });
  document.addEventListener("focusin", e => {
    const el = e.target.closest && e.target.closest("[data-tip]");
    if (el) { const r = el.getBoundingClientRect(); show(el, r.left + r.width / 2, r.top); } else if (cur) hide();
  });
  document.addEventListener("scroll", hide, true);
}

// ---------- Charts (return HTML strings) ----------
const pctW = (v, max) => (max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0);

export function meter(value, max, { color = "var(--c-build)", marker = null, label = "", thin = false } = {}) {
  const w = pctW(value, max);
  return `<div class="meter ${thin ? "thin" : ""}" style="--mc:${color}" role="img" aria-label="${esc(label)}">
    <i style="width:${w}%"></i>${marker != null ? `<b style="left:${pctW(marker, max)}%"></b>` : ""}</div>`;
}

// columns with a target tick per column; values/targets arrays, labels for x
// bands: optional per-column [low, high] target range, drawn as a soft band behind the bar.
export function columns(values, targets, labels, { color = "var(--c-apply)", cur = -1, unit = "", bands = null } = {}) {
  const max = Math.max(1, ...values, ...targets, ...(bands || []).map(b => (b ? b[1] : 0)));
  const cols = values.map((v, i) => {
    const h = pctW(v, max), t = targets[i], bd = bands && bands[i];
    const range = bd && bd[1] > bd[0] ? `${bd[0]}–${bd[1]}` : t;
    return `<div class="col ${i === cur ? "cur" : ""}" data-tip="${esc(`${v} ${unit}`)}|${esc(`${labels[i]}${range ? ` · target ${range}` : ""}`)}">
      ${bd && bd[1] > bd[0] ? `<s class="band" style="bottom:${pctW(bd[0], max)}%;height:${pctW(bd[1] - bd[0], max)}%"></s>` : ""}<i style="height:${h}%"></i>${t ? `<b style="bottom:calc(${pctW(t, max)}% - 1px)"></b>` : ""}</div>`;
  }).join("");
  return `<div class="cols" style="--mc:${color}" role="img" aria-label="${esc(values.map((v, i) => `${labels[i]}: ${v}${targets[i] ? ` of ${targets[i]}` : ""}`).join("; "))}">${cols}</div>`;
}

// Week numbers under a column chart; long plans label every fourth week.
export const weekLabels = n => `<div class="cols-x" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<span>${n <= 14 || i === 0 || (i + 1) % 4 === 0 || i === n - 1 ? i + 1 : ""}</span>`).join("")}</div>`;

// segmented whole; parts: [{label, value, color}]
export function segmented(parts, { tall = false, label = "" } = {}) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (!total) return `<div class="empty-chart" role="img" aria-label="No data yet"></div>`;
  const segs = parts.filter(p => p.value > 0).map(p => {
    const share = Math.round((p.value / total) * 100);
    return `<i style="--c:${p.color};flex:${p.value}" data-tip="${esc(`${p.value} · ${share}%`)}|${esc(p.label)}">${tall && share >= 14 && !/neutral/.test(p.color) ? `<span>${share}%</span>` : ""}</i>`;
  }).join("");
  return `<div class="seg ${tall ? "tall" : ""}" role="img" aria-label="${esc(label || parts.map(p => `${p.label}: ${p.value}`).join(", "))}">${segs}</div>`;
}

export function legend(parts, { showValue = true } = {}) {
  return `<div class="legend">${parts.map(p => `<span><i class="dot" style="--c:${p.color}"></i>${esc(p.label)}${showValue ? ` <b>${esc(p.display ?? p.value)}</b>` : ""}</span>`).join("")}</div>`;
}

export function skillBars(items, max = 5) {
  return `<div class="skillbars" role="img" aria-label="${esc(items.map(s => `${s.name}: ${s.now} of target ${s.target}`).join("; "))}">${items.map(s =>
    `<div class="sb ${s.now >= s.target ? "met" : ""}" data-tip="${esc(`${s.now} → ${s.target}`)}|${esc(s.name)}"><i style="height:${pctW(s.now, max)}%"></i><b style="bottom:calc(${pctW(s.target, max)}% - 1px)"></b></div>`).join("")}</div>`;
}

// Line chart: points [{label, y}]; one series, one axis. Returns SVG.
export function lineChart(points, { max = null, min = 0, color = "var(--c-learn)", unit = "", height = 120, label = "", yTicks = null } = {}) {
  const W = 320, H = height, padL = 28, padR = 10, padT = 10, padB = 22;
  if (!points.length) return `<div class="empty-chart" style="height:${H}px" role="img" aria-label="No data yet"></div>`;
  const hi = max != null ? max : Math.max(1, ...points.map(p => p.y));
  const x = i => padL + (points.length === 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (points.length - 1));
  const y = v => padT + (H - padT - padB) * (1 - (v - min) / (hi - min || 1));
  const ticks = yTicks || [min, hi];
  const grid = ticks.map(t => `<line x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}" stroke="var(--grid)" stroke-width="1"/><text x="${padL - 6}" y="${y(t) + 4}" text-anchor="end" class="ax">${esc(String(Math.round(t * 10) / 10))}</text>`).join("");
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");
  const step = Math.ceil(points.length / 8);
  const xl = points.map((p, i) => (i % step === 0 || i === points.length - 1) ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" class="ax">${esc(p.short ?? p.label)}</text>` : "").join("");
  const dots = points.map((p, i) => `<g data-tip="${esc(`${Math.round(p.y * 10) / 10}${unit}`)}|${esc(p.label)}"><circle cx="${x(i)}" cy="${y(p.y)}" r="12" fill="transparent"/><circle cx="${x(i)}" cy="${y(p.y)}" r="4" fill="${color}" stroke="var(--surface)" stroke-width="2"/></g>`).join("");
  return `<svg class="linechart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label || points.map(p => `${p.label}: ${Math.round(p.y * 10) / 10}${unit}`).join("; "))}">${grid}${xl}
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}</svg>`;
}

// Grouped columns: groups [{label, a, b, color}], a = planned (neutral), b = actual (series color)
export function groupedBars(groups, { aLabel = "Planned", bLabel = "Worked", unit = "h", label = "" } = {}) {
  const max = Math.max(1, ...groups.flatMap(g => [g.a, g.b]));
  const cols = groups.map(g => `<div class="gb-g">
      <div class="gb-bars">
        <i class="gb-a" style="height:${pctW(g.a, max)}%;--c:${g.color}" data-tip="${esc(`${Math.round(g.a * 10) / 10}${unit} ${aLabel.toLowerCase()}`)}|${esc(g.label)}"></i>
        <i class="gb-b" style="height:${pctW(g.b, max)}%;--c:${g.color}" data-tip="${esc(`${Math.round(g.b * 10) / 10}${unit} ${bLabel.toLowerCase()}`)}|${esc(g.label)}"></i>
      </div><span>${esc(g.label)}</span></div>`).join("");
  return `<div class="gbars" role="img" aria-label="${esc(label || groups.map(g => `${g.label}: ${aLabel} ${g.a}, ${bLabel} ${g.b}`).join("; "))}">${cols}</div>
    <div class="legend" style="margin-top:8px"><span><i class="dot light" style="--c:var(--ink-2)"></i>${esc(aLabel)} (light)</span><span><i class="dot" style="--c:var(--ink-2)"></i>${esc(bLabel)} (solid)</span></div>`;
}

// Horizontal rows of meters: rows [{label, value, max, color, display, href}]
export function hbars(rows, { empty = "Nothing yet." } = {}) {
  if (!rows.length) return `<p class="muted small">${esc(empty)}</p>`;
  return `<div class="trows hb">${rows.map(r => `<div class="trow"><span class="tn" title="${esc(r.label)}">${r.href ? `<a href="${r.href}">${esc(r.label)}</a>` : esc(r.label)}</span>
    ${meter(r.value, r.max, { color: r.color || "var(--c-learn)", thin: true, label: `${r.label}: ${r.display ?? r.value}` })}
    <span class="tv">${esc(r.display ?? String(r.value))}</span></div>`).join("")}</div>`;
}

// 1–5 level scale with now filled and a target marker.
export function levelBar(now, target, { label = "", size = "" } = {}) {
  const cells = [1, 2, 3, 4, 5].map(i => `<i class="${i <= now ? "on" : ""} ${i === target ? "tgt" : ""}"></i>`).join("");
  return `<div class="lvl ${size}" role="img" aria-label="${esc(label || `Level ${now} of 5, target ${target}`)}">${cells}</div>`;
}

export function stars(n, { name = "", interactive = false } = {}) {
  if (!interactive) return n ? `<span class="stars" aria-label="Rated ${n} of 5">${"★".repeat(n)}<span class="off">${"★".repeat(5 - n)}</span></span>` : "";
  return `<div class="star-input" role="radiogroup" aria-label="Your rating">${[1, 2, 3, 4, 5].map(i => `<label><input type="radio" name="${name}" value="${i}" ${i === n ? "checked" : ""}><span aria-hidden="true">★</span><span class="sr-only">${i} of 5</span></label>`).join("")}
    <label class="clear"><input type="radio" name="${name}" value="0" ${!n ? "checked" : ""}><span>None</span></label></div>`;
}

// Ring for a single share (0–100). Text stays in ink tokens; the arc carries the value.
export function ring(pct, { color = "var(--c-apply)", label = "", size = 112, sub = "" } = {}) {
  const r = 44, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, Math.round(pct)));
  return `<figure class="ring" style="--rs:${size}px" role="img" aria-label="${esc(label || `${v}%`)}">
    <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${r}" class="ring-track"/>
      ${v > 0 ? `<circle cx="50" cy="50" r="${r}" class="ring-val" style="stroke:${color}" stroke-dasharray="${(c * v) / 100} ${c}" transform="rotate(-90 50 50)"/>` : ""}</svg>
    <figcaption><b>${v}%</b>${sub ? `<span>${esc(sub)}</span>` : ""}</figcaption></figure>`;
}
