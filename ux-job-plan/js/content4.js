// Stage 4 content: company loops, interview practice, story bank, applications and strategy.
// Sources: product design career research (Nov 2026). Location-specific lists are built from
// Settings → Location at the time they're used (see locale.js).

import { MOCK_PLAN } from "./plan-data.js";
import { L } from "./content.js";
import { jobsUrl, meetupUrl, searchUrl, getLoc } from "./locale.js";

const LI = q => "https://www.linkedin.com/jobs/search/?keywords=" + encodeURIComponent(q + " designer");
const src = (l, u) => ({ l, u });

// ---------- Companies (one record shared by Interview prep, Applications and Strategy) ----------
export const TIERS = {
  1: { name: "Big tech", short: "Tier 1", color: "var(--c-learn)", titles: "UX Designer I, Product Designer I, Associate UX Designer" },
  2: { name: "Mid-size", short: "Tier 2", color: "var(--c-build)", titles: "Product Designer, UX Designer, UI/UX Designer" },
  3: { name: "Startups, agencies, contract", short: "Tier 3", color: "var(--c-practice)", titles: "Product Designer, UX Designer II (contract)" }
};
// v1's split, and a mix that follows the LinkedIn research (aim at mid-size and contracts now).
export const V1_SHARES = { 1: 40, 2: 30, 3: 30 };
export const RESEARCH_SHARES = { 1: 20, 2: 45, 3: 35 };

export const MIDSIZE_LOOP = "Recruiter → hiring manager → portfolio review → take-home or live challenge → team interviews. Always ask the recruiter for the full process.";
export const LOOP_CHECKED = "2026-11-13";

const step = (name, tests, prep) => ({ name, tests, prep });
const LOOPS = {
  amazon: {
    steps: [
      step("Recruiter screen", "Background, level and why Amazon", "Your 60-second intro, salary range and start date"),
      step("Hiring-manager interview, 1 hour", "Half portfolio, half cross-functional questions; no whiteboard", "One case study in about 20 minutes, plus stories about working with PMs and engineers"),
      step("Onsite: portfolio presentation", "The problem, your decisions, the results and the why behind them", "A 45-minute deck with two case studies; lead with the outcome"),
      step("Onsite: functional design exercise", "Clarifying questions, focus on the customer, a workable flow", "Timed challenges. A reported prompt: show laundromat customers when a machine will be free"),
      step("Onsite: behavioral interviews", "Leadership Principles in every round", "2–3 STAR stories for each key principle, each under 3 minutes")
    ],
    distinctive: "Every round checks Leadership Principles. The whole process takes about 4–6 weeks.",
    sources: [src("Exponent: Amazon UX Designer interview", "https://www.tryexponent.com/guides/amazon-ux-designer-interview"), src("Prepfully: Amazon UX Designer", "https://prepfully.com/interview-guides/amazon-ux-designer")]
  },
  microsoft: {
    steps: [
      step("Design recruiter", "Background and team fit", "Know which team you applied to; you usually do"),
      step("Hiring manager", "Your experience against the team's work", "Lead with the case study closest to their product"),
      step("Portfolio presentation, 1 hour", "Goals (OKRs), decisions and lessons for each case study", "For every project: the goal, the metric and what you learned"),
      step("About 4 individual interviews", "Design, collaboration and team-specific competencies", "Stories on collaboration and growth; questions on the team's product")
    ],
    distinctive: "Each team sets its own process. Candidates report questions on the OKRs and lessons behind each case study.",
    sources: [src("Exponent: Microsoft Product Designer interview", "https://www.tryexponent.com/guides/microsoft-product-designer-interview"), src("Glassdoor: Microsoft interview", "https://clear.glassdoor.nl/Interview/Microsoft-Interview-E1651-RVW103647574.htm"), src("Glassdoor: Microsoft interview report", "https://www.glassdoor.co.in/Interview/Microsoft-Interview-E1651-RVW25497378.htm")]
  },
  google: {
    steps: [
      step("Recruiter", "Background and role fit", "Portfolio link in the resume; Google requires one"),
      step("Portfolio review with a designer", "Craft and the reasoning behind your work", "Two case studies told as narratives built on data"),
      step("Take-home exercise (sometimes)", "Process, framing and craft under a time limit", "Candidates report 3–5 hours; ask the limit and what to hand in"),
      step("Onsite: panel portfolio presentation", "Story for PM, engineering and design in the same room", "Explain trade-offs for each discipline"),
      step("Onsite: design exercise", "Framing, users, ideas and a clear choice", "Timed challenges with metrics at the end"),
      step("Onsite: Googleyness and Leadership", "Collaboration, ambiguity and leading without authority", "Stories on ambiguity and disagreement"),
      step("Onsite: cross-functional interview", "How you work with PMs and engineers", "Stories on feasibility and prioritization"),
      step("Hiring committee, then team matching", "Your packet is reviewed; then teams pick", "Team matching can take longer than the interviews")
    ],
    distinctive: "A hiring committee decides, then team matching. Candidates say matching can take longer than the interviews.",
    sources: [src("Exponent: Google Interaction Designer interview", "https://www.tryexponent.com/guides/google-interaction-designer-interview"), src("Glassdoor: Google UX interview report", "https://www.glassdoor.com.br/Entrevista/Google-Entrevista-E9079-RVW31154489.htm"), src("CleverPrep: Google UX Designer", "https://www.cleverprep.com/companies/google/ux-designer"), src("Nora: Google UX Designer guide 2026", "https://interview.norahq.com/interview-guides/google-ux-designer-interview-guide-2026")]
  },
  meta: {
    steps: [
      step("Recruiter", "Background and level", "Your intro and why Meta"),
      step("Case-study walkthrough", "Product thinking and visual craft in one project", "One case study, problem to outcome"),
      step("Full loop: panel presentation", "Product thinking, craft and how you present", "Two case studies with clear decisions"),
      step("Full loop: app critique", "Structure, users, problems ranked by impact", "Practice on Google Maps, DoorDash, Airbnb, Spotify, Pinterest or Yelp"),
      step("Full loop: whiteboard product design", "Framing, ideas, a decision and metrics", "45-minute timed challenges"),
      step("Full loop: behavioral 1:1s", "Collaboration, conflict and growth", "Stories on disagreement and feedback"),
      step("Hiring committee, then team matching", "Your packet is reviewed; then teams pick", "Keep practicing while you wait")
    ],
    distinctive: "App critique is a set round. Strong emphasis on product thinking and visual craft.",
    sources: [src("Glassdoor: Meta Product Designer interview", "https://www.glassdoor.co.in/Interview/Meta-Interview-E40772-RVW97601742.htm"), src("Glassdoor: Meta app critique list", "https://www.glassdoor.sg/Interview/Meta-Interview-E40772-RVW90828080.htm")]
  },
  openai: {
    steps: [
      step("Recruiter or hiring-manager screen", "Background and fit with a small team", "Show range: copy, motion, some front-end code"),
      step("Take-home or portfolio, defended live", "Your choices under questioning", "Be ready to explain every decision and what you'd change"),
      step("Final loop", "Varies by team", "Ask the recruiter for the exact format")
    ],
    distinctive: "A small design team where designers also own copy, motion and some front-end code. Many design roles there are senior.",
    sources: [src("Exponent: OpenAI interview process", "https://www.tryexponent.com/blog/openai-interview-process"), src("OpenAI careers", "https://openai.com/careers")]
  }
};

// [id, name, tier, careers link, fit note]. Companies that hire product designers in many cities
// and remotely; add local ones on the Interview prep or Applications page.
const CO = [
  ["amazon", "Amazon", "1", "https://www.amazon.jobs", ""],
  ["microsoft", "Microsoft", "1", "https://careers.microsoft.com", ""],
  ["google", "Google", "1", "https://www.google.com/about/careers/applications/", ""],
  ["meta", "Meta", "1", "https://www.metacareers.com", ""],
  ["openai", "OpenAI", "1", "https://openai.com/careers", ""],
  ["apple", "Apple", "1", "https://jobs.apple.com", ""],
  ["salesforce", "Salesforce", "2", "https://careers.salesforce.com", ""],
  ["adobe", "Adobe", "2", "https://careers.adobe.com", ""],
  ["atlassian", "Atlassian", "2", "https://www.atlassian.com/company/careers", ""],
  ["expedia", "Expedia Group", "2", "https://careers.expediagroup.com", ""],
  ["docusign", "DocuSign", "2", "https://careers.docusign.com", ""],
  ["spotify", "Spotify", "2", "https://www.lifeatspotify.com/jobs", ""],
  ["airbnb", "Airbnb", "2", "https://careers.airbnb.com", ""],
  ["shopify", "Shopify", "2", "https://www.shopify.com/careers", ""],
  ["plaid", "Plaid", "2", "https://plaid.com/careers/", ""],
  ["samsung", "Samsung", "2", LI("Samsung"), ""],
  ["figma", "Figma", "3", "https://www.figma.com/careers/", ""],
  ["notion", "Notion", "3", "https://www.notion.com/careers", ""]
];
export const COMPANY_SEED = CO.map(([id, name, tier, careers, fit]) => ({
  id, name, tier, careers, fit, builtIn: true, target: true,
  loop: LOOPS[id] ? { ...LOOPS[id], steps: LOOPS[id].steps.map(s => ({ ...s })), sources: LOOPS[id].sources.map(s => ({ ...s })), checked: LOOP_CHECKED, ai: false } : null,
  contact: "", next: "", nextDate: "", notes: ""
}));
export const LOOP_ORDER = ["amazon", "microsoft", "google", "meta", "openai"];

// ---------- Portfolio presentation ----------
const sec = (id, name, min, notes) => ({ id, name, min, notes });
export const PRES_LONG = [
  sec("intro", "Intro: who you are, what you focus on", 2, ""),
  sec("c1-ctx", "Case 1: context and problem", 4, "Product, users, business goal, your role, the team"),
  sec("c1-proc", "Case 1: process and decisions", 10, "Research, options, trade-offs, why"),
  sec("c1-out", "Case 1: outcome", 3, "Metrics, launch, feedback"),
  sec("c1-learn", "Case 1: learnings", 2, "What you'd do differently"),
  sec("c2-ctx", "Case 2: context and problem", 4, ""),
  sec("c2-proc", "Case 2: process and decisions", 10, ""),
  sec("c2-out", "Case 2: outcome", 3, ""),
  sec("c2-learn", "Case 2: learnings", 2, ""),
  sec("qa", "Questions", 5, "“Why this decision?” “What would you change?”")
];
export const PRES_SHORT = [
  sec("s-intro", "Intro", 1, ""),
  sec("s-ctx", "Context and problem", 2, "One case study"),
  sec("s-proc", "Process and decisions", 7, "The two decisions that mattered most"),
  sec("s-out", "Outcome", 2, ""),
  sec("s-learn", "Learnings", 1, ""),
  sec("s-qa", "Questions", 2, "")
];

// ---------- Design challenge ----------
// tags drive the filters; label is the category as written in the research.
const p = (id, text, label, tags, note = "") => ({ id, text, label, tags, note, builtIn: true });
export const PROMPTS = [
  p("p1", "Help commuters plan a trip that combines bus and train.", "Mobile", ["mobile"]),
  p("p2", "Redesign grocery delivery checkout for adults over 65.", "Mobile, accessibility", ["mobile", "a11y"]),
  p("p3", "A dashboard for a small business owner to track online orders.", "Web, B2B", ["web", "enterprise"]),
  p("p4", "An AI assistant in a banking app that explains spending.", "AI", ["ai", "mobile"]),
  p("p5", "A tool that helps new employees find answers across internal tools.", "Enterprise, AI", ["enterprise", "ai"]),
  p("p6", "An app for neighbors to share and borrow tools.", "Mobile", ["mobile"]),
  p("p7", "The booking flow for a car service garage, from choosing a service to confirmation.", "Web", ["web"]),
  p("p8", "Split recurring household bills with roommates.", "Mobile", ["mobile"]),
  p("p9", "A smart home screen that shows what matters in the morning.", "Devices", ["devices"]),
  p("p10", "Help first-time voters find their polling information.", "Civic, accessibility", ["web", "a11y"]),
  p("p11", "Show laundromat customers when a machine will be free next.", "Devices, service", ["devices"], "Reported at Amazon (Prepfully)"),
  p("p12", "Redesign the ATM experience.", "Physical, service", ["devices"], "Reported at Meta (Glassdoor)"),
  p("p13", "An agent that books a dinner for four with different diets. Users must approve before it pays.", "AI agents", ["ai"]),
  p("p14", "Show sources and confidence in an AI answer for a health insurance question.", "AI, trust", ["ai"]),
  p("p15", "Let users undo or correct what an AI writing assistant changed in a document.", "AI, productivity", ["ai", "web"]),
  p("p16", "A voice-first shopping list for a smart speaker with a screen.", "Voice, devices", ["devices", "ai"]),
  p("p17", "Onboard a small business onto an advertising platform in under 10 minutes.", "B2B, growth", ["web", "enterprise"]),
  p("p18", "An admin console for managing employee access to company apps.", "Enterprise", ["enterprise", "web"]),
  p("p19", "A developer portal flow for publishing an app to a store.", "Developer tools", ["enterprise", "web"]),
  p("p20", "Help warehouse associates report a safety issue in 30 seconds.", "Internal tools", ["enterprise", "mobile"]),
  p("p21", "Help parents coordinate school pickups with other families.", "Mobile, social", ["mobile"]),
  p("p22", "Help international students track visa paperwork deadlines.", "Mobile, civic", ["mobile"]),
  p("p23", "Help hikers check trail conditions and parking before leaving.", "Mobile, local", ["mobile"]),
  p("p24", "Help ferry riders plan around ferry wait times.", "Mobile, local", ["mobile"]),
  p("p25", "A returns flow for an online clothing store that reduces returns.", "E-commerce", ["web", "mobile"]),
  p("p26", "Let travelers change a flight booking on mobile when the flight is delayed.", "Travel", ["mobile"]),
  p("p27", "Help renters compare apartments, including commute time.", "Web, real estate", ["web"]),
  p("p28", "Make a video-call app usable for people who are hard of hearing.", "Accessibility", ["a11y"]),
  p("p29", "A wearable feature that encourages taking breaks during long work sessions.", "Wearables", ["devices"]),
  p("p30", "Help a team decide which customer feedback to act on first.", "B2B, AI", ["enterprise", "ai"])
];
export const PROMPT_FILTERS = [["all", "All"], ["mobile", "Mobile"], ["web", "Web"], ["ai", "AI"], ["enterprise", "Enterprise"], ["devices", "Devices"], ["a11y", "Accessibility"], ["mine", "My prompts"]];
// Phase markers for a 45-minute challenge, in minutes from the start.
export const PHASES = [
  { key: "clarify", name: "Clarify goal and constraints", from: 0, to: 8, tip: "Questions only. Who, what, where, why now, limits." },
  { key: "users", name: "Define the user", from: 8, to: 13, tip: "Pick one primary user and their situation." },
  { key: "problem", name: "Pick one problem", from: 13, to: 18, tip: "Say out loud why this one." },
  { key: "flow", name: "Map the key flow", from: 18, to: 25, tip: "Steps before screens." },
  { key: "sketch", name: "Sketch 2 options", from: 25, to: 35, tip: "Two real alternatives, not variations." },
  { key: "choice", name: "Choose and explain", from: 35, to: 40, tip: "Trade-offs, what you gave up." },
  { key: "metrics", name: "Success metrics and next steps", from: 40, to: 45, tip: "One main metric, guardrails, what you'd test." }
];

// ---------- Rubrics (each row scored 1–4) ----------
export const RUBRICS = {
  story: { name: "Story", rows: [["structure", "Structure: a short setup, under 20% of the time"], ["own", "Your own actions: “I” more than “we”"], ["evidence", "A result with evidence"], ["relevance", "Relevant to the question or principle"], ["lesson", "A lesson"], ["length", "Under 3 minutes spoken (about 450 words)"]] },
  presentation: { name: "Portfolio presentation", rows: [["problem", "Problem and business goal"], ["role", "Your role"], ["decisions", "Decisions and trade-offs"], ["craft", "Craft"], ["outcome", "Outcome and how it was measured"], ["timing", "Story and timing"], ["qa", "Handling questions"]] },
  challenge: { name: "Design challenge", rows: [["clarify", "Clarifying questions and constraints"], ["user", "User and problem definition"], ["focus", "Choosing one problem"], ["breadth", "Breadth of ideas"], ["tradeoffs", "Decision and trade-offs"], ["metrics", "Success metrics and next steps"], ["comms", "Clear communication"], ["time", "Time management"]] },
  critique: { name: "App critique", rows: [["who", "Who it's for and the job it does"], ["strengths", "Strengths with reasons"], ["problems", "Problems ranked by impact"], ["fix", "A fix and how you'd measure it"], ["business", "Business awareness"], ["structure", "Structure"]] }
};
export const SCORE_WORDS = { 1: "Missing", 2: "Partly there", 3: "Solid", 4: "Strong" };

// ---------- Story bank ----------
export const STORY_FORMATS = {
  STAR: { name: "STAR", best: "Default; Amazon Leadership Principle questions", fields: [["s", "Situation"], ["t", "Task"], ["a", "Action"], ["r", "Result"]] },
  STARL: { name: "STARL", best: "Failure and feedback stories", fields: [["s", "Situation"], ["t", "Task"], ["a", "Action"], ["r", "Result"], ["l", "Learning"]] },
  CAR: { name: "CAR", best: "Short answers, recruiter screens", fields: [["c", "Challenge"], ["a", "Action"], ["r", "Result"]] },
  PAR: { name: "PAR", best: "When situation and task overlap", fields: [["p", "Problem"], ["a", "Action"], ["r", "Result"]] },
  SOAR: { name: "SOAR", best: "Stories where the difficulty is the point", fields: [["s", "Situation"], ["o", "Obstacle"], ["a", "Action"], ["r", "Result"]] },
  SHARE: { name: "SHARE", best: "Stories where you'd now do it differently", fields: [["s", "Situation"], ["h", "Hindrance"], ["a", "Action"], ["r", "Result"], ["e", "Evaluation"]] }
};
export const STORY_STATUS = { idea: "Idea", drafted: "Drafted", ready: "Ready", rehearsed: "Rehearsed" };
export const THEMES = [
  ["impact", "Impact and ownership"], ["collab", "Collaboration and conflict"], ["ambiguity", "Ambiguity and judgment"], ["failure", "Failure and learning"],
  ["users", "Users and research"], ["craft", "Craft and quality"], ["growth", "Growth and AI"], ["amazon", "Amazon Leadership Principles"]
];
const q = (id, theme, text, tags = []) => ({ id, theme, q: text, tags });
export const QUESTIONS = [
  q("q1", "impact", "Tell me about the project you're proudest of.", ["Deliver Results"]),
  q("q2", "impact", "Tell me about a time you took ownership beyond your role.", ["Ownership"]),
  q("q3", "impact", "Tell me about a design decision that changed a metric or a user outcome.", ["Deliver Results", "Impact and metrics"]),
  q("q4", "impact", "Tell me about a tight deadline. What did you cut, and why?", ["Bias for Action"]),
  q("q5", "collab", "Tell me about a time you disagreed with a PM about a design.", ["Have Backbone; Disagree and Commit", "Handling conflict"]),
  q("q6", "collab", "Tell me about an engineer pushing back on feasibility. What happened?", ["Collaboration"]),
  q("q7", "collab", "Tell me about working with a difficult stakeholder.", ["Earn Trust", "Handling conflict"]),
  q("q8", "collab", "How did you get support for an idea others didn't like at first?", ["Have Backbone; Disagree and Commit", "Communication"]),
  q("q9", "collab", "Tell me about a time you disagreed but committed to the team's decision.", ["Have Backbone; Disagree and Commit"]),
  q("q10", "ambiguity", "Tell me about a decision you made with incomplete data.", ["Are Right, A Lot", "Ambiguity"]),
  q("q11", "ambiguity", "Tell me about requirements changing late in a project.", ["Ambiguity"]),
  q("q12", "ambiguity", "Tell me about a time you had to design without research.", ["Bias for Action", "Ambiguity"]),
  q("q13", "ambiguity", "How do you handle ambiguity?", ["Ambiguity"]),
  q("q14", "failure", "Tell me about a mistake you made and what you changed.", ["Earn Trust", "Learning from failure"]),
  q("q15", "failure", "Tell me about a project that didn't go as planned.", ["Learning from failure"]),
  q("q16", "failure", "Tell me about critical feedback you acted on.", ["Learn and Be Curious", "Growth mindset"]),
  q("q17", "failure", "Tell me about a time you were wrong about users.", ["Customer Obsession", "Learning from failure"]),
  q("q18", "users", "Tell me about advocating for users against business pressure.", ["Customer Obsession", "User advocacy"]),
  q("q19", "users", "Tell me about research that changed your direction.", ["Dive Deep", "User advocacy"]),
  q("q20", "users", "Tell me about simplifying something complex.", ["Invent and Simplify"]),
  q("q21", "users", "Tell me about designing for accessibility.", ["Customer Obsession", "User advocacy"]),
  q("q22", "craft", "Tell me about raising the quality bar on a team.", ["Insist on the Highest Standards", "Craft and quality"]),
  q("q23", "craft", "Tell me about contributing to a design system.", ["Craft and quality"]),
  q("q24", "craft", "How do you balance craft and speed?", ["Insist on the Highest Standards", "Bias for Action"]),
  q("q25", "growth", "Tell me about learning a new tool or skill quickly.", ["Learn and Be Curious", "Growth mindset"]),
  q("q26", "growth", "How do you use AI in your work, and when don't you?", ["Learn and Be Curious"]),
  q("q27", "growth", "Tell me about feedback you gave a peer.", ["Hire and Develop the Best", "Communication"]),
  q("q28", "amazon", "Dive Deep: a time data revealed the real cause of a problem.", ["Dive Deep"]),
  q("q29", "amazon", "Invent and Simplify: a time you found a simpler way.", ["Invent and Simplify"]),
  q("q30", "amazon", "Frugality: a time you did more with less.", ["Frugality"]),
  q("q31", "amazon", "Earn Trust: a time you rebuilt trust after a mistake.", ["Earn Trust"]),
  q("q32", "amazon", "Motivation: why this company, why this city, and where you want to grow.", ["Think Big"])
];
export const LPS = ["Customer Obsession", "Ownership", "Invent and Simplify", "Are Right, A Lot", "Learn and Be Curious", "Hire and Develop the Best", "Insist on the Highest Standards", "Think Big", "Bias for Action", "Frugality", "Earn Trust", "Dive Deep", "Have Backbone; Disagree and Commit", "Deliver Results", "Strive to be Earth's Best Employer", "Success and Scale Bring Broad Responsibility"];
// What other companies call the behavioral rounds, and common competencies to tag.
export const COMPETENCIES = ["Collaboration", "Handling conflict", "Ambiguity", "Learning from failure", "User advocacy", "Craft and quality", "Impact and metrics", "Communication", "Leadership", "Growth mindset", "Googleyness"];
export const ROUND_NAMES = "Amazon calls them Leadership Principles; Google, Googleyness and Leadership; Meta, behavioral or background; Microsoft, team-specific competencies.";
export const WORDS_PER_MIN = 150;
export const STORY_MAX_WORDS = 450;

// ---------- Other interview types ----------
const t = (id, name, what, prep, links = [], practice = "") => ({ id, name, what, prep, links, practice });
export const ROUND_TYPES = [
  t("takehome", "Take-home exercise", "A design problem you solve on your own time. Google candidates report 3–5 hours.", ["Ask the time limit and exactly what to hand in before you start", "Timebox it and say what you'd do with more time", "Show your thinking: framing, options and the choice, not only polished screens", "End with what you'd test next and how you'd measure success"], [], "challenge"),
  t("whiteboard", "Live whiteboard", "A 45–60 minute design exercise with an interviewer watching and asking questions.", ["Spend the first 5–8 minutes on questions only", "Think out loud and check in with the interviewer", "Draw the flow before any screens", "Watch the clock and save 5 minutes for metrics"], [L.ytChallenge], "challenge"),
  t("hm", "Portfolio review with a hiring manager", "Often one case study in 20 minutes plus questions. At Amazon it's half portfolio, half cross-functional questions.", ["Pick the case study closest to their product", "Open with the outcome and your role", "Have the 15-minute version of your deck ready", "Prepare 2 stories about working with PMs and engineers"], [L.ytPortfolioMock], "presentation"),
  t("xfn", "PM and engineer interviews", "Partners from other disciplines test how you work with them.", ["Stories on feasibility pushback and trade-offs", "How you prioritize when time is short", "How you hand off and check the build (design QA)", "Questions about how their team works with design"], [], "story"),
  t("pastwork", "Critique of your own past work", "“What would you change?” about a project in your portfolio.", ["Have 2 honest weaknesses for each case study", "Say what you'd do now and why", "Show what you learned, not regret"], [], ""),
  t("barraiser", "Amazon bar raiser", "Amazon loops often include an interviewer from outside the team whose job is to keep the hiring bar high. Expect deep follow-ups on Leadership Principles.", ["Know exactly what you did in each story, not the team", "Have numbers or evidence ready, even small ones", "Expect “And then what?” two or three times", "Cover Customer Obsession, Ownership, Dive Deep and Disagree and Commit"], [L.lps], "story"),
  t("metrics", "Product sense and metrics", "How you define success and choose what to measure.", ["Name one main metric and 2 guardrails for each case study", "Use HEART: happiness, engagement, adoption, retention, task success", "Explain how you'd know a design worked within a month"], [L.ytHeart], ""),
  t("a11y", "Accessibility", "Questions on designing for everyone and checking your work.", ["WCAG 2.2 AA basics: contrast, focus order, labels, target size", "One story where accessibility changed a design", "How you test with a screen reader and keyboard"], [L.wai], ""),
  t("ai", "Designing AI features", "How you design features where AI can be wrong, slow or unsure.", ["Set expectations about what the AI can do", "Show sources and confidence; let people correct and undo", "Keep a person in the loop for consequential actions", "Design the wrong, unsure and slow states"], [L.hax, L.pair], "")
];
export const CRITIQUE_STEPS = ["Who it's for and what job it does", "What works, and why", "The 2–3 biggest problems, ranked by impact", "What you'd change first, and how you'd measure it"];
export const CRITIQUE_APPS = ["Google Maps", "DoorDash", "Airbnb", "Spotify", "Pinterest", "Yelp", "Duolingo", "Uber", "Notion", "Instagram"];
export const ANSWERS = [
  ["intro", "Tell me about yourself (60 seconds)", "Who you are, what you focus on, what you're looking for."],
  ["why", "Why this company, why this city", ""],
  ["salary", "Salary range", "Check Levels.fyi and Glassdoor for your city and level, then give a range rather than one number."],
  ["start", "When can you start", ""],
  ["qs", "Questions to ask interviewers", "Three or more, specific to the team."]
];
export const QUESTIONS_TO_ASK = ["What does success look like for this role in the first 90 days?", "How do designers work with PMs and engineers here?", "What's the biggest design challenge the team faces right now?", "How is design work reviewed and critiqued?", "What would the next step in the process look like?"];
export const MOCK_TYPES = ["Portfolio presentation", "Design challenge", "Behavioral", "App critique", "Recruiter screen", "Full loop"];
// Mock interviews in the generated plan, and the week the last one is scheduled.
export const MOCK_TARGET = MOCK_PLAN.target;
export const MOCK_BY_WEEK = MOCK_PLAN.byWeek;

// ---------- Applications ----------
export const SOURCES = ["LinkedIn", "Built In", "Company site", "Referral", "Agency", "Recruiter reached out", "Other"];
export const STATUS_TIPS = {
  Saved: "Find one designer or recruiter there on LinkedIn before you apply. Apply within 24 hours of the posting when you can.",
  Applied: "Follow up once, 7–10 days after applying, if you have a contact.",
  "Recruiter screen": "Have your 60-second intro, salary range and start date ready (Interview prep).",
  Interviewing: "Present two case studies, 15–20 minutes each, and leave time for questions.",
  "Final round": "Rehearse the full deck, one design challenge and your story bank the day before.",
  Offer: "Ask for time to decide, compare total compensation, and negotiate once, politely.",
  Rejected: "Ask the recruiter for feedback and note it here.",
  Withdrawn: ""
};
export function companyTips(name, tier) {
  const co = (name || "").toLowerCase();
  if (co.includes("amazon") || co.includes("aws") || co.includes("goodreads")) return ["Map 2–3 stories to each of Customer Obsession, Ownership, Dive Deep and Have Backbone; Disagree and Commit.", "Expect a design exercise in the final loop; practice with the timer.", "Bring data: what changed after launch, even small numbers."];
  if (co.includes("microsoft")) return ["Prepare a 1-hour portfolio presentation with two case studies.", "For each case study, know the goal (OKR), the metric and what you learned.", "Read the HAX guidelines if the team works on Copilot or AI features."];
  if (co.includes("google")) return ["Build each case study as a narrative backed by data.", "Ask whether there's a take-home and how long it should take.", "Prepare stories on ambiguity for Googleyness and Leadership."];
  if (co.includes("meta")) return ["Practice app critiques out loud: Maps, DoorDash, Airbnb, Spotify, Pinterest, Yelp.", "Show product thinking and visual craft in the same case study."];
  if (tier === "3") return ["Startups and agencies value speed and range: show a working prototype.", "Expect a take-home exercise; ask about the time limit before starting."];
  return ["Look up the team's product and do a 10-minute critique before the first call.", "Lead with the case study closest to their product (mobile, dashboards or research)."];
}

// ---------- Strategy & networking ----------
// Weekly goals from the research: [applications, coffee chats, events, referral asks] for weeks 1–2, 3–4, 5+.
// Full-pace weekly goals. Each plan week sets its own (setup weeks, the lighter weeks before
// the portfolio is live, holidays); these apply once the search is at full pace.
// About 9–10 hours: 6 applications at 45 minutes, 2 coffee chats, 2 referral asks, 1 event, follow-ups.
export const GOAL_DEFAULT = { apps: 6, chats: 2, events: 1, refs: 2 };
export const GOAL_OLD_DEFAULT = { apps: 8, chats: 2, events: 1, refs: 2 };
export const REPLY_GOAL = 0.08;   // at least 8% of applications leading to a recruiter reply
export const AGENCIES = [
  { name: "Aquent", note: "Contract and freelance design roles in many cities and remote.", u: "https://aquent.com" },
  { name: "TEKsystems", note: "Contract Product Designer roles; screens resumes with AI, so literal keywords matter.", u: LI("TEKsystems product") },
  { name: "Robert Half", note: "Creative and design contract roles.", u: LI("Robert Half product") }
];
export const CONTRACT_NOTE = "Contract roles pay hourly and move fast: Easy Apply posts can draw dozens of applicants within a day. To compare with a salary, an hourly rate times about 2,000 hours is the yearly figure before any gaps between contracts. A contract at a big company can be the way in.";
export const WARM_NETWORK = [
  "Search LinkedIn for designers at your target companies who are 1st or 2nd-degree connections.",
  "Check where alumni from your school work: LinkedIn's alumni page filters by company and title.",
  "Former colleagues and classmates who moved into product or engineering roles count too.",
  "Start there when you're ready: they're the easiest first conversations."
];
export const HOW_TO_APPLY = [
  "Paste the posting into Resume Tailor, then add it to Applications.",
  "Mirror 5–8 of its keywords in your resume, only where they're true.",
  "Lead with the case study closest to the role.",
  "Apply within 24 hours of the posting; contract roles fill fastest.",
  "Find one designer or recruiter there and send a short note.",
  "Follow up once, 7–10 days later.",
  "Keep at most 2–3 open applications per company at a time.",
  "Answer work authorization questions accurately."
];
// Built when used, so the links follow Settings → Location.
export function whereToFind() {
  const c = getLoc().city;
  return [
    { l: `LinkedIn alerts: “product designer” and “UX designer”${c ? ` near ${c}` : ""}`, u: jobsUrl("product designer") },
    { l: "Remote product design roles on LinkedIn", u: "https://www.linkedin.com/jobs/search/?keywords=product%20designer&f_WT=2" },
    { l: L.wellfound.l, u: L.wellfound.u },
    { l: "Aquent and other agencies for contract roles", u: "https://aquent.com" }
  ];
}
const cm = (id, name, desc, u) => ({ id, name, desc, u, builtIn: true });
// Communities near the person's city (or online when no city is set).
export function communities() {
  const c = getLoc().city;
  const near = c ? ` near ${c}` : "";
  return [
    cm("ixda", `IxDA${c ? ` ${c}` : " local groups"}`, "Interaction Design Association: talks and casual meetups", searchUrl(`IxDA ${c || "local group"}`)),
    cm("uxpa", `UXPA${c ? ` ${c}` : " chapters"}`, "Talks, mixers and sessions for people new to UX", searchUrl(`UXPA chapter ${c}`.trim())),
    cm("fof", `Friends of Figma${c ? ` ${c}` : ""}`, "Figma's local community chapters", "https://friends.figma.com"),
    cm("meetup", `UX meetups${near}`, "Design meetups, workshops and talks", meetupUrl("UX design")),
    cm("content", `Content design meetups${near}`, "For content designers and UX writers", meetupUrl("content design UX writing")),
    cm("adplist", "ADPList", "Free 1:1 mentoring and mock interviews", L.adplist.u)
  ];
}
export const EVENTS_TIP = "Pick two groups to attend regularly, so people start to recognize you. Bring one question about their team's work, and follow up on LinkedIn within 48 hours.";
export const TEMPLATES = [
  { id: "coffee", name: "Coffee chat", text: "Hi [name], I'm a product designer focused on mobile and web products. I liked [specific project or post] and I'm curious how your team approaches [topic]. Would you have 15 minutes for a quick call in the next couple of weeks?" },
  { id: "follow", name: "Follow-up", text: "Hi [name], just following up on my note from [day]. I know things get busy. If a short call isn't possible, I'd still love one tip on how your team approaches [topic]. Thanks either way!" },
  { id: "referral", name: "Referral ask", text: "Hi [name], thank you again for the chat about [topic]. I've applied for the [role] role at [company] ([link]). If you feel comfortable, would you be open to referring me? I've attached my resume and portfolio, and I'm happy to send a short summary you can forward." },
  { id: "thanks", name: "Thank-you", text: "Hi [name], thank you for your time today. Your point about [specific thing] was really helpful, and I'm going to [what you'll do with it]. I'd be glad to return the favor any time." }
];
export const CONTACT_HOW = ["Coffee chat", "Event", "LinkedIn", "Referral", "School", "Former colleague", "Recruiter", "Other"];
export const REF_STATUS = { toask: "To ask", asked: "Asked", referred: "Referred", declined: "Declined", noreply: "No reply" };
// Funnel checks from the research's review rules.
export const HINT_RULES = {
  noReplies: "20 or more applications and no replies yet: fix the resume or portfolio before sending more.",
  lowReply: "Fewer than 8% of applications are getting a reply. Tailor more and lean on referrals.",
  screensNoPortfolio: "Recruiter screens but no portfolio rounds: tighten your 60-second intro and how you describe your experience.",
  portfolioNoOnsite: "Portfolio rounds but no final rounds: rework the presentation.",
  onsiteNoOffer: "Final rounds but no offers: more mock interviews, design challenges and stories.",
  tooMany: "More than 3 open applications at one company. Focus on the best fit there.",
  noReferrals: "No referral asks yet. Referrals reach interviews far more often than cold applications.",
  behindApps: "Behind on applications this week."
};
