// Resume rendering and export: HTML preview, plain text, Markdown, PDF and Word (.docx).

import { esc } from "./util.js";
import { normDesign, metrics, inSide, FONTS, hexRgb, tint, ruleColor } from "./resume-design.js";
import { toast } from "./ui.js";

// ---------- Visible content ----------
export function visible(res) {
  const out = [];
  for (const s of res.sections) {
    if (s.hidden) continue;
    if (s.kind === "text") { if ((s.text || "").trim()) out.push({ ...s }); continue; }
    if (s.kind === "entries") {
      const items = s.items.filter(i => !i.hidden).map(i => ({ ...i, bullets: i.bullets.filter(b => !b.hidden && b.text.trim()) }));
      if (items.length) out.push({ ...s, items });
      continue;
    }
    if (s.kind === "skills") { const groups = s.groups.filter(g => !g.hidden && g.items.trim()); if (groups.length) out.push({ ...s, groups }); continue; }
    if (s.kind === "list") { const items = s.items.filter(i => !i.hidden && i.text.trim()); if (items.length) out.push({ ...s, items }); }
  }
  return out;
}
export const contactParts = h => [h.location, h.phone, h.email, h.linkedin, h.portfolio].map(x => (x || "").trim()).filter(Boolean);
const shortList = items => items.every(i => i.text.length <= 40);

export function fileBase(res) {
  const h = res.header;
  return [h.name, h.title].filter(Boolean).join(" ").trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "Resume";
}

// ---------- HTML preview ----------
// The page's look comes from the design: CSS variables for sizes and colors, classes for the rest.
export function designVars(d) {
  const m = metrics(d);
  return `--rp-font:${FONTS[d.font].css};--rp-size:${m.body}pt;--rp-name:${m.name}pt;--rp-title:${m.title}pt;--rp-contact:${m.contact}pt;--rp-head:${m.head}pt;--rp-org:${m.org}pt;--rp-lh:${m.lh};--rp-sec:${m.sec}pt;--rp-entry:${m.entry}pt;--rp-para:${m.para}pt;--rp-m:${d.margin}in;--rp-accent:${d.accent};--rp-tint:${tint(d.accent)};--rp-rule:${ruleColor(d.accent)};--rp-side:${d.sideWidth}%;--rp-bul:'${m.bullet}'`;
}
export function resumeHTML(res, style = "clean", { diff = null } = {}) {
  const d = normDesign(style);
  const h = res.header;
  const mark = (key, html) => (diff && diff.has(key) ? `<mark class="rp-changed">${html}</mark>` : html);
  const ul = list => `<ul class="rp-ul">${list.map(([k, t]) => `<li>${k ? mark(k, esc(t)) : esc(t)}</li>`).join("")}</ul>`;
  const sec = (s, narrow) => {
    let body = "";
    if (s.kind === "text") body = `<p class="rp-p">${mark(`sec:${s.id}`, esc(s.text))}</p>`;
    if (s.kind === "entries") body = s.items.map(i => {
      const meta = narrow ? `<div class="rp-stack"><b>${esc(i.org)}</b>${i.role ? `<span>${esc(i.role)}</span>` : ""}${i.loc || i.dates ? `<span class="rp-dates">${[i.loc, i.dates].filter(Boolean).map(esc).join(" · ")}</span>` : ""}</div>`
        : d.dates === "inline" ? `<div class="rp-line"><span><b>${esc(i.org)}</b>${i.role ? ` — ${esc(i.role)}` : ""}${i.loc ? `<span class="rp-loc"> · ${esc(i.loc)}</span>` : ""}${i.dates ? `<span class="rp-dates"> · ${esc(i.dates)}</span>` : ""}</span></div>`
        : `<div class="rp-line"><span><b>${esc(i.org)}</b>${i.role ? ` — ${esc(i.role)}` : ""}${i.loc ? `<span class="rp-loc"> · ${esc(i.loc)}</span>` : ""}</span>${i.dates ? `<span class="rp-dates">${esc(i.dates)}</span>` : ""}</div>`;
      return `<div class="rp-entry">${meta}${i.bullets.length ? ul(i.bullets.map(b => [`b:${b.id}`, b.text])) : ""}</div>`;
    }).join("");
    if (s.kind === "skills") body = s.groups.map(g => narrow ? `<p class="rp-p rp-skill"><b>${esc(g.label)}</b><br>${mark(`g:${g.id}`, esc(g.items))}</p>` : `<p class="rp-p rp-skill"><b>${esc(g.label)}:</b> ${mark(`g:${g.id}`, esc(g.items))}</p>`).join("");
    if (s.kind === "list") body = shortList(s.items) ? (narrow ? s.items.map(i => `<p class="rp-p">${esc(i.text)}</p>`).join("") : `<p class="rp-p">${s.items.map(i => esc(i.text)).join(" · ")}</p>`) : ul(s.items.map(i => ["", i.text]));
    return `<section class="rp-sec"><h3 class="rp-h">${esc(s.title)}</h3>${body}</section>`;
  };
  const secs = visible(res);
  let content;
  if (d.layout === "one") content = secs.map(s => sec(s, false)).join("");
  else {
    const side = secs.filter(s => inSide(d, s)), main = secs.filter(s => !inSide(d, s));
    content = side.length && main.length ? `<div class="rp-cols"><div class="rp-side">${side.map(s => sec(s, true)).join("")}</div><div class="rp-main">${main.map(s => sec(s, false)).join("")}</div></div>` : secs.map(s => sec(s, false)).join("");
  }
  const cls = ["rp", `rp-h-${d.heading}`, d.headAlign === "center" ? "rp-center" : "", d.upper ? "rp-upper" : "", d.nameColor ? "rp-namecolor" : "", d.headLine ? "rp-headline" : "", d.layout !== "one" ? `rp-two rp-${d.layout}` : ""].filter(Boolean).join(" ");
  return `<div class="${cls}" data-m="${d.margin}" style="${esc(designVars(d))}"><div class="rp-inner">
    <header class="rp-head"><h2 class="rp-name">${esc(h.name)}</h2>${h.title ? `<p class="rp-title">${mark("title", esc(h.title))}</p>` : ""}
      <p class="rp-contact">${contactParts(h).map(esc).join(" · ")}</p></header>${content}</div></div>`;
}
// ---------- Text and Markdown ----------
export function resumeText(res) {
  const h = res.header, L = [h.name.toUpperCase(), h.title, contactParts(h).join(" | "), ""];
  for (const s of visible(res)) {
    L.push(s.title.toUpperCase());
    if (s.kind === "text") L.push(s.text);
    if (s.kind === "entries") for (const i of s.items) {
      L.push([i.org, i.role].filter(Boolean).join(" — ") + (i.loc ? ` | ${i.loc}` : "") + (i.dates ? ` | ${i.dates}` : ""));
      for (const b of i.bullets) L.push(`- ${b.text}`);
      L.push("");
    }
    if (s.kind === "skills") for (const g of s.groups) L.push(`${g.label}: ${g.items}`);
    if (s.kind === "list") for (const i of s.items) L.push(`- ${i.text}`);
    if (L[L.length - 1] !== "") L.push("");
  }
  return L.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
export function resumeMarkdown(res) {
  const h = res.header, L = [`# ${h.name}`, "", h.title ? `**${h.title}**` : "", "", contactParts(h).join(" · "), ""];
  for (const s of visible(res)) {
    L.push(`## ${s.title}`, "");
    if (s.kind === "text") L.push(s.text, "");
    if (s.kind === "entries") for (const i of s.items) {
      L.push(`### ${[i.org, i.role].filter(Boolean).join(" — ")}`, [i.loc, i.dates].filter(Boolean).join(" · "), "");
      for (const b of i.bullets) L.push(`- ${b.text}`);
      L.push("");
    }
    if (s.kind === "skills") { for (const g of s.groups) L.push(`- **${g.label}:** ${g.items}`); L.push(""); }
    if (s.kind === "list") { for (const i of s.items) L.push(`- ${i.text}`); L.push(""); }
  }
  return L.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// ---------- Script loading ----------
const loaded = {};
// Libraries load from a public CDN, pinned to an exact version and checked with Subresource Integrity.
const LIBS = {
  jspdf: { path: "jspdf@2.5.2/dist/jspdf.umd.min.js", sri: "sha384-en/ztfPSRkGfME4KIm05joYXynqzUgbsG5nMrj/xEFAHXkeZfO3yMK8QQ+mP7p1/" },
  jszip: { path: "jszip@3.10.1/dist/jszip.min.js", sri: "sha384-+mbV2IY1Zk/X1p/nWllGySJSUN8uMs+gUAN10Or95UBH0fpj6GfKgPmgC5EXieXG" },
  // Reading PDFs on import. The worker loads as a plain script so pdf.js runs it on the page itself.
  pdfjs: { path: "pdfjs-dist@3.11.174/build/pdf.min.js", sri: "sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e" },
  pdfworker: { path: "pdfjs-dist@3.11.174/build/pdf.worker.min.js", sri: "sha384-SnzOobpRMLXZ52iJvZm/C0fYw0OQemTXzTjIsdsfMcrCtCEe9qgzxTd3RSklO5x2" }
};
const CDNS = ["https://cdn.jsdelivr.net/npm/", "https://unpkg.com/"];
function inject(src, integrity) {
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.integrity = integrity; s.crossOrigin = "anonymous";
    s.onload = res; s.onerror = () => { s.remove(); rej(new Error("Couldn't load " + src)); };
    document.head.appendChild(s);
  });
}
export const loadLib = name => loadScript(name);
function loadScript(name) {
  const lib = LIBS[name];
  if (!loaded[name]) loaded[name] = (async () => {
    for (const cdn of CDNS) { try { await inject(cdn + lib.path, lib.sri); return; } catch { /* try the next one */ } }
    delete loaded[name];
    throw new Error("Couldn't load the file maker. Check your connection and try again.");
  })();
  return loaded[name];
}

// ---------- PDF ----------
async function pdfFonts(doc, font) {
  if (font === "arial") {
    const { LS_REGULAR, LS_BOLD } = await import("./vendor/fonts.js");
    doc.addFileToVFS("LS-R.ttf", LS_REGULAR); doc.addFont("LS-R.ttf", "RF", "normal");
    doc.addFileToVFS("LS-B.ttf", LS_BOLD); doc.addFont("LS-B.ttf", "RF", "bold");
    return;
  }
  const F = await import("./vendor/fonts2.js");
  const [r, b] = font === "times" ? [F.SERIF_REGULAR, F.SERIF_BOLD] : [F.CAL_REGULAR, F.CAL_BOLD];
  doc.addFileToVFS("RF-R.ttf", r); doc.addFont("RF-R.ttf", "RF", "normal");
  doc.addFileToVFS("RF-B.ttf", b); doc.addFont("RF-B.ttf", "RF", "bold");
}
// Characters the subset fonts don't have.
const pdfText = t => String(t ?? "").replace(/­/g, "").replace(/‐|‑/g, "-");

export async function resumePdf(res, style = "clean") {
  const d = normDesign(style), m = metrics(d);
  await loadScript("jspdf");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  await pdfFonts(doc, d.font);
  doc.setProperties({ title: `${res.header.name} – Resume`, author: res.header.name, subject: res.header.title || "Resume" });
  const M = m.marginPt, PW = 612, W = PW - 2 * M, TOP = M, BOTTOM = 792 - M;
  const INK = [17, 17, 17], MUTED = [68, 68, 68], SOFT = [51, 51, 51];
  const accent = hexRgb(d.accent), rule = hexRgb(ruleColor(d.accent)), band = hexRgb(tint(d.accent));
  const set = (size, bold = false, color = INK) => { doc.setFont("RF", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(...color); };
  const lh = size => size * m.lh;
  const split = (t, w) => doc.splitTextToSize(pdfText(t), Math.max(20, w));
  // A column keeps its own page and position, so a sidebar and the main column can flow side by side.
  const col = (x, w, y) => ({ x, w, y, page: 1 });
  const ensure = (c, need) => {
    if (c.y + need > BOTTOM) { c.page++; while (doc.getNumberOfPages() < c.page) doc.addPage(); c.y = TOP; }
    doc.setPage(c.page);
  };
  const lines = (c, text, size, { bold = false, color = INK, indent = 0 } = {}) => {
    set(size, bold, color);
    for (const l of split(text, c.w - indent)) { ensure(c, lh(size)); set(size, bold, color); doc.text(l, c.x + indent, c.y + size); c.y += lh(size); }
  };
  const bullets = (c, list, narrow) => {
    const ind = narrow ? 10 : 14;
    for (const t of list) {
      set(m.body); const ls = split(t, c.w - ind);
      ls.forEach((l, k) => { ensure(c, lh(m.body)); set(m.body); if (!k) doc.text(m.bullet, c.x + (narrow ? 1 : 3), c.y + m.body); doc.text(l, c.x + ind, c.y + m.body); c.y += lh(m.body); });
    }
  };
  const heading = (c, s) => {
    ensure(c, 34); c.y += m.sec;
    const t = pdfText(d.upper ? s.title.toUpperCase() : s.title), hs = m.head, cs = d.upper ? 0.6 : 0;
    const color = d.heading === "box" && d.accent.toLowerCase() === "#111111" ? INK : accent;
    if (d.heading === "box") {
      doc.setFillColor(...band); doc.rect(c.x, c.y, c.w, hs + 7, "F");
      set(hs, true, color); doc.text(t, c.x + 5, c.y + hs + 1.5, { charSpace: cs }); c.y += hs + 11;
    } else if (d.heading === "bar") {
      doc.setFillColor(...accent); doc.rect(c.x, c.y + 1, 3, hs + 1.5, "F");
      set(hs, true, color); doc.text(t, c.x + 9, c.y + hs, { charSpace: cs }); c.y += hs + 8;
    } else {
      set(hs, true, color); doc.text(t, c.x, c.y + hs, { charSpace: cs }); c.y += Math.round(hs * 1.33);
      if (d.heading === "rule") { doc.setDrawColor(...rule); doc.setLineWidth(0.6); doc.line(c.x, c.y, c.x + c.w, c.y); c.y += 5; } else c.y += 3;
    }
  };
  const entry = (c, i, narrow) => {
    ensure(c, 30); c.y += m.entry;
    if (narrow) {
      lines(c, i.org, m.org, { bold: true });
      if (i.role) lines(c, i.role, m.body);
      const meta = [i.loc, i.dates].filter(Boolean).join(" · ");
      if (meta) lines(c, meta, m.dates - 0.5, { color: MUTED });
    } else {
      const org = pdfText(i.org || ""), dates = d.dates === "right" ? pdfText(i.dates || "") : "";
      set(m.dates); const dw = dates ? doc.getTextWidth(dates) + 12 : 0;
      set(m.org, true); const ow = doc.getTextWidth(org);
      const rest = pdfText([i.role ? ` — ${i.role}` : "", i.loc ? ` · ${i.loc}` : "", d.dates === "inline" && i.dates ? ` · ${i.dates}` : ""].join(""));
      set(m.org); const rl = doc.splitTextToSize(rest, Math.max(60, c.w - ow - dw));
      ensure(c, lh(m.org) + 2);
      set(m.org, true); doc.text(org, c.x, c.y + m.org);
      set(m.org); doc.text(rl[0] || "", c.x + ow, c.y + m.org);
      if (dates) { set(m.dates, false, MUTED); doc.text(dates, c.x + c.w, c.y + m.org, { align: "right" }); }
      c.y += m.org * 1.35;
      if (rl.length > 1) lines(c, rl.slice(1).join(" ").trim(), m.org);
    }
    bullets(c, i.bullets.map(b => b.text), narrow);
    c.y += 2;
  };
  const section = (c, s, narrow) => {
    heading(c, s);
    if (s.kind === "text") lines(c, s.text, m.body);
    if (s.kind === "entries") for (const i of s.items) entry(c, i, narrow);
    if (s.kind === "skills") for (const g of s.groups) {
      if (narrow) { lines(c, g.label, m.body, { bold: true }); lines(c, g.items, m.body); c.y += m.para + 1; continue; }
      set(m.body, true); const label = pdfText(`${g.label}: `), lw = doc.getTextWidth(label);
      set(m.body); const ls = split(g.items, c.w - lw);
      ls.forEach((l, k) => { ensure(c, lh(m.body)); if (!k) { set(m.body, true); doc.text(label, c.x, c.y + m.body); } set(m.body); doc.text(l, k ? c.x : c.x + lw, c.y + m.body); c.y += lh(m.body); });
      c.y += m.para;
    }
    if (s.kind === "list") {
      if (shortList(s.items)) { if (narrow) for (const i of s.items) lines(c, i.text, m.body); else lines(c, s.items.map(i => i.text).join("  ·  "), m.body); }
      else bullets(c, s.items.map(i => i.text), narrow);
    }
  };

  // Header, full width on the first page.
  const h = res.header, center = d.headAlign === "center", hx = center ? PW / 2 : M, al = { align: center ? "center" : "left" };
  let y = TOP;
  set(m.name, true, d.nameColor ? accent : INK); doc.text(pdfText(h.name || ""), hx, y + m.name, al); y += m.name * 1.3;
  if (h.title) { set(m.title, false, MUTED); doc.text(pdfText(h.title), hx, y + m.title, al); y += m.title * 1.39; }
  const contact = contactParts(h).join("  ·  ");
  if (contact) { set(m.contact, false, SOFT); for (const l of split(contact, W)) { doc.text(l, hx, y + m.contact, al); y += m.contact * 1.34; } }
  y += 4;
  if (d.headLine) { doc.setDrawColor(...rule); doc.setLineWidth(0.8); doc.line(M, y, M + W, y); y += 4; }

  const secs = visible(res);
  const side = d.layout === "one" ? [] : secs.filter(s => inSide(d, s)), main = secs.filter(s => !side.includes(s));
  if (!side.length || !main.length) { const c = col(M, W, y); for (const s of secs) section(c, s, false); }
  else {
    const gap = 18, sw = Math.round(W * d.sideWidth / 100), mw = W - sw - gap;
    const cs = col(d.layout === "left" ? M : M + mw + gap, sw, y), cm = col(d.layout === "left" ? M + sw + gap : M, mw, y);
    for (const s of main) section(cm, s, false);
    for (const s of side) section(cs, s, true);
  }
  return doc.output("blob");
}
// ---------- Word (.docx) ----------
const x = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function resumeDocx(res, style = "clean") {
  const d = normDesign(style), m = metrics(d);
  await loadScript("jszip");
  const font = FONTS[d.font].word, hp = pt => Math.round(pt * 2), tw = pt => Math.round(pt * 20);
  const accent = d.accent.slice(1).toUpperCase(), ruleHex = ruleColor(d.accent).slice(1).toUpperCase(), bandHex = tint(d.accent).slice(1).toUpperCase();
  // Word multiplies "auto" line spacing by the font's own line height, so divide it out to match the PDF.
  const NATURAL = { arial: 1.149, times: 1.149, calibri: 1.22 };
  const LINE = Math.round(240 * m.lh / NATURAL[d.font]);
  const run = (t, { b = false, sz = m.body, color = "111111" } = {}) => `<w:r><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>${b ? "<w:b/>" : ""}<w:color w:val="${color}"/><w:sz w:val="${hp(sz)}"/></w:rPr><w:t xml:space="preserve">${x(t)}</w:t></w:r>`;
  const tab = `<w:r><w:tab/></w:r>`;
  const para = (runs, { after = 2, before = 0, center = false, tabs = "", ind = "", border = "", shd = "" } = {}) =>
    `<w:p><w:pPr>${tabs}${border}${shd}<w:spacing w:before="${tw(before)}" w:after="${tw(after)}" w:line="${LINE}" w:lineRule="auto"/>${ind}${center ? `<w:jc w:val="center"/>` : ""}</w:pPr>${runs}</w:p>`;
  const contentTw = Math.round((8.5 - 2 * d.margin) * 1440);
  const h = res.header, center = d.headAlign === "center";
  const bulletInd = narrow => `<w:ind w:left="${narrow ? 220 : 300}" w:hanging="${narrow ? 160 : 200}"/>`;

  const heading = s => {
    const t = d.upper ? s.title.toUpperCase() : s.title;
    const color = d.heading === "box" && accent === "111111" ? "111111" : accent;
    const border = d.heading === "rule" ? `<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="${ruleHex}"/></w:pBdr>`
      : d.heading === "bar" ? `<w:pBdr><w:left w:val="single" w:sz="24" w:space="6" w:color="${accent}"/></w:pBdr>` : "";
    const shd = d.heading === "box" ? `<w:shd w:val="clear" w:color="auto" w:fill="${bandHex}"/>` : "";
    return para(run(t, { b: true, sz: m.head, color }), { before: m.sec, after: 4, border, shd, ind: d.heading === "bar" ? `<w:ind w:left="120"/>` : "" });
  };
  const sectionXml = (s, narrow, width) => {
    let out = heading(s);
    const right = `<w:tabs><w:tab w:val="right" w:pos="${width}"/></w:tabs>`;
    if (s.kind === "text") out += para(run(s.text), { after: 3 });
    if (s.kind === "entries") for (const i of s.items) {
      if (narrow) {
        out += para(run(i.org, { b: true, sz: m.org }), { before: m.entry, after: 0 });
        if (i.role) out += para(run(i.role), { after: 0 });
        const meta = [i.loc, i.dates].filter(Boolean).join(" · ");
        if (meta) out += para(run(meta, { sz: m.dates - 0.5, color: "444444" }), { after: 1 });
      } else {
        const rest = [i.role ? ` — ${i.role}` : "", i.loc ? ` · ${i.loc}` : "", d.dates === "inline" && i.dates ? ` · ${i.dates}` : ""].join("");
        // Rough width check (about half the size per character): if the dates won't fit on the line, they go on their own line.
        const fits = (i.org.length + rest.length) * m.org * 0.5 + (i.dates || "").length * m.dates * 0.5 + 24 < width / 20;
        if (d.dates === "right" && i.dates && !fits) out += para(run(i.org, { b: true, sz: m.org }) + run(rest, { sz: m.org }), { before: m.entry, after: 0 }) + para(run(i.dates, { sz: m.dates, color: "444444" }), { after: 1.5 });
        else out += para(run(i.org, { b: true, sz: m.org }) + run(rest, { sz: m.org }) + (d.dates === "right" && i.dates ? tab + run(i.dates, { sz: m.dates, color: "444444" }) : ""), { before: m.entry, after: 1.5, tabs: d.dates === "right" ? right : "" });
      }
      for (const b of i.bullets) out += para(run(`${m.bullet}  ${b.text}`), { after: 1, ind: bulletInd(narrow) });
    }
    if (s.kind === "skills") for (const g of s.groups) out += narrow
      ? para(run(g.label, { b: true }), { after: 0 }) + para(run(g.items), { after: 3 })
      : para(run(`${g.label}: `, { b: true }) + run(g.items), { after: 1.5 });
    if (s.kind === "list") {
      if (shortList(s.items)) out += narrow ? s.items.map(i => para(run(i.text), { after: 1 })).join("") : para(run(s.items.map(i => i.text).join("  ·  ")), { after: 1.5 });
      else for (const i of s.items) out += para(run(`${m.bullet}  ${i.text}`), { after: 1, ind: bulletInd(narrow) });
    }
    return out;
  };

  let body = para(run(h.name, { b: true, sz: m.name, color: d.nameColor ? accent : "111111" }), { after: 2, center });
  if (h.title) body += para(run(h.title, { sz: m.title, color: "444444" }), { after: 2, center });
  const contact = contactParts(h).join("  ·  ");
  if (contact) body += para(run(contact, { sz: m.contact, color: "333333" }), { after: 6, center, border: d.headLine ? `<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="${ruleHex}"/></w:pBdr>` : "" });

  const secs = visible(res);
  const side = d.layout === "one" ? [] : secs.filter(s => inSide(d, s)), main = secs.filter(s => !side.includes(s));
  if (!side.length || !main.length) body += secs.map(s => sectionXml(s, false, contentTw)).join("");
  else {
    // Two columns as a borderless table. Screening software reads tables less reliably; the page says so.
    const gap = 360, sw = Math.round(contentTw * d.sideWidth / 100), mw = contentTw - sw;
    const cell = (w, xml, pad) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:tcMar>${pad}</w:tcMar></w:tcPr>${xml || "<w:p/>"}</w:tc>`;
    const left = d.layout === "left";
    // The first cell carries the gap as its right padding, so its text is that much narrower.
    const sideXml = side.map(s => sectionXml(s, true, left ? sw - gap : sw)).join(""), mainXml = main.map(s => sectionXml(s, false, left ? mw : mw - gap)).join("");
    const none = ["top", "left", "bottom", "right", "insideH", "insideV"].map(k => `<w:${k} w:val="nil"/>`).join("");
    body += `<w:tbl><w:tblPr><w:tblW w:w="${contentTw}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${none}</w:tblBorders><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr>
<w:tblGrid><w:gridCol w:w="${left ? sw : mw}"/><w:gridCol w:w="${left ? mw : sw}"/></w:tblGrid><w:tr>${left
      ? cell(sw, sideXml, `<w:right w:w="${gap}" w:type="dxa"/>`) + cell(mw, mainXml, "")
      : cell(mw, mainXml, `<w:right w:w="${gap}" w:type="dxa"/>`) + cell(sw, sideXml, "")}</w:tr></w:tbl><w:p/>`;
  }
  const mar = Math.round(d.margin * 1440);
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="${mar}" w:right="${mar}" w:bottom="${mar}" w:left="${mar}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="${hp(m.body)}"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="40"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
  const zip = new window.JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${x(h.name)} – Resume</dc:title><dc:creator>${x(h.name)}</dc:creator></cp:coreProperties>`);
  zip.file("word/document.xml", documentXml);
  zip.file("word/styles.xml", stylesXml);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

// ---------- Saving ----------
export async function saveBlob(filename, blob) {
  let dl = null;
  try { if (window.claude?.use) dl = await window.claude.use("downloads"); } catch { dl = null; }
  if (dl) {
    try { await dl.save({ filename, data: blob }); return true; }
    catch (e) {
      if (e && e.code === "declined") return false;
      if (e && e.code === "rate_limited") { toast("Too many downloads at once. Try again in a moment."); return false; }
    }
  }
  // Outside Claude (or if downloads are unavailable), try a normal link download.
  try {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return true;
  } catch { toast("Downloads aren't available here."); return false; }
}

export async function downloadResume(res, fmt, style = "clean", { nameFrom = null } = {}) {
  const base = fileBase(nameFrom || res);
  try {
    if (fmt === "pdf") return saveBlob(`${base}.pdf`, await resumePdf(res, style));
    if (fmt === "docx") return saveBlob(`${base}.docx`, await resumeDocx(res, style));
    if (fmt === "txt") return saveBlob(`${base}.txt`, new Blob([resumeText(res)], { type: "text/plain" }));
    if (fmt === "md") return saveBlob(`${base}.md`, new Blob([resumeMarkdown(res)], { type: "text/markdown" }));
  } catch (e) {
    toast(/file maker/.test(e?.message || "") ? e.message : "Couldn't create the file. Try again.");
    console.error(e);
  }
}
