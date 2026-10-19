// ==========================================================================
// Tokenly base — identical on tokenly.in, Kural and fast-CV.
// Change it in one page, copy it to the others. Page code goes below the
// "Page" banner at the end of this file.
// ==========================================================================

const root = document.documentElement;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.getElementById("year").textContent = new Date().getFullYear();

// Trigger the hero load-in once the first frame has painted.
requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("loaded")));

// ---------- Mobile menu ----------

const menuToggle = document.getElementById("menuToggle");
const mobileMenu = document.getElementById("mobileMenu");

function setMenu(open) {
  document.body.classList.toggle("menu-open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}

menuToggle.addEventListener("click", () => {
  setMenu(!document.body.classList.contains("menu-open"));
});

mobileMenu.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => setMenu(false));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMenu(false);
});

document.addEventListener("click", (event) => {
  if (!document.body.classList.contains("menu-open")) return;
  if (mobileMenu.contains(event.target) || menuToggle.contains(event.target)) return;
  setMenu(false);
});

window.matchMedia("(min-width: 641px)").addEventListener("change", (event) => {
  if (event.matches) setMenu(false);
});

// ---------- Reveal on scroll ----------

const revealed = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window && !reducedMotion) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
  );

  revealed.forEach((el, i) => {
    el.style.transitionDelay = `${(i % 5) * 60}ms`;
    observer.observe(el);
  });
} else {
  revealed.forEach((el) => el.classList.add("visible"));
}

// ---------- Animated backdrop ----------

// Sizes the full-viewport #bg canvas and runs the page's draw(view, now) every
// frame, pausing while the tab is hidden. Reduced motion draws one still frame.
function startBackdrop({ draw, resize = () => {} }) {
  const canvas = document.getElementById("bg");
  const view = { ctx: canvas.getContext("2d"), width: 0, height: 0 };

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.width = window.innerWidth;
    view.height = window.innerHeight;
    canvas.width = view.width * dpr;
    canvas.height = view.height * dpr;
    view.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    resize(view);
  }

  fit();
  window.addEventListener("resize", () => {
    fit();
    if (reducedMotion) draw(view, 0);
  });

  if (reducedMotion) {
    draw(view, 0);
    return;
  }

  let rafId = 0;
  const frame = (now) => {
    draw(view, now);
    rafId = requestAnimationFrame(frame);
  };
  rafId = requestAnimationFrame(frame);
  document.addEventListener("visibilitychange", () => {
    cancelAnimationFrame(rafId);
    if (!document.hidden) rafId = requestAnimationFrame(frame);
  });
}

// ==========================================================================
// Page
// ==========================================================================

// ---------- Animated document background ----------

// Faint lines of "text", like a resume page. Every so often one line is
// re-angled: its words re-order and re-size in place, staying within ~10% of
// the original length, and leave a small citation tick behind.
let rows = [];

const INK_RGB = "15, 15, 20";
const ACCENT_RGB = "200, 65, 65";
const LINE_GAP = 30;
const BAR_HEIGHT = 5;
const WORD_GAP = 7;
const REWRITE_MS = 1400;
const CITE_MS = 3500;

const rand = (min, max) => min + Math.random() * (max - min);
const ease = (p) => 1 - Math.pow(1 - p, 3);

function makeWords(length) {
  const words = [];
  let used = 0;
  while (used < length) {
    const w = Math.min(rand(14, 72), length - used);
    if (w < 10) break;
    words.push(w);
    used += w + WORD_GAP;
  }
  return words;
}

function buildRows({ width, height }) {
  const margin = width < 640 ? 16 : 32;
  const column = width - margin * 2;
  rows = [];
  let lineInPara = 0;
  let paraLength = Math.floor(rand(3, 7));
  for (let y = LINE_GAP / 2; y < height + LINE_GAP; y += LINE_GAP) {
    if (lineInPara === paraLength) {
      // Blank line between paragraphs.
      lineInPara = 0;
      paraLength = Math.floor(rand(3, 7));
      continue;
    }
    const last = lineInPara === paraLength - 1;
    const length = column * (last ? rand(0.25, 0.6) : rand(0.85, 1));
    rows.push({ y, x: margin, words: makeWords(length), from: null, start: 0, done: 0 });
    lineInPara++;
  }
}

// Shuffle and re-size the words, then scale so the line stays within ~10%.
function rewrite(row, now) {
  const before = row.words.reduce((a, b) => a + b, 0);
  const next = row.words.map((w) => w * rand(0.7, 1.3)).sort(() => Math.random() - 0.5);
  const after = next.reduce((a, b) => a + b, 0);
  const scale = (before * rand(0.92, 1.08)) / after;
  row.from = row.words.slice();
  row.to = next.map((w) => Math.max(10, w * scale));
  row.start = now;
}

function bar(ctx, x, y, w) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y - BAR_HEIGHT / 2, w, BAR_HEIGHT, BAR_HEIGHT / 2);
  else ctx.rect(x, y - BAR_HEIGHT / 2, w, BAR_HEIGHT);
  ctx.fill();
}

function drawRow(ctx, row, now) {
  let words = row.words;
  let progress = 1;
  if (row.from) {
    progress = Math.min(1, (now - row.start) / REWRITE_MS);
    const e = ease(progress);
    words = row.from.map((w, i) => w + (row.to[i] - w) * e);
    if (progress === 1) {
      row.words = row.to;
      row.from = null;
      row.done = now;
    }
  }

  const rewriting = progress < 1;
  // Accent glows in while rewriting, then settles back to ink.
  const glow = rewriting ? Math.sin(progress * Math.PI) : 0;
  let x = row.x;
  words.forEach((w) => {
    ctx.fillStyle = `rgba(${INK_RGB}, ${0.035 * (1 - glow)})`;
    bar(ctx, x, row.y, w);
    if (glow > 0) {
      ctx.fillStyle = `rgba(${ACCENT_RGB}, ${0.22 * glow})`;
      bar(ctx, x, row.y, w);
    }
    x += w + WORD_GAP;
  });

  if (rewriting) {
    // Caret sweeping across the line as it is rewritten.
    const caret = row.x + (x - row.x) * ease(progress);
    ctx.fillStyle = `rgba(${ACCENT_RGB}, ${0.5 * glow})`;
    ctx.fillRect(caret, row.y - 8, 1.5, 16);
  } else if (row.done && now - row.done < CITE_MS) {
    // Citation tick: the rewrite points back at its source.
    const fade = 1 - (now - row.done) / CITE_MS;
    ctx.fillStyle = `rgba(${ACCENT_RGB}, ${0.35 * fade})`;
    bar(ctx, x + 2, row.y, 16);
  }
}

let nextRewrite = 0;

startBackdrop({
  resize: buildRows,
  draw({ ctx, width, height }, now) {
    if (now && now >= nextRewrite && rows.length) {
      const idle = rows.filter((r) => !r.from);
      if (idle.length) rewrite(idle[Math.floor(Math.random() * idle.length)], now);
      nextRewrite = now + rand(500, 1100);
    }
    ctx.clearRect(0, 0, width, height);
    rows.forEach((row) => drawRow(ctx, row, now));
  },
});

// ---------- Tailoring demo ----------

const paper = document.getElementById("paper");
const bulletList = document.getElementById("bullets");
const skillsEl = document.getElementById("skills");
const jobHost = document.getElementById("jobHost");
const jobTitle = document.getElementById("jobTitle");
const demoState = document.getElementById("demoState");
const checks = document.getElementById("checks");

// The resume as written. Rewrites below only re-order and re-word these facts.
const source = {
  b1: "Built a Node.js service that parses PDF resumes into structured JSON for 40k users.",
  b2: "Cut p95 API latency by 38% by moving hot paths to Redis caching.",
  b3: "Wrote a retrieval pipeline over Postgres and pgvector for internal search.",
};
const sourceSkills = ["Node.js", "TypeScript", "Python", "Postgres", "Redis", "pgvector", "Docker", "React"];

const jobs = [
  {
    host: "linkedin.com/jobs",
    title: "AI Engineer, Retrieval",
    bullets: [
      { from: "b3", text: "Built a retrieval pipeline over Postgres and pgvector powering internal search." },
      { from: "b1", text: "Shipped a Node.js document-parsing service turning PDF resumes into structured JSON for 40k users." },
      { from: "b2", text: "Reduced p95 API latency 38% by caching hot paths in Redis." },
    ],
    skills: ["Python", "pgvector", "Postgres", "Node.js", "TypeScript", "Redis", "Docker", "React"],
    lead: 3,
    gaps: "LangChain, Kubernetes",
  },
  {
    host: "careers.example.com",
    title: "Backend Engineer, Payments",
    bullets: [
      { from: "b2", text: "Lowered p95 API latency by 38% by moving hot request paths onto Redis caching." },
      { from: "b1", text: "Built and ran a Node.js service parsing PDF resumes into structured JSON for 40k users." },
      { from: "b3", text: "Wrote a Postgres-backed retrieval pipeline with pgvector for internal search." },
    ],
    skills: ["Node.js", "TypeScript", "Redis", "Postgres", "Docker", "Python", "pgvector", "React"],
    lead: 3,
    gaps: "Go, Kafka",
  },
  {
    host: "jobs.example.io",
    title: "Full-stack Engineer, Product",
    bullets: [
      { from: "b1", text: "Built a Node.js service turning uploaded PDF resumes into structured JSON for 40k users." },
      { from: "b2", text: "Cut p95 API latency by 38% by moving hot paths behind Redis caching." },
      { from: "b3", text: "Wrote a Postgres and pgvector retrieval pipeline behind internal search." },
    ],
    skills: ["TypeScript", "React", "Node.js", "Postgres", "Redis", "Docker", "Python", "pgvector"],
    lead: 3,
    gaps: "Next.js",
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function renderSource() {
  bulletList.textContent = "";
  Object.values(source).forEach((text) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.className = "bullet-text";
    span.textContent = text;
    li.append(span);
    bulletList.append(li);
  });
  renderSkills(sourceSkills, 0);
}

function renderSkills(list, lead) {
  skillsEl.textContent = "";
  list.forEach((name, i) => {
    const span = document.createElement("span");
    span.textContent = name;
    span.dataset.skill = name;
    if (i < lead) span.className = "lead-skill";
    skillsEl.append(span);
  });
}

// FLIP: re-order the skills in place and let each one glide to its new slot.
function reorderSkills(list, lead) {
  const before = new Map();
  skillsEl.querySelectorAll("span").forEach((el) => before.set(el.dataset.skill, el.getBoundingClientRect()));
  renderSkills(list, lead);
  skillsEl.querySelectorAll("span").forEach((el) => {
    const prev = before.get(el.dataset.skill);
    const next = el.getBoundingClientRect();
    if (!prev) return;
    el.animate(
      [
        { transform: `translate(${prev.left - next.left}px, ${prev.top - next.top}px)` },
        { transform: "none" },
      ],
      { duration: 650, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
    );
  });
}

async function setState(text) {
  if (demoState.textContent === text) return;
  demoState.classList.add("fading");
  await sleep(250);
  demoState.textContent = text;
  demoState.classList.remove("fading");
}

async function setJob(job) {
  jobTitle.classList.add("fading");
  await sleep(250);
  jobHost.textContent = job.host;
  jobTitle.textContent = job.title;
  jobTitle.classList.remove("fading");
}

function setCheck(name, value) {
  const li = checks.querySelector(`[data-check="${name}"]`);
  li.querySelector(".check-value").textContent = value;
  li.classList.toggle("done", value !== "—");
}

function resetChecks() {
  ["cited", "unattested", "added", "pages", "gaps"].forEach((name) => setCheck(name, "—"));
}

function cite(li, from) {
  const tag = document.createElement("span");
  tag.className = "cite";
  tag.textContent = `← ${from}`;
  li.append(tag);
}

async function rewriteBullet(li, { from, text }) {
  const span = li.querySelector(".bullet-text");
  li.classList.add("active");
  span.classList.add("fading");
  await sleep(300);
  span.textContent = "";
  span.classList.remove("fading");
  const words = text.split(" ");
  for (let i = 0; i < words.length; i++) {
    if (i) span.append(" ");
    const w = document.createElement("span");
    w.className = "word";
    w.textContent = words[i];
    span.append(w);
    await sleep(55 + Math.random() * 55);
  }
  cite(li, from);
  await sleep(350);
  li.classList.remove("active");
}

function showFinal(job) {
  jobHost.textContent = job.host;
  jobTitle.textContent = job.title;
  bulletList.querySelectorAll("li").forEach((li, i) => {
    li.querySelector(".bullet-text").textContent = job.bullets[i].text;
    cite(li, job.bullets[i].from);
  });
  renderSkills(job.skills, job.lead);
  setCheck("cited", `${job.bullets.length} / ${job.bullets.length}`);
  setCheck("unattested", "0");
  setCheck("added", "0");
  setCheck("pages", "1 / 1");
  setCheck("gaps", job.gaps);
  demoState.textContent = "Fits one page";
}

async function runDemo() {
  let index = 0;
  while (true) {
    const job = jobs[index];
    renderSource();
    resetChecks();
    await setJob(job);
    setState("Reading job post");
    await sleep(1400);

    paper.classList.add("working");
    setState("Tailoring");
    const items = bulletList.querySelectorAll("li");
    for (let i = 0; i < items.length; i++) {
      await rewriteBullet(items[i], job.bullets[i]);
    }
    reorderSkills(job.skills, job.lead);
    await sleep(800);

    setState("Verifying");
    await sleep(500);
    setCheck("cited", `${job.bullets.length} / ${job.bullets.length}`);
    await sleep(280);
    setCheck("unattested", "0");
    await sleep(280);
    setCheck("added", "0");
    await sleep(280);
    setCheck("pages", "1 / 1");
    await sleep(280);
    setCheck("gaps", job.gaps);

    paper.classList.remove("working");
    setState("Fits one page");
    await sleep(3200);
    index = (index + 1) % jobs.length;
  }
}

renderSource();

if (reducedMotion) {
  showFinal(jobs[0]);
} else {
  runDemo();
}
