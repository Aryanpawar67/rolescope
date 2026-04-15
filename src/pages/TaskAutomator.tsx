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

interface DimensionScore {
  score: number;
  rationale: string;
}

interface AssessmentResult {
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

const categoryStyle = (cat: string) => {
  if (cat === "AI-Led") return { badge: "bg-green-100 text-green-800", score: "text-green-700" };
  if (cat === "AI Assisted") return { badge: "bg-yellow-100 text-yellow-800", score: "text-yellow-700" };
  return { badge: "bg-orange-100 text-orange-800", score: "text-orange-700" };
};

const dimensionMeta: Record<
  keyof AssessmentResult["dimensions"],
  { label: string; inverted: boolean; tooltip: string }
> = {
  task_routineness: {
    label: "Task Routineness",
    inverted: false,
    tooltip: "How predictable and rule-governed the task is. Higher = more automatable.",
  },
  data_information_processing: {
    label: "Data Processing",
    inverted: false,
    tooltip: "Is the core work digital — reading, extracting, classifying? Higher = more automatable.",
  },
  input_predictability: {
    label: "Input Predictability",
    inverted: false,
    tooltip: "How structured and consistent the task inputs are. Higher = more automatable.",
  },
  physical_requirement: {
    label: "Physical Requirement",
    inverted: true,
    tooltip: "Does the task require physical presence or dexterity? Higher = harder to automate.",
  },
  social_emotional_complexity: {
    label: "Social & Emotional",
    inverted: true,
    tooltip: "Does the task require empathy, trust-building, or negotiation? Higher = harder to automate.",
  },
  creative_judgment_demand: {
    label: "Creative Judgment",
    inverted: true,
    tooltip: "Does the task require original thinking or nuanced judgment? Higher = harder to automate.",
  },
  consequence_of_error: {
    label: "Error Consequence",
    inverted: true,
    tooltip: "How severe is an AI mistake here? Higher = riskier to automate.",
  },
};

const barColor = (score: number, inverted: boolean) => {
  const effective = inverted ? 100 - score : score;
  if (effective >= 67) return "bg-green-500";
  if (effective >= 34) return "bg-yellow-400";
  return "bg-red-400";
};

const TaskAutomator = () => {
  const location = useLocation();
  const [task, setTask] = useState("");
  const [jobProfile, setJobProfile] = useState("");
  const [department, setDepartment] = useState("");
  const [industry, setIndustry] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);

  useEffect(() => {
    const incoming = (location.state as { task?: string } | null)?.task;
    if (incoming) {
      setTask(incoming);
      setResult(null);
      window.history.replaceState({}, "");
    }
  }, []);

  const handleAssess = async () => {
    if (!task.trim()) {
      toast.error("Please enter a task to assess.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/automate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: task.trim(),
          job_profile: jobProfile.trim(),
          department: department.trim(),
          industry: industry.trim(),
        }),
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

  const styles = result ? categoryStyle(result.automation_category) : null;

  return (
    <div className="flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-2xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Task Automator</h1>
          <p className="text-muted-foreground text-sm">
            Assess how automatable a workplace task is across 7 dimensions.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Task Assessment</CardTitle>
            <CardDescription>
              Enter a task and optional context for a richer assessment.
            </CardDescription>
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
                <Input
                  id="job_profile"
                  placeholder="e.g. Software Engineer"
                  value={jobProfile}
                  onChange={(e) => setJobProfile(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  placeholder="e.g. Engineering"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  placeholder="e.g. FinTech"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                />
              </div>
            </div>
            <Button className="w-full" onClick={handleAssess} disabled={loading || !task.trim()}>
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Assessing…</>
              ) : (
                <><Zap className="mr-2 h-4 w-4" />Assess Automation Potential</>
              )}
            </Button>
          </CardContent>
        </Card>

        {result && styles && (
          <div className="space-y-4">
            {/* Score header */}
            <Card>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-5">
                  <div className="text-center min-w-[4.5rem]">
                    <p className={`text-4xl font-bold ${styles.score}`}>{result.automation_score}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">/ 100</p>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${styles.badge}`}>
                      {result.automation_category}
                    </span>
                    <p className="text-sm text-muted-foreground leading-snug">{result.reasoning}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dimensions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Dimension Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(Object.keys(dimensionMeta) as Array<keyof typeof dimensionMeta>).map((key) => {
                  const meta = dimensionMeta[key];
                  const dim = result.dimensions[key];
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-xs font-medium text-foreground flex items-center gap-1 cursor-default w-fit">
                              {meta.label}
                              {meta.inverted && (
                                <span className="text-[10px] text-muted-foreground">(barrier)</span>
                              )}
                              <Info className="h-3 w-3 shrink-0 text-muted-foreground" />
                            </p>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px] text-xs">
                            {meta.tooltip}
                          </TooltipContent>
                        </Tooltip>
                        <span className="text-xs text-muted-foreground">{dim.score}/100</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${barColor(dim.score, meta.inverted)}`}
                          style={{ width: `${dim.score}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">{dim.rationale}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Tools + Oversight */}
            <Card>
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-foreground">Applicable AI Tools</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.ai_tools_applicable.map((tool) => (
                      <span key={tool} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">Human Oversight</p>
                  <p className="text-xs text-muted-foreground">{result.human_oversight_recommendation}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskAutomator;
