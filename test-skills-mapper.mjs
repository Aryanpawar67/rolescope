#!/usr/bin/env node
// Run: node test-skills-mapper.mjs
// Tests TC-01 and TC-02 from SKILLS_MAPPER_TEST_CASES.md against the running dev server.

const BASE = "http://localhost:7001";

// ── Colour helpers ────────────────────────────────────────────────────────────
const c = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
  green:  "\x1b[32m",
  red:    "\x1b[31m",
  yellow: "\x1b[33m",
  cyan:   "\x1b[36m",
  magenta:"\x1b[35m",
  blue:   "\x1b[34m",
};
const bold    = (s) => `${c.bold}${s}${c.reset}`;
const dim     = (s) => `${c.dim}${s}${c.reset}`;
const green   = (s) => `${c.green}${s}${c.reset}`;
const red     = (s) => `${c.red}${s}${c.reset}`;
const yellow  = (s) => `${c.yellow}${s}${c.reset}`;
const cyan    = (s) => `${c.cyan}${s}${c.reset}`;
const magenta = (s) => `${c.magenta}${s}${c.reset}`;

// ── Test cases ────────────────────────────────────────────────────────────────

const TC01 = {
  label: "TC-01 — Backend Software Engineer (Fintech)",
  orgName:    "Zeta Financial Technologies",
  industry:   "Fintech / Banking Technology",
  department: "Platform Engineering",
  jobTitle:   "Backend Software Engineer",
  jdText: `We are looking for a Backend Software Engineer to design, build, and maintain high-throughput APIs and microservices that power our core payment processing platform. You will work within a distributed systems environment handling millions of transactions daily.

You are expected to write production-grade code in Java and Python, own services end-to-end from design through deployment, and participate in on-call rotations. You will collaborate closely with product, mobile, and data engineering teams.

The role requires strong fundamentals in relational databases (PostgreSQL), message queuing (Kafka), and containerised deployments on AWS. Experience with gRPC, REST API design, and observability tooling (Datadog, OpenTelemetry) is expected. You will be responsible for writing technical design documents and conducting code reviews for junior engineers.

We are progressively adopting AI-assisted development tooling and expect engineers to evaluate and integrate these effectively into daily workflows.`,
  tasks: [
    "Design and implement RESTful and gRPC APIs for payment processing services",
    "Write and maintain unit, integration, and contract tests for backend services",
    "Conduct code reviews and provide technical mentoring to junior engineers",
    "Own service reliability through on-call participation and incident response",
    "Design Kafka-based event streaming pipelines for transaction data",
    "Write technical design documents for new features and architectural changes",
    "Instrument services with OpenTelemetry for distributed tracing and alerting",
    "Collaborate with data engineering to define schemas and data contracts",
    "Evaluate and integrate AI-assisted coding tools into team workflows",
    "Optimise PostgreSQL query performance and manage schema migrations",
  ],
  models: ["azure-gpt-4o", "azure-gpt-5.3", "azure-oss-120b"],
};

const TC02 = {
  label: "TC-02 — Frontend / UI Engineer (SaaS Product)",
  orgName:    "Notion Labs",
  industry:   "SaaS / Productivity Software",
  department: "Product Engineering",
  jobTitle:   "Frontend Engineer",
  jdText: `As a Frontend Engineer on our product team, you will build fast, accessible, and delightful user interfaces for our web application used by over 30 million people. You will work in a React + TypeScript codebase and own entire feature surfaces from design handoff through production shipping.

You will partner closely with designers using Figma, implement component libraries using our internal design system, and write end-to-end tests using Playwright. Performance budgets and Core Web Vitals are first-class concerns — you are expected to profile and optimise rendering bottlenecks.

We are increasingly using AI-powered features in the product itself (smart suggestions, summarisation, AI writing assistant) and engineers are expected to understand how to build interfaces that wrap LLM APIs effectively, handle streaming responses, and manage latency-sensitive UX patterns.

Experience with state management (Zustand, Jotai), server components (Next.js App Router), and accessibility standards (WCAG 2.2) is expected.`,
  tasks: [
    "Implement new product features in React and TypeScript from Figma designs",
    "Build and maintain reusable components in the internal design system",
    "Write end-to-end tests using Playwright for critical user flows",
    "Profile and optimise rendering performance using Chrome DevTools and web vitals",
    "Integrate LLM API calls and handle streaming text responses in the UI",
    "Implement accessible UI components meeting WCAG 2.2 standards",
    "Conduct design reviews and provide feedback on component specifications",
    "Manage client-side state using Zustand or Jotai across complex feature surfaces",
    "Ship features using Next.js App Router with server and client component boundaries",
    "Participate in frontend architecture decisions and technical roadmap planning",
  ],
  models: ["azure-gpt-4o", "azure-gpt-5.3", "azure-oss-120b"],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function separator(char = "─", width = 80) {
  console.log(dim(char.repeat(width)));
}

function printSkills(label, skills, color) {
  if (!skills?.length) {
    console.log(`  ${dim("(none)")}`);
    return;
  }
  skills.forEach((s, i) => {
    const name = s.skill_name ?? s;
    const conf = s.confidence ? dim(` [${s.confidence}]`) : "";
    const cat  = s.category   ? dim(` · ${s.category}`)  : "";
    console.log(`  ${color(`${i + 1}.`)} ${name}${conf}${cat}`);
    if (s.reasoning) {
      console.log(`     ${dim(s.reasoning.slice(0, 120))}${s.reasoning.length > 120 ? "…" : ""}`);
    }
  });
}

async function runTest(tc) {
  separator("═");
  console.log(`\n${bold(cyan(tc.label))}\n`);
  console.log(`${dim("Org:")} ${tc.orgName}   ${dim("Industry:")} ${tc.industry}   ${dim("Dept:")} ${tc.department}`);
  console.log(`${dim("Models:")} ${tc.models.join(", ")}\n`);

  const startMs = Date.now();
  let data;
  try {
    const res = await fetch(`${BASE}/api/full-analysis-multi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jdText:     tc.jdText,
        tasks:      tc.tasks,
        orgName:    tc.orgName,
        industry:   tc.industry,
        jobTitle:   tc.jobTitle,
        department: tc.department,
        profile:    null,
        models:     tc.models,
      }),
    });
    data = await res.json();
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    console.log(`${dim("Status:")} ${res.ok ? green(`${res.status} OK`) : red(`${res.status} ERROR`)}  ${dim(`(${elapsed}s)`)}\n`);

    if (!res.ok) {
      console.log(red(`  Error: ${data.error ?? JSON.stringify(data)}`));
      return;
    }
  } catch (err) {
    console.log(red(`  Fetch failed: ${err.message}`));
    console.log(red("  Is the dev server running on port 7001? Run: npm run dev"));
    return;
  }

  if (data.warnings?.length) {
    data.warnings.forEach(w => console.log(yellow(`  ⚠ ${w}`)));
    console.log();
  }

  const runs = data.runs ?? {};
  const modelIds = Object.keys(runs);

  if (!modelIds.length) {
    console.log(red("  No model runs returned."));
    console.log(dim("  Raw response:"), JSON.stringify(data, null, 2).slice(0, 500));
    return;
  }

  for (const modelId of modelIds) {
    const run = runs[modelId];
    separator();
    const label = {
      "azure-gpt-4o":     "GPT-4o",
      "azure-gpt-5.3":    "GPT-5.3",
      "azure-oss-120b":   "OSS 120B",
      "claude-sonnet-4-6":"Claude Sonnet",
    }[modelId] ?? modelId;

    const emerging    = run?.emerging?.emerging_skills    ?? [];
    const diminishing = run?.diminishing?.diminishing_skills ?? run?.diminishing?.skills ?? [];

    console.log(`\n${bold(magenta(label))}  ${green(`↑ ${emerging.length} emerging`)}  ${red(`↓ ${diminishing.length} diminishing`)}`);

    if (run?.warnings?.length) {
      run.warnings.forEach(w => console.log(yellow(`  ⚠ ${w}`)));
    }

    if (!emerging.length && !diminishing.length) {
      console.log(red("  ✗ No data returned for this model"));
      if (run?.emerging === null || run?.diminishing === null) {
        console.log(dim("  (run object exists but both sides are null — likely an API/parse error)"));
      }
      continue;
    }

    console.log(`\n  ${bold(green("Emerging Skills"))}`);
    printSkills("emerging", emerging, green);

    console.log(`\n  ${bold(red("Diminishing Skills"))}`);
    printSkills("diminishing", diminishing, red);

    console.log();
  }

  // ── Run evaluate ────────────────────────────────────────────────────────────
  const runsWithData = modelIds.filter(mid => {
    const r = runs[mid];
    return (r?.emerging?.emerging_skills?.length ?? 0) > 0 ||
           (r?.diminishing?.diminishing_skills?.length ?? r?.diminishing?.skills?.length ?? 0) > 0;
  });

  if (runsWithData.length >= 2) {
    separator("─");
    console.log(`\n${bold(cyan("Claude Evaluator"))} ${dim("(calling /api/evaluate-skills-multi…)")}\n`);
    const evalStart = Date.now();
    try {
      const evalRes = await fetch(`${BASE}/api/evaluate-skills-multi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runs:       runs,
          jdText:     tc.jdText,
          tasks:      tc.tasks,
          orgName:    tc.orgName,
          industry:   tc.industry,
          department: tc.department,
          jobTitle:   tc.jobTitle,
        }),
      });
      const evalData = await evalRes.json();
      const evalElapsed = ((Date.now() - evalStart) / 1000).toFixed(1);
      console.log(`${dim("Eval status:")} ${evalRes.ok ? green("OK") : red("ERROR")}  ${dim(`(${evalElapsed}s)`)}\n`);

      if (!evalRes.ok) {
        console.log(red(`  Error: ${evalData.error}`));
      } else {
        if (evalData.overall_assessment) {
          console.log(`${bold("Overall:")} ${evalData.overall_assessment}\n`);
        }

        (evalData.model_evaluations ?? []).forEach(me => {
          const isRec = me.model_id === evalData.recommended_model;
          const tag = isRec ? cyan(" ← recommended") : "";
          console.log(`  ${bold(me.model_label)}${tag}`);
          console.log(`    Emerging: ${me.emerging_score}/10   Diminishing: ${me.diminishing_score}/10   Overall: ${me.overall_score}/10`);
          if (me.strengths)  console.log(`    ${green("✓")} ${me.strengths}`);
          if (me.weaknesses) console.log(`    ${red("✗")} ${me.weaknesses}`);
          if (me.flagged_skills?.length) {
            me.flagged_skills.forEach(f => {
              console.log(`    ${yellow("⚑")} [${f.side}] ${f.skill_name} — ${f.note}`);
            });
          }
          console.log();
        });

        const ce = (evalData.consensus?.emerging   ?? []).filter(c => c.agreed_by?.length > 1);
        const cd = (evalData.consensus?.diminishing ?? []).filter(c => c.agreed_by?.length > 1);
        if (ce.length || cd.length) {
          console.log(bold("Consensus skills (2+ models agree):"));
          ce.forEach(s => console.log(`  ${green("↑")} ${s.skill_name} ${dim(`[${s.recommendation}]`)}`));
          cd.forEach(s => console.log(`  ${red("↓")} ${s.skill_name} ${dim(`[${s.recommendation}]`)}`));
          console.log();
        }

        if (evalData.recommended_model_rationale) {
          console.log(`${bold("Rationale:")} ${evalData.recommended_model_rationale}`);
        }
      }
    } catch (err) {
      console.log(red(`  Evaluator fetch failed: ${err.message}`));
    }
  } else {
    console.log(dim("\n  (Skipping evaluator — fewer than 2 models returned data)"));
  }

  console.log();
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n${bold(cyan("Skills Mapper — Terminal Test Runner"))}`);
console.log(dim("Running TC-01 and TC-02 against http://localhost:7001\n"));

// Check server is up first
try {
  const ping = await fetch(`${BASE}/api/stored-results`);
  if (!ping.ok) throw new Error(`status ${ping.status}`);
  console.log(green("✓ Server reachable on port 7001\n"));
} catch {
  console.log(red("✗ Cannot reach server on port 7001."));
  console.log(yellow("  Start it with:  npm run dev   (or: node --loader ts-node/esm server.ts)\n"));
  process.exit(1);
}

await runTest(TC01);
await runTest(TC02);

separator("═");
console.log(bold(green("\nDone.\n")));
