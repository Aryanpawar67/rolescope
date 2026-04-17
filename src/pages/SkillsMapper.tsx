import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, BrainCircuit, TrendingUp, TrendingDown, Info, Trash2, Clock, BookMarked } from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Task { name: string; proficiency: string; }
interface Competency { name: string; description: string; }
interface JobProfile {
  id: number;
  title: string;
  subFamily: string;
  family: string;
  level: string;
  purpose: string;
  tasks: Task[];
  professionalKnowledge: string[];
  competencies: Competency[];
}

interface EmergingSkill {
  skill_name: string;
  category: string;
  confidence: "high" | "medium" | "low";
  time_horizon: string;
  demand_signal: string;
  reasoning: string;
  profile_gap: "absent" | "adjacent" | "present-but-evolving";
  co_emerging_skills: string[];
}

interface DiminishingSkill {
  skill_name: string;
  category?: string;
  confidence?: "high" | "medium" | "low";
  decline_horizon?: string;
  decline_reason?: string;
  reasoning: string;
  still_required_today?: boolean;
  replacement?: {
    skill_name: string;
    relationship: string;
    transition_note: string;
  };
}

interface AnalysisRecord {
  profileId: string;
  profile: JobProfile | null;
  orgName: string;
  industry: string;
  department: string;
  analyzedAt: string;
  emerging: { job_title?: string; analysis_date?: string; emerging_skills?: EmergingSkill[] };
  diminishing: { job_title?: string; analysis_date?: string; diminishing_skills?: DiminishingSkill[]; [key: string]: any };
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const confidenceStyle = (c?: string) => {
  if (c === "high") return "bg-green-100 text-green-800";
  if (c === "medium") return "bg-yellow-100 text-yellow-800";
  return "bg-orange-100 text-orange-800";
};

const horizonStyle = (h?: string) => {
  if (!h) return "bg-muted text-muted-foreground";
  if (h.startsWith("0")) return "bg-red-50 text-red-700 border border-red-200";
  if (h.startsWith("6")) return "bg-amber-50 text-amber-700 border border-amber-200";
  return "bg-blue-50 text-blue-700 border border-blue-200";
};

const gapStyle = (g?: string) => {
  if (g === "absent") return "bg-red-100 text-red-800";
  if (g === "adjacent") return "bg-yellow-100 text-yellow-800";
  if (g === "present-but-evolving") return "bg-purple-100 text-purple-800";
  return "bg-muted text-muted-foreground";
};

const categoryBadge = (cat?: string) => {
  const map: Record<string, string> = {
    "Technical": "bg-blue-100 text-blue-800",
    "Methodology": "bg-indigo-100 text-indigo-800",
    "Tool": "bg-cyan-100 text-cyan-800",
    "Domain Knowledge": "bg-emerald-100 text-emerald-800",
    "Soft Skill": "bg-pink-100 text-pink-800",
  };
  return (cat && map[cat]) ?? "bg-muted text-muted-foreground";
};

const gapTooltip: Record<string, string> = {
  absent: "Not in the current profile at all — a new skill to build",
  adjacent: "Natural extension of an existing skill — easier to develop",
  "present-but-evolving": "On the profile but changing form significantly",
};

// ── Profile-to-input helpers ──────────────────────────────────────────────────

function profileToJdText(p: JobProfile): string {
  const lines: string[] = [];
  if (p.purpose) lines.push(`Job Purpose:\n${p.purpose}`);
  if (p.professionalKnowledge?.length)
    lines.push(`\nExpected Professional Knowledge:\n${p.professionalKnowledge.join("\n")}`);
  return lines.join("\n");
}

function profileToTasks(p: JobProfile): string[] {
  return p.tasks.map((t) => (t.proficiency ? `${t.name} - ${t.proficiency}` : t.name));
}

// ── Emerging skill card ───────────────────────────────────────────────────────

function EmergingSkillCard({ skill, rank }: { skill: EmergingSkill; rank: number }) {
  return (
    <div className="p-3 rounded-lg border border-border space-y-2">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-muted-foreground w-5 shrink-0">#{rank}</span>
          <p className="text-xs font-semibold text-foreground">{skill.skill_name}</p>
          {skill.category && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${categoryBadge(skill.category)}`}>
              {skill.category}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap shrink-0">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${confidenceStyle(skill.confidence)}`}>
            {skill.confidence}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${horizonStyle(skill.time_horizon)}`}>
            {skill.time_horizon}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium cursor-default flex items-center gap-0.5 ${gapStyle(skill.profile_gap)}`}>
                {skill.profile_gap}<Info className="h-2 w-2" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px] text-xs">
              {gapTooltip[skill.profile_gap] ?? ""}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      {skill.demand_signal && (
        <div className="flex items-start gap-1.5 text-[11px] pl-7">
          <TrendingUp className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
          <span className="text-muted-foreground">{skill.demand_signal}</span>
        </div>
      )}
      <p className="text-[11px] text-foreground leading-relaxed pl-7">{skill.reasoning}</p>
      {skill.co_emerging_skills?.length > 0 && (
        <div className="pl-7 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground shrink-0">Also watch:</span>
          {skill.co_emerging_skills.map((s, i) => (
            <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/40">{s}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Diminishing skill card ────────────────────────────────────────────────────

const declineReasonLabel: Record<string, string> = {
  ai_automation: "AI Automation",
  tool_supersession: "Tool Superseded",
  commoditization: "Commoditized",
  legacy_phase_out: "Legacy Phase-out",
  process_elimination: "Process Eliminated",
};

const declineHorizonStyle = (h?: string) => {
  if (!h) return "bg-muted text-muted-foreground";
  if (h === "already declining") return "bg-red-100 text-red-800 border border-red-200";
  if (h.startsWith("6")) return "bg-amber-50 text-amber-700 border border-amber-200";
  return "bg-blue-50 text-blue-700 border border-blue-200";
};

const relationshipStyle = (r?: string) => {
  if (r === "direct_swap") return "bg-orange-100 text-orange-800";
  if (r === "capability_upgrade") return "bg-blue-100 text-blue-800";
  if (r === "paradigm_shift") return "bg-purple-100 text-purple-800";
  if (r === "partial_automation") return "bg-yellow-100 text-yellow-800";
  return "bg-muted text-muted-foreground";
};

function DiminishingSkillCard({ skill, rank }: { skill: DiminishingSkill; rank: number }) {
  return (
    <div className="p-3 rounded-lg border border-border space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-muted-foreground w-5 shrink-0">#{rank}</span>
          <p className="text-xs font-semibold text-foreground">{skill.skill_name}</p>
          {skill.category && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${categoryBadge(skill.category)}`}>
              {skill.category}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap shrink-0">
          {skill.confidence && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${confidenceStyle(skill.confidence)}`}>
              {skill.confidence}
            </span>
          )}
          {skill.decline_horizon && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${declineHorizonStyle(skill.decline_horizon)}`}>
              {skill.decline_horizon}
            </span>
          )}
          {skill.still_required_today !== undefined && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${skill.still_required_today ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {skill.still_required_today ? "still needed" : "phase out now"}
            </span>
          )}
        </div>
      </div>

      {/* Decline reason */}
      {skill.decline_reason && (
        <div className="flex items-start gap-1.5 text-[11px] pl-7">
          <TrendingDown className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />
          <span className="text-muted-foreground">
            {declineReasonLabel[skill.decline_reason] ?? skill.decline_reason}
          </span>
        </div>
      )}

      {/* Reasoning */}
      <p className="text-[11px] text-foreground leading-relaxed pl-7">{skill.reasoning}</p>

      {/* Replacement */}
      {skill.replacement && (
        <div className="pl-7 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
            <span className="text-muted-foreground shrink-0">Replaced by:</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-800 border-amber-200 font-medium">
              {skill.replacement.skill_name}
            </Badge>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${relationshipStyle(skill.replacement.relationship)}`}>
              {skill.replacement.relationship?.replace(/_/g, " ")}
            </span>
          </div>
          {skill.replacement.transition_note && (
            <p className="text-[10px] text-muted-foreground italic">{skill.replacement.transition_note}</p>
          )}
        </div>
      )}

      {!skill.replacement && (skill as any).replacement_skill && (
        <div className="pl-7 flex items-center gap-1.5 text-[11px]">
          <span className="text-muted-foreground shrink-0">Replaced by:</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-800 border-amber-200">
            {(skill as any).replacement_skill}
          </Badge>
        </div>
      )}
    </div>
  );
}

// ── Full analysis result card (used in both live + saved views) ───────────────

function AnalysisCard({ record, onDelete }: { record: AnalysisRecord; onDelete?: () => void }) {
  const emerging = record.emerging?.emerging_skills ?? [];

  // Diminishing skills: try common key names
  const diminishing: DiminishingSkill[] = (
    record.diminishing?.diminishing_skills ??
    record.diminishing?.skills ??
    (Array.isArray(record.diminishing) ? record.diminishing : [])
  );

  const analyzedDate = record.analyzedAt
    ? new Date(record.analyzedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">
              {record.profile?.title ?? record.emerging?.job_title ?? "Analysis"}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
              {record.industry && <span>{record.industry}</span>}
              {record.orgName && <><span>·</span><span>{record.orgName}</span></>}
              {analyzedDate && (
                <><span>·</span>
                  <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{analyzedDate}</span>
                </>
              )}
            </div>
          </div>
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
              title="Delete this result"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">
            {emerging.length} emerging
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-medium">
            {diminishing.length} diminishing
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Emerging */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-green-600" />
              <p className="text-xs font-semibold text-foreground">Emerging Skills</p>
            </div>
            {emerging.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">No data — paste your emerging skills prompt.</p>
            ) : (
              <div className="space-y-2">
                {emerging.map((s, i) => <EmergingSkillCard key={i} skill={s} rank={i + 1} />)}
              </div>
            )}
          </div>

          {/* Diminishing */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
              <p className="text-xs font-semibold text-foreground">Diminishing Skills</p>
            </div>
            {diminishing.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">No data — paste your diminishing skills prompt.</p>
            ) : (
              <div className="space-y-2">
                {diminishing.map((s, i) => <DiminishingSkillCard key={i} skill={s} rank={i + 1} />)}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const SkillsMapper = () => {
  const location = useLocation();
  const incomingProfile = (location.state as { profile?: JobProfile } | null)?.profile;

  const [profiles, setProfiles] = useState<JobProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedProfile, setSelectedProfile] = useState<JobProfile | null>(null);
  const [jdText, setJdText] = useState("");
  const [tasksText, setTasksText] = useState("");
  const [orgName, setOrgName] = useState("");
  const [industry, setIndustry] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(false);
  const [liveResult, setLiveResult] = useState<AnalysisRecord | null>(null);
  const [savedResults, setSavedResults] = useState<AnalysisRecord[]>([]);
  const [activeTab, setActiveTab] = useState("run");

  const loadSaved = useCallback(() => {
    fetch("/api/stored-results")
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === "object") {
          setSavedResults(Object.values(data) as AnalysisRecord[]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/job-profiles")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setProfiles(data); })
      .catch(() => {});
    loadSaved();
  }, []);

  useEffect(() => {
    if (incomingProfile) {
      applyProfile(incomingProfile);
      window.history.replaceState({}, "");
    }
  }, []);

  const applyProfile = (p: JobProfile) => {
    setSelectedId(String(p.id));
    setSelectedProfile(p);
    setJdText(profileToJdText(p));
    setTasksText(profileToTasks(p).join("\n"));
    setDepartment(p.subFamily || "");
    setLiveResult(null);
  };

  const handleProfileSelect = (val: string) => {
    const p = profiles.find((x) => String(x.id) === val);
    if (p) applyProfile(p);
  };

  const handleRunBoth = async () => {
    if (!jdText.trim()) { toast.error("Please provide a job description."); return; }
    const tasks = tasksText.split("\n").map((t) => t.trim()).filter(Boolean);
    if (!tasks.length) { toast.error("Please provide at least one task."); return; }

    setLoading(true);
    setLiveResult(null);
    try {
      const res = await fetch("/api/full-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jdText: jdText.trim(),
          tasks,
          orgName: orgName.trim(),
          industry: industry.trim(),
          jobTitle: selectedProfile?.title || "",
          department: department.trim(),
          profile: selectedProfile,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed.");
      setLiveResult(data);
      loadSaved();
      toast.success("Analysis complete — results saved.");
    } catch (err: any) {
      toast.error(err.message || "Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (profileId: string) => {
    await fetch(`/api/stored-results/${profileId}`, { method: "DELETE" });
    loadSaved();
    toast.success("Result deleted.");
  };

  const tasks = tasksText.split("\n").map((t) => t.trim()).filter(Boolean);

  return (
    <div className="flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-5xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Skills Mapper</h1>
          <p className="text-muted-foreground text-sm">
            Identify emerging and diminishing skills for any job profile. Results are saved automatically.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="run">
              <BrainCircuit className="mr-2 h-4 w-4" />Run Analysis
            </TabsTrigger>
            <TabsTrigger value="saved">
              <BookMarked className="mr-2 h-4 w-4" />
              Saved Results
              {savedResults.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                  {savedResults.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Run Analysis tab ── */}
          <TabsContent value="run" className="space-y-5 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Input</CardTitle>
                <CardDescription>Select a profile to auto-fill, or enter context manually.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {profiles.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Load from Job Profile</Label>
                    <Select value={selectedId} onValueChange={handleProfileSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a job profile…" />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="org">Organisation</Label>
                    <Input id="org" placeholder="e.g. Acme Bank" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="industry">Industry</Label>
                    <Input id="industry" placeholder="e.g. Banking" value={industry} onChange={(e) => setIndustry(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dept">Department</Label>
                    <Input id="dept" placeholder="e.g. IT and Digitalization" value={department} onChange={(e) => setDepartment(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="jd">Job Description / Purpose</Label>
                  <Textarea
                    id="jd"
                    placeholder="Paste job description or purpose here…"
                    className="min-h-[100px] font-mono text-xs"
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tasks">Tasks (one per line)</Label>
                  <Textarea
                    id="tasks"
                    placeholder="Development Planning Support - Performs Independently&#10;Bug Fixing and Problem Investigation - Performs Independently"
                    className="min-h-[100px] font-mono text-xs"
                    value={tasksText}
                    onChange={(e) => setTasksText(e.target.value)}
                  />
                  {tasks.length > 0 && (
                    <p className="text-xs text-muted-foreground">{tasks.length} task{tasks.length !== 1 ? "s" : ""} detected</p>
                  )}
                </div>

                <Button
                  className="w-full"
                  onClick={handleRunBoth}
                  disabled={loading || !jdText.trim() || tasks.length === 0}
                >
                  {loading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Running both pipelines in parallel…</>
                    : <><BrainCircuit className="mr-2 h-4 w-4" />Run Emerging + Diminishing Analysis</>}
                </Button>
              </CardContent>
            </Card>

            {liveResult && <AnalysisCard record={liveResult} />}
          </TabsContent>

          {/* ── Saved Results tab ── */}
          <TabsContent value="saved" className="mt-4 space-y-4">
            {savedResults.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  No saved results yet. Run an analysis to store results here.
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {savedResults.length} profile{savedResults.length !== 1 ? "s" : ""} analysed
                  </p>
                </div>
                <div className="space-y-4">
                  {[...savedResults]
                    .sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime())
                    .map((r) => (
                      <AnalysisCard
                        key={r.profileId}
                        record={r}
                        onDelete={() => handleDelete(r.profileId)}
                      />
                    ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SkillsMapper;
