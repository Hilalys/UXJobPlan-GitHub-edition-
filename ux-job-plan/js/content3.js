// Stage 3 content: starter resume, checklists, house rules, case studies.
// The starter resume is an empty template: the person fills it in or imports their own.

// Default profile text for AI features. Empty: people describe themselves in Settings → About you.
export const PROFILE_SUMMARY = "";

const b = (id, text) => ({ id, text, hidden: false });

export function starterResume(p = {}) {
  return {
    id: "master", name: "Master resume", updated: "",
    header: { name: p.name || "", title: p.title || "Product Designer", location: p.location || "", phone: "", email: "", linkedin: "", portfolio: "" },
    sections: [
      { id: "summary", kind: "text", title: "Summary", hidden: false, text: "" },
      { id: "experience", kind: "entries", type: "experience", title: "Experience", hidden: false, items: [
        { id: "x-1", org: "", role: "", loc: "", dates: "", hidden: false, bullets: [b("b-x1-1", ""), b("b-x1-2", "")] }
      ] },
      { id: "projects", kind: "entries", type: "projects", title: "Projects", hidden: false, items: [
        { id: "p-1", org: "", role: "Self-initiated research and prototype", loc: "", dates: "", hidden: false, bullets: [b("b-p1-1", "")] }
      ] },
      { id: "education", kind: "entries", type: "education", title: "Education", hidden: false, items: [
        { id: "e-1", org: "", role: "", loc: "", dates: "", hidden: false, bullets: [] }
      ] },
      { id: "skills", kind: "skills", title: "Skills", hidden: false, groups: [
        { id: "g-design", label: "Design", items: "Figma, prototyping, design systems, interaction design, visual design", hidden: false },
        { id: "g-research", label: "Research", items: "User interviews, usability testing", hidden: false },
        { id: "g-code", label: "Front-end", items: "", hidden: false }
      ] },
      { id: "languages", kind: "list", title: "Languages", hidden: false, items: [b("l-1", "")] }
    ]
  };
}

export const SECTION_KINDS = {
  experience: { org: "Company", role: "Title", loc: "Location", dates: "Dates" },
  projects: { org: "Project", role: "What it is", loc: "Link", dates: "Dates" },
  education: { org: "School", role: "Degree", loc: "Location", dates: "Dates" },
  custom: { org: "Name", role: "Detail", loc: "Location or link", dates: "Dates" }
};

// Checklists: [text, why, how]
const C = (text, why, how) => ({ text, why, how });
export const RESUME_CHECKS = [
  C("Location: {cityFull} and a local phone number", "Recruiters filter for local candidates, and a foreign number can read as not yet moved.", "Put your city in the header (or \"Remote\") and use a local number."),
  C("LinkedIn custom URL in the header", "Recruiters check LinkedIn against the resume.", "Set a short custom URL (linkedin.com/in/yourname) and use it without https://www."),
  C("Dates match LinkedIn exactly", "Mismatched dates raise questions in screens.", "Compare each role's month and year on both."),
  C("Title line says Product Designer", "It's the title most postings use for this work.", "Put \"Product Designer\" under your name; tailor it per job in Resume Tailor."),
  C("Every bullet: problem → what you did → result", "Hiring managers look for impact, not task lists.", "Start with a strong verb; end with what changed. Use the AI bullet helper."),
  C("At least one number per role where honest (screens shipped, apps launched, ratings)", "Numbers make impact concrete.", "Count what you can verify. Never estimate a number you can't back up."),
  C("Removed outdated tools and course lists", "Outdated tools and course lists make a resume look junior.", "Keep tools postings ask for: Figma, prototyping, front-end basics."),
  C("Portfolio link at the top", "Google and Microsoft postings require a portfolio link on the resume.", "Add it to the header next to LinkedIn."),
  C("Two versions saved: mobile-focused and web/dashboard-focused", "Matching your strongest work to the role lifts your response rate.", "Use the versions in this section; tailor from the closest one."),
  C("One page, PDF, file named First-Last-Product-Designer.pdf", "One page is standard at your level; a clear file name looks professional.", "Watch the one-page meter, then download as PDF."),
  C("Portfolio password (if any) written next to the link", "Samsung and Google postings say a link reviewers can't open isn't considered.", "Add \"Password: …\" right after the portfolio link, or make the case studies public."),
  C("Short roles labeled (internship, contract)", "Recruiter screens reject profiles that look like frequent job changes.", "Add \"Internship\" or \"Contract\" after those titles, and keep your longest role easy to find."),
  C("AI tools you actually use, named in a bullet", "Most postings now expect AI in your own workflow, often by tool name.", "One bullet showing the tool and what it changed, such as prototyping a flow in Figma Make. Name only tools you've used."),
  C("Edge states or design QA in at least one bullet", "Many postings ask for work beyond the happy path and checking the build.", "Mention the empty, error or permission states you designed, or how you specced and checked what shipped."),
  C("Keywords from each job posting added before applying", "Literal keyword matching still decides many first screens.", "Run the posting through Resume Tailor and add only terms that are true for you.")
];
export const LINKEDIN_CHECKS = [
  C("Headline uses Product Designer and UX Designer", "Recruiters search by these titles.", "For example: Product Designer | Mobile and web | User research and AI prototyping."),
  C("About section published", "It's the first thing people read after the headline.", "Three short paragraphs: what you design, how you work, what you're looking for. No company names."),
  C("Open to work set ({area}, and Remote if you want it)", "Recruiters filter by it.", "Set it to recruiters only if you prefer; add all the locations."),
  C("Featured: portfolio, App Store links, best case study", "It turns your profile into proof.", "Add your portfolio, your strongest case study and a live prototype."),
  C("Top skills reordered (Product Design, Figma, UX, Interaction Design, Prototyping, User Research)", "The top skills show first and feed recruiter search.", "Pin the ones postings in your area ask for most."),
  C("Second-language profile updated or removed (if you have one)", "An outdated second-language profile can show old information.", "Update it to match, or remove it."),
  C("Following 30 target companies", "You'll see their posts and openings early.", "Follow each company in your target list and a few of its design leaders."),
  C("Headline adds 2–3 focus areas after the title", "Strong headlines pair the role with focus areas recruiters search for.", "Role, then focus areas, then proof, separated by |. Example: Product Designer | Mobile and web | AI prototyping and research."),
  C("Featured also has your resume PDF", "Many designer profiles pin both portfolio and resume.", "Upload the PDF from the Resume section, named First-Last-Product-Designer.pdf."),
  C("Job alerts set for Product Designer and UX Designer in {city}, plus contract agencies", "Contract posts can draw dozens of applicants within a day of going up.", "Create an alert for each title in {city}, and follow the design staffing agencies near you."),
  C("Comment on 2–3 design leaders' posts each week", "Most designers stay visible through comments rather than their own posts.", "Add one specific thought or question; skip \"Great post\"."),
  C("Private mode on while you browse profiles (optional)", "Viewing a profile can show in that person's \"Who viewed your profile\" list.", "Settings & Privacy → Visibility → Profile viewing options. Switch back before you start reaching out."),
  C("One post every 1–2 weeks", "Regular posts keep you visible to people you've met.", "Share one insight from your research project or a resource you finished. Use the post planner below.")
];
export const CASE_CHECKS = [
  "3-line summary at the top: product, your role, outcome",
  "Context and problem, with the business goal",
  "Your role, team and timeline",
  "Research or evidence that shaped decisions",
  "2–3 key decisions with the options you rejected and why",
  "Final design with annotations",
  "Outcome and how success was measured",
  "Accessibility considerations",
  "What you would do differently",
  "Readable in 2 minutes by skimming headings and images",
  "Empty, loading, error and permission states shown",
  "How AI helped, and where you overrode it"
];
export const CASE_SECTIONS = [
  ["summary", "Summary", "Three lines: the product, your role, the outcome."],
  ["context", "Context and business goal", "The problem, who it's for, the business goal and the constraints."],
  ["research", "Research and evidence", "Interviews, data or tests that shaped your decisions."],
  ["decisions", "Key decisions", "2–3 decisions, each with the options you rejected and why."],
  ["design", "Final design", "Annotated screens and a live prototype link."],
  ["outcome", "Outcome", "What changed and how it was measured; if no numbers, the signals you saw and what you'd measure."],
  ["learnings", "Learnings and accessibility", "What you'd do differently, plus an accessibility note."]
];
export const CASE_STATUS = { idea: "Idea", planning: "Planning", drafting: "Drafting", review: "In review", published: "Published" };

export const STARTER_CASES = [
  { id: "cs-transit", title: "{cityL} transit trip planner: research and AI prototype", status: "idea", product: "Self-initiated project", role: "Designer and researcher", team: "Solo", timeline: "Weeks 2–11 of the plan", problem: "How do {cityL} commuters plan trips that combine bus and train?", goal: "", skills: ["research", "testing", "ai-ux", "ai-proto"], next: "Write the research plan: goals, questions, recruiting." },
  { id: "cs-system", title: "Mini design system: tokens, components and states", status: "idea", product: "Self-initiated project", role: "Designer", team: "Solo", timeline: "Weeks 2–4 of the plan", problem: "", goal: "", skills: ["systems", "states", "figma"], next: "Set the scope: 10–15 components, colors and type as variables, light and dark modes." }
];
// Case study ids retired in earlier versions.
export const RETIRED_CASES = [];

export const SITE_PAGES = ["Home with the 3 case studies", "A page for each case study", "About, with photo and contact", "Resume (PDF download)", "Contact"];
export const SITE_LAUNCH = ["Works well on mobile", "Loads in under 3 seconds on mobile", "Passes basic accessibility checks (contrast, alt text, headings, focus)", "Page titles and descriptions set", "Contact link works", "Spelling checked twice", "Reviewed by an ADPList mentor"];

export const TAILOR_RULES = {
  may: ["Title line", "Summary emphasis", "Skill order and wording", "Bullet wording that keeps the same claim"],
  never: ["Numbers", "Job titles", "Dates", "Which job a bullet sits under", "Skills you don't have"]
};
export const LINKEDIN_RULES = ["Professional title: Product Designer", "About names no companies and no product details", "Plain, warm, first person; no buzzwords"];

export const COMPANIES = ["Amazon", "Microsoft", "Google", "Meta", "OpenAI", "Apple", "Salesforce", "Adobe", "Atlassian", "Spotify", "Airbnb", "Uber", "Shopify", "Stripe", "Intuit", "Expedia Group", "DocuSign", "Plaid", "Samsung", "Rippling", "Databricks", "Figma", "Canva", "Notion", "Aquent"];
export const TOP_TERMS = ["Product Design", "Figma", "User Research", "Prototyping", "Interaction Design", "Design Systems", "Usability Testing", "AI prototyping", "Accessibility", "Mobile", "Web", "Edge cases", "Design QA", "Handoff", "Information Architecture", "AI-assisted workflows"];
