import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import multer from "multer";
import { createRequire } from "module";
import mammoth from "mammoth";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { buildSkillsPipelinePrompt } from "./src/prompts/skills-pipeline.js";
import { buildDiminishingSkillsPrompt } from "./src/prompts/diminishing-skills.js";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Excel file lives in data/ inside the project so it deploys to Vercel
const EXCEL_PATH = path.resolve(__dirname, "data/job-profiles.xlsx");
// Results file: writable locally, gracefully skipped on read-only filesystems (Vercel)
const RESULTS_PATH = path.resolve(__dirname, "../analysis-results.json");

// xlsx is CommonJS-only
const requireCJS = createRequire(import.meta.url);
const XLSX = requireCJS("xlsx") as typeof import("xlsx");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.post("/api/parse-file", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });

  const { mimetype, originalname, buffer } = req.file;
  const ext = originalname.split(".").pop()?.toLowerCase();

  try {
    let text = "";

    if (mimetype === "application/pdf" || ext === "pdf") {
      const require = createRequire(import.meta.url);
      const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
      const result = await pdfParse(buffer);
      text = result.text;
    } else if (
      mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === "docx"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (mimetype === "text/plain" || ext === "txt" || ext === "md") {
      text = buffer.toString("utf-8");
    } else {
      return res.status(400).json({ error: `Unsupported file type: ${ext}` });
    }

    if (!text.trim()) return res.status(422).json({ error: "Could not extract text from file." });
    res.json({ text: text.trim() });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to parse file." });
  }
});

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.post("/api/extract", async (req, res) => {
  const { jdText } = req.body;
  if (!jdText?.trim()) {
    return res.status(400).json({ error: "No job description text provided." });
  }

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are a workforce analyst with deep expertise in role decomposition and task taxonomy design. You have studied thousands of job profiles across IT, BFSI, manufacturing, healthcare, and professional
  services. You understand the difference between what a JD says and what a person actually does day-to-day — you look past corporate language to identify the real, recurring work activities that define
   a role.                                                                                                                                                                                                
                                                                                                                                                                                                          
  Your job: read a Job Description and extract the concrete, tasks someone in this role would perform weekly or monthly.                                                                        
  
  WHAT COUNTS AS A TASK:                                                                                                                                                                                  
  - Observable work activities with a clear output — something a manager could verify was done
  - Starts with an active verb: Design, Implement, Review, Coordinate, Analyze, Build, Conduct, Prepare, Monitor, Develop, Execute, Evaluate, Configure, Investigate, Draft, Maintain                     
  - Specific to THIS role — not something any employee at the company does                                                                                                                                
                                                                                                                                                                                                          
  - Soft skill statements: "Communicate effectively", "Collaborate with cross-functional teams", "Build relationships with stakeholders", "Work independently and in teams"                               
  - Vague outcome statements: "Drive results", "Ensure quality", "Support business objectives", "Contribute to team success", "Manage relationships"                                                      
  - Compliance platitudes: "Ensure compliance with company policies", "Adhere to industry standards", "Maintain confidentiality"                                                                          
  - Attribute descriptions: "Strong attention to detail", "Excellent problem-solving skills"                                                                                                              
  - Requirements/qualifications: education, years of experience, certifications — these are NOT tasks                                                                                                     
                                                                                                                                                                                                          
  EXTRACTION RULES:                                                                                                                                                                                       
  1. Extract between 5 and 15 tasks. But if the JD genuinely only supports fewer than 5 real tasks, return fewer. NEVER pad with generic filler to reach 5. Accuracy over quantity.                       
  2. If the JD contains an explicit responsibilities list, extract and refine those first. Then look for implied tasks in the requirements or context sections.                                           
  3. Each task name must be under 100 characters. If longer, truncate the name and put the full text in the description.                                                                                  
  4. Deduplicate: if the JD states the same responsibility in two different ways, extract it once — pick the more specific version.
  5. Choose the right granularity: tasks should be at the level of a weekly/monthly work activity, not a quarterly project and not a 10-minute subtask. "Conduct code reviews for pull requests" is right.
   "Manage the software development lifecycle" is too broad. "Open the PR link in the browser" is too granular.                                                                                           
                                                                                                                                                                                                          
  PRIORITY SCORING — infer how central each task is to the role:
  - "core": This is what the role exists to do. These tasks appear first in the JD, get the most description, or are directly tied to the role title. A hiring manager would say "if you don't do this    
  well, you fail in this role."                                                                                                                                                                       
  - "supporting": Important tasks that enable or complement core work. Mentioned in the JD but with less emphasis. The role would function without them, but worse.                                       
  - "peripheral": Real tasks that exist but are infrequent, minor in scope, or clearly subordinate. Often implied or mentioned briefly.                            
                                                                                                                                                                                                          
  PRIORITY SIGNALS to look for in the JD:                   
  - Order: Responsibilities listed first or given the most description tend to be core                                                                                                                    
  - Emphasis language: "primary responsibility", "main focus", "lead", "own", "drive" → core
  - Frequency cues: "daily", "ongoing", "regularly" → core; "as needed", "occasionally", "support" → peripheral                                                                                           
  - Role title alignment: Tasks that directly reflect the job title are core                                   
  - Explicit vs. implied: Stated responsibilities outrank inferred ones in priority                                                                                                                       
                                                                                   
  REASONING (critical for customer trust):                                                                                                                                                                
  For each task, explain WHY you extracted it by doing ONE of the following:                                                                                                                              
  - QUOTE: If the JD explicitly states it, quote the exact phrase: "The JD states: '[exact phrase]'"
  - INFER: If implied, explain the inference chain: "The JD requires [X skill/tool] and mentions [Y responsibility], which in practice involves this task"                                                
  - PATTERN: If based on role knowledge, say so: "Not explicitly stated, but standard for [role type] roles based on the [specific context from JD]"      
  Never just restate the task as the reasoning.                                                                                                                                                           
                                                                                                                                                                                                          
  CATEGORY (pick the primary one):                                                                                                                                                                        
  - "Technical": Hands-on building, coding, configuring, testing, debugging, architecture                                                                                                                 
  - "Analytical": Data analysis, reporting, research, metrics, evaluation, auditing      
  - "Operational": Process execution, coordination, scheduling, logistics, maintenance
  - "Leadership": People management, mentoring, decision-making, strategy, planning                                                                                                                       
  - "Client-facing": Sales, customer interaction, presentations, demos, support    
                                                                                                                                                                                                          
  OUTPUT FORMAT — respond ONLY with valid JSON:                                                                                                                                                           
  {                                            
    "tasks": [                                                                                                                                                                                            
      {                                                     
        "name": "...",
        "description": "...",
        "reasoning": "...",  
        "priority": "core|supporting|peripheral",
        "category": "..."                                                                                                                                                                                 
      }                  
    ],                                                                                                                                                                                                    
    "summary": "A one-line summary of the role as interpreted from the JD",
    "quality_notes": "Any concerns about the JD quality that affected inference — e.g., too vague, mostly requirements, very short. Use null if no concerns."
  }
                                                                                                                                                                                                          
  Do not include any text outside the JSON.

Job Description:
${jdText}`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    // Enrich each task with derived confidence — no prompt change needed
    if (Array.isArray(parsed.tasks)) {
      parsed.tasks = parsed.tasks.map((t: any) => ({
        ...t,
        confidence: deriveConfidence(t.reasoning ?? ""),
      }));
    }

    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to extract tasks." });
  }
});

// Derive confidence from the reasoning tag written by the extractor prompt
function deriveConfidence(reasoning: string): { score: number; source: "QUOTE" | "INFER" | "PATTERN" } {
  const upper = reasoning.toUpperCase();
  if (upper.startsWith("QUOTE") || upper.includes("THE JD STATES"))
    return { score: 0.9, source: "QUOTE" };
  if (upper.startsWith("INFER") || upper.includes("THE JD REQUIRES"))
    return { score: 0.65, source: "INFER" };
  return { score: 0.4, source: "PATTERN" };
}

app.post("/api/evaluate", async (req, res) => {
  const { jdText, tasks } = req.body;
  if (!jdText?.trim() || !Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: "jdText and tasks are required." });
  }

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are an impartial evaluator reviewing the output of a JD task-extraction system.

Given the original Job Description and a list of extracted tasks, score each task on three dimensions (1–5 each):

- groundedness: Is this task actually supported by the JD? (5 = explicitly stated, 1 = hallucinated or contradicted)
- specificity: Is this task specific to THIS role, not a generic responsibility any employee has? (5 = highly role-specific, 1 = completely generic)
- actionability: Does it describe a concrete, verifiable work activity with a clear output? (5 = highly actionable, 1 = vague or unmeasurable)

Also provide:
- overall_quality: integer 1–10 rating of the full extraction
- missed_tasks: array of strings — important responsibilities in the JD that were NOT extracted (empty array if none)
- hallucinated_tasks: array of task names that have no basis in the JD (empty array if none)

Return ONLY valid JSON in this exact shape:
{
  "task_scores": [
    { "name": "...", "groundedness": 1-5, "specificity": 1-5, "actionability": 1-5 }
  ],
  "overall_quality": 1-10,
  "missed_tasks": ["..."],
  "hallucinated_tasks": ["..."]
}

Job Description:
${jdText}

Extracted Tasks:
${JSON.stringify(tasks, null, 2)}`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const evaluation = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    res.json(evaluation);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to evaluate." });
  }
});

async function runStandardPrompt(task: string) {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are an automation strategist who evaluates work tasks and recommends the most practical automation approach using modern tools available today.

For the task, produce ONE best automation suggestion.

AUTOMATION TYPES — pick the most fitting:
- "script": A Python/JS/shell script handles this reliably
- "no-code": Best handled by a no-code tool (Zapier, Make, n8n, Airtable)
- "ai-agent": Requires reasoning or unstructured input — best as an AI agent
- "integration": A direct API-to-API integration, no logic layer needed
- "workflow": Multi-step orchestration combining triggers, conditions, and actions

CONFIDENCE SCORING (0.0 to 1.0) — how automatable is this task:
- 0.85–1.0 High: Repetitive, rule-based, structured data, clear trigger and output
- 0.50–0.84 Medium: Partially automatable; requires some human judgment
- 0.10–0.49 Low: Requires domain knowledge, creativity, or interpersonal skill

Set confidence_label: "High" if ≥0.85, "Medium" if ≥0.50, "Low" otherwise.

EXPLANATION — 1–2 sentences: why this confidence level, and what makes the task more or less automatable.

TOOLS — list 1–3 specific tools or technologies best suited for this automation.

Return ONLY valid JSON:
{
  "task": "<echoed input task>",
  "suggestion_name": "<short memorable name for this automation>",
  "type": "script|no-code|ai-agent|integration|workflow",
  "description": "<what this automation does, 1-2 sentences>",
  "confidence": 0.0-1.0,
  "confidence_label": "High|Medium|Low",
  "explanation": "<why this confidence, what makes it automatable or not>",
  "tools_mentioned": ["Tool1", "Tool2"]
}

Do not include any text outside the JSON.

Task: ${task}`,
      },
    ],
  });
  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
}

async function runEnterprisePrompt(task: string, job_profile: string, department: string, industry: string) {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are an AI Automation Assessment Engine built for enterprise HR and workforce planning.

Your role is to evaluate how automatable a specific workplace task is using AI and
automation technologies available today (as of early 2026) — including large language
models, robotic process automation (RPA), computer vision, agentic AI systems, and
intelligent document processing.

You will be given a task with its job profile, department, and industry context.
Evaluate the task against 7 defined dimensions, calculate an automation score,
assign a category, and provide clear reasoning an HR admin can act on.

---

## EVALUATION DIMENSIONS

Score each dimension from 0 to 100 with a one-line rationale.

### Dimensions where a HIGH score increases automation potential:

1. TASK ROUTINENESS (weight: 25%)
   How predictable, repetitive, and rule-governed is this task?
   100 = follows a fixed procedure every time, no variation
   0   = every instance requires a different approach or judgment call

2. DATA & INFORMATION PROCESSING (weight: 20%)
   Is the core work about handling data, documents, text, or digital information?
   100 = purely information-based (reading, classifying, extracting, generating)
   0   = no data processing involved

3. INPUT PREDICTABILITY (weight: 15%)
   How structured and consistent are the inputs to this task?
   100 = inputs always arrive in the same predictable format
   0   = inputs are highly variable, ambiguous, or unstructured each time

### Dimensions where a HIGH score DECREASES automation potential:

4. PHYSICAL REQUIREMENT (weight: 15%)
   Does the task require physical actions, dexterity, or presence in a specific location?
   100 = requires significant physical presence or manual dexterity
   0   = fully digital, no physical component

5. SOCIAL & EMOTIONAL COMPLEXITY (weight: 10%)
   Does the task require empathy, trust-building, negotiation, or reading human dynamics?
   100 = deep human connection is central to the task's success
   0   = no meaningful human interaction required

6. CREATIVE & JUDGMENT DEMAND (weight: 10%)
   Does the task require original thinking, ethical judgment, or nuanced contextual
   decisions that cannot be reduced to rules?
   100 = heavily relies on novel creative output or irreducible human judgment
   0   = fully rule-specifiable, no judgment required

7. CONSEQUENCE OF ERROR (weight: 5%)
   How severe are the consequences if AI makes a mistake on this task?
   Consider: financial, legal, safety, or reputational impact.
   100 = a single error could be catastrophic or irreversible
   0   = errors are trivial and easily caught or corrected

---

## SCORING FORMULA

Automation Score =
  (Task Routineness × 0.25)
+ (Data & Information Processing × 0.20)
+ (Input Predictability × 0.15)
+ ((100 − Physical Requirement) × 0.15)
+ ((100 − Social & Emotional Complexity) × 0.10)
+ ((100 − Creative & Judgment Demand) × 0.10)
+ ((100 − Consequence of Error) × 0.05)

Round to the nearest whole number. The result will be between 0 and 100.

---

## AUTOMATION CATEGORIES

| Score   | Category     | Meaning                                                          |
|---------|--------------|------------------------------------------------------------------|
| 67–100  | AI-Led       | Can be fully or largely automated today with current AI tools    |
| 34–66   | AI Assisted  | AI augments significantly; human judgment required for key steps |
| 0–33    | Human-Led    | Human-led; AI can assist only in limited, peripheral ways        |

---

## OUTPUT FORMAT

Return a valid JSON object with this exact structure:

{
  "task_name": "<task name>",
  "job_profile": "<job profile name>",
  "department": "<department>",
  "industry": "<industry>",
  "automation_score": <0-100>,
  "automation_category": "<AI-Led | AI Assisted | Human-Led>",
  "dimensions": {
    "task_routineness":            { "score": <0-100>, "rationale": "<one sentence>" },
    "data_information_processing": { "score": <0-100>, "rationale": "<one sentence>" },
    "input_predictability":        { "score": <0-100>, "rationale": "<one sentence>" },
    "physical_requirement":        { "score": <0-100>, "rationale": "<one sentence>" },
    "social_emotional_complexity": { "score": <0-100>, "rationale": "<one sentence>" },
    "creative_judgment_demand":    { "score": <0-100>, "rationale": "<one sentence>" },
    "consequence_of_error":        { "score": <0-100>, "rationale": "<one sentence>" }
  },
  "reasoning": "<2-3 sentence plain-English explanation of why this task scored the way it did. Mention which dimensions drove the score up or down. Write for an HR admin, not a data scientist.>",
  "ai_tools_applicable": ["<specific AI/automation tool or capability that could handle this task today>"],
  "human_oversight_recommendation": "<one sentence on what, if any, human role should remain even if the task is automated>"
}

Do not include any text outside the JSON object.

Task: ${task}
Job Profile: ${job_profile || "Not specified"}
Department: ${department || "Not specified"}
Industry: ${industry || "Not specified"}`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
}

app.post("/api/automate", async (req, res) => {
  const { task, job_profile, department, industry } = req.body;
  if (!task?.trim())
    return res.status(400).json({ error: "task is required." });

  try {
    const [standard, enterprise] = await Promise.all([
      runStandardPrompt(task.trim()),
      runEnterprisePrompt(task.trim(), job_profile || "", department || "", industry || ""),
    ]);
    res.json({ standard, enterprise });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Assessment failed." });
  }
});

// ── Excel Job Profiles ──────────────────────────────────────────────────────

interface JobProfile {
  id: number;
  title: string;
  subFamily: string;
  family: string;
  branch: string;
  level: string;
  careerLevel: string;
  purpose: string;
  tasks: Array<{ name: string; proficiency: string }>;
  managementTasks: string;
  groupResponsibility: string;
  languageSkills: string;
  education: string;
  experience: string;
  professionalKnowledge: string[];
  managementExperience: string;
  competencies: Array<{ name: string; description: string }>;
}

function stripPrefix(val: string | null | undefined, prefix: string): string {
  if (!val) return "";
  return val.replace(prefix, "").trim();
}

function parseTask(raw: string): { name: string; proficiency: string } {
  const separators = [" - Performs Independently", " - Contributes", " - Leads", " - Manages", " - Hozza"];
  for (const sep of separators) {
    const idx = raw.lastIndexOf(sep);
    if (idx !== -1) {
      return { name: raw.slice(0, idx).trim(), proficiency: raw.slice(idx + 3).trim() };
    }
  }
  return { name: raw.trim(), proficiency: "" };
}

function loadJobProfiles(): JobProfile[] {
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets["Quality Check1"];
  const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });

  const getCell = (rowIdx: number, colIdx: number): string => {
    const row = data[rowIdx];
    if (!row) return "";
    const val = row[colIdx];
    return val ? String(val).trim() : "";
  };

  const profiles: JobProfile[] = [];
  const numCols = 16;

  for (let col = 0; col < numCols; col++) {
    const title = stripPrefix(getCell(2, col), "Job Title: ");
    if (!title) continue;

    // Tasks: rows 19–30 (0-indexed)
    const tasks: Array<{ name: string; proficiency: string }> = [];
    for (let r = 19; r <= 30; r++) {
      const raw = getCell(r, col);
      if (raw && raw !== '"No value selected for this section"') {
        tasks.push(parseTask(raw));
      }
    }

    // Professional knowledge: rows 57–62
    const profKnowledge: string[] = [];
    for (let r = 57; r <= 62; r++) {
      const raw = getCell(r, col);
      if (raw) profKnowledge.push(raw);
    }

    // Competencies: rows 79–88, alternating name/description
    const competencies: Array<{ name: string; description: string }> = [];
    const compRows = [79, 81, 83, 85, 87];
    for (const nameRow of compRows) {
      const name = getCell(nameRow, col);
      const desc = getCell(nameRow + 1, col);
      if (name) competencies.push({ name, description: desc });
    }

    const mgmt = getCell(37, col);
    const mgmtExp = getCell(74, col);

    profiles.push({
      id: col + 1,
      title,
      subFamily: stripPrefix(getCell(3, col), "Job Sub-Family: "),
      family: stripPrefix(getCell(4, col), "Job Family: "),
      branch: stripPrefix(getCell(5, col), "Job Branch: "),
      level: stripPrefix(getCell(6, col), "Job Level: "),
      careerLevel: stripPrefix(getCell(7, col), "Career Level: "),
      purpose: getCell(12, col),
      tasks,
      managementTasks: mgmt === '"No value selected for this section"' ? "" : mgmt,
      groupResponsibility: getCell(41, col),
      languageSkills: getCell(45, col),
      education: getCell(49, col),
      experience: getCell(53, col),
      professionalKnowledge: profKnowledge,
      managementExperience: mgmtExp === '"No value selected for this section"' ? "" : mgmtExp,
      competencies,
    });
  }

  return profiles;
}

let cachedProfiles: JobProfile[] | null = null;

function getProfiles(): JobProfile[] {
  if (!cachedProfiles) cachedProfiles = loadJobProfiles();
  return cachedProfiles;
}

app.get("/api/job-profiles", (_req, res) => {
  try {
    res.json(getProfiles());
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load job profiles." });
  }
});

// ── Skills Pipeline ──────────────────────────────────────────────────────────

function deriveSkillsList(professionalKnowledge: string[]): string {
  return professionalKnowledge.map((k, i) => `${i + 1}. ${k}`).join("\n") || "Not specified";
}

function deriveCapabilitiesList(competencies: Array<{ name: string; description: string }>): string {
  return competencies.map((c) => `- ${c.name}: ${c.description}`).join("\n") || "Not specified";
}

function deriveSkillCapabilityMapping(
  professionalKnowledge: string[],
  competencies: Array<{ name: string; description: string }>
): string {
  if (!professionalKnowledge.length || !competencies.length) return "Not specified";
  return competencies.map((c) => {
    const related = professionalKnowledge.filter((k) =>
      k.toLowerCase().split(" ").some((w) => w.length > 4 && c.name.toLowerCase().includes(w))
    );
    return `${c.name} ← ${related.length ? related.map((k) => k.slice(0, 60)).join("; ") : "general technical knowledge"}`;
  }).join("\n");
}

function deriveTaskSkillMapping(
  tasks: Array<{ name: string; proficiency: string }>,
  professionalKnowledge: string[]
): string {
  if (!tasks.length) return "Not specified";
  return tasks.map((t) => {
    const related = professionalKnowledge.filter((k) =>
      k.toLowerCase().split(" ").some((w) => w.length > 5 && t.name.toLowerCase().includes(w))
    );
    return `${t.name} → ${related.length ? related[0].slice(0, 80) : "general professional knowledge"}`;
  }).join("\n");
}

app.post("/api/skills-pipeline", async (req, res) => {
  const { jdText, tasks } = req.body;
  if (!jdText?.trim()) return res.status(400).json({ error: "jdText is required." });
  if (!Array.isArray(tasks) || tasks.length === 0)
    return res.status(400).json({ error: "tasks array is required." });
  try {
    const input = buildPipelineInput(req.body);
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: buildSkillsPipelinePrompt(input) }],
    });
    const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
    res.json(parseClaudeJson(raw));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Skills pipeline failed." });
  }
});

// ── Storage helpers ───────────────────────────────────────────────────────────

function readResults(): Record<string, any> {
  try {
    return fs.existsSync(RESULTS_PATH) ? JSON.parse(fs.readFileSync(RESULTS_PATH, "utf-8")) : {};
  } catch { return {}; }
}

function writeResults(data: Record<string, any>): void {
  try { fs.writeFileSync(RESULTS_PATH, JSON.stringify(data, null, 2), "utf-8"); } catch { /* read-only on Vercel */ }
}

app.get("/api/stored-results", (_req, res) => {
  res.json(readResults());
});

app.delete("/api/stored-results/:profileId", (req, res) => {
  const all = readResults();
  delete all[req.params.profileId];
  writeResults(all);
  res.json({ ok: true });
});

// ── Shared input builder ──────────────────────────────────────────────────────

function buildPipelineInput(body: any) {
  const { jdText, tasks, orgName, industry, jobTitle, department, profile } = body;
  const profKnowledge: string[] = profile?.professionalKnowledge ?? [];
  const competencies: Array<{ name: string; description: string }> = profile?.competencies ?? [];
  const profileTasks: Array<{ name: string; proficiency: string }> = profile?.tasks ?? [];
  const resolvedTasks = profileTasks.length
    ? profileTasks
    : (tasks as string[]).map((t) => ({ name: t, proficiency: "" }));
  return {
    orgName: orgName?.trim() || "",
    industry: industry?.trim() || "",
    jobTitle: jobTitle?.trim() || profile?.title || "",
    department: department?.trim() || profile?.subFamily || "",
    jdText: jdText.trim(),
    skillsList: deriveSkillsList(profKnowledge),
    capabilitiesList: deriveCapabilitiesList(competencies),
    skillCapabilityMapping: deriveSkillCapabilityMapping(profKnowledge, competencies),
    tasksList: resolvedTasks.map((t, i) => `${i + 1}. ${t.name}`).join("\n"),
    taskSkillMapping: deriveTaskSkillMapping(resolvedTasks, profKnowledge),
  };
}

function parseClaudeJson(raw: string): any {
  const stripped = raw.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]);
  } catch {
    // Truncated JSON — attempt to extract partial skills array before bailing
    console.error("[parseClaudeJson] JSON.parse failed, raw length:", match[0].length);
    return {};
  }
}

// ── Diminishing Skills Pipeline ───────────────────────────────────────────────

app.post("/api/diminishing-skills", async (req, res) => {
  const { jdText, tasks } = req.body;
  if (!jdText?.trim()) return res.status(400).json({ error: "jdText is required." });
  if (!Array.isArray(tasks) || tasks.length === 0)
    return res.status(400).json({ error: "tasks array is required." });

  try {
    const input = buildPipelineInput(req.body);
    const prompt = buildDiminishingSkillsPrompt(input);
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
    res.json(parseClaudeJson(raw));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Diminishing skills pipeline failed." });
  }
});

// ── Full Analysis (both pipelines in parallel + auto-save) ────────────────────

app.post("/api/full-analysis", async (req, res) => {
  const { jdText, tasks, profile } = req.body;
  if (!jdText?.trim()) return res.status(400).json({ error: "jdText is required." });
  if (!Array.isArray(tasks) || tasks.length === 0)
    return res.status(400).json({ error: "tasks array is required." });

  try {
    const input = buildPipelineInput(req.body);

    const [emergingRaw, diminishingRaw] = await Promise.all([
      client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        messages: [{ role: "user", content: buildSkillsPipelinePrompt(input) }],
      }),
      client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        messages: [{ role: "user", content: buildDiminishingSkillsPrompt(input) }],
      }),
    ]);

    const emerging = parseClaudeJson(
      emergingRaw.content[0].type === "text" ? emergingRaw.content[0].text : "{}"
    );
    const diminishing = parseClaudeJson(
      diminishingRaw.content[0].type === "text" ? diminishingRaw.content[0].text : "{}"
    );

    const profileId = `profile_${profile?.id ?? Date.now()}`;
    const record = {
      profileId,
      profile: profile ?? null,
      orgName: input.orgName,
      industry: input.industry,
      department: input.department,
      analyzedAt: new Date().toISOString(),
      emerging,
      diminishing,
    };

    const all = readResults();
    all[profileId] = record;
    writeResults(all);

    res.json(record);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Full analysis failed." });
  }
});

// ── Skill Validation ─────────────────────────────────────────────────────────

app.post("/api/validate-skills", async (req, res) => {
  const { emerging = [], diminishing = [], jobTitle = "", industry = "" } = req.body;
  const allNames: string[] = [
    ...emerging.map((s: any) => s.skill_name ?? s),
    ...diminishing.map((s: any) => s.skill_name ?? s),
  ].filter(Boolean);

  if (!allNames.length) return res.status(400).json({ error: "No skill names provided." });

  const prompt = `You are a skills taxonomy expert. Your job is to review a list of items extracted from a job role analysis and determine whether each one is a genuine, learnable, demonstrable SKILL or something else.

Context: Role = "${jobTitle}", Industry = "${industry}"

DEFINITIONS:
- "skill": A specific, learnable, practisable capability with a demonstrable output. Examples: "Prompt Engineering", "CI/CD Pipeline Design", "SQL Query Optimisation".
- "knowledge": A broad awareness or information domain — not something you practice or improve through repetition. Examples: "Basic customer knowledge", "Business line knowledge", "Industry awareness".
- "competency": A behavioural or cognitive trait, not a discrete learnable item. Examples: "Stakeholder Influence", "Analytical Thinking", "Problem Anticipation".
- "experience": A past exposure, not a skill. Examples: "Project management experience", "Client-facing experience".
- "too_vague": Too generic to be actionable. Examples: "IT knowledge", "Technical skills", "Digital awareness".

TASK: For each item, return:
- verdict: "skill" | "knowledge" | "competency" | "experience" | "too_vague"
- reason: one short sentence explaining why
- suggested: if verdict is NOT "skill", provide a rephrased version that would be a proper skill name (or null if it should be removed entirely)

Items to validate:
${allNames.map((n, i) => `${i + 1}. ${n}`).join("\n")}

Return ONLY valid JSON:
{
  "results": [
    { "name": "...", "verdict": "skill|knowledge|competency|experience|too_vague", "reason": "...", "suggested": "..." | null }
  ]
}`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content[0].type === "text" ? msg.content[0].text : "{}";
    res.json(parseClaudeJson(raw));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Validation failed." });
  }
});

// ── Skills Report (XLSX export) ───────────────────────────────────────────────

import ExcelJS from "exceljs";

const REPORT_PATH = path.resolve(__dirname, "data/skills-analysis-report.xlsx");

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" },
};
const EMERGING_FILL: ExcelJS.Fill = {
  type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E9" },
};
const DIMINISHING_FILL: ExcelJS.Fill = {
  type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4EC" },
};
const META_FILL: ExcelJS.Fill = {
  type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" },
};
const SEPARATOR_FILL: ExcelJS.Fill = {
  type: "pattern", pattern: "solid", fgColor: { argb: "FFBDBDBD" },
};

function applyBorder(cell: ExcelJS.Cell, style: ExcelJS.BorderStyle = "thin") {
  const b = { style, color: { argb: "FFBDBDBD" } };
  cell.border = { top: b, left: b, bottom: b, right: b };
}

function applyThickBorder(cell: ExcelJS.Cell) {
  const thick = { style: "medium" as ExcelJS.BorderStyle, color: { argb: "FF1F3864" } };
  cell.border = { top: thick, left: thick, bottom: thick, right: thick };
}

async function appendRecordToReport(record: any): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const sheetName = "Skills Analysis";

  // Load existing or create fresh
  let ws: ExcelJS.Worksheet;
  if (fs.existsSync(REPORT_PATH)) {
    await wb.xlsx.readFile(REPORT_PATH);
    ws = wb.getWorksheet(sheetName) ?? wb.addWorksheet(sheetName);
  } else {
    ws = wb.addWorksheet(sheetName);
  }

  // ── Column widths (set once, idempotent) ─────────────────────────────────
  if (ws.rowCount === 0) {
    ws.columns = [
      { key: "sno",        width: 5  },
      { key: "role",       width: 32 },
      { key: "jd",         width: 48 },
      { key: "emerging",   width: 42 },
      { key: "diminishing",width: 42 },
      { key: "date",       width: 14 },
    ];
  }

  // ── Header row (only if sheet is brand new) ───────────────────────────────
  const isNew = ws.rowCount === 0;
  if (isNew) {
    // Title row
    const titleRow = ws.addRow(["Skills Analysis Report", "", "", "", "", ""]);
    ws.mergeCells(`A${titleRow.number}:F${titleRow.number}`);
    const titleCell = titleRow.getCell(1);
    titleCell.value = "Skills Analysis Report";
    titleCell.font  = { name: "Calibri", bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    titleCell.fill  = HEADER_FILL;
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    titleRow.height = 32;

    // Column header row
    const headers = ["#", "Role / Job Title", "Job Description", "Emerging Skills ▲", "Diminishing Skills ▼", "Analysis Date"];
    const hRow = ws.addRow(headers);
    hRow.height = 22;
    hRow.eachCell((cell) => {
      cell.font  = { name: "Calibri", bold: true, size: 11, color: { argb: "FFFFFFFF" } };
      cell.fill  = HEADER_FILL;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      applyThickBorder(cell);
    });
  }

  // ── Data ──────────────────────────────────────────────────────────────────
  const emerging: string[]   = (record.emerging?.emerging_skills  ?? []).map((s: any) => s.skill_name);
  const diminishing: string[] = (
    record.diminishing?.diminishing_skills ??
    record.diminishing?.skills ??
    []
  ).map((s: any) => s.skill_name);

  const rowCount = Math.max(emerging.length, diminishing.length, 1);
  const role     = record.profile?.title ?? record.emerging?.job_title ?? "—";
  const jd       = record.profile?.purpose ?? record.emerging?.jd ?? "";
  const dateStr  = record.analyzedAt
    ? new Date(record.analyzedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "";

  // S.No = count of unique roles already in sheet (approximate)
  const existingSno = Math.max(0, ...ws.getColumn(1).values
    .filter((v): v is number => typeof v === "number"));
  const sno = existingSno + 1;

  const startRow = ws.rowCount + 1;

  for (let i = 0; i < rowCount; i++) {
    const r = ws.addRow([
      i === 0 ? sno  : "",
      i === 0 ? role : "",
      i === 0 ? jd   : "",
      emerging[i]   ?? "",
      diminishing[i] ?? "",
      i === 0 ? dateStr : "",
    ]);
    r.height = 18;

    // Cells 1–3 and 6: meta style
    [1, 2, 3, 6].forEach((col) => {
      const c = r.getCell(col);
      c.fill = META_FILL;
      c.font = { name: "Calibri", size: 10 };
      c.alignment = { vertical: "top", wrapText: true };
      applyBorder(c);
    });

    // Cell 4: emerging
    const ec = r.getCell(4);
    ec.fill = EMERGING_FILL;
    ec.font = { name: "Calibri", size: 10, color: { argb: "FF1B5E20" } };
    ec.alignment = { vertical: "middle", wrapText: true };
    applyBorder(ec);

    // Cell 5: diminishing
    const dc = r.getCell(5);
    dc.fill = DIMINISHING_FILL;
    dc.font = { name: "Calibri", size: 10, color: { argb: "FFB71C1C" } };
    dc.alignment = { vertical: "middle", wrapText: true };
    applyBorder(dc);
  }

  // Merge meta columns vertically
  const endRow = startRow + rowCount - 1;
  if (rowCount > 1) {
    [1, 2, 3, 6].forEach((col) => {
      const colLetter = ["A","B","C","D","E","F"][col - 1];
      ws.mergeCells(`${colLetter}${startRow}:${colLetter}${endRow}`);
      const mergedCell = ws.getCell(`${colLetter}${startRow}`);
      mergedCell.alignment = { vertical: "middle", wrapText: true };
    });
  }

  // Separator row
  const sepRow = ws.addRow(["", "", "", "", "", ""]);
  sepRow.height = 6;
  sepRow.eachCell((cell) => { cell.fill = SEPARATOR_FILL; });

  await wb.xlsx.writeFile(REPORT_PATH);
}

// POST /api/export-to-sheet
app.post("/api/export-to-sheet", async (req, res) => {
  const { record } = req.body;
  if (!record) return res.status(400).json({ error: "record is required." });
  try {
    await appendRecordToReport(record);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[export-to-sheet]", err);
    res.status(500).json({ error: err.message || "Export failed." });
  }
});

// GET /api/download-sheet
app.get("/api/download-sheet", (_req, res) => {
  if (!fs.existsSync(REPORT_PATH)) {
    return res.status(404).json({ error: "No report generated yet." });
  }
  res.download(REPORT_PATH, "skills-analysis-report.xlsx");
});

// GET /api/sheet-status
app.get("/api/sheet-status", (_req, res) => {
  res.json({ exists: fs.existsSync(REPORT_PATH) });
});

export default app;

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 7001;
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}
