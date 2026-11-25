// Stage 2 content: resource library and skill details.
// Sources: the career research doc (Nov 13, 2026) and the v1 tool.

import { RES_WEEK } from "./plan-data.js";

const yt = q => "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
// Books link to a WorldCat search, which finds copies in libraries near you.
const spl = q => "https://search.worldcat.org/search?q=" + encodeURIComponent(q);

export const RES_TYPES = ["Course", "Video", "Article", "Book", "Guide", "Tool", "Newsletter", "Podcast", "Community"];
export const RES_STATUS = { todo: "Not started", doing: "In progress", done: "Done" };

// [id, title, type, skills, url, cost, week, units?]  units: [total, label]
const R = [
  // Research and testing
  ["maze-cpd", "Maze: Continuous Product Discovery", "Course", ["testing", "research"], "https://learn.maze.co/courses/continuous-product-discovery", "Free", 4, [16, "lessons"]],
  ["maze-guide", "Maze: A Beginner's Guide to Usability Testing", "Guide", ["testing"], "https://maze.co/guides/usability-testing/", "Free", 4],
  ["nng-disc", "NN/g: Discovery, study guide (interviews, synthesis)", "Guide", ["research"], "https://www.nngroup.com/articles/discovery-study-guide/", "Free", 2],
  ["nng-qut", "NN/g: Qualitative usability testing, study guide", "Guide", ["testing"], "https://www.nngroup.com/articles/qual-usability-testing-study-guide/", "Free", 2],
  ["nng-quant", "NN/g: Quantitative research, study guide", "Guide", ["product", "research"], "https://www.nngroup.com/articles/quantitative-research-study-guide/", "Free", 12],
  ["amp-path", "Amplitude Academy: Getting Started with Amplitude Analytics (free demo data)", "Course", ["product"], "https://academy.amplitude.com/path/getting-started-with-amplitude-analytics-learning-path", "Free", 12, [5, "parts"]],
  ["t-maze", "Maze (unmoderated tests on Figma prototypes)", "Tool", ["testing"], "https://maze.co", "Free tier", 6],
  ["nng-yt", "NN/g YouTube channel", "Video", ["research", "testing"], "https://www.youtube.com/@NNgroup", "Free", 2],
  ["y-nngt", "NN/g: usability testing videos", "Video", ["testing"], yt("NNgroup usability testing"), "Free", 4],
  ["y-aff", "Affinity mapping in FigJam", "Video", ["research"], yt("affinity mapping FigJam user research synthesis"), "Free", 4],
  ["b-jer", "Just Enough Research, Erika Hall", "Book", ["research"], spl("Just Enough Research Erika Hall"), "Library", 2],
  ["b-iu", "Interviewing Users (2nd ed.), Steve Portigal", "Book", ["research"], spl("Interviewing Users Portigal"), "Library", 3],
  ["b-mom", "The Mom Test, Rob Fitzpatrick", "Book", ["research"], spl("The Mom Test Fitzpatrick"), "About $20", 3],
  ["b-rsme", "Rocket Surgery Made Easy, Steve Krug", "Book", ["testing"], spl("Rocket Surgery Made Easy Krug"), "Library", 4],
  ["b-cdh", "Continuous Discovery Habits, Teresa Torres", "Book", ["research", "product"], spl("Continuous Discovery Habits Torres"), "About $30", 12],
  ["b-dmmt", "Don't Make Me Think, Revisited, Steve Krug", "Book", ["visual", "testing"], spl("Don't Make Me Think Krug"), "Library", 1],
  ["lil-int", "LinkedIn Learning: UX Research Methods: Interviewing", "Course", ["research"], "{libraryUrl}", "Free with library card", 3],
  ["a-five", "NN/g: Why you only need to test with 5 users", "Article", ["testing"], "https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/", "Free", 4],
  ["a-heur", "NN/g: 10 usability heuristics", "Article", ["testing", "visual"], "https://www.nngroup.com/articles/ten-usability-heuristics/", "Free", 1],

  // Figma
  ["figma-beg", "Figma Learn: Figma Design for beginners", "Course", ["figma"], "https://help.figma.com/hc/en-us/articles/30848209492887-Course-overview-Figma-Design-for-beginners-2025", "Free", 1],
  ["figma-vars", "Figma Learn: Guide to variables", "Guide", ["figma", "systems"], "https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma", "Free", 2],
  ["figma-dev", "Figma Learn: Guide to Dev Mode", "Guide", ["figma", "frontend"], "https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode-in-Figma", "Free", 3],
  ["figma-courses", "Figma Learn: courses, tutorials and design-system basics", "Course", ["figma", "systems"], "https://help.figma.com/hc/en-us/categories/23557013073047-Courses-tutorials-projects", "Free", 2],
  ["y-config", "Figma Config 2026 keynote", "Video", ["figma"], yt("Figma Config 2026 keynote"), "Free", 1],
  ["y-vars", "Figma variables tutorials", "Video", ["figma", "systems"], yt("Figma variables tutorial"), "Free", 2],
  ["y-figbeg", "Figma for beginners (Figma's YouTube channel)", "Video", ["figma"], yt("Figma for beginners official"), "Free", 1],
  ["a-config", "Figma blog: Config 2026 recap", "Article", ["figma"], "https://www.figma.com/blog/config-2026-recap/", "Free", 1],
  ["a-config-in", "Figma: Everything from Config India 2026", "Article", ["figma"], "https://forum.figma.com/product-updates-3/here-s-everything-from-config-india-2026-59008", "Free", 1],
  ["figma-blog", "Figma blog and Config talks", "Newsletter", ["figma"], "https://www.figma.com/blog/", "Free", 12],

  // AI prototyping and AI experiences
  ["figma-mcp", "Figma Learn: Guide to the Figma MCP server", "Guide", ["ai-proto", "frontend"], "https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server", "Free", 3],
  ["figma-mcp-cc", "Set up the Figma MCP server with Claude Code", "Guide", ["ai-proto"], "https://help.figma.com/hc/en-us/articles/39888612464151-Claude-Code-and-Figma-Set-up-the-MCP-server", "Free", 3],
  ["figma-make", "Figma Learn: Explore Figma Make", "Guide", ["ai-proto"], "https://help.figma.com/hc/en-us/articles/31304412302231-Explore-Figma-Make", "Free", 5],
  ["t-make", "Figma Make", "Tool", ["ai-proto"], "https://www.figma.com/make/", "Figma paid seat", 5],
  ["y-make", "Figma Make tutorials", "Video", ["ai-proto"], yt("Figma Make tutorial prototype"), "Free", 5],
  ["maven", "Maven: Vibe Coding for Designers (recorded free lesson)", "Video", ["ai-proto"], "https://maven.com/p/b2b164", "Free", 6],
  ["udemy-make", "Udemy: Learn to vibe code with Figma Make", "Course", ["ai-proto"], "https://www.udemy.com/course/figmamake/", "Paid", 6],
  ["cursor-series", "Cursor for Designers tutorial series", "Video", ["ai-proto", "frontend"], "https://www.builder.io/blog/cursor-for-designers-tutorial-series", "Free", 6],
  ["a-vibe", "10 vibe coding tools for designers", "Article", ["ai-proto"], "https://www.toools.design/blog-posts/vibe-coding-tools-for-designers", "Free", 5],
  ["hax", "Microsoft HAX Toolkit: 18 guidelines and design library", "Guide", ["ai-ux"], "https://www.microsoft.com/en-us/haxtoolkit/", "Free", 5],
  ["pair", "Google People + AI Guidebook", "Guide", ["ai-ux"], "https://pair.withgoogle.com/guidebook", "Free", 5],
  ["shape-ai", "The Shape of AI pattern library", "Guide", ["ai-ux"], "https://www.shapeof.ai", "Free", 5],
  ["carbon-ai", "IBM Carbon for AI", "Guide", ["ai-ux", "systems"], "https://carbondesignsystem.com/guidelines/carbon-for-ai/", "Free", 6],
  ["nng-scope", "NN/g: Scope in generative AI features", "Article", ["ai-ux"], "https://www.nngroup.com/articles/scope-ai-features/", "Free", 5],
  ["nng-aiwork", "NN/g: Using AI for UX work, study guide", "Article", ["ai-ux", "ai-proto"], "https://www.nngroup.com/articles/ai-work-study-guide/", "Free", 6],
  ["aif-ff", "Claude Academy: AI Fluency: Framework & Foundations", "Course", ["ai-ux", "ai-proto"], "https://academy.claude.com/courses/ai-fluency-framework-foundations", "Free", 1, [14, "lessons"]],
  ["aif-cw", "Claude Academy: AI Fluency for Creative Work", "Course", ["ai-ux", "ai-proto"], "https://academy.claude.com/courses/ai-fluency-for-creative-work", "Free", 1, [8, "lessons"]],
  ["nng-ai-sg", "NN/g: Designing AI products and features, study guide (Sep 2026)", "Guide", ["ai-ux"], "https://www.nngroup.com/articles/designing-ai-study-guide/", "Free", 6],
  ["gh-intro", "GitHub Skills: Introduction to GitHub", "Course", ["ai-proto", "frontend"], "https://github.com/skills/introduction-to-github", "Free", 12],
  ["nng-agents", "NN/g: AI agents as users", "Article", ["ai-ux", "a11y"], "https://www.nngroup.com/articles/ai-agents-as-users/", "Free", 6],
  ["dive", "Dive Club: designers on AI workflows", "Podcast", ["ai-proto", "ai-ux"], yt("Dive Club Ridd designers AI"), "Free", 6],
  ["b-agentive", "Designing Agentive Technology, Christopher Noessel", "Book", ["ai-ux"], spl("Designing Agentive Technology Noessel"), "About $40", 6],

  // Motion
  ["figma-motion", "Figma Learn: Explore Figma Motion", "Guide", ["motion", "figma"], "https://help.figma.com/hc/en-us/articles/41274629073303-Explore-Figma-Motion", "Free", 7],
  ["figma-motion-proj", "Figma Learn project: create a loading animation", "Course", ["motion"], "https://help.figma.com/hc/en-us/articles/41523077992855-Motion-design-fundamentals-Create-a-loading-animation", "Free", 7],
  ["figma-lab", "Figma Learn: Workflow lab on Motion, Weave and shaders", "Course", ["motion", "figma"], "https://help.figma.com/hc/en-us/articles/42847574436119-Workflow-lab-New-tools-more-expression-with-Figma-Motion-Figma-Weave-and-shaders", "Free", 7],
  ["y-motion-basics", "Figma Motion Basics videos", "Video", ["motion"], "https://forum.figma.com/product-updates-3/new-figma-motion-basics-video-custom-animation-styles-58732", "Free", 7],
  ["y-motion-deep", "Figma deep dive: Motion (Config 2026)", "Video", ["motion", "figma"], yt("Figma deep dive Motion Config 2026"), "Free", 1],
  ["mantlr", "How to Use Figma Motion, step by step", "Article", ["motion"], "https://mantlr.com/blog/how-to-use-figma-motion", "Free", 7],
  ["m3-motion", "Material Design 3: motion", "Guide", ["motion"], "https://m3.material.io/styles/motion/overview", "Free", 7],
  ["hig-motion", "Apple Human Interface Guidelines: motion", "Guide", ["motion"], "https://developer.apple.com/design/human-interface-guidelines/motion", "Free", 7],
  ["som-uxae", "School of Motion: UX Animation Essentials", "Course", ["motion"], "https://schoolofmotion.com/uxae", "Paid", 7, [4, "hours"]],
  ["som-path", "School of Motion: UX Animation and Interaction path", "Course", ["motion"], "https://schoolofmotion.com/learning-paths/ux-animation-and-interaction", "Paid", 12, [5, "courses"]],
  ["ztm-motion", "Zero to Mastery: Motion Design with Figma", "Course", ["motion"], "https://zerotomastery.io/ai/courses/learn-motion-design/", "Paid", 7, [14, "hours"]],
  ["b-val", "Designing Interface Animation, Val Head", "Book", ["motion"], spl("Designing Interface Animation Val Head"), "About $40", 7],
  ["t-rive", "Rive (interactive animation)", "Tool", ["motion"], "https://rive.app", "Free tier", 7],
  ["y-rive", "Rive and Jitter tutorials", "Video", ["motion"], yt("Rive state machine tutorial UI animation"), "Free", 10],

  // Design systems
  ["fluent", "Microsoft Fluent 2 design system", "Guide", ["systems"], "https://fluent2.microsoft.design", "Free", 8],
  ["cloudscape", "AWS Cloudscape design system", "Guide", ["systems"], "https://cloudscape.design", "Free", 8],
  ["material", "Google Material Design 3", "Guide", ["systems", "visual"], "https://m3.material.io", "Free", 2],
  ["hig", "Apple Human Interface Guidelines", "Guide", ["visual", "systems"], "https://developer.apple.com/design/human-interface-guidelines/", "Free", 8],
  ["atomic", "Atomic Design, Brad Frost (free online)", "Book", ["systems"], "https://atomicdesign.bradfrost.com/", "Free", 2],
  ["eightshapes", "Nathan Curtis: EightShapes articles", "Article", ["systems"], "https://medium.com/eightshapes-llc", "Free", 2],
  ["dsc", "Design Systems Collective", "Newsletter", ["systems"], "https://www.designsystemscollective.com/", "Free", 8],

  // Product thinking
  ["heart", "Google's HEART framework (Kerry Rodden)", "Article", ["product"], "https://library.gv.com/how-to-choose-the-right-ux-metrics-for-your-product-5f46359ab5be", "Free", 10],
  ["y-heart", "HEART framework explained", "Video", ["product"], yt("Google HEART framework UX metrics"), "Free", 10],
  ["b-mux", "Measuring the User Experience, Tullis and Albert", "Book", ["product", "testing"], spl("Measuring the User Experience Tullis Albert"), "About $50", 10],
  ["growth", "Growth.Design case studies", "Article", ["product", "behavior"], "https://growth.design/case-studies", "Free", 10],
  ["lenny", "Lenny's Newsletter", "Newsletter", ["product"], "https://www.lennysnewsletter.com", "Free / paid", 10],
  ["a-sou", "NN/g: State of UX 2026", "Article", ["product"], "https://www.nngroup.com/articles/state-of-ux-2026/", "Free", 1],

  // Storytelling and presenting
  ["b-add", "Articulating Design Decisions, Tom Greever", "Book", ["story", "product"], spl("Articulating Design Decisions Greever"), "Library", 9],
  ["nng-story", "NN/g: Storytelling in UX work, study guide", "Guide", ["story"], "https://www.nngroup.com/articles/storytelling-study-guide/", "Free", 12],
  ["nng-port", "NN/g: portfolio and case-study articles and videos", "Guide", ["story"], "https://www.nngroup.com/articles/growing-your-ux-career-study-guide/", "Free", 3],
  ["b-resonate", "Resonate, Nancy Duarte", "Book", ["story"], spl("Resonate Nancy Duarte"), "Free online edition", 9],
  ["y-port", "Portfolio presentation mock interviews", "Video", ["story", "interview"], yt("Exponent portfolio review product designer mock interview"), "Free", 9],
  ["y-femke", "Femke Design: portfolio and career", "Video", ["story"], yt("Femke Design product design portfolio"), "Free", 1],
  ["y-doody", "Sarah Doody: case studies and research", "Video", ["story", "research"], yt("Sarah Doody UX portfolio case study"), "Free", 8],
  ["tomscott", "Tom Scott on what portfolios need now", "Article", ["story"], "https://substack.com/@iamtomscott/note/c-217093513", "Free", 8],
  ["verified", "Verified Insider: the design job playbook", "Article", ["story"], "https://verifiedinsider.substack.com/p/the-playbook-to-finding-a-design", "Free", 8],

  // Interviews
  ["exp-course", "Exponent: product design interview course", "Course", ["interview"], "https://www.tryexponent.com/courses/product-designer-interview", "Paid subscription", 9],
  ["exp-amazon", "Exponent: Amazon UX Designer interview guide", "Guide", ["interview"], "https://www.tryexponent.com/guides/amazon-ux-designer-interview", "Free", 9],
  ["exp-ms", "Exponent: Microsoft Product Designer interview guide", "Guide", ["interview"], "https://www.tryexponent.com/guides/microsoft-product-designer-interview", "Free", 9],
  ["b-spde", "Solving Product Design Exercises, Artiom Dashinsky", "Book", ["interview"], spl("Solving Product Design Exercises Dashinsky"), "About $30", 10],
  ["adp", "ADPList: free mentors and mock interviews", "Community", ["interview", "story"], "https://adplist.org", "Free", 6],
  ["adp-google", "ADPList: most-asked Google product design questions", "Article", ["interview"], "https://adplist.org/blog/most-asked-google-product-design-interview-questions", "Free", 10],
  ["glassdoor", "Glassdoor interview reviews for target companies", "Article", ["interview"], "https://www.glassdoor.com/Interview/index.htm", "Free", 11],
  ["lps", "Amazon Leadership Principles", "Guide", ["interview", "story"], "https://www.amazon.jobs/content/en/our-workplace/leadership-principles", "Free", 1],
  ["y-crit", "App critique mock interviews", "Video", ["interview"], yt("Exponent app critique product design interview"), "Free", 3],
  ["y-chall", "Design challenge mock interviews", "Video", ["interview"], yt("product design whiteboard challenge mock interview"), "Free", 4],

  // Accessibility
  ["wai", "W3C WAI: Digital Accessibility Foundations and other courses", "Course", ["a11y"], "https://www.w3.org/WAI/courses/list/", "Free", 7],
  ["wai-found", "W3C WAI: Digital Accessibility Foundations (free on edX)", "Course", ["a11y"], "https://www.w3.org/WAI/courses/foundations-course/", "Free", 9, [16, "sections"]],
  ["webaim-vo", "WebAIM: Using VoiceOver to evaluate web accessibility", "Guide", ["a11y", "testing"], "https://webaim.org/articles/voiceover/", "Free", 14],
  ["webaim-vo-m", "WebAIM: VoiceOver on mobile", "Guide", ["a11y", "testing"], "https://webaim.org/articles/voiceover/mobile", "Free", 14],
  ["wcag22-new", "W3C: What's new in WCAG 2.2", "Article", ["a11y"], "https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/", "Free", 13],
  ["webaim", "WebAIM articles and contrast checker", "Tool", ["a11y"], "https://webaim.org/resources/contrastchecker/", "Free", 7],
  ["stark", "Stark plugin for Figma", "Tool", ["a11y"], "https://www.getstark.co", "Free tier", 7],
  ["b-a4e", "Accessibility for Everyone, Laura Kalbag", "Book", ["a11y"], spl("Accessibility for Everyone Kalbag"), "About $30", 7],
  ["deque", "Deque University", "Course", ["a11y"], "https://dequeuniversity.com", "Paid", 12],
  ["y-a11y", "Accessibility for designers (WCAG 2.2)", "Video", ["a11y"], yt("accessibility for product designers WCAG 2.2"), "Free", 7],

  // UX writing
  ["b-swux", "Strategic Writing for UX, Torrey Podmajersky", "Book", ["ux-writing"], spl("Strategic Writing for UX Podmajersky"), "About $40", 5],
  ["b-micro", "Microcopy: The Complete Guide, Kinneret Yifrah", "Book", ["ux-writing"], spl("Microcopy The Complete Guide Yifrah"), "About $30", 5],
  ["nng-errors", "NN/g: Error-message guidelines", "Article", ["ux-writing"], "https://www.nngroup.com/articles/error-message-guidelines/", "Free", 5],
  ["cs-local", "Content design meetups near {city}", "Community", ["ux-writing"], "{contentMeetupUrl}", "Free", 6],

  // Front-end
  ["fcc", "freeCodeCamp: Responsive Web Design", "Course", ["frontend"], "https://www.freecodecamp.org/learn/", "Free", 6],
  ["mdn-layout", "MDN Web Docs: CSS layout (flexbox, grid)", "Guide", ["frontend"], "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout", "Free", 6],
  ["comeau", "Josh W. Comeau: CSS for JavaScript Developers", "Course", ["frontend"], "https://css-for-js.dev", "Paid", 12],

  // Visual and interaction
  ["refactoring", "Refactoring UI, Adam Wathan and Steve Schoger", "Book", ["visual"], "https://www.refactoringui.com", "About $100", 8],
  ["mobbin", "Mobbin (real app screen library)", "Tool", ["visual"], "https://mobbin.com", "Free tier", 1],
  ["laws", "Laws of UX (site and book by Jon Yablonski)", "Guide", ["visual", "behavior"], "https://lawsofux.com", "Free / about $40", 1],

  // Behavior
  ["b-tfs", "Thinking, Fast and Slow, Daniel Kahneman", "Book", ["behavior"], spl("Thinking Fast and Slow Kahneman"), "Library", 10],
  ["nng-cog", "NN/g: Minimize cognitive load", "Article", ["behavior"], "https://www.nngroup.com/articles/minimize-cognitive-load/", "Free", 10],
  ["baymard", "Baymard: current state of checkout UX", "Article", ["behavior"], "https://baymard.com/research-articles/current-state-of-checkout-ux", "Free", 10],
  ["pew-ai", "Pew: Americans and AI 2026", "Article", ["behavior", "ai-ux"], "https://www.pewresearch.org/internet/2026/06/17/americans-and-ai-2026-chatbots-smart-devices-and-views-on-impact/", "Free", 12],

  // Staying current
  ["nng-news", "NN/g newsletter", "Newsletter", ["research", "behavior"], "https://www.nngroup.com/newsletter/", "Free", 12],
  ["uxc", "UX Collective", "Newsletter", ["visual", "product"], "https://uxdesign.cc", "Free / paid", 12],
  // From the LinkedIn research (Nov 2026)
  ["wcag22-qr", "W3C: How to Meet WCAG 2.2 (quick reference)", "Guide", ["a11y", "states"], "https://www.w3.org/WAI/WCAG22/quickref/", "Free", 7],
  ["nng-empty", "NN/g: Designing empty states in complex applications", "Article", ["states", "ux-writing"], "https://www.nngroup.com/articles/empty-state-interface-design/", "Free", 5],
  ["m3-states", "Material Design 3: Interaction states", "Guide", ["states", "visual"], "https://m3.material.io/foundations/interaction/states", "Free", 5],
  ["alexa-design", "Alexa Design Guide: conversation and multimodal design", "Guide", ["conversation", "ai-ux"], "https://developer.amazon.com/docs/alexa-design/get-started.html", "Free", 8],
  ["claude-code", "Claude Code docs: overview", "Guide", ["ai-proto", "frontend"], "https://docs.claude.com/en/docs/claude-code/overview", "Free", 4],
  ["uxtools", "UX Tools newsletter and surveys", "Newsletter", ["figma", "ai-proto"], "https://www.uxtools.co", "Free", 12]
];

// The week each resource first comes up in the generated plan (or the first week on the same skill).
export const RESOURCES = R.map(([id, title, type, skills, url, cost, week, units]) => ({
  id, title, type, skills, url, cost, week: RES_WEEK[id] ?? week, units: units ? { done: 0, total: units[0], label: units[1] } : null
}));

// Skill details: proof, projects, practice, interview questions, fixed test bank.
const P = (t, ...steps) => ({ t, steps });
const Q = (q, tip) => ({ q, tip });
const M = (q, o, a, why) => ({ q, o, a, why });

export const SKILL_DETAILS = {
  research: {
    proof: "Commuter study: plan, 4–5 interviews and synthesis, written up as a case study",
    projects: [P("{cityL} commuter study", "Write goals and 3–5 research questions", "Recruit 5 riders who mix bus and train", "Run 30-minute interviews with a discussion guide", "Affinity-map into 3–5 insights with quotes"),
      P("Interview-based teardown of an app you use", "Pick an app and the job it does", "Interview 3 people who use it", "Write 3 insights and one opportunity")],
    practice: ["Rewrite 5 leading questions as neutral ones", "Write a discussion guide for a new topic in 20 minutes", "Turn one interview's notes into 3 insight statements"],
    interview: [Q("Walk me through how you planned a research study.", "Goal, questions, method and why, recruiting, what changed because of it."),
      Q("How do you decide between interviews and a survey?", "Why vs how many: interviews explore, surveys measure."),
      Q("Tell me about a finding that changed a design decision.", "Name the quote or data, and the decision before and after."),
      Q("How do you avoid bias when you interview users?", "Neutral questions, past behavior, no pitching, let silence work.")],
    bank: [M("Which question is least leading?", ["Don't you find the checkout confusing?", "How easy was the checkout?", "Tell me about the last time you checked out.", "Would you like a faster checkout?"], 2, "It asks about past behavior without suggesting an answer."),
      M("What is affinity mapping mainly used for?", ["Ranking features by revenue", "Grouping observations into themes", "Testing visual hierarchy", "Estimating task time"], 1, "It clusters research notes into patterns you can turn into insights."),
      M("Which is the strongest research question?", ["Will users like the new design?", "How do commuters plan trips that combine bus and train?", "Should we add a map?", "What color should the button be?"], 1, "It's open, about behavior, and guides what you ask and observe."),
      M("Why ask about past behavior instead of future intentions?", ["It's faster", "People predict their own future behavior poorly", "It needs fewer participants", "It avoids note-taking"], 1, "What people did is more reliable than what they say they'll do.")]
  },
  testing: {
    proof: "A baseline test and a second round on your prototype, with task success compared",
    projects: [P("Before-and-after test of a transit app", "Write 4 realistic tasks", "Test the current app with 5 people", "Redesign the worst step", "Test again and compare task success"),
      P("Unmoderated test in Maze", "Import a Figma prototype", "Write tasks and one follow-up question", "Recruit 5–10 testers", "Report success, misclicks and quotes")],
    practice: ["Write 3 realistic task scenarios for any app", "Rate 5 usability issues by severity", "Run a 10-minute hallway test with a friend"],
    interview: [Q("How do you write a good usability task?", "A realistic goal, no UI words, a clear end point."),
      Q("Why test with 5 users?", "Most problems show up early; test small and often (NN/g)."),
      Q("What do you do when a participant gets stuck?", "Wait, ask what they expected, don't rescue too early, note it."),
      Q("How do you share test results with a team?", "Top issues by severity, clips or quotes, a recommendation for each.")],
    bank: [M("Which task wording is best?", ["Click the Plan Trip button", "Find the fastest way to get to Capitol Hill by 9 am", "Test the trip planner", "Do you like the trip planner?"], 1, "It gives a realistic goal without naming UI elements."),
      M("What does SUS measure?", ["Load time", "Perceived usability", "Conversion rate", "Accessibility compliance"], 1, "The System Usability Scale is a 10-item questionnaire on perceived usability."),
      M("In a moderated test, thinking aloud means…", ["The moderator explains each screen", "Participants say what they're thinking as they work", "Participants read the task aloud only", "The team discusses findings live"], 1, "Hearing their reasoning shows why problems happen."),
      M("A severity rating combines…", ["Color and contrast", "How often, how badly and how persistently a problem affects users", "Number of screens and tasks", "Test length and budget"], 1, "Severity weighs frequency, impact and persistence.")]
  },
  "ai-ux": {
    proof: "AI trip-planner flows labeled with HAX guidelines, including wrong, unsure and slow states",
    projects: [P("AI feature with trust built in", "Pick a narrow job for the AI", "Design onboarding that sets expectations", "Design wrong, unsure and slow states", "Label each screen with its HAX guideline"),
      P("Agent control panel", "Map how a person starts, steers, pauses and reviews an agent", "Design the approval step before it acts", "Prototype one flow")],
    practice: ["Critique an AI app's error handling in 10 minutes", "Write 3 versions of a 'not sure' message", "Map one HAX guideline to a screen you use daily"],
    interview: [Q("How would you design for an AI that's sometimes wrong?", "Set expectations, show confidence and sources, make correction and undo easy."),
      Q("When should a product not use AI?", "When a simple rule works, when errors are costly and hard to spot, or when people need full control."),
      Q("How do you show uncertainty in an AI answer?", "Sources, hedged wording, confidence cues, ways to check."),
      Q("How would you design an agent that acts for the user?", "Clear scope, a preview, approval for important actions, a log, an easy stop.")],
    bank: [M("Why are narrow AI features easier to adopt (NN/g)?", ["They're cheaper", "People understand what they do and when to use them", "They need no testing", "They need no UI"], 1, "A clear scope sets expectations and builds trust."),
      M("Which of these is a Microsoft HAX guideline?", ["Make clear how well the system can do what it can do", "Always use chat", "Hide model limits", "Never show sources"], 0, "Setting expectations about capability is one of the 18 guidelines."),
      M("Human in the loop means…", ["A human writes every answer", "A person reviews or approves before important AI actions take effect", "The AI trains on users", "Support staff watch every chat"], 1, "People keep control over consequential steps."),
      M("What's the best response when the AI isn't confident?", ["Hide the answer", "Show the answer with its sources and a way to check or correct it", "Show an error code", "Retry silently"], 1, "Transparency plus correction keeps trust at the right level.")]
  },
  "ai-proto": {
    proof: "A live prototype built with Figma Make, then Claude Code or Cursor, linked in a case study",
    projects: [P("From Figma to a working app", "Design one flow with your mini system", "Generate it in Figma Make", "Take it further in Claude Code or Cursor through the Figma MCP server", "Deploy it and test with 5 people"),
      P("A small tool for yourself", "Pick a small daily problem", "Describe it to an AI coding tool", "Iterate until it works", "Write a short lab entry on what you learned")],
    practice: ["Rebuild one screen from Figma in code with AI", "Ask an AI tool for 3 variations of a component and pick one with reasons", "Fix one bug in your prototype by reading the diff"],
    interview: [Q("Tell me how you used AI in your design process.", "The tool, the step, what it saved, where you overruled it."),
      Q("What are the limits of vibe-coded prototypes?", "Edge cases, accessibility, performance and maintenance; they test ideas, they don't ship products."),
      Q("How do you keep quality when AI generates the UI?", "Your design system as the source, review every screen, test with people."),
      Q("When do you prototype in code instead of Figma?", "Real data, complex states, timing, or testing on devices.")],
    bank: [M("What does the Figma MCP server let coding agents do?", ["Edit invoices", "Read your Figma designs as context", "Host your website", "Run usability tests"], 1, "It gives tools like Claude Code and Cursor your design context."),
      M("Figma Make is best described as…", ["A font manager", "A tool that builds working prototypes and apps from prompts or frames", "A version control system", "A user-testing panel"], 1, "Make turns prompts or designs into working prototypes."),
      M("When you show an AI-built prototype in a portfolio, you should…", ["Hide that AI was used", "Say which tool did what and what you decided", "Remove all interactions", "Only show screenshots"], 1, "Hiring managers want specific, honest AI use."),
      M("A good first step when an AI coding tool makes a wrong change is…", ["Start a new project", "Read the diff and ask for a targeted fix", "Delete the repo", "Switch tools"], 1, "Reviewing changes keeps you in control.")]
  },
  figma: {
    proof: "Every case study: auto layout, variables with modes, components with properties, clean Dev Mode handoff",
    projects: [P("Mini design system", "Colors and type as variables with light and dark modes", "10–15 components with properties", "Document how to use them", "Use them in one flow"),
      P("Animate a flow with Figma Motion", "Pick one flow", "Add 3 transitions and 2 microinteractions", "Export an MP4", "Check timings in Dev Mode")],
    practice: ["Rebuild a screen from a popular app with auto layout in 30 minutes", "Convert a hard-coded file to variables", "Build one component with 3 properties"],
    interview: [Q("How do you structure a Figma file for handoff?", "Pages, named frames, components, variables, Dev Mode annotations, ready for dev."),
      Q("How do variables and modes help a team?", "One source for tokens, themes and states; fewer detached styles."),
      Q("What's new in Figma that changed how you work?", "Name one (Make, Motion, code layers, the agent) and how you used it."),
      Q("How do you keep components flexible?", "Properties instead of endless variants, auto layout, instance swap.")],
    bank: [M("Variables with modes are most useful for…", ["Light and dark themes", "Exporting PNGs", "Comments", "Version history"], 0, "Modes switch token values, such as themes or densities."),
      M("Which feature makes a frame resize around its content?", ["Absolute position", "Auto layout", "Flatten", "Rasterize"], 1, "Auto layout resizes frames around their content."),
      M("Dev Mode is mainly for…", ["Inspecting designs and handing off to engineers", "Brainstorming", "User interviews", "Presenting slides"], 0, "It shows specs, code and ready-for-dev status."),
      M("Figma Motion (2026) adds…", ["A timeline with keyframes and easing inside Figma Design", "A new font format", "Plugin billing", "Team chat"], 0, "Motion brings keyframe animation into Figma.")]
  },
  product: {
    proof: "\"How we measured success\" in each case study, with goals and metrics",
    projects: [P("Metrics for your commuter project", "Write the problem statement", "Pick a HEART dimension", "Define a goal, a signal and a metric", "Add them to the case study"),
      P("Teardown of a product decision", "Pick a recent change in an app you use", "Name the likely business goal", "Propose how you'd measure it", "Write a 300-word note")],
    practice: ["Write a one-sentence problem statement for any feature", "Name 3 metrics for a feature and pick one", "Explain one trade-off between user and business needs"],
    interview: [Q("How did you measure the success of this project?", "Goal, metric, baseline, result, or the proxy you'd use."),
      Q("How do you prioritize when everything seems important?", "Impact vs effort, user pain, business goal, and what you'd drop."),
      Q("Tell me about a time you pushed back on a feature.", "The evidence, the alternative you offered, the outcome."),
      Q("What makes a good success metric?", "Tied to the goal, sensitive to the change, hard to game.")],
    bank: [M("In Google's HEART framework, H stands for…", ["Hours", "Happiness", "Hierarchy", "Heuristics"], 1, "Happiness, Engagement, Adoption, Retention, Task success."),
      M("Goals–Signals–Metrics means…", ["Start with goals, find signals of success, then pick metrics", "Pick metrics first", "Only track revenue", "Survey every user"], 0, "It ties measurement to what you're trying to achieve."),
      M("An A/B test compares…", ["Two designers", "Two versions shown to different users at the same time", "Two months of data", "Two personas"], 1, "A random split keeps other factors equal."),
      M("A good problem statement focuses on…", ["The solution", "The user, their need and why it matters", "The tech stack", "The deadline"], 1, "It frames the work without locking in a solution.")]
  },
  story: {
    proof: "A 45-minute deck and a 2–3 minute Loom walkthrough",
    projects: [P("45-minute portfolio presentation", "Pick two case studies", "Outline context, decisions, outcome, learnings", "Build the slides", "Rehearse twice and record once"),
      P("Case study rewrite", "Write a 3-line summary at the top", "Add 2–3 decisions with the options you rejected", "Add the outcome and what you'd change", "Cut to 800–1,500 words")],
    practice: ["Say your 60-second intro out loud and record it", "Summarize a project in 3 lines", "Present one decision and its trade-off in 2 minutes"],
    interview: [Q("Walk me through a project you're proud of.", "Problem, your role, 2–3 decisions, result, learning; under 10 minutes."),
      Q("Why did you choose this design over the alternatives?", "Name the options and the evidence that decided it."),
      Q("What would you do differently?", "Be specific and show what you learned."),
      Q("Tell me about yourself.", "Present, past, future in 60 seconds, ending on why this role.")],
    bank: [M("What should come first in a case study?", ["Your process diagram", "A short summary of the problem, your role and the outcome", "Wireframes", "Team photos"], 1, "Reviewers decide in seconds, so lead with impact."),
      M("Interviewers ask about rejected options because…", ["They want more slides", "Trade-offs show your judgment", "It fills time", "It shows you were slow"], 1, "Choosing between options is the core of design work."),
      M("A good length for one case study is about…", ["100 words", "800–1,500 words plus images", "5,000 words", "Images only"], 1, "Long enough for decisions and outcomes, short enough to scan."),
      M("When you have no numbers for impact, you should…", ["Estimate some", "Share qualitative signals and what you'd measure", "Skip outcomes", "Only show visuals"], 1, "Honesty plus a measurement plan beats made-up numbers.")]
  },
  interview: {
    proof: "A log of timed practice challenges and mock interviews",
    projects: [P("Challenge practice series", "Pick 6 prompts across mobile, web, AI and enterprise", "Do one a week in 45 minutes", "Review against the rubric", "Note what to change next time"),
      P("App critique library", "Critique 5 apps in 15 minutes each", "Use the same structure every time", "Record two out loud", "Compare with a mock interview")],
    practice: ["Spend 5–8 minutes only on clarifying questions for a prompt", "Critique one app in 10 minutes", "Sketch three different solutions in 10 minutes"],
    interview: [Q("Design a way for people to know when a laundromat machine will be free.", "Clarify users and constraints, map the journey, then solutions and metrics."),
      Q("Critique an app you use every day.", "Who it's for, what works, top problems, what you'd change and how you'd measure it."),
      Q("How do you start a whiteboard challenge?", "Questions first: users, goals, constraints, success."),
      Q("How would you know if your solution works?", "One success metric, one guardrail, and how you'd test it.")],
    bank: [M("In the first minutes of a design challenge you should…", ["Start drawing screens", "Ask clarifying questions about users, goals and constraints", "Pick colors", "Write code"], 1, "Framing the problem is a big part of the score."),
      M("A strong app critique includes…", ["Only what you dislike", "Who it's for, what works, the problems and a prioritized fix", "Pixel-level color notes only", "A redesign of everything"], 1, "Balanced, user-centered and prioritized."),
      M("Interviewers mostly judge a whiteboard challenge on…", ["Drawing skill", "Process, reasoning and communication", "Final visual polish", "Drawing speed"], 1, "They want to see how you think."),
      M("When time runs short in a challenge, it's best to…", ["Rush through everything", "Say what you'd do next and why", "Stop talking", "Ask for more time"], 1, "Naming next steps shows judgment.")]
  },
  systems: {
    proof: "Your own mini design system, documented: tokens, components, variants and states",
    projects: [P("Contribute a component", "Find a missing pattern in your mini system", "Design its states and variants", "Write usage guidelines", "Add it to the library"),
      P("System audit of an app", "Screenshot every button in an app", "Group the inconsistencies", "Propose tokens and one component", "Write a one-page summary")],
    practice: ["Name tokens for a color palette", "Document one component's do's and don'ts", "Compare one component across Fluent, Material and Cloudscape"],
    interview: [Q("How do you work within a design system?", "Use it first, extend it carefully, propose additions with evidence."),
      Q("When would you break the system?", "When it can't meet a real user need; document it and feed it back."),
      Q("How do tokens help design and engineering?", "Shared names for decisions; themes and changes in one place."),
      Q("Tell me about a component you designed.", "States, variants, accessibility, usage guidance, adoption.")],
    bank: [M("Design tokens are…", ["Named design decisions such as colors and spacing", "Payment credits", "Plugin licenses", "User permissions"], 0, "Tokens store decisions so they can be reused across platforms."),
      M("Atomic design builds interfaces from…", ["Atoms, molecules, organisms, templates and pages", "Pages only", "Icons and photos", "Grids and fonts"], 0, "Brad Frost's model builds up from small parts."),
      M("Fluent 2 is the design system of…", ["Amazon", "Microsoft", "Google", "Meta"], 1, "Microsoft teams design in Fluent."),
      M("A component's documentation should include…", ["Only a screenshot", "Usage, states, variants and accessibility notes", "The designer's name", "Release notes only"], 1, "Guidance makes it usable by others.")]
  },
  a11y: {
    proof: "Accessibility notes in every case study and a pass on contrast, focus, labels and target sizes",
    projects: [P("Accessibility pass on your case studies", "Check the contrast of every text style", "Set focus order and visible focus", "Label every input and icon button", "Write down what you changed"),
      P("Screen reader walkthrough", "Turn on VoiceOver or NVDA", "Complete one task in your prototype", "Note what breaks", "Fix it and test again")],
    practice: ["Check the contrast of 5 color pairs", "Write alt text for 5 images", "Use a site with only the keyboard for 10 minutes"],
    interview: [Q("How do you make sure your designs are accessible?", "Contrast, focus, labels, target sizes, motion; check with tools and assistive tech."),
      Q("What's the minimum contrast for body text under WCAG AA?", "4.5:1; 3:1 for large text and UI parts."),
      Q("How do you design for screen readers?", "Semantic structure, labels, reading order, announcements."),
      Q("Tell me about an accessibility issue you fixed.", "The barrier, who it affected, the fix, how you checked it.")],
    bank: [M("WCAG AA contrast for normal text is at least…", ["2:1", "3:1", "4.5:1", "7:1"], 2, "4.5:1 for normal text and 3:1 for large text."),
      M("WCAG 2.2's minimum target size (AA) is…", ["16 by 16 px", "24 by 24 CSS px", "44 by 44 px", "48 by 48 dp"], 1, "Success criterion 2.5.8 asks for at least 24 by 24 CSS pixels."),
      M("The most common WCAG failure on home pages in WebAIM's 2026 report was…", ["Missing captions", "Low-contrast text", "Vague link text", "Flashing content"], 1, "Low-contrast text appeared on 83.9% of home pages."),
      M("Showing an error with color alone is a problem because…", ["It looks bad", "People who can't see the color difference miss it", "It's slow", "It breaks dark mode"], 1, "Pair color with text or an icon.")]
  },
  motion: {
    proof: "Five microinteractions from a case study, exported as MP4 or GIF",
    projects: [P("Five microinteractions", "Pick feedback, loading, success, error and an AI thinking state", "Animate them in Figma Motion or Rive", "Keep durations around 150–400 ms", "Add them to a case study"),
      P("Screen transition study", "Pick a navigation flow", "Design forward and back transitions", "Add a reduced-motion version", "Export the specs")],
    practice: ["Recreate one app animation you like", "Tune an easing curve until it feels right", "Write a reduced-motion alternative for one animation"],
    interview: [Q("When should you use motion in a UI?", "Feedback, continuity, attention; not decoration."),
      Q("How do you hand off animations?", "Duration, easing and triggers; Dev Mode specs or Lottie or Rive files."),
      Q("How do you make motion accessible?", "Respect reduced-motion settings, avoid flashing, keep it short."),
      Q("Show me an animation you designed and why.", "The problem it solved and how you tested it.")],
    bank: [M("A typical duration for a small UI transition is about…", ["20 ms", "150–300 ms", "2 seconds", "5 seconds"], 1, "Short enough to feel instant, long enough to follow."),
      M("Ease-out curves suit elements that…", ["Leave the screen", "Enter the screen", "Never move", "Blink"], 1, "They start fast and settle, which feels responsive."),
      M("The prefers-reduced-motion setting lets you…", ["Speed up animations", "Offer less animation to people who ask for it", "Turn off dark mode", "Lazy-load images"], 1, "It respects the person's system setting."),
      M("WCAG warns against content that flashes more than…", ["Once per second", "Three times per second", "Ten times per minute", "It never matters"], 1, "More than three flashes a second can trigger seizures.")]
  },
  "ux-writing": {
    proof: "Microcopy for your AI feature: onboarding, errors and low-confidence messages",
    projects: [P("Error message rewrite", "Collect 10 error messages from apps", "Rewrite each: what happened, why, what to do", "Test 3 of them with people", "Turn it into a lab entry"),
      P("Voice and tone mini guide", "Pick 3 words for the voice", "Write do and don't examples", "Apply it to 5 screens")],
    practice: ["Rewrite one button label 5 ways", "Cut a paragraph of UI text in half", "Write an empty state with a next step"],
    interview: [Q("How do you write a good error message?", "Say what happened, why, and how to fix it, in plain words."),
      Q("How do you work with content designers?", "Bring them in early; content first, layout second."),
      Q("How would you write for an AI that's unsure?", "Honest and specific, with a way to check or change the answer."),
      Q("Show an example where words changed a design outcome.", "Before, after, and the evidence.")],
    bank: [M("A good error message…", ["Shows an error code only", "Explains what happened and how to fix it", "Blames the user", "Uses technical terms"], 1, "Clear, polite and actionable."),
      M("Button labels work best when they…", ["Say what happens, like 'Save changes'", "Say 'OK'", "Say 'Click here'", "Are one letter long"], 0, "Specific verbs set expectations."),
      M("Front-loading text means…", ["Putting the key words first", "Adding a header image", "Using all caps", "Writing long intros"], 0, "People scan the start of lines."),
      M("Empty states should…", ["Be blank", "Explain what goes here and offer a next step", "Show an error", "Show ads"], 1, "They guide the first use.")]
  },
  frontend: {
    proof: "A deployed prototype you can explain at a basic level",
    projects: [P("Build a page from your design", "Lay it out with flexbox and grid", "Use CSS variables from your tokens", "Make it responsive", "Deploy it"),
      P("A React component with AI", "Ask Claude Code or Cursor for one component", "Read and edit the code", "Add its states", "Compare it with your Figma spec")],
    practice: ["Recreate one layout with CSS grid", "Change 3 styles on a site in DevTools", "Explain flexbox vs grid in one paragraph"],
    interview: [Q("How comfortable are you with code?", "Your honest level, what you've built, how you work with engineers."),
      Q("How does knowing code change your designs?", "Feasible layouts, real states and constraints, faster handoff."),
      Q("How do you hand off responsive designs?", "Breakpoints, behavior rules, tokens, examples."),
      Q("What's the difference between margin and padding?", "Padding is inside the border, margin is outside.")],
    bank: [M("CSS grid is best for…", ["Two-dimensional layouts with rows and columns", "Animations only", "Fonts", "Images only"], 0, "Flexbox handles one direction; grid handles two."),
      M("Semantic HTML helps…", ["Screen readers and AI agents understand the page", "Only page speed", "Only colors", "Nothing visible"], 0, "Meaningful elements expose structure."),
      M("A media query lets you…", ["Change styles at different screen sizes", "Query a database", "Play video", "Load fonts"], 0, "It's the basis of responsive design."),
      M("CSS custom properties (variables) are useful for…", ["Design tokens such as colors and spacing", "Server logs", "Image compression", "Routing"], 0, "They mirror your tokens in code.")]
  },
  visual: {
    proof: "Polished, consistent screens across your own case studies",
    projects: [P("Refresh a screen you use", "Pick a screen from an app you use every day", "Improve hierarchy, spacing and type", "Check contrast", "Show before and after"),
      P("Pattern study", "Collect 10 examples of one pattern on Mobbin", "Note what works and why", "Design your own version")],
    practice: ["Redesign one screen in 30 minutes with a type scale", "Find 3 spacing inconsistencies in an app", "Make a 5-color palette that passes contrast"],
    interview: [Q("How do you create visual hierarchy?", "Size, weight, color, spacing, position; one primary action."),
      Q("How do you choose between patterns?", "What people expect (Jakob's Law), the context, and testing."),
      Q("Tell me about a time you improved polish under a deadline.", "What you prioritized and why."),
      Q("How do you design for mobile and web at the same time?", "A shared system, platform conventions, responsive rules.")],
    bank: [M("Jakob's Law says people…", ["Prefer new patterns", "Expect your product to work like others they use", "Read every word", "Ignore navigation"], 1, "Familiar patterns reduce learning."),
      M("Fitts's Law is about…", ["Color contrast", "The time to reach a target, based on its size and distance", "Reading speed", "Load time"], 1, "Bigger, closer targets are faster to hit."),
      M("A type scale helps…", ["Keep hierarchy consistent across screens", "Images load", "Translation", "Analytics"], 0, "Fixed steps keep text sizes consistent."),
      M("Whitespace in a layout…", ["Wastes space", "Groups related items and helps scanning", "Hurts accessibility", "Only matters in print"], 1, "Proximity shows what belongs together.")]
  },
  behavior: {
    proof: "Design decisions in your case studies backed by a named behavioral finding",
    projects: [P("Behavior-led redesign", "Pick a flow where people drop off", "Name 2 behavioral principles at play", "Redesign one step", "Test it"),
      P("AI trust mini study", "Interview 3 people about using AI answers", "Note when they check sources", "Write 3 design implications")],
    practice: ["Spot 3 cognitive biases in an app's onboarding", "Explain one Laws of UX principle with an example", "Read one NN/g or Baymard article and write 3 takeaways"],
    interview: [Q("How do you use psychology in design?", "Name a principle, the behavior it explains, and the decision it shaped."),
      Q("How are people's search habits changing with AI?", "AI for vague, many-part tasks; search for accuracy and trusted sources (NN/g)."),
      Q("How do you avoid dark patterns?", "Respect intent, make choices clear, make leaving easy."),
      Q("Tell me about a user behavior that surprised you.", "What you saw, why it happened, what you changed.")],
    bank: [M("Hick's Law says decision time grows with…", ["Screen size", "The number of choices", "Font size", "The number of colors"], 1, "More options take longer to choose between."),
      M("With a Google AI summary on the page, people clicked a result in about…", ["8% of visits", "30% of visits", "50% of visits", "80% of visits"], 0, "Pew found 8% with an AI Overview vs 15% without."),
      M("'Recognition rather than recall' means…", ["Show options instead of making people remember them", "Use more text", "Hide menus", "Add quizzes"], 0, "Recognizing is easier than remembering."),
      M("People often scan web pages in patterns such as…", ["F-shape and layer cake", "Circles", "Bottom to top", "Random"], 0, "Found in NN/g's eye-tracking studies.")]
  },
  states: {
    proof: "One case study that shows empty, loading, error, permission and success states for a real workflow, plus how you checked the build",
    projects: [P("State map for one complex flow", "Pick a flow with settings or permissions (for example saved trips in your transit planner, or an admin screen built from your mini design system)", "List every state: empty, loading, partial, error, no access, success", "Design each state with copy and a way forward", "Add the state map to the case study"),
      P("Data-dense table, done well", "Design a table with sort, filter, bulk actions and empty and no-results states", "Check density, alignment and keyboard focus", "Prototype one bulk action with undo", "Write 3 lines on the trade-offs")],
    practice: ["Redesign one error message you met this week", "Write the empty state for a brand-new dashboard", "Audit one admin screen for unclear permissions"],
    interview: [Q("How do you design beyond the happy path?", "Map every state up front: empty, loading, error, permissions, recovery. Then design copy and next steps for each."),
      Q("How do you simplify a complex enterprise workflow?", "Find the core task, progressive disclosure, sensible defaults, and keep power-user controls reachable."),
      Q("How do you make permissions understandable?", "Say who can do what, explain disabled actions, and show how to get access."),
      Q("What do you check in design QA?", "States, spacing, tokens, copy, accessibility and edge data such as long names and zero values.")],
    bank: [M("A good empty state…", ["Shows nothing so the page looks clean", "Explains what will appear and offers a next step", "Shows an error code", "Hides the navigation"], 1, "Empty states teach the system and offer a direct path to the key task."),
      M("For a button the user can't use because of permissions, it's usually best to…", ["Hide all controls silently", "Disable it and say why, or how to get access", "Let it fail on click", "Remove the page"], 1, "Unexplained missing or broken controls erode trust."),
      M("'Design QA' means…", ["Writing test cases for engineers", "Checking the built product against the design and fixing gaps", "Running an A/B test", "Reviewing the roadmap"], 1, "Sinclair and Plaid list design QA as part of the role."),
      M("A good error message…", ["Blames the user", "Says what happened and how to fix it, in plain words", "Shows only a code", "Uses red color alone"], 1, "Plain words, a cause and a way forward; never color alone.")]
  },
  conversation: {
    proof: "A short conversational or voice-plus-screen flow with a sample script, repair paths and the screen states that go with it",
    projects: [P("Assistant flow for the transit planner", "Write a happy-path script for planning a trip by chat", "Add 3 repair paths: unclear request, no route, changed plans", "Design the screen cards that answer each turn", "Test it with 3 people reading the script aloud"),
      P("Voice plus screen", "Pick one shopping or travel task", "Write the voice response and the matching screen", "Keep both short and consistent", "Note what each channel is better at")],
    practice: ["Rewrite one chatbot reply to be shorter and clearer", "Write 5 ways a user might ask for the same thing", "Design a 'Did you mean…' repair for one request"],
    interview: [Q("How do you design a conversation?", "Start from a sample dialog, then intents, slots, repair paths and the screen states that support it."),
      Q("How do you handle errors in a chat experience?", "Admit the limit, offer choices, keep context and give a way to a human or a manual path."),
      Q("When should an experience use voice, screen or both?", "Voice for hands-busy, quick tasks; screen for comparing and browsing; both for confirmation."),
      Q("How do you keep an AI assistant trustworthy?", "Show sources and status, let people correct and undo, and be honest about uncertainty.")],
    bank: [M("A 'happy path' script in conversation design is…", ["A legal disclaimer", "One ideal sample dialog that guides the rest of the design", "A list of error codes", "A test plan"], 1, "Write one great sample conversation first, then add the paths around it."),
      M("A repair path is…", ["A bug fix", "How the conversation recovers when the system or the person misunderstands", "A way to end the chat", "A pricing tier"], 1, "Good repairs keep context and offer a clear next step."),
      M("In a voice-plus-screen experience the screen should…", ["Repeat every spoken word", "Support the voice with scannable details and choices", "Stay blank", "Show only ads"], 1, "Each channel does what it's best at."),
      M("For an AI answer people may rely on, it helps to…", ["Hide uncertainty", "Show sources or confidence and let people correct it", "Use longer answers", "Remove undo"], 1, "Transparency and control build trust.")]
  }
};
