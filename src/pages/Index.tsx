import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Loader2, ClipboardPaste } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExtractedTask {
  task: string;
  frequency: string;
  category: string;
}

const Index = () => {
  const [jdText, setJdText] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<ExtractedTask[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setJdText(ev.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleExtract = async () => {
    if (!jdText.trim()) {
      toast.error("Please paste or upload a job description first.");
      return;
    }
    setLoading(true);
    setTasks([]);
    try {
      const { data, error } = await supabase.functions.invoke("extract-tasks", {
        body: { jdText: jdText.trim() },
      });
      if (error) throw error;
      setTasks(data.tasks ?? []);
      if (!data.tasks?.length) toast.info("No tasks could be extracted.");
    } catch (err: any) {
      toast.error(err.message || "Failed to extract tasks.");
    } finally {
      setLoading(false);
    }
  };

  const frequencyColor = (f: string) => {
    const lower = f.toLowerCase();
    if (lower.includes("daily")) return "bg-primary/10 text-primary";
    if (lower.includes("weekly")) return "bg-accent text-accent-foreground";
    if (lower.includes("monthly")) return "bg-secondary text-secondary-foreground";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">JD Task Extractor</h1>
          <p className="text-muted-foreground">
            Paste or upload a job description to extract concrete weekly/monthly tasks.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Job Description Input</CardTitle>
            <CardDescription>Provide the JD text via paste or file upload.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="paste" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="paste">
                  <ClipboardPaste className="mr-2 h-4 w-4" /> Paste Text
                </TabsTrigger>
                <TabsTrigger value="upload">
                  <Upload className="mr-2 h-4 w-4" /> Upload File
                </TabsTrigger>
              </TabsList>
              <TabsContent value="paste">
                <Textarea
                  placeholder="Paste the full job description here..."
                  className="min-h-[200px]"
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                />
              </TabsContent>
              <TabsContent value="upload" className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  variant="outline"
                  className="w-full h-24 border-dashed"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-1">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {fileName || "Click to select a .txt or .md file"}
                    </span>
                  </div>
                </Button>
                {jdText && fileName && (
                  <p className="text-sm text-muted-foreground">
                    ✓ File loaded — {jdText.length} characters
                  </p>
                )}
              </TabsContent>
            </Tabs>

            <Button
              className="w-full mt-4"
              onClick={handleExtract}
              disabled={loading || !jdText.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Extracting…
                </>
              ) : (
                "Extract Tasks"
              )}
            </Button>
          </CardContent>
        </Card>

        {tasks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Extracted Tasks ({tasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tasks.map((t, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border"
                >
                  <span className="text-sm font-medium text-muted-foreground mt-0.5 min-w-[1.5rem]">
                    {i + 1}.
                  </span>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm text-foreground">{t.task}</p>
                    <div className="flex gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${frequencyColor(t.frequency)}`}>
                        {t.frequency}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {t.category}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Index;
