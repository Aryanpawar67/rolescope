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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, BrainCircuit, TrendingUp, TrendingDown, Info, Trash2, Clock, BookMarked, FileSpreadsheet, Download, Plus, ShieldCheck, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ValidationResult {
  name: string;
  verdict: "skill" | "knowledge" | "competency" | "experience" | "too_vague";
  reason: string;
  suggested: string | null;
}

type ValidationMap = Record<string, ValidationResult>; // keyed by skill_name

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

// ── Validation helpers ────────────────────────────────────────────────────────

function verdictIcon(v?: ValidationResult["verdict"]) {
  if (!v) return null;
  if (v === "skill") return <ShieldCheck className="h-3 w-3 text-green-600 shrink-0" />;
  if (v === "knowledge" || v === "competency") return <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />;
  return <XCircle className="h-3 w-3 text-red-500 shrink-0" />;
}

function verdictLabel(v: ValidationResult["verdict"]) {
  const map: Record<string, string> = {
    skill: "Valid skill",
    knowledge: "Knowledge area — not a skill",
    competency: "Behavioural competency — not a discrete skill",
    experience: "Experience descriptor — not a skill",
    too_vague: "Too vague to be actionable",
  };
  return map[v] ?? v;
}

// ── Compact skill row (name + category only) ──────────────────────────────────

function EmergingSkillRow({ skill, rank, validation }: { skill: EmergingSkill; rank: number; validation?: ValidationResult }) {
  const isInvalid = validation && validation.verdict !== "skill";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-default transition-colors ${isInvalid ? "hover:bg-amber-50 opacity-70" : "hover:bg-green-50"}`}>
          <span className="text-[10px] font-bold text-muted-foreground w-4 shrink-0">#{rank}</span>
          <span className={`text-[11px] font-medium flex-1 ${isInvalid ? "text-muted-foreground line-through decoration-amber-400" : "text-foreground"}`}>{skill.skill_name}</span>
          {validation && verdictIcon(validation.verdict)}
          {skill.category && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${categoryBadge(skill.category)}`}>
              {skill.category}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[300px] space-y-1.5 p-3">
        <p className="text-xs font-semibold">{skill.skill_name}</p>
        {validation && (
          <div className={`flex items-center gap-1.5 text-[10px] font-medium rounded px-1.5 py-1 ${validation.verdict === "skill" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
            {verdictIcon(validation.verdict)}
            {verdictLabel(validation.verdict)}
          </div>
        )}
        {validation?.suggested && (
          <p className="text-[10px] text-blue-700 italic">Suggested: "{validation.suggested}"</p>
        )}
        {validation?.reason && <p className="text-[10px] text-muted-foreground">{validation.reason}</p>}
        <div className="flex flex-wrap gap-1 pt-1 border-t border-border">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${confidenceStyle(skill.confidence)}`}>{skill.confidence}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${horizonStyle(skill.time_horizon)}`}>{skill.time_horizon}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${gapStyle(skill.profile_gap)}`}>{skill.profile_gap}</span>
        </div>
        {skill.demand_signal && <p className="text-[10px] text-muted-foreground">{skill.demand_signal}</p>}
        <p className="text-[10px] leading-relaxed">{skill.reasoning}</p>
        {skill.co_emerging_skills?.length > 0 && (
          <p className="text-[9px] text-muted-foreground">Also watch: {skill.co_emerging_skills.join(", ")}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

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

function DiminishingSkillRow({ skill, rank, validation }: { skill: DiminishingSkill; rank: number; validation?: ValidationResult }) {
  const isInvalid = validation && validation.verdict !== "skill";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-default transition-colors ${isInvalid ? "hover:bg-amber-50 opacity-70" : "hover:bg-red-50"}`}>
          <span className="text-[10px] font-bold text-muted-foreground w-4 shrink-0">#{rank}</span>
          <span className={`text-[11px] font-medium flex-1 ${isInvalid ? "text-muted-foreground line-through decoration-amber-400" : "text-foreground"}`}>{skill.skill_name}</span>
          {validation && verdictIcon(validation.verdict)}
          {skill.category && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${categoryBadge(skill.category)}`}>
              {skill.category}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[300px] space-y-1.5 p-3">
        <p className="text-xs font-semibold">{skill.skill_name}</p>
        {validation && (
          <div className={`flex items-center gap-1.5 text-[10px] font-medium rounded px-1.5 py-1 ${validation.verdict === "skill" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
            {verdictIcon(validation.verdict)}
            {verdictLabel(validation.verdict)}
          </div>
        )}
        {validation?.suggested && (
          <p className="text-[10px] text-blue-700 italic">Suggested: "{validation.suggested}"</p>
        )}
        {validation?.reason && <p className="text-[10px] text-muted-foreground">{validation.reason}</p>}
        <div className="flex flex-wrap gap-1 pt-1 border-t border-border">
          {skill.confidence && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${confidenceStyle(skill.confidence)}`}>{skill.confidence}</span>}
          {skill.decline_horizon && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${declineHorizonStyle(skill.decline_horizon)}`}>{skill.decline_horizon}</span>}
          {skill.still_required_today !== undefined && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${skill.still_required_today ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {skill.still_required_today ? "still needed" : "phase out now"}
            </span>
          )}
        </div>
        {skill.decline_reason && <p className="text-[10px] text-muted-foreground">{declineReasonLabel[skill.decline_reason] ?? skill.decline_reason}</p>}
        <p className="text-[10px] leading-relaxed">{skill.reasoning}</p>
        {skill.replacement && (
          <div className="space-y-0.5">
            <p className="text-[9px] text-muted-foreground">Replaced by: <span className="font-medium text-amber-700">{skill.replacement.skill_name}</span></p>
            {skill.replacement.transition_note && <p className="text-[9px] text-muted-foreground italic">{skill.replacement.transition_note}</p>}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

// ── Full analysis result card (used in both live + saved views) ───────────────

function AnalysisCard({
  record,
  onDelete,
  onAddToReport,
  addingToReport,
}: {
  record: AnalysisRecord;
  onDelete?: () => void;
  onAddToReport?: (correctedRecord: AnalysisRecord) => void;
  addingToReport?: boolean;
}) {
  const [validating, setValidating] = useState(false);
  const [validationMap, setValidationMap] = useState<ValidationMap>({});

  const emerging = record.emerging?.emerging_skills ?? [];
  const diminishing: DiminishingSkill[] = (
    record.diminishing?.diminishing_skills ??
    record.diminishing?.skills ??
    (Array.isArray(record.diminishing) ? record.diminishing : [])
  );

  // Run validation automatically when the card mounts
  useEffect(() => {
    if (emerging.length > 0 || diminishing.length > 0) runValidation();
  }, [record.profileId]);

  const runValidation = async (): Promise<ValidationMap> => {
    setValidating(true);
    try {
      const res = await fetch("/api/validate-skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emerging,
          diminishing,
          jobTitle: record.profile?.title ?? record.emerging?.job_title ?? "",
          industry: record.industry ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Validation failed.");
      const map: ValidationMap = {};
      (data.results ?? []).forEach((r: ValidationResult) => { map[r.name] = r; });
      setValidationMap(map);
      const invalid = (data.results ?? []).filter((r: ValidationResult) => r.verdict !== "skill").length;
      if (invalid === 0) toast.success("All items validated as genuine skills.");
      else toast.warning(`${invalid} item${invalid > 1 ? "s" : ""} flagged — hover skills for details.`);
      return map;
    } catch (err: any) {
      toast.error(err.message || "Validation failed.");
      return {};
    } finally {
      setValidating(false);
    }
  };

  // Build corrected record: rename flagged skills with suggestions, drop unfixable ones
  const buildCorrectedRecord = (map: ValidationMap): AnalysisRecord => {
    const correct = <T extends { skill_name: string }>(skills: T[]): T[] =>
      skills
        .filter(s => {
          const v = map[s.skill_name];
          return !v || v.verdict === "skill" || v.suggested !== null;
        })
        .map(s => {
          const v = map[s.skill_name];
          return v && v.verdict !== "skill" && v.suggested
            ? { ...s, skill_name: v.suggested }
            : s;
        });

    return {
      ...record,
      emerging:    { ...record.emerging,    emerging_skills:    correct(emerging) },
      diminishing: { ...record.diminishing, diminishing_skills: correct(diminishing) },
    };
  };

  const handleAddToReportClick = async () => {
    let map = validationMap;
    if (Object.keys(map).length === 0) {
      map = await runValidation();
    }
    onAddToReport?.(buildCorrectedRecord(map));
  };

  const validatedCount = Object.values(validationMap).filter(v => v.verdict === "skill").length;
  const flaggedCount   = Object.values(validationMap).filter(v => v.verdict !== "skill").length;

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
          <div className="flex items-center gap-1.5 shrink-0">
            {onAddToReport && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] gap-1.5 border-green-300 text-green-700 hover:bg-green-50"
                onClick={handleAddToReportClick}
                disabled={addingToReport || validating}
              >
                {addingToReport || validating
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Plus className="h-3 w-3" />}
                {validating ? "Validating…" : "Add to Report"}
              </Button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Delete this result"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">
            {emerging.length} emerging
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-medium">
            {diminishing.length} diminishing
          </span>
          {flaggedCount > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium flex items-center gap-1">
              <AlertTriangle className="h-2.5 w-2.5" />{flaggedCount} flagged
            </span>
          )}
          {validatedCount > 0 && flaggedCount === 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium flex items-center gap-1">
              <ShieldCheck className="h-2.5 w-2.5" />all valid
            </span>
          )}
          <span className="text-[10px] text-muted-foreground ml-1">hover a skill for details</span>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Emerging */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="h-3.5 w-3.5 text-green-600" />
              <p className="text-xs font-semibold text-foreground">Emerging Skills</p>
            </div>
            {emerging.length === 0
              ? <p className="text-[11px] text-muted-foreground italic px-2">No data.</p>
              : emerging.map((s, i) => <EmergingSkillRow key={i} skill={s} rank={i + 1} validation={validationMap[s.skill_name]} />)
            }
          </div>

          {/* Diminishing */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
              <p className="text-xs font-semibold text-foreground">Diminishing Skills</p>
            </div>
            {diminishing.length === 0
              ? <p className="text-[11px] text-muted-foreground italic px-2">No data.</p>
              : diminishing.map((s, i) => <DiminishingSkillRow key={i} skill={s} rank={i + 1} validation={validationMap[s.skill_name]} />)
            }
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
  const [confirmRecord, setConfirmRecord] = useState<AnalysisRecord | null>(null);
  const [addingToReport, setAddingToReport] = useState<string | null>(null);
  const [sheetExists, setSheetExists] = useState(false);

  const LS_KEY = "rolescope_results";

  // Read from localStorage (primary) merged with server results (seed)
  const loadSaved = useCallback(async () => {
    // 1. Load from localStorage first (instant)
    let local: Record<string, AnalysisRecord> = {};
    try { local = JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch {}

    // 2. Merge server results (seeds existing data; no-op on Vercel)
    try {
      const res = await fetch("/api/stored-results");
      const server = await res.json();
      if (server && typeof server === "object") {
        const merged = { ...server, ...local }; // local wins on conflict
        localStorage.setItem(LS_KEY, JSON.stringify(merged));
        local = merged;
      }
    } catch {}

    setSavedResults(Object.values(local).sort(
      (a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime()
    ));
  }, []);

  const saveToLocal = useCallback((record: AnalysisRecord) => {
    try {
      const existing: Record<string, AnalysisRecord> =
        JSON.parse(localStorage.getItem(LS_KEY) || "{}");
      existing[record.profileId] = record;
      localStorage.setItem(LS_KEY, JSON.stringify(existing));
      setSavedResults(Object.values(existing).sort(
        (a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime()
      ));
    } catch {}
  }, []);

  const deleteFromLocal = useCallback((profileId: string) => {
    try {
      const existing: Record<string, AnalysisRecord> =
        JSON.parse(localStorage.getItem(LS_KEY) || "{}");
      delete existing[profileId];
      localStorage.setItem(LS_KEY, JSON.stringify(existing));
      setSavedResults(Object.values(existing).sort(
        (a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime()
      ));
    } catch {}
    // best-effort server delete
    fetch(`/api/stored-results/${profileId}`, { method: "DELETE" }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/job-profiles")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setProfiles(data); })
      .catch(() => {});
    loadSaved();
    fetch("/api/sheet-status").then(r => r.json()).then(d => setSheetExists(d.exists)).catch(() => {});
  }, []);

  const handleAddToReport = async (record: AnalysisRecord) => {
    setAddingToReport(record.profileId);
    try {
      const res = await fetch("/api/export-to-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record }),
      });
      if (!res.ok) throw new Error("Export failed.");
      setSheetExists(true);
      toast.success("Added to skills-analysis-report.xlsx");
    } catch (err: any) {
      toast.error(err.message || "Export failed.");
    } finally {
      setAddingToReport(null);
      setConfirmRecord(null);
    }
  };

  const handleDownloadSheet = () => {
    window.open("/api/download-sheet", "_blank");
  };

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
      saveToLocal(data);
      toast.success("Analysis complete — auto-saving to results…");
      // Switch to Saved Results tab after 3 s
      setTimeout(() => setActiveTab("saved"), 3000);
    } catch (err: any) {
      toast.error(err.message || "Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (profileId: string) => {
    deleteFromLocal(profileId);
    toast.success("Result deleted.");
  };

  const tasks = tasksText.split("\n").map((t) => t.trim()).filter(Boolean);

  return (
    <>
    <AlertDialog open={!!confirmRecord} onOpenChange={(o) => { if (!o) setConfirmRecord(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Add to Report
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-1">
            <span className="block font-medium text-foreground">
              {confirmRecord?.profile?.title ?? confirmRecord?.emerging?.job_title ?? "This analysis"}
            </span>
            <span className="block text-sm">
              Will be appended to <code className="text-xs bg-muted px-1 rounded">skills-analysis-report.xlsx</code> with{" "}
              {(confirmRecord?.emerging?.emerging_skills ?? []).length} emerging and{" "}
              {(confirmRecord?.diminishing?.diminishing_skills ?? confirmRecord?.diminishing?.skills ?? []).length} diminishing skills.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-green-600 hover:bg-green-700"
            onClick={() => confirmRecord && handleAddToReport(confirmRecord)}
          >
            Add to Report
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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

            {liveResult && (
              <AnalysisCard
                record={liveResult}
                onAddToReport={(corrected) => setConfirmRecord(corrected)}
                addingToReport={addingToReport === liveResult.profileId}
              />
            )}
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
                  {sheetExists && (
                    <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={handleDownloadSheet}>
                      <Download className="h-3.5 w-3.5" />
                      Download Report
                    </Button>
                  )}
                </div>
                <div className="space-y-4">
                  {[...savedResults]
                    .sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime())
                    .map((r) => (
                      <AnalysisCard
                        key={r.profileId}
                        record={r}
                        onDelete={() => handleDelete(r.profileId)}
                        onAddToReport={(corrected) => setConfirmRecord(corrected)}
                        addingToReport={addingToReport === r.profileId}
                      />
                    ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </>
  );
};

export default SkillsMapper;
