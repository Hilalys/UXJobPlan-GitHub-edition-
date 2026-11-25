// Built-in content for the UX Job Search Plan.
// Sources: product design career research (Nov 2026). Location-specific links are built
// from Settings → Location (see locale.js).

const yt = q => "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);

// Optional links to longer write-ups (hours estimates, research). Empty in the shared edition.
export const DOCS = { estimates: "", spec: "", research: "", linkedin: "" };

export const TRACKS = {
  learn: { name: "Learn", color: "var(--c-learn)" },
  build: { name: "Build", color: "var(--c-build)" },
  practice: { name: "Practice", color: "var(--c-practice)" },
  apply: { name: "Apply", color: "var(--c-apply)" }
};
export const TRACK_KEYS = ["learn", "build", "practice", "apply"];

export const L = {
  figmaBeginners: { l: "Figma Learn: Figma Design for beginners", u: "https://help.figma.com/hc/en-us/articles/30848209492887-Course-overview-Figma-Design-for-beginners-2025" },
  figmaVariables: { l: "Figma Learn: Guide to variables", u: "https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma" },
  figmaDevMode: { l: "Figma Learn: Guide to Dev Mode", u: "https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode-in-Figma" },
  figmaMcp: { l: "Figma Learn: Guide to the Figma MCP server", u: "https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server" },
  figmaMcpClaude: { l: "Set up the Figma MCP server with Claude Code", u: "https://help.figma.com/hc/en-us/articles/39888612464151-Claude-Code-and-Figma-Set-up-the-MCP-server" },
  figmaMcpCursor: { l: "Set up the Figma MCP server with Cursor", u: "https://help.figma.com/hc/en-us/articles/39889260656407-Cursor-and-Figma-Set-up-the-MCP-server" },
  figmaMake: { l: "Figma Learn: Explore Figma Make", u: "https://help.figma.com/hc/en-us/articles/31304412302231-Explore-Figma-Make" },
  figmaMakeHelp: { l: "Figma Make help articles", u: "https://help.figma.com/hc/en-us/categories/31304285531543-Figma-Make" },
  figmaMotion: { l: "Figma Learn: Explore Figma Motion", u: "https://help.figma.com/hc/en-us/articles/41274629073303-Explore-Figma-Motion" },
  figmaMotionProject: { l: "Project: Create a loading animation (15 min)", u: "https://help.figma.com/hc/en-us/articles/41523077992855-Motion-design-fundamentals-Create-a-loading-animation" },
  figmaWorkflowLab: { l: "Workflow lab: Motion, Weave and shaders", u: "https://help.figma.com/hc/en-us/articles/42847574436119-Workflow-lab-New-tools-more-expression-with-Figma-Motion-Figma-Weave-and-shaders" },
  figmaCourses: { l: "Figma Learn: courses and tutorials", u: "https://help.figma.com/hc/en-us/categories/23557013073047-Courses-tutorials-projects" },
  figmaMotionBlog: { l: "Figma blog: Introducing Figma Motion", u: "https://www.figma.com/blog/introducing-figma-motion/" },
  config2026: { l: "Figma blog: Config 2026 recap", u: "https://www.figma.com/blog/config-2026-recap/" },
  figmaYtBeginners: { l: "Figma for beginners (YouTube)", u: yt("Figma for beginners official") },
  ytConfig: { l: "Config 2026 keynote (YouTube)", u: yt("Figma Config 2026 keynote") },
  ytMotionDeep: { l: "Figma deep dive: Motion, Config 2026 (YouTube)", u: yt("Figma deep dive Motion Config 2026") },
  ytComponentProps: { l: "Component properties tutorials (YouTube)", u: yt("Figma component properties variables design system tutorial 2026") },
  figmaHiring: { l: "Figma: Why demand for designers is on the rise", u: "https://www.figma.com/blog/why-demand-for-designers-is-on-the-rise/" },
  nngState: { l: "NN/g: State of UX 2026", u: "https://www.nngroup.com/articles/state-of-ux-2026/" },
  nngAiWork: { l: "NN/g: Using AI for UX work, study guide", u: "https://www.nngroup.com/articles/ai-work-study-guide/" },
  nngAgents: { l: "NN/g: AI agents as users", u: "https://www.nngroup.com/articles/ai-agents-as-users/" },
  nngScope: { l: "NN/g: Scope in generative AI features", u: "https://www.nngroup.com/articles/scope-ai-features/" },
  nngFive: { l: "NN/g: Why you only need to test with 5 users", u: "https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/" },
  nngHeur: { l: "NN/g: 10 usability heuristics", u: "https://www.nngroup.com/articles/ten-usability-heuristics/" },
  ytNngInterviews: { l: "NN/g: user interview videos (YouTube)", u: yt("NNgroup user interviews") },
  ytAffinity: { l: "Affinity mapping in FigJam (YouTube)", u: yt("affinity mapping FigJam user research synthesis") },
  hax: { l: "Microsoft HAX Toolkit", u: "https://www.microsoft.com/en-us/haxtoolkit/" },
  pair: { l: "Google People + AI Guidebook", u: "https://pair.withgoogle.com/guidebook" },
  shapeAi: { l: "The Shape of AI patterns", u: "https://www.shapeof.ai" },
  maze: { l: "Maze: Continuous Product Discovery (free course)", u: "https://learn.maze.co/courses/continuous-product-discovery" },
  mazeGuide: { l: "Maze: Beginner's guide to usability testing", u: "https://maze.co/guides/usability-testing/" },
  laws: { l: "Laws of UX", u: "https://lawsofux.com" },
  wai: { l: "W3C WAI accessibility courses", u: "https://www.w3.org/WAI/courses/list/" },
  material: { l: "Material Design 3", u: "https://m3.material.io" },
  fluent: { l: "Microsoft Fluent 2", u: "https://fluent2.microsoft.design" },
  cloudscape: { l: "AWS Cloudscape", u: "https://cloudscape.design" },
  exponentCourse: { l: "Exponent: product design interview course", u: "https://www.tryexponent.com/courses/product-designer-interview" },
  expAmazon: { l: "Exponent: Amazon UX Designer guide", u: "https://www.tryexponent.com/guides/amazon-ux-designer-interview" },
  expMicrosoft: { l: "Exponent: Microsoft Product Designer guide", u: "https://www.tryexponent.com/guides/microsoft-product-designer-interview" },
  ytCritique: { l: "App critique mock interviews (YouTube)", u: yt("Exponent app critique product design interview") },
  ytChallenge: { l: "Design challenge mock interviews (YouTube)", u: yt("product design whiteboard challenge mock interview") },
  ytPortfolioMock: { l: "Portfolio presentation mocks (YouTube)", u: yt("product designer portfolio presentation mock interview") },
  ytHeart: { l: "HEART framework explained (YouTube)", u: yt("Google HEART framework UX metrics") },
  adplist: { l: "ADPList mentors and mock interviews", u: "https://adplist.org" },
  lps: { l: "Amazon Leadership Principles", u: "https://www.amazon.jobs/content/en/our-workplace/leadership-principles" },
  aquent: { l: "Aquent (contract roles)", u: "https://aquent.com" },
  levels: { l: "Levels.fyi: Product Designer pay", u: "https://www.levels.fyi/t/product-designer" },
  glassdoor: { l: "Glassdoor: salaries by location", u: "https://www.glassdoor.com/Salaries/index.htm" },
  wellfound: { l: "Wellfound: startup jobs", u: "https://wellfound.com" },
  gitlab: { l: "GitLab product design career framework", u: "https://handbook.gitlab.com/job-description-library/product/product-designer/" },
  baymard: { l: "Baymard: current state of checkout UX", u: "https://baymard.com/research-articles/current-state-of-checkout-ux" },
  pewAi: { l: "Pew: Americans and AI 2026", u: "https://www.pewresearch.org/internet/2026/06/17/americans-and-ai-2026-chatbots-smart-devices-and-views-on-impact/" },
  schoolMotion: { l: "School of Motion: UX Animation Essentials", u: "https://schoolofmotion.com/uxae" },
  rive: { l: "Rive", u: "https://rive.app" },
  udemyMake: { l: "Udemy: Learn to vibe code with Figma Make", u: "https://www.udemy.com/course/figmamake/" },
  maven: { l: "Maven: Vibe Coding for Designers (free lesson)", u: "https://maven.com/p/b2b164" },
  cursorDesigners: { l: "Cursor for Designers tutorial series", u: "https://www.builder.io/blog/cursor-for-designers-tutorial-series" },
  tomScott: { l: "Tom Scott on what portfolios need now", u: "https://substack.com/@iamtomscott/note/c-217093513" },
  verifiedInsider: { l: "Verified Insider: the design job playbook", u: "https://verifiedinsider.substack.com/p/the-playbook-to-finding-a-design" },
  huntr: { l: "Huntr: job search data, Q2 2026", u: "https://huntr.co/research/job-search-trends-q2-2026" }
};

// The weekly plan is generated from real course, book and task lengths: see plan-data.js
// and the estimates doc. Each week carries its phase, its own hours split and its goals.
export { WEEKS, PHASES, PLAN_VERSION, WEEK_HOURS, ESTIMATES, RES_WEEK, MOCK_PLAN, PACE } from "./plan-data.js";

export const SKILLS = [
  { id: "research", name: "User research and interviewing", now: 0, target: 4, why: "Named in most postings; the junior differentiator is documented research reasoning." },
  { id: "testing", name: "Usability testing", now: 0, target: 4, why: "Amazon asks for usability principles; teams use research and telemetry." },
  { id: "ai-ux", name: "Designing AI experiences", now: 0, target: 3, why: "79% of hiring managers want people who can design AI products." },
  { id: "ai-proto", name: "AI prototyping and vibe coding", now: 0, target: 4, why: "Microsoft asks for prototyping with code or AI-assisted workflows." },
  { id: "figma", name: "Figma 2026", now: 0, target: 5, why: "Used weekly by 82.6% of designers; variables, Make, Motion, MCP." },
  { id: "product", name: "Product thinking and metrics", now: 0, target: 4, why: "Interviewers ask for goals and results for every case study." },
  { id: "story", name: "Storytelling and presenting", now: 0, target: 4, why: "The portfolio presentation decides most loops." },
  { id: "interview", name: "Design challenges and critique", now: 0, target: 4, why: "Part of most onsite loops." },
  { id: "systems", name: "Design systems", now: 0, target: 4, why: "In most big-tech postings; systems thinking ranks top five." },
  { id: "a11y", name: "Accessibility", now: 0, target: 4, why: "A baseline at big tech; 95.9% of home pages still fail WCAG." },
  { id: "motion", name: "Motion design", now: 0, target: 3, why: "Figma Motion is new; motion is a differentiator in AI states." },
  { id: "ux-writing", name: "UX writing", now: 0, target: 3, why: "AI interfaces are mostly words: prompts, errors, explanations." },
  { id: "frontend", name: "Front-end basics", now: 0, target: 3, why: "Half of designers have shipped AI-generated code." },
  { id: "visual", name: "Interaction and visual design", now: 0, target: 5, why: "58% of hiring managers rank visual polish the top skill." },
  { id: "behavior", name: "User behavior and behavioral science", now: 0, target: 3, why: "Needed to make and defend decisions." },
  { id: "states", name: "Complex workflows and system states", now: 0, target: 4, why: "Many postings ask for complex or data-heavy workflows and work beyond the happy path: empty, error and permission states." },
  { id: "conversation", name: "Conversation and multimodal design", now: 0, target: 3, why: "Assistant and shopping teams ask for conversation design and voice-plus-screen experiences." }
];

export const EVENT_TYPES = ["Meetup", "Workshop", "Conference", "Webinar", "Coffee chat", "Interview", "Deadline", "Other"];

export const STAGES = {};

// Application statuses and how they roll up into feedback.
export const APP_STATUS = ["Saved", "Applied", "Recruiter screen", "Interviewing", "Final round", "Offer", "Rejected", "Withdrawn"];
export const FEEDBACK = [
  { key: "none", label: "No reply yet", color: "var(--c-neutral)", statuses: ["Applied"] },
  { key: "rejected", label: "Rejected", color: "var(--c-practice)", statuses: ["Rejected"] },
  { key: "advancing", label: "Advancing", color: "var(--c-learn)", statuses: ["Recruiter screen", "Interviewing", "Final round"] },
  { key: "offer", label: "Offer", color: "var(--c-apply)", statuses: ["Offer"] }
];
// Weekly application targets come from each plan week's goals (model.weekGoal).

// Credit and license, shown in Settings → About.
export const CREDIT = {
  app: "UX Job Plan",
  author: "Hilalys",
  github: "https://github.com/Hilalys",
  repo: "https://github.com/Hilalys/ux-job-plan",
  license: "MIT",
  year: 2026
};
