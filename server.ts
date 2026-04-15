import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
import mammoth from "mammoth";
import "dotenv/config";

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
      model: "claude-opus-4-6",
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
      model: "claude-opus-4-6",
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

app.post("/api/automate", async (req, res) => {
  const { tasks } = req.body;
  if (!Array.isArray(tasks) || tasks.length === 0)
    return res.status(400).json({ error: "tasks must be a non-empty array." });
  if (tasks.length > 15)
    return res.status(400).json({ error: "Maximum 15 tasks per request." });

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are an automation strategist who evaluates work tasks and recommends the most practical automation approach using modern tools available today.

For each task, produce ONE best automation suggestion.

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
  "suggestions": [
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
  ]
}

Do not include any text outside the JSON.

Tasks to analyze:
${tasks.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n")}`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { suggestions: [] };
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate automation suggestions." });
  }
});

export default app;

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 7001;
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}
