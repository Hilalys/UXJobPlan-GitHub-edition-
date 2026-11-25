// Small helpers shared by every view.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ESC[c]);

export const uid = (p = "") => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const clone = o => JSON.parse(JSON.stringify(o));

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const sum = (arr, f = x => x) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);

// ---- Dates: always local calendar dates as "YYYY-MM-DD" ----
const pad = n => String(n).padStart(2, "0");
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = s => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const today = () => ymd(new Date());
export const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
export const mondayOf = s => { const d = parseYmd(s); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return ymd(d); };
export const nextMonday = () => { const t = today(); const m = mondayOf(t); return m === t ? t : addDays(m, 7); };

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const fmtDate = (s, opts = {}) => {
  const d = parseYmd(s); if (!d) return "";
  const base = `${MON[d.getMonth()]} ${d.getDate()}`;
  const withDow = opts.dow ? `${DOW[d.getDay()]}, ${base}` : base;
  return opts.year || d.getFullYear() !== new Date().getFullYear() ? `${withDow}, ${d.getFullYear()}` : withDow;
};
export const dowLong = s => DOW_LONG[parseYmd(s).getDay()];
export const relDay = s => {
  const n = daysBetween(today(), s);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n > 1 && n < 7) return `In ${n} days`;
  if (n < -1 && n > -7) return `${-n} days ago`;
  return fmtDate(s, { dow: true });
};
export const fmtTime = t => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${pad(m)} ${ap}`;
};
export const monthShort = s => MON[parseYmd(s).getMonth()].toUpperCase();
export const dayNum = s => parseYmd(s).getDate();

// ---- Durations ----
export const fmtHours = h => {
  const n = Number(h) || 0;
  // Plan hours come in quarter hours (0.75h, 2.25h); show those exactly.
  if (Math.abs(n * 4 - Math.round(n * 4)) < 1e-9) return String(Math.round(n * 4) / 4) + "h";
  const v = Math.round(n * 10) / 10;
  return (Number.isInteger(v) ? String(v) : v.toFixed(1)) + "h";
};
export const fmtMin = min => {
  min = Math.round(min || 0);
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};
export const fmtClock = ms => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${h}:${pad(m)}:${pad(x)}`;
};
export const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

export const debounce = (fn, ms) => {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); fn(...a); };
  return d;
};

export const safeUrl = u => {
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; }
};
export const host = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

export const csvEscape = v => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows, cols) => [cols.map(c => csvEscape(c.label)).join(","), ...rows.map(r => cols.map(c => csvEscape(c.get(r))).join(","))].join("\n");
