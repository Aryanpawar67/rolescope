export interface SkillsPipelineInput {
  orgName: string;
  industry: string;
  jobTitle: string;
  department: string;
  jdText: string;
  skillsList: string;        // derived from professional knowledge
  capabilitiesList: string;  // derived from competencies
  skillCapabilityMapping: string;
  tasksList: string;         // derived from tasks array
  taskSkillMapping: string;
}

export function buildSkillsPipelinePrompt(input: SkillsPipelineInput): string {
  const today = new Date().toISOString().split("T")[0];

  return `You are a senior labor market analyst specializing in skills intelligence and

workforce forecasting. You analyze job profiles to identify skills that are

becoming increasingly critical for a role over the next 6–36 months, based on

technology shifts, market signals, industry evolution, and AI adoption patterns.

You reason carefully before producing output. Your recommendations must be

specific to the role, industry, and organisational context provided — not

generic market observations.

USER:

Today's date: ${today}

## Job Profile

Organisation: ${input.orgName || "Not specified"}

Industry: ${input.industry || "Not specified"}

Job Title: ${input.jobTitle}

Department: ${input.department || "Not specified"}

Job Description:

${input.jdText}

Current Skills:

${input.skillsList}

Capabilities:

${input.capabilitiesList}

Skill–Capability Mapping:

${input.skillCapabilityMapping}

Tasks:

${input.tasksList}

Task–Skill Mapping:

${input.taskSkillMapping}

---

## Your Task

Step 1 — Reason first (write this inside a <thinking> block, do not skip):

- What major technology, methodology, or market shifts are currently reshaping

this role in the ${input.industry || "relevant"} industry?

- Which current skills in this profile are evolving into more advanced or

adjacent forms? (e.g., SQL → dbt + analytical engineering)

- What skills are consistently appearing in new job postings for this title

but are absent or underweighted in this profile?

- What tasks in this profile are changing due to AI/automation — and what new

human skills does that shift create demand for?

- What skills are implicitly required by the listed tasks but not yet formally

captured in the profile?

##Output a JSON object with this exact structure:

{

"job_title": "string",

"analysis_date": "string",

"emerging_skills": [

{

"skill_name": "string",

"category": "Technical | Methodology | Tool | Domain Knowledge | Soft Skill",

"confidence": "high | medium | low",

"time_horizon": "0–6 months | 6–18 months | 18–36 months",

"demand_signal": "string — the primary driver

(e.g., AI tool adoption, regulatory shift,

framework migration, cloud-native transition)",

"reasoning": "string — 1–2 sentences specific to this role and industry",

"profile_gap": "absent | adjacent | present-but-evolving",

"co_emerging_skills": ["string", "string"]

}

]

}

Rules:

- Return 8–12 skills

- Order: high confidence first, then by nearest time_horizon

- Do not list skills already dominant in the profile unless they are

evolving into a meaningfully different form

- profile_gap values:

absent = not on the profile at all

adjacent = natural extension of a skill already on the profile

present-but-evolving = on the profile but the nature of the skill

is changing significantly

- Keep reasoning specific to ${input.jobTitle} in ${input.industry || "this industry"},

not generic industry commentary

- Return only valid JSON after the </thinking> block, no additional text`;
}
