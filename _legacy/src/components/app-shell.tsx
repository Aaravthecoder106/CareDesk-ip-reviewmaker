import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, FileLock2, MessageCircle, LineChart, Users, Settings,
  Sparkles, LogOut, Bell, Menu, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/reports", label: "Report Library", icon: FileLock2 },
  { to: "/chat", label: "AI Health Assistant", icon: MessageCircle },
  { to: "/analytics", label: "Analytics", icon: LineChart },
  { to: "/family", label: "Care Network", icon: Users },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Lock scroll while drawer open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [mobileOpen]);

  const { data: profile } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).maybeSingle();
      return { email: user.email ?? "", id: user.id, ...(data ?? { full_name: null, avatar_url: null }) };
    },
  });

  const { data: notifCount } = useQuery({
    queryKey: ["notif-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = (profile?.full_name || profile?.email || "?").split(/[\s@]/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const SidebarInner = (
    <>
      <Link to="/dashboard" className="flex items-center gap-2 mb-10">
        <div className="size-8 bg-primary rounded-lg flex items-center justify-center">
          <Sparkles className="size-4 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <span className="font-display text-xl font-bold tracking-tight">CareDesk</span>
      </Link>

      <div className="space-y-1">
        {NAV.map((n) => {
          const active = location.pathname === n.to || (n.to !== "/dashboard" && location.pathname.startsWith(n.to));
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all " +
                (active
                  ? "bg-surface ring-1 ring-black/5 dark:ring-white/10 font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50")
              }
            >
              <Icon className="size-4" strokeWidth={1.75} />
              {n.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-auto pt-8 border-t border-border space-y-1">
        <Link to="/settings" className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md">
          <Settings className="size-4" strokeWidth={1.75} />
          Settings
        </Link>
        <Link to="/upgrade" className="block mt-2">
          <div className="px-3 py-4 bg-accent rounded-xl border border-primary/10 hover:border-primary/20 transition-colors">
            <p className="text-[11px] font-mono uppercase tracking-wider text-primary font-bold mb-1">Free plan</p>
            <p className="text-xs text-accent-foreground/80 leading-relaxed">Upgrade for unlimited family & AI queries.</p>
          </div>
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground selection:bg-primary/10">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-border flex-col p-6">
        {SidebarInner}
      </aside>

      {/* Mobile off-canvas drawer */}
      <div
        className={
          "lg:hidden fixed inset-0 z-40 transition-opacity duration-300 " +
          (mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")
        }
        onClick={() => setMobileOpen(false)}
        aria-hidden={!mobileOpen}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      </div>
      <aside
        className={
          "lg:hidden fixed top-0 left-0 z-50 h-full w-72 max-w-[85%] bg-background border-r border-border flex flex-col p-6 shadow-2xl " +
          "transition-transform duration-300 ease-out " +
          (mobileOpen ? "translate-x-0" : "-translate-x-full")
        }
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-md hover:bg-secondary"
          aria-label="Close menu"
        >
          <X className="size-4" />
        </button>
        {SidebarInner}
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between gap-4">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-md hover:bg-secondary transition-colors"
            aria-label="Open menu"
          >
            <Menu className="size-5" strokeWidth={1.75} />
          </button>

          <div className="flex-1 lg:hidden flex items-center gap-2">
            <div className="size-7 bg-primary rounded-lg flex items-center justify-center">
              <Sparkles className="size-3.5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="font-display font-bold tracking-tight">CareDesk</span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 ml-auto">
            <Link to="/notifications" className="relative p-2 rounded-md hover:bg-secondary transition-colors">
              <Bell className="size-4 text-muted-foreground" strokeWidth={1.75} />
              {notifCount ? (
                <span className="absolute top-1 right-1 size-2 rounded-full bg-destructive animate-pulse" />
              ) : null}
            </Link>
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium leading-tight">{profile?.full_name ?? "You"}</p>
                <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-tighter truncate max-w-[180px]">{profile?.email}</p>
              </div>
              <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                {initials}
              </div>
            </div>
            <div className="sm:hidden size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
              {initials}
            </div>
            <button onClick={signOut} className="p-2 rounded-md hover:bg-secondary transition-colors" title="Sign out">
              <LogOut className="size-4 text-muted-foreground" strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <div className="p-4 sm:p-6 lg:p-10">{children ?? <Outlet />}</div>
      </main>
    </div>
  );
}
