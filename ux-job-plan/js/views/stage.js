// Sections that arrive in later build stages.

import { STAGES, DOCS } from "../content.js";
import { esc } from "../util.js";
import { icon } from "../ui.js";

const DONE = 4;
const ROADMAP = [
  [1, "Overview, weekly plan, hours, events, settings"],
  [2, "Skills, courses and resources, weekly review"],
  [3, "Resume, Resume Tailor, LinkedIn, portfolio"],
  [4, "Interview prep, applications, strategy and networking"]
];

export function renderStage(key) {
  const s = STAGES[key];
  if (!s) return "";
  return `<header class="page-h"><div><div class="eyebrow">${esc(s.title)}</div><h1>${esc(s.title)}</h1><p class="lead">${esc(s.lead)}</p></div></header>
  <section class="card stage" aria-labelledby="stage-h">
    <div>
      <span class="badge">${icon("flag", "sm")}Coming in Stage ${s.stage}</span>
      <h2 id="stage-h">What this section will do</h2>
      <ul>${s.features.map(f => `<li>${icon("check")}<span>${esc(f)}</span></li>`).join("")}</ul>
      <p class="muted" style="margin-top:16px">Already prepared: ${esc(s.ready)}. The details are in the <a href="${DOCS.spec}" target="_blank" rel="noopener noreferrer">feature spec</a> and the <a href="${DOCS.research}" target="_blank" rel="noopener noreferrer">career research</a>.</p>
    </div>
    <aside aria-label="Build stages"><h3>Build stages</h3>
      <div class="roadmap">${ROADMAP.map(([n, t]) => `<div><span class="st ${n <= DONE ? "done" : n === s.stage ? "next" : ""}">${n <= DONE ? icon("check", "sm") : n}</span><span>${n === s.stage ? `<b>${esc(t)}</b>` : esc(t)}</span></div>`).join("")}</div>
    </aside>
  </section>`;
}
