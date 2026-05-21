export interface SkillsEvaluatorModelOutput {
  modelId: string;
  modelLabel: string;
  emergingSkills: Array<{ skill_name: string; category?: string; confidence?: string; reasoning?: string; [key: string]: any }>;
  diminishingSkills: Array<{ skill_name: string; decline_reason?: string; reasoning?: string; [key: string]: any }>;
}

export interface SkillsEvaluatorInput {
  orgName: string;
  industry: string;
  job_profile_name: string;
  department: string;
  jdText: string;
  tasksList: string;
  modelOutputs: SkillsEvaluatorModelOutput[];
}

export interface SkillsEvaluatorPrompt {
  system: string;
  user: string;
}

export function buildSkillsEvaluatorPrompt(input: SkillsEvaluatorInput): SkillsEvaluatorPrompt {
  const today = new Date().toISOString().split("T")[0];

  const modelsSection = input.modelOutputs
    .map((m) => {
      const emerging = m.emergingSkills
        .map((s, i) =>
          `  ${i + 1}. ${s.skill_name}${s.category ? ` [${s.category}]` : ""}${s.confidence ? ` [${s.confidence}]` : ""}${s.reasoning ? ` — ${s.reasoning}` : ""}`
        )
        .join("\n") || "  (none)";
      const diminishing = m.diminishingSkills
        .map((s, i) =>
          `  ${i + 1}. ${s.skill_name}${s.decline_reason ? ` [${s.decline_reason}]` : ""}${s.reasoning ? ` — ${s.reasoning}` : ""}`
        )
        .join("\n") || "  (none)";
      return `### ${m.modelLabel} (model_id: "${m.modelId}")
Emerging Skills (${m.emergingSkills.length}):
${emerging}

Diminishing Skills (${m.diminishingSkills.length}):
${diminishing}`;
    })
    .join("\n\n---\n\n");

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

Organisation: ${input.orgName || "Not specified"}
Industry: ${input.industry || "Not specified"}
Job Profile: ${input.job_profile_name || "Not specified"}
Department: ${input.department || "Not specified"}

## Job Description

${input.jdText}

## Tasks

${input.tasksList || "Not specified"}

---

## Model Outputs to Evaluate

${modelsSection}

---

## Your Task

Evaluate each model's output directly. Output a JSON object with this exact structure:

{
  "job_profile_name": "string",
  "evaluation_date": "string",
  "model_evaluations": [
    {
      "model_id": "string",
      "model_label": "string",
      "emerging_score": 1-10,
      "diminishing_score": 1-10,
      "overall_score": 1-10,
      "strengths": "string — 1 sentence on what this model did well",
      "weaknesses": "string — 1 sentence on the main shortcoming",
      "flagged_skills": [
        {
          "skill_name": "string",
          "side": "emerging | diminishing",
          "issue": "hallucination | over_generic | not_a_skill | weak_signal | role_mismatch",
          "note": "string — 1 sentence explaining the problem"
        }
      ]
    }
  ],
  "consensus": {
    "emerging": [
      {
        "skill_name": "string — use the clearest/most precise version of the name",
        "agreed_by": ["model_id_1", "model_id_2"],
        "recommendation": "include | review | exclude"
      }
    ],
    "diminishing": [
      {
        "skill_name": "string",
        "agreed_by": ["model_id_1"],
        "recommendation": "include | review | exclude"
      }
    ]
  },
  "recommended_model": "string — model_id of the best overall output",
  "recommended_model_rationale": "string — 1-2 sentences on why this model's output is most reliable",
  "overall_assessment": "string — 2-3 sentences summarising comparative quality across all models, written for an HR analyst"
}

Rules:
- Scores are 1–10: 10 = excellent precision, role-specificity, and JD grounding; 1 = generic, hallucinated, or irrelevant
- Only flag genuine issues — not stylistic differences between models
- For consensus: a skill counts as agreed when 2+ models name it by the same or clearly equivalent term
  (e.g., "Prompt Engineering" and "LLM Prompt Design" are equivalent — pick the cleaner name)
- Consensus agreed_by must be an array of model_id strings
- recommendation "include" = strong signal, well-grounded; "review" = uncertain or needs human check; "exclude" = likely noise
- Return only valid JSON, no markdown fences, no additional text`;

  return { system, user };
}
