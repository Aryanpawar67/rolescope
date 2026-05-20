import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, BrainCircuit, TrendingUp, TrendingDown, Trash2, Clock, BookMarked, FileSpreadsheet, Download, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";

// ── Model constants ───────────────────────────────────────────────────────────

type ModelId = "azure-gpt-4o" | "azure-gpt-5.3" | "azure-oss-120b" | "claude-sonnet-4-6";

const MODEL_LABELS: Record<ModelId, string> = {
  "azure-gpt-4o":     "GPT-4o",
  "azure-gpt-5.3":    "GPT-5.3",
  "azure-oss-120b":   "OSS 120B",
  "claude-sonnet-4-6":"Claude Sonnet",
};

const DEFAULT_MULTI_MODELS: ModelId[] = ["azure-gpt-4o", "azure-gpt-5.3", "azure-oss-120b"];

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
  profile_gap?: "absent" | "adjacent" | "present-but-evolving";
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

interface ModelRun {
  emerging: { job_profile_name?: string; job_title?: string; analysis_date?: string; emerging_skills?: EmergingSkill[] };
  diminishing: { job_profile_name?: string; job_title?: string; analysis_date?: string; diminishing_skills?: DiminishingSkill[]; [key: string]: any };
  analyzedAt: string;
  warnings?: string[];
}

interface MultiModelRecord {
  profileId: string;
  profile: JobProfile | null;
  orgName: string;
  industry: string;
  department: string;
  jdText?: string;
  runs: Partial<Record<ModelId, ModelRun>>;
  warnings?: string[];
}

interface EvaluationFlaggedSkill {
  skill_name: string;
  side: "emerging" | "diminishing";
  issue: string;
  note: string;
}

interface EvaluationModelResult {
  model_id: string;
  model_label: string;
  emerging_score: number;
  diminishing_score: number;
  overall_score: number;
  strengths: string;
  weaknesses: string;
  flagged_skills: EvaluationFlaggedSkill[];
}

interface EvaluationConsensusSkill {
  skill_name: string;
  agreed_by: string[];
  recommendation: "include" | "review" | "exclude";
}

interface EvaluationResult {
  job_profile_name?: string;
  evaluation_date?: string;
  model_evaluations: EvaluationModelResult[];
  consensus: {
    emerging: EvaluationConsensusSkill[];
    diminishing: EvaluationConsensusSkill[];
  };
  recommended_model: string;
  recommended_model_rationale: string;
  overall_assessment: string;
}

interface ReportEntry {
  profileId: string;
  modelId: ModelId;
  profile: JobProfile | null;
  orgName: string;
  industry: string;
  department: string;
  emerging: ModelRun["emerging"];
  diminishing: ModelRun["diminishing"];
  analyzedAt: string;
}

// ── Normalization ─────────────────────────────────────────────────────────────

function normalizeRecord(record: any): MultiModelRecord {
  if (record.runs) return record as MultiModelRecord;
  const run: any = { analyzedAt: record.analyzedAt };
  if (record.emerging)    run.emerging    = record.emerging;
  if (record.diminishing) run.diminishing = record.diminishing;
  if (record.warnings)    run.warnings    = record.warnings;
  return {
    profileId:  record.profileId,
    profile:    record.profile ?? null,
    orgName:    record.orgName ?? "",
    industry:   record.industry ?? "",
    department: record.department ?? "",
    jdText:     record.jdText ?? "",
    runs: { "claude-sonnet-4-6": run },
  };
}

function getRecordDate(r: MultiModelRecord): number {
  const dates = Object.values(r.runs).map(run => new Date((run as ModelRun).analyzedAt).getTime());
  return dates.length ? Math.max(...dates) : 0;
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const confidenceStyle = (c?: string) => {
  if (c === "high")   return "bg-green-100 text-green-800";
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
  if (g === "absent")               return "bg-red-100 text-red-800";
  if (g === "adjacent")             return "bg-yellow-100 text-yellow-800";
  if (g === "present-but-evolving") return "bg-purple-100 text-purple-800";
  return "bg-muted text-muted-foreground";
};

const categoryBadge = (cat?: string) => {
  const map: Record<string, string> = {
    "Technical":       "bg-blue-100 text-blue-800",
    "Methodology":     "bg-indigo-100 text-indigo-800",
    "Tool":            "bg-cyan-100 text-cyan-800",
    "Domain Knowledge":"bg-emerald-100 text-emerald-800",
    "Soft Skill":      "bg-pink-100 text-pink-800",
  };
  return (cat && map[cat]) ?? "bg-muted text-muted-foreground";
};

const declineReasonLabel: Record<string, string> = {
  ai_automation:       "AI Automation",
  tool_supersession:   "Tool Superseded",
  commoditization:     "Commoditized",
  legacy_phase_out:    "Legacy Phase-out",
  process_elimination: "Process Eliminated",
};

const declineHorizonStyle = (h?: string) => {
  if (!h) return "bg-muted text-muted-foreground";
  if (h === "already declining") return "bg-red-100 text-red-800 border border-red-200";
  if (h.startsWith("6")) return "bg-amber-50 text-amber-700 border border-amber-200";
  return "bg-blue-50 text-blue-700 border border-blue-200";
};

// ── Profile helpers ───────────────────────────────────────────────────────────

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

// ── Skill row components ──────────────────────────────────────────────────────

function EmergingSkillRow({ skill, rank }: { skill: EmergingSkill; rank: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded cursor-default transition-colors hover:bg-green-50">
          <span className="text-[10px] font-bold text-muted-foreground w-4 shrink-0">#{rank}</span>
          <span className="text-[11px] font-medium flex-1 text-foreground">{skill.skill_name}</span>
          {skill.category && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${categoryBadge(skill.category)}`}>
              {skill.category}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[280px] space-y-1.5 p-3">
        <p className="text-xs font-semibold">{skill.skill_name}</p>
        <div className="flex flex-wrap gap-1 pt-1 border-t border-border">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${confidenceStyle(skill.confidence)}`}>{skill.confidence}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${horizonStyle(skill.time_horizon)}`}>{skill.time_horizon}</span>
          {skill.profile_gap && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${gapStyle(skill.profile_gap)}`}>{skill.profile_gap}</span>
          )}
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

function DiminishingSkillRow({ skill, rank }: { skill: DiminishingSkill; rank: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded cursor-default transition-colors hover:bg-red-50">
          <span className="text-[10px] font-bold text-muted-foreground w-4 shrink-0">#{rank}</span>
          <span className="text-[11px] font-medium flex-1 text-foreground">{skill.skill_name}</span>
          {skill.category && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${categoryBadge(skill.category)}`}>
              {skill.category}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[280px] space-y-1.5 p-3">
        <p className="text-xs font-semibold">{skill.skill_name}</p>
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

// ── Single model column ───────────────────────────────────────────────────────

function ModelRunColumn({
  modelId,
  run,
  isReference,
  onSetReference,
  showReferencePicker,
}: {
  modelId: ModelId;
  run: ModelRun;
  isReference?: boolean;
  onSetReference?: () => void;
  showReferencePicker?: boolean;
}) {
  const emerging: EmergingSkill[] = run.emerging?.emerging_skills ?? [];
  const diminishing: DiminishingSkill[] = run.diminishing?.diminishing_skills ?? run.diminishing?.skills ?? [];

  return (
    <div className={`flex flex-col gap-3 rounded-lg border p-3 ${isReference ? "border-blue-300 bg-blue-50/20" : "border-border bg-card"}`}>
      {/* Column header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-foreground">{MODEL_LABELS[modelId]}</span>
          {run.warnings?.length ? (
            <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-700">
              {run.warnings.length}⚠
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">{emerging.length}↑</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 font-medium">{diminishing.length}↓</span>
        </div>
      </div>

      {/* Emerging */}
      <div>
        <div className="flex items-center gap-1 mb-1">
          <TrendingUp className="h-3 w-3 text-green-600" />
          <p className="text-[11px] font-semibold text-foreground">Emerging</p>
        </div>
        <div className="space-y-0.5">
          {emerging.length === 0
            ? <p className="text-[10px] text-muted-foreground italic px-2">No data.</p>
            : emerging.map((s, i) => <EmergingSkillRow key={i} skill={s} rank={i + 1} />)}
        </div>
      </div>

      {/* Diminishing */}
      <div>
        <div className="flex items-center gap-1 mb-1">
          <TrendingDown className="h-3 w-3 text-red-500" />
          <p className="text-[11px] font-semibold text-foreground">Diminishing</p>
        </div>
        <div className="space-y-0.5">
          {diminishing.length === 0
            ? <p className="text-[10px] text-muted-foreground italic px-2">No data.</p>
            : diminishing.map((s, i) => <DiminishingSkillRow key={i} skill={s} rank={i + 1} />)}
        </div>
      </div>

      {/* Reference selector */}
      {showReferencePicker && (
        <button
          onClick={onSetReference}
          className={`mt-auto w-full text-[10px] py-1 rounded border transition-colors ${
            isReference
              ? "bg-blue-100 border-blue-300 text-blue-700 font-semibold"
              : "border-border text-muted-foreground hover:bg-muted"
          }`}
        >
          {isReference ? "✓ Use for Report" : "Use for Report"}
        </button>
      )}
    </div>
  );
}

// ── Evaluation panel ─────────────────────────────────────────────────────────

function EvaluationPanel({ evaluation }: { evaluation: EvaluationResult }) {
  const scoreColor = (s: number) =>
    s >= 8 ? "text-green-700 font-semibold" : s >= 6 ? "text-amber-600" : "text-red-600";

  const recStyle = (r: string) =>
    r === "include" ? "bg-green-50 border-green-200 text-green-700"
    : r === "exclude" ? "bg-red-50 border-red-200 text-red-600"
    : "bg-amber-50 border-amber-200 text-amber-700";

  const consensusEmerging   = (evaluation.consensus?.emerging   ?? []).filter(c => c.agreed_by?.length > 1);
  const consensusDiminishing = (evaluation.consensus?.diminishing ?? []).filter(c => c.agreed_by?.length > 1);
  const allFlags = (evaluation.model_evaluations ?? []).flatMap(me =>
    (me.flagged_skills ?? []).map(f => ({ ...f, model_label: me.model_label }))
  );

  return (
    <div className="mt-4 border-t pt-4 space-y-4">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-violet-500" />
        <p className="text-xs font-semibold text-violet-700">Claude Sonnet Evaluation</p>
      </div>

      {evaluation.overall_assessment && (
        <p className="text-[11px] text-muted-foreground leading-relaxed bg-violet-50 border border-violet-100 rounded p-2">
          {evaluation.overall_assessment}
        </p>
      )}

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${Math.min(evaluation.model_evaluations?.length ?? 1, 4)}, minmax(0, 1fr))` }}
      >
        {(evaluation.model_evaluations ?? []).map(me => (
          <div
            key={me.model_id}
            className={`rounded border p-2 space-y-1.5 ${me.model_id === evaluation.recommended_model ? "border-violet-300 bg-violet-50/50" : "border-border bg-muted/20"}`}
          >
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <p className="text-[10px] font-semibold">{me.model_label}</p>
              {me.model_id === evaluation.recommended_model && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-violet-100 text-violet-700 font-medium whitespace-nowrap">✓ Best</span>
              )}
            </div>
            <div className="flex gap-3 text-[10px]">
              <span className="flex items-center gap-0.5">
                <TrendingUp className="h-2.5 w-2.5 text-green-500" />
                <span className={scoreColor(me.emerging_score)}>{me.emerging_score}/10</span>
              </span>
              <span className="flex items-center gap-0.5">
                <TrendingDown className="h-2.5 w-2.5 text-red-400" />
                <span className={scoreColor(me.diminishing_score)}>{me.diminishing_score}/10</span>
              </span>
            </div>
            {me.strengths && <p className="text-[9px] text-muted-foreground leading-tight">✓ {me.strengths}</p>}
            {me.weaknesses && <p className="text-[9px] text-red-500 leading-tight">✗ {me.weaknesses}</p>}
            {(me.flagged_skills?.length ?? 0) > 0 && (
              <p className="text-[9px] text-amber-600">{me.flagged_skills.length} issue{me.flagged_skills.length !== 1 ? "s" : ""} flagged</p>
            )}
          </div>
        ))}
      </div>

      {evaluation.recommended_model_rationale && (
        <p className="text-[10px] text-muted-foreground italic">
          Recommended:{" "}
          <span className="font-medium not-italic text-violet-700">
            {(evaluation.model_evaluations ?? []).find(m => m.model_id === evaluation.recommended_model)?.model_label ?? evaluation.recommended_model}
          </span>{" "}
          — {evaluation.recommended_model_rationale}
        </p>
      )}

      {(consensusEmerging.length > 0 || consensusDiminishing.length > 0) && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground">Consensus Skills (2+ models agree)</p>
          <div className="flex flex-wrap gap-1">
            {consensusEmerging.map((c, i) => (
              <span key={`e${i}`} className={`text-[9px] px-1.5 py-0.5 rounded-full border ${recStyle(c.recommendation)}`}>
                ↑ {c.skill_name}
              </span>
            ))}
            {consensusDiminishing.map((c, i) => (
              <span key={`d${i}`} className={`text-[9px] px-1.5 py-0.5 rounded-full border ${recStyle(c.recommendation)}`}>
                ↓ {c.skill_name}
              </span>
            ))}
          </div>
        </div>
      )}

      {allFlags.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground">Flagged Issues</p>
          <div className="space-y-0.5">
            {allFlags.map((f, i) => (
              <div key={i} className="text-[9px] flex items-start gap-1 text-amber-700">
                <span className="shrink-0 font-medium">[{f.model_label}]</span>
                <span className="font-medium">{f.skill_name}</span>
                <span className="text-muted-foreground">— {f.note}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Multi-model result grid ───────────────────────────────────────────────────

function MultiModelResultGrid({
  record,
  onDelete,
  onAddToReport,
  addingToReport,
  onEvaluate,
  evaluating,
  evaluation,
}: {
  record: MultiModelRecord;
  onDelete?: () => void;
  onAddToReport?: (run: ModelRun, modelId: ModelId) => void;
  addingToReport?: boolean;
  onEvaluate?: () => void;
  evaluating?: boolean;
  evaluation?: EvaluationResult;
}) {
  const runEntries = Object.entries(record.runs) as [ModelId, ModelRun][];
  const [referenceModelId, setReferenceModelId] = useState<ModelId>(
    runEntries[0]?.[0] ?? "azure-gpt-4o"
  );

  const refRun = record.runs[referenceModelId];

  const runsWithData = runEntries.filter(([, run]) =>
    (run.emerging?.emerging_skills?.length ?? 0) > 0 ||
    (run.diminishing?.diminishing_skills?.length ?? run.diminishing?.skills?.length ?? 0) > 0
  );
  const canEvaluate = runsWithData.length >= 2;
  const analyzedDate = refRun?.analyzedAt
    ? new Date(refRun.analyzedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">
              {record.profile?.title ?? "Analysis"}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
              {record.industry && <span>{record.industry}</span>}
              {record.orgName && <><span>·</span><span>{record.orgName}</span></>}
              {analyzedDate && (
                <><span>·</span>
                  <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{analyzedDate}</span>
                </>
              )}
              <span className="flex items-center gap-0.5 font-medium text-primary">
                <BrainCircuit className="h-3 w-3" />{runEntries.length} model{runEntries.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onEvaluate && canEvaluate && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-50"
                onClick={onEvaluate}
                disabled={evaluating}
              >
                {evaluating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {evaluating ? "Evaluating…" : evaluation ? "Re-evaluate" : "Evaluate with Claude"}
              </Button>
            )}
            {onAddToReport && refRun && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] gap-1.5 border-green-300 text-green-700 hover:bg-green-50"
                onClick={() => onAddToReport(refRun, referenceModelId)}
                disabled={addingToReport}
              >
                {addingToReport ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Add to Report ({MODEL_LABELS[referenceModelId]})
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
        <p className="text-[10px] text-muted-foreground pt-1">
          Hover a skill for details · click "Use for Report" on a column to select it for export
        </p>
      </CardHeader>

      <CardContent>
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${runEntries.length}, minmax(0, 1fr))` }}
        >
          {runEntries.map(([modelId, run]) => (
            <ModelRunColumn
              key={modelId}
              modelId={modelId}
              run={run}
              isReference={referenceModelId === modelId}
              onSetReference={() => setReferenceModelId(modelId)}
              showReferencePicker={!!onAddToReport}
            />
          ))}
        </div>
        {evaluation && <EvaluationPanel evaluation={evaluation} />}
      </CardContent>
    </Card>
  );
}

// ── Model picker ──────────────────────────────────────────────────────────────

function ModelPicker({
  selected,
  onChange,
}: {
  selected: ModelId[];
  onChange: (ids: ModelId[]) => void;
}) {
  const allModels: ModelId[] = [...DEFAULT_MULTI_MODELS, "claude-sonnet-4-6"];

  const toggle = (id: ModelId) => {
    if (selected.includes(id)) {
      if (selected.length === 1) return; // keep at least one
      onChange(selected.filter(m => m !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>Models to Compare</Label>
      <div className="flex flex-wrap gap-2">
        {allModels.map((id) => {
          const isAzure = id !== "claude-sonnet-4-6";
          const active = selected.includes(id);
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                active
                  ? isAzure
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-violet-600 border-violet-600 text-white"
                  : "bg-background border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white" : "bg-muted-foreground"}`} />
              {MODEL_LABELS[id]}
              {!isAzure && <span className="text-[10px] opacity-75">(opt-in)</span>}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {selected.length} model{selected.length !== 1 ? "s" : ""} selected · same prompt sent to all
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const LS_KEY             = "rolescope_results";
const LS_REPORT_KEY      = "rolescope_report_entries";

const SkillsMapper = () => {
  const [jdText, setJdText]                   = useState("");
  const [tasksText, setTasksText]             = useState("");
  const [orgName, setOrgName]                 = useState("");
  const [industry, setIndustry]               = useState("");
  const [department, setDepartment]           = useState("");
  const [selectedModels, setSelectedModels]   = useState<ModelId[]>([...DEFAULT_MULTI_MODELS]);
  const [loading, setLoading]                 = useState(false);
  const [liveResult, setLiveResult]           = useState<MultiModelRecord | null>(null);
  const [savedResults, setSavedResults]       = useState<MultiModelRecord[]>([]);
  const [activeTab, setActiveTab]             = useState("run");
  const [addingToReport, setAddingToReport]   = useState<string | null>(null);
  const [reportEntries, setReportEntries]     = useState<ReportEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_REPORT_KEY) || "[]"); } catch { return []; }
  });
  const [confirmEntry, setConfirmEntry]       = useState<{ record: MultiModelRecord; run: ModelRun; modelId: ModelId } | null>(null);
  const [evaluations, setEvaluations]         = useState<Record<string, EvaluationResult>>({});
  const [evaluatingId, setEvaluatingId]       = useState<string | null>(null);

  // ── Storage helpers ─────────────────────────────────────────────────────────

  const loadSaved = useCallback(async () => {
    let local: Record<string, any> = {};
    try { local = JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch {}
    try {
      const res = await fetch("/api/stored-results");
      const server = await res.json();
      if (server && typeof server === "object") {
        const merged = { ...server, ...local };
        localStorage.setItem(LS_KEY, JSON.stringify(merged));
        local = merged;
      }
    } catch {}
    setSavedResults(
      Object.values(local)
        .map(normalizeRecord)
        .sort((a, b) => getRecordDate(b) - getRecordDate(a))
    );
  }, []);

  const saveToLocal = useCallback((record: MultiModelRecord) => {
    try {
      const existing: Record<string, any> = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
      existing[record.profileId] = record;
      localStorage.setItem(LS_KEY, JSON.stringify(existing));
      setSavedResults(
        Object.values(existing)
          .map(normalizeRecord)
          .sort((a, b) => getRecordDate(b) - getRecordDate(a))
      );
    } catch {}
  }, []);

  const deleteFromLocal = useCallback((profileId: string) => {
    try {
      const existing: Record<string, any> = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
      delete existing[profileId];
      localStorage.setItem(LS_KEY, JSON.stringify(existing));
      setSavedResults(
        Object.values(existing)
          .map(normalizeRecord)
          .sort((a, b) => getRecordDate(b) - getRecordDate(a))
      );
    } catch {}
    fetch(`/api/stored-results/${profileId}`, { method: "DELETE" }).catch(() => {});
  }, []);

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  useEffect(() => {
    loadSaved();
  }, []);

  // ── Run ─────────────────────────────────────────────────────────────────────

  const handleRunAnalysis = async () => {
    if (!jdText.trim()) { toast.error("Please provide a job description."); return; }
    const tasks = tasksText.split("\n").map(t => t.trim()).filter(Boolean);
    if (!tasks.length) { toast.error("Please provide at least one task."); return; }
    if (!selectedModels.length) { toast.error("Select at least one model."); return; }

    setLoading(true);
    setLiveResult(null);
    try {
      const res = await fetch("/api/full-analysis-multi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jdText: jdText.trim(),
          tasks,
          orgName:    orgName.trim(),
          industry:   industry.trim(),
          jobTitle:   "",
          department: department.trim(),
          profile:    null,
          models:     selectedModels,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed.");
      const record = normalizeRecord(data);
      record.jdText = jdText.trim();
      setLiveResult(record);
      saveToLocal(record);
      toast.success(`Analysis complete — ${selectedModels.length} model${selectedModels.length !== 1 ? "s" : ""} compared.`);
      setTimeout(() => setActiveTab("saved"), 3000);
    } catch (err: any) {
      toast.error(err.message || "Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  // ── Evaluate ────────────────────────────────────────────────────────────────

  const handleEvaluate = async (record: MultiModelRecord) => {
    const resolvedJd = record.jdText || record.profile?.purpose || "";
    if (!resolvedJd.trim()) { toast.error("No job description available to evaluate against."); return; }
    const runEntries = Object.entries(record.runs);
    if (runEntries.length < 2) { toast.error("Need at least 2 model outputs to evaluate."); return; }

    setEvaluatingId(record.profileId);
    try {
      const tasksList = record.profile?.tasks
        ? record.profile.tasks.map((t, i) => `${i + 1}. ${t.name}`).join("\n")
        : "";
      const res = await fetch("/api/evaluate-skills-multi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runs:       record.runs,
          jdText:     resolvedJd,
          tasks:      tasksList,
          orgName:    record.orgName,
          industry:   record.industry,
          department: record.department,
          jobTitle:   record.profile?.title || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Evaluation failed.");
      setEvaluations(prev => ({ ...prev, [record.profileId]: data }));
      toast.success("Evaluation complete.");
    } catch (err: any) {
      toast.error(err.message || "Evaluation failed.");
    } finally {
      setEvaluatingId(null);
    }
  };

  // ── Report ──────────────────────────────────────────────────────────────────

  const handleAddToReport = async (record: MultiModelRecord, run: ModelRun, modelId: ModelId) => {
    setAddingToReport(record.profileId);
    try {
      const entry: ReportEntry = {
        profileId:  record.profileId,
        modelId,
        profile:    record.profile,
        orgName:    record.orgName,
        industry:   record.industry,
        department: record.department,
        emerging:   run.emerging,
        diminishing:run.diminishing,
        analyzedAt: run.analyzedAt,
      };
      const next = [...reportEntries.filter(e => e.profileId !== record.profileId), entry];
      setReportEntries(next);
      localStorage.setItem(LS_REPORT_KEY, JSON.stringify(next));
      // best-effort server export in old AnalysisRecord shape
      fetch("/api/export-to-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record: {
            profileId:  record.profileId,
            profile:    record.profile,
            orgName:    record.orgName,
            industry:   record.industry,
            department: record.department,
            analyzedAt: run.analyzedAt,
            emerging:   run.emerging,
            diminishing:run.diminishing,
          },
        }),
      }).catch(() => {});
      setActiveTab("report");
      toast.success(`Added ${MODEL_LABELS[modelId]} output to report.`);
    } finally {
      setAddingToReport(null);
      setConfirmEntry(null);
    }
  };

  const handleDownloadSheet = async () => {
    try {
      const records = reportEntries.map(e => ({
        profileId:  e.profileId,
        profile:    e.profile,
        orgName:    e.orgName,
        industry:   e.industry,
        department: e.department,
        analyzedAt: e.analyzedAt,
        emerging:   e.emerging,
        diminishing:e.diminishing,
      }));
      const res = await fetch("/api/generate-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      });
      if (!res.ok) throw new Error("Download failed.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "skills-analysis-report.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message || "Download failed.");
    }
  };

  const handleDelete = (profileId: string) => {
    deleteFromLocal(profileId);
    toast.success("Result deleted.");
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const tasks = tasksText.split("\n").map(t => t.trim()).filter(Boolean);

  const sheetRows = reportEntries.map((entry, idx) => ({
    sno:        idx + 1,
    role:       entry.profile?.title ?? "—",
    date:       entry.analyzedAt
      ? new Date(entry.analyzedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : "",
    modelId:    entry.modelId,
    emerging:   (entry.emerging?.emerging_skills ?? []).map(s => s.skill_name),
    diminishing:(entry.diminishing?.diminishing_skills ?? []).map(s => s.skill_name),
  }));

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
    <AlertDialog open={!!confirmEntry} onOpenChange={o => { if (!o) setConfirmEntry(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Add to Report
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-1">
            <span className="block font-medium text-foreground">
              {confirmEntry?.record.profile?.title ?? "This analysis"} — {confirmEntry?.modelId ? MODEL_LABELS[confirmEntry.modelId] : ""}
            </span>
            <span className="block text-sm">
              Will be added to the report with{" "}
              {(confirmEntry?.run.emerging?.emerging_skills ?? []).length} emerging and{" "}
              {(confirmEntry?.run.diminishing?.diminishing_skills ?? []).length} diminishing skills.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-green-600 hover:bg-green-700"
            onClick={() => confirmEntry && handleAddToReport(confirmEntry.record, confirmEntry.run, confirmEntry.modelId)}
          >
            Add to Report
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <div className="flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-6xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Skills Mapper</h1>
          <p className="text-muted-foreground text-sm">
            Compare emerging and diminishing skills across multiple AI models. Same prompt, same input — pick the best output.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
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
            <TabsTrigger value="report">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Report
              {reportEntries.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full font-medium">
                  {reportEntries.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Run Analysis tab ── */}
          <TabsContent value="run" className="space-y-5 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Input</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="org">Organisation</Label>
                    <Input id="org" placeholder="e.g. Acme Bank" value={orgName} onChange={e => setOrgName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="industry">Industry</Label>
                    <Input id="industry" placeholder="e.g. Banking" value={industry} onChange={e => setIndustry(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dept">Department</Label>
                    <Input id="dept" placeholder="e.g. IT and Digitalization" value={department} onChange={e => setDepartment(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="jd">Job Description / Purpose</Label>
                  <Textarea
                    id="jd"
                    placeholder="Paste job description or purpose here…"
                    className="min-h-[100px] font-mono text-xs"
                    value={jdText}
                    onChange={e => setJdText(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tasks">Tasks (one per line)</Label>
                  <Textarea
                    id="tasks"
                    placeholder="Development Planning Support - Performs Independently&#10;Bug Fixing and Problem Investigation - Performs Independently"
                    className="min-h-[100px] font-mono text-xs"
                    value={tasksText}
                    onChange={e => setTasksText(e.target.value)}
                  />
                  {tasks.length > 0 && (
                    <p className="text-xs text-muted-foreground">{tasks.length} task{tasks.length !== 1 ? "s" : ""} detected</p>
                  )}
                </div>

                {/* Model picker */}
                <ModelPicker selected={selectedModels} onChange={setSelectedModels} />

                <Button
                  className="w-full"
                  onClick={handleRunAnalysis}
                  disabled={loading || !jdText.trim() || tasks.length === 0 || selectedModels.length === 0}
                >
                  {loading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Running {selectedModels.length} model{selectedModels.length !== 1 ? "s" : ""} in parallel…</>
                    : <><BrainCircuit className="mr-2 h-4 w-4" />Run Emerging + Diminishing on {selectedModels.length} Model{selectedModels.length !== 1 ? "s" : ""}</>}
                </Button>
              </CardContent>
            </Card>

            {liveResult && (
              <MultiModelResultGrid
                record={liveResult}
                onAddToReport={(run, modelId) => setConfirmEntry({ record: liveResult, run, modelId })}
                addingToReport={addingToReport === liveResult.profileId}
                onEvaluate={() => handleEvaluate(liveResult)}
                evaluating={evaluatingId === liveResult.profileId}
                evaluation={evaluations[liveResult.profileId]}
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
                  {reportEntries.length > 0 && (
                    <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={handleDownloadSheet}>
                      <Download className="h-3.5 w-3.5" />Download Report
                    </Button>
                  )}
                </div>
                <div className="space-y-4">
                  {savedResults.map(r => (
                    <MultiModelResultGrid
                      key={r.profileId}
                      record={r}
                      onDelete={() => handleDelete(r.profileId)}
                      onAddToReport={(run, modelId) => setConfirmEntry({ record: r, run, modelId })}
                      addingToReport={addingToReport === r.profileId}
                      onEvaluate={Object.keys(r.runs).length >= 2 ? () => handleEvaluate(r) : undefined}
                      evaluating={evaluatingId === r.profileId}
                      evaluation={evaluations[r.profileId]}
                    />
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          {/* ── Report Preview tab ── */}
          <TabsContent value="report" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-green-600" />
                      Skills Analysis Report
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {sheetRows.length} role{sheetRows.length !== 1 ? "s" : ""} added · downloads as{" "}
                      <code className="bg-muted px-1 rounded">skills-analysis-report.xlsx</code>
                    </CardDescription>
                  </div>
                  {sheetRows.length > 0 && (
                    <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={handleDownloadSheet}>
                      <Download className="h-3.5 w-3.5" />Download XLSX
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {sheetRows.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No entries yet — click <strong>Add to Report</strong> on any result.
                  </div>
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-[#1F3864] text-white">
                          <th className="px-3 py-2 text-left font-semibold w-8">#</th>
                          <th className="px-3 py-2 text-left font-semibold w-40">Role</th>
                          <th className="px-3 py-2 text-left font-semibold w-24">Model</th>
                          <th className="px-3 py-2 text-left font-semibold text-green-300">Emerging Skills ▲</th>
                          <th className="px-3 py-2 text-left font-semibold text-red-300">Diminishing Skills ▼</th>
                          <th className="px-3 py-2 text-left font-semibold w-24">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sheetRows.map((row, ri) => {
                          const maxLen = Math.max(row.emerging?.length ?? 0, row.diminishing?.length ?? 0, 1);
                          return Array.from({ length: maxLen }).map((_, si) => (
                            <tr key={`${ri}-${si}`} className={si % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              {si === 0 && (
                                <>
                                  <td rowSpan={maxLen} className="px-3 py-1.5 border border-gray-200 text-muted-foreground align-middle text-center font-medium">{row.sno}</td>
                                  <td rowSpan={maxLen} className="px-3 py-1.5 border border-gray-200 font-medium align-middle">{row.role}</td>
                                  <td rowSpan={maxLen} className="px-3 py-1.5 border border-gray-200 align-middle">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
                                      {MODEL_LABELS[row.modelId] ?? row.modelId}
                                    </span>
                                  </td>
                                </>
                              )}
                              <td className="px-3 py-1.5 border border-gray-200 text-green-800 bg-green-50">
                                {row.emerging?.[si] ?? ""}
                              </td>
                              <td className="px-3 py-1.5 border border-gray-200 text-red-800 bg-red-50">
                                {row.diminishing?.[si] ?? ""}
                              </td>
                              {si === 0 && (
                                <td rowSpan={maxLen} className="px-3 py-1.5 border border-gray-200 text-muted-foreground align-middle whitespace-nowrap">{row.date}</td>
                              )}
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </>
  );
};

export default SkillsMapper;
