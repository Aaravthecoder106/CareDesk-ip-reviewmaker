import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, ArrowUpRight, Upload, MessageCircle, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: reports } = useQuery({
    queryKey: ["reports-recent"],
    queryFn: async () => {
      const { data } = await supabase.from("reports")
        .select("id, title, ai_summary, status, created_at, ai_extracted")
        .order("created_at", { ascending: false }).limit(4);
      return data ?? [];
    },
  });

  const { data: snapshot } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("analytics_snapshots").select("data, updated_at").eq("user_id", user.id).maybeSingle();
      return data;
    },
  });

  const { data: family } = useQuery({
    queryKey: ["family-list"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from("family_members")
        .select("owner_id, member_id, relation, status")
        .eq("status", "accepted");
      return data ?? [];
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["me-name"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      return { name: (data?.full_name ?? user.email ?? "there").split("@")[0].split(" ")[0] };
    },
  });

  const snap = (snapshot?.data ?? {}) as Record<string, unknown>;
  const labs = (snap.labs ?? {}) as Record<string, Array<{ date: string; value: number; unit: string | null }>>;
  const firstLabName = Object.keys(labs)[0];
  const firstLabSeries = firstLabName ? labs[firstLabName].slice(-8).map((p, i) => ({ i, value: p.value })) : [];
  const flags = Array.isArray(snap.flags) ? (snap.flags as Array<{ text: string; report: string }>) : [];

  return (
    <div>
      <header className="mb-10 animate-slide-up">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Dashboard</p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-balance mb-2">
          Good {greeting()}, {profile?.name ?? "there"}.
        </h1>
        <p className="text-muted-foreground">
          {snapshot?.updated_at
            ? `Your health profile was updated ${formatDistanceToNow(new Date(snapshot.updated_at))} ago.`
            : "Upload your first report to see AI insights, trends, and family alerts."}
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard label="Reports" value={String((reports?.length ? undefined : 0) ?? (snap.report_count as number) ?? reports?.length ?? 0)} delay={100} />
        <StatCard label="Last upload" value={reports?.[0] ? formatDistanceToNow(new Date(reports[0].created_at), { addSuffix: false }) : "—"} delay={150} />
        <StatCard label="Tracked labs" value={String(Object.keys(labs).length)} delay={200} />
        <StatCard label="Care network" value={String(family?.length ?? 0)} delay={250} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        <div className="lg:col-span-8 space-y-4 animate-slide-up min-w-0" style={{ animationDelay: "300ms" }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display text-lg font-bold">Recent records</h3>
            <Link to="/reports" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
              View library <ArrowUpRight className="size-3" />
            </Link>
          </div>

          {!reports?.length ? (
            <EmptyReports />
          ) : (
            reports.map((r) => (
              <div key={r.id} className="group p-4 bg-surface ring-1 ring-black/5 dark:ring-white/5 rounded-2xl hover:ring-primary/20 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="size-10 bg-secondary rounded-lg border border-border flex items-center justify-center">
                      <FileText className="size-4 text-muted-foreground" strokeWidth={1.75} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">{r.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        Uploaded {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <StatusPill status={r.status} extracted={r.ai_extracted as Record<string, unknown> | null} />
                </div>
                {r.ai_summary && (
                  <div className="bg-secondary/50 rounded-lg p-3 border-l-2 border-primary/30">
                    <p className="text-xs text-foreground/80 leading-relaxed">
                      <span className="font-bold text-primary italic">AI summary:</span> {r.ai_summary}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="lg:col-span-4 space-y-6 lg:space-y-8 min-w-0">
          <Link to="/chat" className="block bg-primary text-primary-foreground p-6 rounded-3xl animate-slide-up shadow-xl shadow-primary/10 hover:shadow-primary/20 transition-shadow" style={{ animationDelay: "400ms" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-lg font-bold">Health Assistant</h3>
              <MessageCircle className="size-4" />
            </div>
            <p className="text-sm opacity-90 leading-relaxed mb-4">
              Ask questions about your reports. I remember every value, date, and trend.
            </p>
            <div className="bg-black/10 border border-white/10 rounded-xl p-3 text-xs">
              Try: "Compare my cholesterol over the last 3 reports"
            </div>
          </Link>

          <div className="bg-surface ring-1 ring-black/5 dark:ring-white/5 p-6 rounded-3xl animate-slide-up" style={{ animationDelay: "500ms" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-bold">{firstLabName ? `${firstLabName} trend` : "Trends"}</h3>
              <Link to="/analytics" className="text-[10px] font-mono uppercase text-primary hover:underline">View all</Link>
            </div>
            {firstLabSeries.length > 1 ? (
              <div className="h-24">
                <ResponsiveContainer>
                  <LineChart data={firstLabSeries}>
                    <XAxis dataKey="i" hide />
                    <YAxis hide domain={["dataMin", "dataMax"]} />
                    <Tooltip cursor={false} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="value" stroke="hsl(190 80% 30%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-6 text-center">
                Upload lab reports to see trend lines here.
              </p>
            )}
          </div>

          <div className="bg-surface ring-1 ring-black/5 dark:ring-white/5 p-6 rounded-3xl animate-slide-up" style={{ animationDelay: "600ms" }}>
            <h3 className="font-display text-sm font-bold mb-4">Recent findings</h3>
            {flags.length ? (
              <ul className="space-y-3">
                {flags.slice(-3).reverse().map((f, i) => (
                  <li key={i} className="text-xs">
                    <p className="text-foreground/90">{f.text}</p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-1">from {f.report}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No findings yet — a good sign, or upload more reports.</p>
            )}
          </div>

          <div className="bg-surface ring-1 ring-black/5 dark:ring-white/5 p-6 rounded-3xl animate-slide-up" style={{ animationDelay: "700ms" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-bold">Care network</h3>
              <Link to="/family" className="text-[10px] font-mono uppercase text-primary hover:underline">Manage</Link>
            </div>
            {family?.length ? (
              <p className="text-xs text-muted-foreground">
                {family.length} {family.length === 1 ? "member" : "members"} sharing health insights with you.
              </p>
            ) : (
              <div className="text-center py-2">
                <Users className="size-6 text-muted-foreground mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-xs text-muted-foreground mb-3">Invite family to share health updates.</p>
                <Link to="/family" className="text-xs font-medium text-primary hover:underline">Invite family →</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function StatCard({ label, value, delay }: { label: string; value: string; delay: number }) {
  return (
    <div className="p-5 bg-surface ring-1 ring-black/5 dark:ring-white/5 rounded-2xl animate-slide-up" style={{ animationDelay: `${delay}ms` }}>
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
      <p className="text-2xl font-display font-bold">{value}</p>
    </div>
  );
}

function StatusPill({ status, extracted }: { status: string; extracted: Record<string, unknown> | null }) {
  if (status === "processing")
    return <span className="px-2 py-1 bg-secondary text-muted-foreground text-[10px] font-mono font-bold rounded uppercase">Analyzing</span>;
  if (status === "failed")
    return <span className="px-2 py-1 bg-destructive/10 text-destructive text-[10px] font-mono font-bold rounded uppercase">Failed</span>;
  const flags = extracted && Array.isArray(extracted.flags) ? (extracted.flags as string[]) : [];
  if (flags.length)
    return <span className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] font-mono font-bold rounded uppercase">Action needed</span>;
  return <span className="px-2 py-1 bg-secondary text-muted-foreground text-[10px] font-mono font-bold rounded uppercase">Reviewed</span>;
}

function EmptyReports() {
  return (
    <Link to="/reports" className="block p-8 bg-surface ring-1 ring-dashed ring-border rounded-2xl text-center hover:ring-primary/30 transition-all">
      <Upload className="size-8 text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
      <p className="font-display font-bold mb-1">Upload your first report</p>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        Blood tests, prescriptions, MRI results, discharge summaries — CareDesk will read them and remember.
      </p>
    </Link>
  );
}
