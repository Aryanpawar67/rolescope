#!/usr/bin/env node
// Run: node test-evaluator.mjs
//
// Step 1 — Runs TC-01 against the dev server to get 3-model analysis results, saves to tc01-runs.json
// Step 2 — Calls Claude Sonnet 4.6 directly (Anthropic SDK) with the evaluator prompt
// Step 3 — Saves raw Claude response to tc01-eval-raw.txt and parsed result to tc01-eval-result.json
//
// This lets you debug JSON parse failures by inspecting tc01-eval-raw.txt directly.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE       = "http://localhost:7001";
const RAW_FILE   = path.join(__dirname, "tc01-eval-raw.txt");
const RUNS_FILE  = path.join(__dirname, "tc01-runs.json");
const RESULT_FILE = path.join(__dirname, "tc01-eval-result.json");

// ── colour helpers ────────────────────────────────────────────────────────────
const c = { reset:"\x1b[0m", bold:"\x1b[1m", dim:"\x1b[2m", green:"\x1b[32m", red:"\x1b[31m", yellow:"\x1b[33m", cyan:"\x1b[36m" };
const bold   = s => `${c.bold}${s}${c.reset}`;
const dim    = s => `${c.dim}${s}${c.reset}`;
const green  = s => `${c.green}${s}${c.reset}`;
const red    = s => `${c.red}${s}${c.reset}`;
const yellow = s => `${c.yellow}${s}${c.reset}`;
const cyan   = s => `${c.cyan}${s}${c.reset}`;
const sep    = (ch="─",w=80) => console.log(dim(ch.repeat(w)));

// ── TC-01 definition ──────────────────────────────────────────────────────────
const TC01 = {
  orgName:    "Zeta Financial Technologies",
  industry:   "Fintech / Banking Technology",
  department: "Platform Engineering",
  job_profile_name: "Backend Software Engineer",
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

// ── JSON parse (mirrors server logic) ────────────────────────────────────────
function parseClaudeJson(raw) {
  let stripped = raw
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<thinking>[\s\S]*/gi, "")
    .trim();
  stripped = stripped.replace(/^```(?:json|javascript)?\s*/im, "").replace(/\s*```\s*$/m, "").trim();

  const firstBrace = stripped.indexOf("{");
  const lastBrace  = stripped.lastIndexOf("}");
  if (firstBrace === -1) throw new Error("No { found in response");
  const candidate = lastBrace > firstBrace
    ? stripped.slice(firstBrace, lastBrace + 1)
    : stripped.slice(firstBrace);

  return JSON.parse(candidate);
}

// ── Step 1: get or load model runs ───────────────────────────────────────────
async function getModelRuns() {
  if (fs.existsSync(RUNS_FILE)) {
    const age = (Date.now() - fs.statSync(RUNS_FILE).mtimeMs) / 1000 / 60;
    if (age < 60) {
      console.log(dim(`  Using cached runs from ${RUNS_FILE} (${age.toFixed(1)} min old)\n`));
      return JSON.parse(fs.readFileSync(RUNS_FILE, "utf8"));
    }
  }

  console.log(cyan("Step 1 — Running TC-01 against /api/full-analysis-multi …\n"));
  const start = Date.now();
  const res = await fetch(`${BASE}/api/full-analysis-multi`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jdText:     TC01.jdText,
      tasks:      TC01.tasks,
      orgName:    TC01.orgName,
      industry:   TC01.industry,
      job_profile_name: TC01.job_profile_name,
      department: TC01.department,
      profile:    null,
      models:     TC01.models,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Analysis failed: ${data.error ?? res.status}`);
  console.log(green(`  ✓ Analysis done in ${((Date.now()-start)/1000).toFixed(1)}s`));

  const runs = data.runs ?? {};
  fs.writeFileSync(RUNS_FILE, JSON.stringify(runs, null, 2));
  console.log(dim(`  Saved to ${RUNS_FILE}\n`));
  return runs;
}

// ── Step 2: call Claude evaluator directly ────────────────────────────────────
async function runEvaluator(runs) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set in .env");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const LABELS = { "azure-gpt-4o": "GPT-4o", "azure-gpt-5.3": "GPT-5.3", "azure-oss-120b": "OSS 120B" };

  const modelOutputs = Object.entries(runs).map(([modelId, run]) => ({
    modelId,
    modelLabel: LABELS[modelId] ?? modelId,
    emergingSkills:    run?.emerging?.emerging_skills   ?? [],
    diminishingSkills: run?.diminishing?.diminishing_skills ?? run?.diminishing?.skills ?? [],
  }));

  const tasksList = TC01.tasks.map((t, i) => `${i + 1}. ${t}`).join("\n");
  const today = new Date().toISOString().split("T")[0];

  const modelsSection = modelOutputs.map(m => {
    const emerging = m.emergingSkills.map((s, i) =>
      `  ${i+1}. ${s.skill_name}${s.category ? ` [${s.category}]` : ""}${s.confidence ? ` [${s.confidence}]` : ""}${s.reasoning ? ` — ${s.reasoning.slice(0,100)}` : ""}`
    ).join("\n") || "  (none)";
    const diminishing = m.diminishingSkills.map((s, i) =>
      `  ${i+1}. ${s.skill_name}${s.decline_reason ? ` [${s.decline_reason}]` : ""}${s.reasoning ? ` — ${s.reasoning.slice(0,100)}` : ""}`
    ).join("\n") || "  (none)";
    return `### ${m.modelLabel} (model_id: "${m.modelId}")
Emerging Skills (${m.emergingSkills.length}):
${emerging}

Diminishing Skills (${m.diminishingSkills.length}):
${diminishing}`;
  }).join("\n\n---\n\n");

  const system = `You are a senior workforce intelligence evaluator. Your role is to critically assess outputs from multiple AI models that analyzed a job profile for emerging and diminishing skills.

You do NOT generate new skills. You evaluate, compare, and score the existing model outputs against the source job description and task list.

Evaluation criteria:
- Groundedness: Is each skill explicitly or clearly implicitly supported by the JD?
- Role-specificity: Is it specific to THIS role/level, not a generic employability skill?
- Skill quality: Is it a genuine learnable, demonstrable skill — not a vague knowledge area, competency, or attribute?
- Signal strength for diminishing skills: Is there a genuine decline driver (AI automation, tool supersession, commoditization, legacy phase-out) relevant to THIS industry?
- Appropriate scope: Not too broad (e.g., "Digital Literacy"), not too narrow (e.g., a single keyboard shortcut).`;

  const user = `Today's date: ${today}

## Job Profile Context

Organisation: ${TC01.orgName}
Industry: ${TC01.industry}
Job Profile: ${TC01.job_profile_name}
Department: ${TC01.department}

## Job Description

${TC01.jdText}

## Tasks

${tasksList}

---

## Model Outputs to Evaluate

${modelsSection}

---

## Your Task

Step 1 — Reason first (inside a <thinking> block, do not skip):

For each model:
- Which emerging skills are clearly grounded in the JD vs speculative, generic, or not specific to this role?
- Which diminishing skills have genuine, industry-specific decline signals vs skills that are stable, thriving, or irrelevant?
- Are any labelled "skills" actually vague knowledge areas, broad competencies, or non-learnable attributes?

Across all models:
- Which skills appear in 2 or more models under the same or clearly equivalent name?
- Which model produces the most accurate, role-specific, and JD-grounded output?

## Output a JSON object with this exact structure:

{
  "job_profile_name": "string",
  "evaluation_date": "string",
  "model_evaluations": [
    {
      "model_id": "string",
      "model_label": "string",
      "emerging_score": 1,
      "diminishing_score": 1,
      "overall_score": 1,
      "strengths": "string",
      "weaknesses": "string",
      "flagged_skills": [
        { "skill_name": "string", "side": "emerging", "issue": "hallucination", "note": "string" }
      ]
    }
  ],
  "consensus": {
    "emerging":   [{ "skill_name": "string", "agreed_by": ["model_id_1"], "recommendation": "include" }],
    "diminishing":[{ "skill_name": "string", "agreed_by": ["model_id_1"], "recommendation": "include" }]
  },
  "recommended_model": "string",
  "recommended_model_rationale": "string",
  "overall_assessment": "string"
}

Rules:
- Scores are 1–10 integers
- Only flag genuine issues — not stylistic differences
- Consensus: a skill counts as agreed when 2+ models name it by the same or equivalent term
- agreed_by must be an array of model_id strings
- Return only valid JSON after the </thinking> block, no additional text`;

  console.log(cyan("Step 2 — Calling Claude Sonnet 4.6 directly …\n"));
  const start = Date.now();
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system,
    messages: [{ role: "user", content: user }],
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const raw = message.content[0].type === "text" ? message.content[0].text : "";

  console.log(green(`  ✓ Claude responded in ${elapsed}s — raw length: ${raw.length} chars`));
  fs.writeFileSync(RAW_FILE, raw);
  console.log(dim(`  Raw response saved to ${RAW_FILE}`));

  // Show thinking block presence
  const hasThinking = /<thinking>/i.test(raw);
  const hasFence    = /```/i.test(raw);
  console.log(dim(`  Has <thinking> block: ${hasThinking} | Has markdown fences: ${hasFence}\n`));

  return raw;
}

// ── Step 3: parse and display ─────────────────────────────────────────────────
function parseAndDisplay(raw) {
  sep("═");
  console.log(`\n${bold(cyan("Step 3 — Parsing Claude response"))}\n`);

  let parsed;
  try {
    parsed = parseClaudeJson(raw);
  } catch (err) {
    console.log(red(`  ✗ Parse failed: ${err.message}`));
    console.log(yellow(`\n  Raw response saved to: ${RAW_FILE}`));
    console.log(yellow("  Open it to inspect what Claude returned.\n"));

    // Show the candidate string that failed
    let stripped = raw
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
      .replace(/<thinking>[\s\S]*/gi, "")
      .trim()
      .replace(/^```(?:json|javascript)?\s*/im, "")
      .replace(/\s*```\s*$/m, "")
      .trim();
    const first = stripped.indexOf("{");
    const last  = stripped.lastIndexOf("}");
    const candidate = first !== -1
      ? (last > first ? stripped.slice(first, last + 1) : stripped.slice(first))
      : stripped;

    console.log(red("  Candidate start (first 500 chars):"));
    console.log(dim(candidate.slice(0, 500)));
    console.log(red("\n  Candidate end (last 300 chars):"));
    console.log(dim(candidate.slice(-300)));
    return;
  }

  fs.writeFileSync(RESULT_FILE, JSON.stringify(parsed, null, 2));
  console.log(green(`  ✓ Parsed successfully — saved to ${RESULT_FILE}\n`));

  // Display summary
  console.log(`${bold("Overall:")} ${parsed.overall_assessment}\n`);
  (parsed.model_evaluations ?? []).forEach(me => {
    const isRec = me.model_id === parsed.recommended_model;
    console.log(`  ${bold(me.model_label)}${isRec ? cyan(" ← recommended") : ""}`);
    console.log(`    Emerging: ${me.emerging_score}/10  Diminishing: ${me.diminishing_score}/10  Overall: ${me.overall_score}/10`);
    if (me.strengths)  console.log(`    ${green("✓")} ${me.strengths}`);
    if (me.weaknesses) console.log(`    ${red("✗")} ${me.weaknesses}`);
    (me.flagged_skills ?? []).forEach(f =>
      console.log(`    ${yellow("⚑")} [${f.side}] ${f.skill_name} — ${f.note}`)
    );
    console.log();
  });

  const ce = (parsed.consensus?.emerging   ?? []).filter(s => s.agreed_by?.length > 1);
  const cd = (parsed.consensus?.diminishing ?? []).filter(s => s.agreed_by?.length > 1);
  if (ce.length || cd.length) {
    console.log(bold("Consensus (2+ models agree):"));
    ce.forEach(s => console.log(`  ${green("↑")} ${s.skill_name} ${dim(`[${s.recommendation}]`)}`));
    cd.forEach(s => console.log(`  ${red("↓")} ${s.skill_name} ${dim(`[${s.recommendation}]`)}`));
    console.log();
  }

  if (parsed.recommended_model_rationale) {
    console.log(`${bold("Rationale:")} ${parsed.recommended_model_rationale}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
sep("═");
console.log(`\n${bold(cyan("Skills Evaluator — Standalone Debug Script"))}`);
console.log(dim("TC-01 · Zeta Fintech · Backend Software Engineer\n"));

try {
  // Check server is up
  const ping = await fetch(`${BASE}/api/stored-results`).catch(() => null);
  if (!ping?.ok) {
    console.log(red("✗ Server not reachable on port 7001. Start it with: npm run dev"));
    process.exit(1);
  }
  console.log(green("✓ Server reachable\n"));

  const runs = await getModelRuns();
  const modelIds = Object.keys(runs);
  console.log(`  Models with data: ${modelIds.map(id => {
    const r = runs[id];
    const e = r?.emerging?.emerging_skills?.length ?? 0;
    const d = r?.diminishing?.diminishing_skills?.length ?? r?.diminishing?.skills?.length ?? 0;
    return `${id} (↑${e} ↓${d})`;
  }).join(", ")}\n`);

  const raw = await runEvaluator(runs);
  parseAndDisplay(raw);
} catch (err) {
  console.log(red(`\nFatal: ${err.message}`));
  process.exit(1);
}

sep("═");
console.log(bold(green("\nDone.\n")));
