import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Loader2, ClipboardPaste, ThumbsUp, ThumbsDown, FlaskConical, Copy, Check, Zap, Info } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Confidence { score: number; source: "QUOTE" | "INFER" | "PATTERN"; }
interface TaskScore { name: string; groundedness: number; specificity: number; actionability: number; }
interface Evaluation { task_scores: TaskScore[]; overall_quality: number; missed_tasks: string[]; hallucinated_tasks: string[]; }
interface ExtractedTask { name: string; description: string; reasoning: string; priority: "core" | "supporting" | "peripheral"; category: string; confidence: Confidence; }
interface ApiResponse { tasks: ExtractedTask[]; summary: string; quality_notes: string | null; }

const Index = () => {
  const navigate = useNavigate();
  const [jdText, setJdText] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [feedback, setFeedback] = useState<Record<number, "up" | "down">>({});
  const [copied, setCopied] = useState<Record<number, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "pdf" || ext === "docx") {
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/parse-file", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to parse file.");
        setJdText(data.text);
      } catch (err: any) {
        toast.error(err.message || "Failed to parse file.");
        setFileName("");
      }
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => setJdText(ev.target?.result as string);
      reader.readAsText(file);
    }
  };

  const handleExtract = async () => {
    if (!jdText.trim()) { toast.error("Please paste or upload a job description first."); return; }
    setLoading(true); setResult(null); setEvaluation(null); setFeedback({}); setCopied({});
    try {
      const res = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jdText: jdText.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to extract tasks.");
      if (!data.tasks?.length) toast.info("No tasks could be extracted.");
      setResult(data);
    } catch (err: any) { toast.error(err.message || "Failed to extract tasks."); }
    finally { setLoading(false); }
  };

  const handleEvaluate = async () => {
    if (!result?.tasks?.length) return;
    setEvaluating(true);
    try {
      const res = await fetch("/api/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jdText: jdText.trim(), tasks: result.tasks }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Evaluation failed.");
      setEvaluation(data); toast.success("Evaluation complete.");
    } catch (err: any) { toast.error(err.message || "Evaluation failed."); }
    finally { setEvaluating(false); }
  };

  const handleCopy = (text: string, i: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied((prev) => ({ ...prev, [i]: true }));
      setTimeout(() => setCopied((prev) => ({ ...prev, [i]: false })), 1500);
    });
  };

  const toggleFeedback = (i: number, val: "up" | "down") =>
    setFeedback((prev) => ({ ...prev, [i]: prev[i] === val ? undefined as any : val }));

  const priorityStyle = (p: string) => {
    if (p === "core") return "bg-primary/10 text-primary border border-primary/20";
    if (p === "supporting") return "bg-accent text-accent-foreground";
    return "bg-muted text-muted-foreground";
  };

  const confidenceBadge = (c: Confidence) => {
    const pct = Math.round(c.score * 100);
    const color = c.source === "QUOTE" ? "bg-green-100 text-green-800" : c.source === "INFER" ? "bg-yellow-100 text-yellow-800" : "bg-orange-100 text-orange-800";
    return { pct, color, label: c.source };
  };

  const scoreBar = (val: number) => ({ w: `${(val / 5) * 100}%`, color: val >= 4 ? "bg-green-500" : val >= 3 ? "bg-yellow-400" : "bg-red-400" });
  const getTaskScore = (name: string) => evaluation?.task_scores.find((s) => s.name === name);

  return (
    <div className="flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-2xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">JD Task Extractor</h1>
          <p className="text-muted-foreground text-sm">Paste or upload a job description to extract concrete weekly/monthly tasks.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Job Description Input</CardTitle>
            <CardDescription>Provide the JD text via paste or file upload.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="paste" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="paste"><ClipboardPaste className="mr-2 h-4 w-4" />Paste Text</TabsTrigger>
                <TabsTrigger value="upload"><Upload className="mr-2 h-4 w-4" />Upload File</TabsTrigger>
              </TabsList>
              <TabsContent value="paste">
                <Textarea placeholder="Paste the full job description here..." className="min-h-[200px]" value={jdText} onChange={(e) => setJdText(e.target.value)} />
              </TabsContent>
              <TabsContent value="upload" className="space-y-3">
                <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf,.doc,.docx" className="hidden" onChange={handleFileUpload} />
                <Button variant="outline" className="w-full h-24 border-dashed" onClick={() => fileInputRef.current?.click()}>
                  <div className="flex flex-col items-center gap-1">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{fileName || "Click to select a .txt, pdf, docx, or .md file"}</span>
                  </div>
                </Button>
                {jdText && fileName && <p className="text-sm text-muted-foreground">✓ File loaded — {jdText.length} characters</p>}
              </TabsContent>
            </Tabs>
            <Button className="w-full mt-4" onClick={handleExtract} disabled={loading || !jdText.trim()}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Extracting…</> : "Extract Tasks"}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <>
            {result.summary && (
              <Card>
                <CardContent className="pt-4 pb-4 space-y-2">
                  <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Role summary: </span>{result.summary}</p>
                  {result.quality_notes && <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Quality notes: </span>{result.quality_notes}</p>}
                </CardContent>
              </Card>
            )}

            {result.tasks?.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg">Extracted Tasks ({result.tasks.length})</CardTitle>
                  <Button size="sm" variant="outline" onClick={handleEvaluate} disabled={evaluating}>
                    {evaluating ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Evaluating…</> : <><FlaskConical className="mr-2 h-3 w-3" />Evaluate Output</>}
                  </Button>
                </CardHeader>

                {evaluation && (
                  <div className="px-6 pb-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="text-center min-w-[3rem]">
                        <p className="text-2xl font-bold text-foreground">{evaluation.overall_quality}<span className="text-sm text-muted-foreground">/10</span></p>
                        <p className="text-xs text-muted-foreground">Overall</p>
                      </div>
                      <div className="flex-1 space-y-1 text-xs text-muted-foreground">
                        {evaluation.missed_tasks.length > 0 && <p><span className="font-medium text-foreground">Missed: </span>{evaluation.missed_tasks.join(", ")}</p>}
                        {evaluation.hallucinated_tasks.length > 0 && <p><span className="font-medium text-red-600">Hallucinated: </span>{evaluation.hallucinated_tasks.join(", ")}</p>}
                        {evaluation.missed_tasks.length === 0 && evaluation.hallucinated_tasks.length === 0 && <p className="text-green-700">No missed or hallucinated tasks detected.</p>}
                      </div>
                    </div>
                  </div>
                )}

                <CardContent className="space-y-3">
                  {result.tasks.map((t, i) => {
                    const cb = confidenceBadge(t.confidence);
                    const score = getTaskScore(t.name);
                    return (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                        <span className="text-sm font-medium text-muted-foreground mt-0.5 min-w-[1.5rem]">{i + 1}.</span>
                        <div className="flex-1 space-y-1.5">
                          <p className="text-sm font-medium text-foreground">{t.name}</p>
                          <p className="text-xs text-muted-foreground">{t.description}</p>
                          <p className="text-xs text-muted-foreground italic">{t.reasoning}</p>

                          <div className="flex gap-2 flex-wrap items-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${priorityStyle(t.priority)}`}>{t.priority}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/50 text-secondary-foreground">{t.category}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cb.color}`}>{cb.label} · {cb.pct}%</span>
                          </div>

                          {score && (
                            <div className="grid grid-cols-3 gap-2 pt-1">
                              {(["groundedness", "specificity", "actionability"] as const).map((dim) => {
                                const bar = scoreBar(score[dim]);
                                const tips: Record<string, string> = {
                                  groundedness: "Is this task actually supported by the JD? 5 = explicitly stated, 1 = not mentioned or contradicted.",
                                  specificity: "Is this task specific to this role, not something any employee does? 5 = highly role-specific, 1 = completely generic.",
                                  actionability: "Is this a concrete, verifiable work activity with a clear output? 5 = manager can verify it was done, 1 = vague or unmeasurable.",
                                };
                                return (
                                  <div key={dim} className="space-y-0.5">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <p className="text-[10px] text-muted-foreground capitalize flex items-center gap-0.5 cursor-default w-fit">
                                          {dim}
                                          <Info className="h-2.5 w-2.5 shrink-0" />
                                        </p>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-[200px] text-xs">
                                        {tips[dim]}
                                      </TooltipContent>
                                    </Tooltip>
                                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${bar.color}`} style={{ width: bar.w }} />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">{score[dim]}/5</p>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div className="flex items-center gap-1 pt-0.5">
                            <button onClick={() => handleCopy(t.name, i)} className="p-1 rounded transition-colors text-muted-foreground hover:text-foreground" title="Copy task name">
                              {copied[i] ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                            <button onClick={() => navigate("/automate", { state: { task: t.name } })} className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors" title="See automation suggestions">
                              <Zap className="h-3 w-3" />See how this automates
                            </button>
                            <div className="flex-1" />
                            <button onClick={() => toggleFeedback(i, "up")} className={`p-1 rounded transition-colors ${feedback[i] === "up" ? "text-green-600" : "text-muted-foreground hover:text-green-600"}`} title="Mark as correct">
                              <ThumbsUp className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => toggleFeedback(i, "down")} className={`p-1 rounded transition-colors ${feedback[i] === "down" ? "text-red-500" : "text-muted-foreground hover:text-red-500"}`} title="Mark as incorrect">
                              <ThumbsDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Index;
