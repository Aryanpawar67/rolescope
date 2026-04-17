import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, ChevronDown, ChevronUp, BrainCircuit } from "lucide-react";
import { toast } from "sonner";

interface Task { name: string; proficiency: string; }
interface Competency { name: string; description: string; }

interface JobProfile {
  id: number;
  title: string;
  subFamily: string;
  family: string;
  branch: string;
  level: string;
  careerLevel: string;
  purpose: string;
  tasks: Task[];
  managementTasks: string;
  groupResponsibility: string;
  languageSkills: string;
  education: string;
  experience: string;
  professionalKnowledge: string[];
  managementExperience: string;
  competencies: Competency[];
}

const proficiencyStyle = (p: string) => {
  if (p.includes("Independently")) return "bg-green-100 text-green-800";
  if (p.includes("Leads") || p.includes("Manages")) return "bg-blue-100 text-blue-800";
  if (p.includes("Contributes")) return "bg-yellow-100 text-yellow-800";
  return "bg-muted text-muted-foreground";
};

const levelStyle = (level: string) => {
  if (level.includes("L4")) return "bg-purple-100 text-purple-800";
  if (level.includes("L3")) return "bg-blue-100 text-blue-800";
  if (level.includes("L2")) return "bg-cyan-100 text-cyan-800";
  if (level.includes("L1")) return "bg-green-100 text-green-800";
  return "bg-muted text-muted-foreground";
};

function ProfileCard({ profile }: { profile: JobProfile }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-base leading-snug">{profile.title}</CardTitle>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className={`text-[10px] ${levelStyle(profile.level)}`}>
                {profile.level}
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                {profile.careerLevel}
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-secondary/50 text-secondary-foreground">
                {profile.subFamily}
              </Badge>
            </div>
          </div>
          <Button
            size="sm"
            variant="default"
            className="shrink-0 text-xs h-8"
            onClick={() => navigate("/skills", { state: { profile } })}
          >
            <BrainCircuit className="h-3.5 w-3.5 mr-1.5" />
            Map Skills
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        {/* Purpose */}
        {profile.purpose && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Job Purpose</p>
            <p className="text-xs text-foreground leading-relaxed">{profile.purpose}</p>
          </div>
        )}

        {/* Tasks */}
        {profile.tasks.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Professional Tasks ({profile.tasks.length})
            </p>
            <div className="space-y-1.5">
              {profile.tasks.map((t, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[10px] text-muted-foreground mt-0.5 shrink-0 w-4">{i + 1}.</span>
                  <div className="flex-1 flex items-start gap-2 flex-wrap">
                    <span className="text-xs text-foreground">{t.name}</span>
                    {t.proficiency && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${proficiencyStyle(t.proficiency)}`}>
                        {t.proficiency}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expand toggle */}
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? "Show less" : "Show more (knowledge, competencies, requirements)"}
        </button>

        {expanded && (
          <div className="space-y-4 pt-1 border-t border-border">
            {/* Requirements grid */}
            <div className="grid grid-cols-2 gap-3">
              {profile.experience && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Experience</p>
                  <p className="text-xs text-foreground">{profile.experience}</p>
                </div>
              )}
              {profile.education && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Education</p>
                  <p className="text-xs text-foreground">{profile.education}</p>
                </div>
              )}
              {profile.languageSkills && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Languages</p>
                  <p className="text-xs text-foreground">{profile.languageSkills}</p>
                </div>
              )}
              {profile.managementExperience && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Mgmt Experience</p>
                  <p className="text-xs text-foreground">{profile.managementExperience}</p>
                </div>
              )}
            </div>

            {/* Professional Knowledge */}
            {profile.professionalKnowledge.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Professional Knowledge</p>
                <ul className="space-y-1.5">
                  {profile.professionalKnowledge.map((k, i) => (
                    <li key={i} className="text-xs text-foreground leading-relaxed pl-2 border-l-2 border-muted">{k}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Competencies */}
            {profile.competencies.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Competencies</p>
                <div className="grid grid-cols-1 gap-2">
                  {profile.competencies.map((c, i) => (
                    <div key={i} className="p-2 rounded-md bg-muted/40">
                      <p className="text-xs font-medium text-foreground">{c.name}</p>
                      {c.description && <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{c.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Management tasks */}
            {profile.managementTasks && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Management Tasks</p>
                <p className="text-xs text-foreground">{profile.managementTasks}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const JobProfiles = () => {
  const [profiles, setProfiles] = useState<JobProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/job-profiles")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProfiles(data);
        else toast.error("Failed to load profiles.");
      })
      .catch(() => toast.error("Could not reach server."))
      .finally(() => setLoading(false));
  }, []);

  // Group by family
  const filtered = profiles.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.family.toLowerCase().includes(q) ||
      p.subFamily.toLowerCase().includes(q)
    );
  });

  const byFamily = filtered.reduce<Record<string, JobProfile[]>>((acc, p) => {
    (acc[p.family] = acc[p.family] || []).push(p);
    return acc;
  }, {});

  return (
    <div className="flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-5xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Job Profiles</h1>
          <p className="text-muted-foreground text-sm">
            {profiles.length} profiles loaded from the classification file. Select any profile to run the Skills Mapper.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, family, or sub-family…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading profiles…</span>
          </div>
        ) : (
          Object.entries(byFamily).map(([family, fps]) => (
            <div key={family} className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-foreground">{family}</h2>
                <span className="text-xs text-muted-foreground">{fps.length} profile{fps.length !== 1 ? "s" : ""}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid grid-cols-1 gap-4">
                {fps.map((p) => <ProfileCard key={p.id} profile={p} />)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default JobProfiles;
