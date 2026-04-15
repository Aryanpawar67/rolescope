import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

interface AutomationSuggestion {
  task: string;
  suggestion_name: string;
  type: "script" | "no-code" | "ai-agent" | "integration" | "workflow";
  description: string;
  confidence: number;
  confidence_label: "High" | "Medium" | "Low";
  explanation: string;
  tools_mentioned: string[];
}

interface AutomateApiResponse {
  suggestions: AutomationSuggestion[];
}

const confidenceStyle = (label: "High" | "Medium" | "Low") => {
  if (label === "High") return "bg-green-100 text-green-800";
  if (label === "Medium") return "bg-yellow-100 text-yellow-800";
  return "bg-orange-100 text-orange-800";
};

const typeStyle = "bg-secondary/50 text-secondary-foreground";

const TaskAutomator = () => {
  const location = useLocation();
  const [taskInput, setTaskInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AutomateApiResponse | null>(null);

  useEffect(() => {
    const incoming = (location.state as { task?: string } | null)?.task;
    if (incoming) {
      setTaskInput(incoming);
      setResults(null);
      window.history.replaceState({}, "");
    }
  }, []);

  const handleAutomate = async () => {
    const tasks = taskInput
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);

    if (tasks.length === 0) {
      toast.error("Please enter at least one task.");
      return;
    }

    setLoading(true);
    setResults(null);
    try {
      const res = await fetch("/api/automate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get automation suggestions.");
      setResults(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to get automation suggestions.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-2xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Task Automator</h1>
          <p className="text-muted-foreground text-sm">
            Enter one or more tasks (one per line) to get practical automation suggestions.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tasks to Automate</CardTitle>
            <CardDescription>
              Paste tasks manually or use "See how this automates" from the JD Extractor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder={"Review pull requests from peers\nMonitor service health via Datadog\nWrite unit and integration tests"}
              className="min-h-[140px] font-mono text-sm"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
            />
            <Button
              className="w-full"
              onClick={handleAutomate}
              disabled={loading || !taskInput.trim()}
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing…</>
              ) : (
                <><Zap className="mr-2 h-4 w-4" /> Automate</>
              )}
            </Button>
          </CardContent>
        </Card>

        {results?.suggestions?.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {results.suggestions.length} automation suggestion{results.suggestions.length !== 1 ? "s" : ""}
            </p>
            {results.suggestions.map((s, i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <CardTitle className="text-base">{s.suggestion_name}</CardTitle>
                      <CardDescription className="text-xs">Task: {s.task}</CardDescription>
                    </div>
                    <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${confidenceStyle(s.confidence_label)}`}>
                      {s.confidence_label} · {Math.round(s.confidence * 100)}%
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${typeStyle}`}>
                      {s.type}
                    </span>
                    {s.tools_mentioned.map((tool) => (
                      <span key={tool} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {tool}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-foreground">{s.description}</p>
                  <p className="text-xs text-muted-foreground italic">{s.explanation}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskAutomator;
