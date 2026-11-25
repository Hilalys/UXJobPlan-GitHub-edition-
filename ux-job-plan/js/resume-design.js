// Resume design: templates and every visual setting. One design object drives the live preview,
// the PDF and the Word file, so all three match.

export const FONTS = {
  arial: { label: "Arial", note: "Clean sans serif", css: 'Arial, "Liberation Sans", Helvetica, sans-serif', word: "Arial" },
  calibri: { label: "Calibri", note: "Soft, modern sans", css: '"ResCal", Carlito, Calibri, sans-serif', word: "Calibri" },
  times: { label: "Times New Roman", note: "Traditional serif", css: '"ResSerif", Tinos, "Times New Roman", Times, serif', word: "Times New Roman" }
};
export const SIZES = { s: { label: "Small", pt: 9 }, m: { label: "Medium", pt: 9.5 }, l: { label: "Large", pt: 10.5 } };
export const SPACING = {
  tight: { label: "Tight", lh: 1.2, sec: 4, entry: 1.5, para: 0.5 },
  normal: { label: "Normal", lh: 1.32, sec: 8, entry: 3, para: 1 },
  roomy: { label: "Roomy", lh: 1.45, sec: 13, entry: 6, para: 2 }
};
export const MARGINS = [[0.5, "0.5 in"], [0.75, "0.75 in"], [1, "1 in"]];
export const ACCENTS = [["#A10B2B", "Crimson"], ["#1F3A68", "Navy"], ["#0F5E63", "Teal"], ["#2F5D3A", "Forest"], ["#5B3A8E", "Plum"], ["#111111", "Black"]];
export const HEADINGS = { rule: "Line under", plain: "No line", bar: "Side bar", box: "Shaded band" };
export const LAYOUTS = { one: "One column", left: "Sidebar on the left", right: "Sidebar on the right" };
export const SIDE_WIDTHS = [[30, "Narrow"], [34, "Medium"], [38, "Wide"]];

const BASE = { font: "arial", size: "m", spacing: "normal", margin: 0.5, accent: "#A10B2B", headAlign: "left", heading: "rule", upper: true, nameColor: false, headLine: false, dates: "right", bullet: "dot", layout: "one", sideWidth: 32, side: {} };

export const PRESETS = {
  clean: { label: "Clean", note: "Crimson headings, left aligned", d: {} },
  classic: { label: "Classic", note: "Centered, black and white", d: { accent: "#111111", headAlign: "center" } },
  modern: { label: "Modern", note: "Calibri, navy side bars", d: { font: "calibri", accent: "#1F3A68", heading: "bar", upper: false, nameColor: true, size: "l" } },
  elegant: { label: "Elegant", note: "Serif, centered, more air", d: { font: "times", accent: "#111111", headAlign: "center", headLine: true, spacing: "roomy", margin: 0.75 } },
  compact: { label: "Compact", note: "Small and tight, for one page", d: { size: "s", spacing: "tight", accent: "#1F3A68", dates: "right" } },
  sidebar: { label: "Sidebar", note: "Two columns, teal bands", d: { font: "calibri", accent: "#0F5E63", heading: "box", layout: "left", nameColor: true, sideWidth: 34 } }
};

export function presetDesign(id = "clean") {
  const p = PRESETS[id] || PRESETS.clean;
  return { ...BASE, ...p.d, side: {}, preset: PRESETS[id] ? id : "clean" };
}
const pick = (v, ok, d) => (ok.includes(v) ? v : d);
export function normDesign(v) {
  if (typeof v === "string") return presetDesign(v);
  const d = presetDesign(v && PRESETS[v.preset] ? v.preset : "clean");
  if (!v || typeof v !== "object") return d;
  return {
    preset: d.preset,
    font: pick(v.font, Object.keys(FONTS), d.font),
    size: pick(v.size, Object.keys(SIZES), d.size),
    spacing: pick(v.spacing, Object.keys(SPACING), d.spacing),
    margin: pick(Number(v.margin), MARGINS.map(m => m[0]), d.margin),
    accent: /^#[0-9a-f]{6}$/i.test(v.accent || "") ? v.accent : d.accent,
    headAlign: pick(v.headAlign, ["left", "center"], d.headAlign),
    heading: pick(v.heading, Object.keys(HEADINGS), d.heading),
    upper: typeof v.upper === "boolean" ? v.upper : d.upper,
    nameColor: typeof v.nameColor === "boolean" ? v.nameColor : d.nameColor,
    headLine: typeof v.headLine === "boolean" ? v.headLine : d.headLine,
    dates: pick(v.dates, ["right", "inline"], d.dates),
    bullet: pick(v.bullet, ["dot", "dash"], d.bullet),
    layout: pick(v.layout, Object.keys(LAYOUTS), d.layout),
    sideWidth: Math.min(40, Math.max(26, Number(v.sideWidth) || d.sideWidth)),
    side: v.side && typeof v.side === "object" && !Array.isArray(v.side) ? { ...v.side } : {}
  };
}
// Whether the design still matches its template.
export function isPreset(d) {
  const p = presetDesign(d.preset);
  return Object.keys(BASE).every(k => k === "side" || p[k] === d[k]);
}

// Which column a section goes in when there's a sidebar. They can move any section.
export function inSide(d, s) {
  if (d.layout === "one") return false;
  if (d.side[s.id] === "side") return true;
  if (d.side[s.id] === "main") return false;
  if (s.kind === "skills" || s.kind === "list") return true;
  if (s.kind === "entries" && s.type === "education") return true;
  return false;
}

// Numbers every renderer uses (points unless noted).
export function metrics(d) {
  const b = SIZES[d.size].pt, sp = SPACING[d.spacing];
  return {
    body: b, name: Math.round(b * 2.1 * 2) / 2, title: Math.round(b * 1.21 * 2) / 2, contact: b - 0.5, head: b + 1, org: b + 0.5, dates: b,
    lh: sp.lh, sec: sp.sec, entry: sp.entry, para: sp.para,
    marginIn: d.margin, marginPt: d.margin * 72,
    bullet: d.bullet === "dash" ? "–" : "•"
  };
}
export const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
// A light tint of the accent for shaded headings.
export const tint = (h, k = 0.88) => "#" + hexRgb(h).map(c => Math.round(c + (255 - c) * k).toString(16).padStart(2, "0")).join("");
// The rule under headings: the accent, lightened unless it's black.
export const ruleColor = h => (h.toLowerCase() === "#111111" ? "#787878" : tint(h, 0.72));

// Load the extra fonts into the page so the preview shows the real letters.
let fontsReady = null;
export function previewFonts(d) {
  if (d.font === "arial" || typeof FontFace === "undefined") return Promise.resolve(false);
  if (!fontsReady) fontsReady = (async () => {
    const F = await import("./vendor/fonts2.js");
    const bin = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
    const faces = [["ResSerif", F.SERIF_REGULAR, "400"], ["ResSerif", F.SERIF_BOLD, "700"], ["ResCal", F.CAL_REGULAR, "400"], ["ResCal", F.CAL_BOLD, "700"]];
    for (const [fam, data, weight] of faces) { const f = new FontFace(fam, bin(data), { weight }); await f.load(); document.fonts.add(f); }
    return true;
  })().catch(() => { fontsReady = null; return false; });
  return fontsReady;
}
