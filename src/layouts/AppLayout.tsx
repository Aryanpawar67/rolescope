import { Outlet } from "react-router-dom";
import { FileText, Zap, Users, BrainCircuit } from "lucide-react";
import { NavLink } from "@/components/NavLink";

const AppLayout = () => (
  <div className="flex min-h-screen bg-background">
    <aside className="w-[220px] shrink-0 sticky top-0 h-screen border-r border-border flex flex-col bg-background">
      <div className="px-5 py-5 border-b border-border">
        <p className="text-sm font-bold text-foreground tracking-tight">RoleScope</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">Powered by Claude</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <NavLink
          to="/"
          end
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          activeClassName="bg-accent text-accent-foreground font-medium"
        >
          <FileText className="h-4 w-4 shrink-0" />
          JD Extractor
        </NavLink>

        <NavLink
          to="/automate"
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          activeClassName="bg-accent text-accent-foreground font-medium"
        >
          <Zap className="h-4 w-4 shrink-0" />
          Task Automator
        </NavLink>

        <div className="pt-3 pb-1 px-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Skills Pipeline</p>
        </div>

        <NavLink
          to="/profiles"
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          activeClassName="bg-accent text-accent-foreground font-medium"
        >
          <Users className="h-4 w-4 shrink-0" />
          Job Profiles
        </NavLink>

        <NavLink
          to="/skills"
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          activeClassName="bg-accent text-accent-foreground font-medium"
        >
          <BrainCircuit className="h-4 w-4 shrink-0" />
          Skills Mapper
        </NavLink>
      </nav>
    </aside>

    <main className="flex-1 overflow-y-auto">
      <Outlet />
    </main>
  </div>
);

export default AppLayout;
