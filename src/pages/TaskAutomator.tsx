import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Zap, Info } from "lucide-react";
import { toast } from "sonner";

// Standard prompt output
interface StandardResult {
  task: string;
  suggestion_name: string;
  type: "script" | "no-code" | "ai-agent" | "integration" | "workflow";
  description: string;
  confidence: number;
  confidence_label: "High" | "Medium" | "Low";
  explanation: string;
  tools_mentioned: string[];
}

// Enterprise prompt output
interface DimensionScore { score: number; rationale: string; }
interface EnterpriseResult {
  task_name: string;
  job_profile: string;
  department: string;
  industry: string;
  automation_score: number;
  automation_category: "AI-Led" | "AI Assisted" | "Human-Led";
  dimensions: {
    task_routineness: DimensionScore;
    data_information_processing: DimensionScore;
    input_predictability: DimensionScore;
    physical_requirement: DimensionScore;
    social_emotional_complexity: DimensionScore;
    creative_judgment_demand: DimensionScore;
    consequence_of_error: DimensionScore;
  };
  reasoning: string;
  ai_tools_applicable: string[];
  human_oversight_recommendation: string;
}

interface CompareResult { standard: StandardResult; enterprise: EnterpriseResult; }

// ── Helpers ─────────────────────────────────────────────────────────────────

const confidenceStyle = (label: "High" | "Medium" | "Low") => {
  if (label === "High") return "bg-green-100 text-green-800";
  if (label === "Medium") return "bg-yellow-100 text-yellow-800";
  return "bg-orange-100 text-orange-800";
};

const categoryStyle = (cat: string) => {
  if (cat === "AI-Led") return { badge: "bg-green-100 text-green-800", score: "text-green-700" };
  if (cat === "AI Assisted") return { badge: "bg-yellow-100 text-yellow-800", score: "text-yellow-700" };
  return { badge: "bg-orange-100 text-orange-800", score: "text-orange-700" };
};

const dimensionMeta: Record<
  keyof EnterpriseResult["dimensions"],
  { label: string; inverted: boolean; tooltip: string }
> = {
  task_routineness: { label: "Task Routineness", inverted: false, tooltip: "How predictable and rule-governed the task is. Higher = more automatable." },
  data_information_processing: { label: "Data Processing", inverted: false, tooltip: "Is the core work digital — reading, extracting, classifying? Higher = more automatable." },
  input_predictability: { label: "Input Predictability", inverted: false, tooltip: "How structured and consistent the task inputs are. Higher = more automatable." },
  physical_requirement: { label: "Physical Requirement", inverted: true, tooltip: "Does the task require physical presence or dexterity? Higher = harder to automate." },
  social_emotional_complexity: { label: "Social & Emotional", inverted: true, tooltip: "Does the task require empathy, trust-building, or negotiation? Higher = harder to automate." },
  creative_judgment_demand: { label: "Creative Judgment", inverted: true, tooltip: "Does the task require original thinking or nuanced judgment? Higher = harder to automate." },
  consequence_of_error: { label: "Error Consequence", inverted: true, tooltip: "How severe is an AI mistake here? Higher = riskier to automate." },
};

const barColor = (score: number, inverted: boolean) => {
  const effective = inverted ? 100 - score : score;
  if (effective >= 67) return "bg-green-500";
  if (effective >= 34) return "bg-yellow-400";
  return "bg-red-400";
};

// ── Component ────────────────────────────────────────────────────────────────

const TaskAutomator = () => {
  const location = useLocation();
  const [task, setTask] = useState("");
  const [jobProfile, setJobProfile] = useState("");
  const [department, setDepartment] = useState("");
  const [industry, setIndustry] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);

  useEffect(() => {
    const incoming = (location.state as { task?: string } | null)?.task;
    if (incoming) {
      setTask(incoming);
      setResult(null);
      window.history.replaceState({}, "");
    }
  }, []);

  const handleAssess = async () => {
    if (!task.trim()) { toast.error("Please enter a task to assess."); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/automate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: task.trim(), job_profile: jobProfile.trim(), department: department.trim(), industry: industry.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Assessment failed.");
      setResult(data);
    } catch (err: any) {
      toast.error(err.message || "Assessment failed.");
    } finally {
      setLoading(false);
    }
  };

  const s = result?.standard;
  const e = result?.enterprise;
  const eStyles = e ? categoryStyle(e.automation_category) : null;

  return (
    <div className="flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-5xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Task Automator</h1>
          <p className="text-muted-foreground text-sm">
            Compare two assessment models side by side to see which gives better signal.
          </p>
        </div>

        {/* Input */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Task Assessment</CardTitle>
            <CardDescription>Enter a task and optional context.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="task">Task</Label>
              <Textarea
                id="task"
                placeholder="e.g. Review pull requests from peers"
                className="min-h-[80px]"
                value={task}
                onChange={(e) => setTask(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="job_profile">Job Profile</Label>
                <Input id="job_profile" placeholder="e.g. Software Engineer" value={jobProfile} onChange={(e) => setJobProfile(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="department">Department</Label>
                <Input id="department" placeholder="e.g. Engineering" value={department} onChange={(e) => setDepartment(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="industry">Industry</Label>
                <Input id="industry" placeholder="e.g. FinTech" value={industry} onChange={(e) => setIndustry(e.target.value)} />
              </div>
            </div>
            <Button className="w-full" onClick={handleAssess} disabled={loading || !task.trim()}>
              {loading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Running both assessments…</>
                : <><Zap className="mr-2 h-4 w-4" />Compare Assessments</>}
            </Button>
          </CardContent>
        </Card>

        {/* Comparison results */}
        {s && e && eStyles && (
          <div className="grid grid-cols-2 gap-4 items-start">

            {/* ── Standard prompt ─────────────────────────────────── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-0.5">Standard (v1)</p>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <CardTitle className="text-base">{s.suggestion_name}</CardTitle>
                      <CardDescription className="text-xs">{s.task}</CardDescription>
                    </div>
                    <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${confidenceStyle(s.confidence_label)}`}>
                      {s.confidence_label} · {Math.round(s.confidence * 100)}%
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/50 text-secondary-foreground">{s.type}</span>
                    {s.tools_mentioned.map((tool) => (
                      <span key={tool} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{tool}</span>
                    ))}
                  </div>
                  <p className="text-sm text-foreground">{s.description}</p>
                  <p className="text-xs text-muted-foreground italic">{s.explanation}</p>
                </CardContent>
              </Card>
            </div>

            {/* ── Enterprise prompt ────────────────────────────────── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-0.5">Enterprise (v2)</p>

              {/* Score */}
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[3.5rem]">
                      <p className={`text-3xl font-bold ${eStyles.score}`}>{e.automation_score}</p>
                      <p className="text-[10px] text-muted-foreground">/ 100</p>
                    </div>
                    <div className="flex-1 space-y-1">
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${eStyles.badge}`}>{e.automation_category}</span>
                      <p className="text-xs text-muted-foreground leading-snug">{e.reasoning}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Dimensions */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Dimension Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {(Object.keys(dimensionMeta) as Array<keyof typeof dimensionMeta>).map((key) => {
                    const meta = dimensionMeta[key];
                    const dim = e.dimensions[key];
                    return (
                      <div key={key} className="space-y-0.5">
                        <div className="flex items-center justify-between">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-[11px] font-medium text-foreground flex items-center gap-1 cursor-default w-fit">
                                {meta.label}
                                {meta.inverted && <span className="text-[10px] text-muted-foreground">(barrier)</span>}
                                <Info className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                              </p>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[200px] text-xs">{meta.tooltip}</TooltipContent>
                          </Tooltip>
                          <span className="text-[11px] text-muted-foreground">{dim.score}/100</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barColor(dim.score, meta.inverted)}`} style={{ width: `${dim.score}%` }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground">{dim.rationale}</p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Tools + oversight */}
              <Card>
                <CardContent className="pt-3 pb-3 space-y-2.5">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground">Applicable AI Tools</p>
                    <div className="flex flex-wrap gap-1.5">
                      {e.ai_tools_applicable.map((tool) => (
                        <span key={tool} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{tool}</span>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-foreground">Human Oversight</p>
                    <p className="text-xs text-muted-foreground">{e.human_oversight_recommendation}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskAutomator;
