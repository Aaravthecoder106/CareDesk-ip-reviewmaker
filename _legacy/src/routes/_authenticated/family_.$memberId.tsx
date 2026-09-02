import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ArrowLeft, Eye, ShieldCheck } from "lucide-react";
import { AnalyticsView, type SnapshotShape, type ReportSummary } from "@/components/analytics-view";

export const Route = createFileRoute("/_authenticated/family_/$memberId")({
  head: () => ({ meta: [{ title: "Family Analytics — CareDesk" }] }),
  component: FamilyMemberAnalytics,
});

function FamilyMemberAnalytics() {
  const { memberId } = Route.useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["family-analytics", memberId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      // Verify mutual accepted permission first — RLS will also enforce, but
      // this lets us show a clear "revoked" state instead of empty data.
      const { data: link } = await supabase
        .from("family_members")
        .select("id, owner_id, member_id, relation, status")
        .eq("status", "accepted")
        .or(`and(owner_id.eq.${user.id},member_id.eq.${memberId}),and(member_id.eq.${user.id},owner_id.eq.${memberId})`)
        .maybeSingle();

      if (!link) return { revoked: true as const };

      const [{ data: profile }, { data: snap }, { data: reports }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url").eq("id", memberId).maybeSingle(),
        supabase.from("analytics_snapshots").select("data, updated_at").eq("user_id", memberId).maybeSingle(),
        supabase.from("reports")
          .select("id, title, ai_summary, created_at")
          .eq("user_id", memberId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      return {
        revoked: false as const,
        profile,
        relation: link.relation,
        snap: (snap?.data ?? null) as SnapshotShape | null,
        updatedAt: snap?.updated_at ?? null,
        reports: (reports ?? []) as ReportSummary[],
      };
    },
    refetchInterval: 30_000, // re-verify permission periodically
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 bg-secondary rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 bg-secondary rounded-2xl animate-pulse" />)}
        </div>
        <div className="h-72 bg-secondary rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!data || data.revoked) {
    // Immediately hide analytics if permission is not (or no longer) mutual.
    return (
      <div>
        <BackLink />
        <div className="p-10 sm:p-16 bg-surface ring-1 ring-dashed ring-border rounded-3xl text-center max-w-xl mx-auto mt-6">
          <div className="mx-auto size-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <ShieldCheck className="size-6 text-destructive" />
          </div>
          <p className="font-display text-lg font-bold mb-1">Access unavailable</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            You don't have permission to view this family member's analytics, or the link has been revoked.
          </p>
          <button
            onClick={() => navigate({ to: "/family" })}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-background text-xs sm:text-sm font-medium"
          >
            Back to Family
          </button>
        </div>
      </div>
    );
  }

  const name = data.profile?.full_name ?? "Family member";
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div>
      <BackLink />
      <header className="mt-4 mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {data.profile?.avatar_url ? (
            <img
              src={data.profile.avatar_url}
              alt={name}
              className="size-14 sm:size-16 rounded-full object-cover ring-2 ring-primary/20 shrink-0"
            />
          ) : (
            <div className="size-14 sm:size-16 rounded-full bg-primary/10 text-primary font-bold text-lg flex items-center justify-center ring-2 ring-primary/20 shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest text-muted-foreground mb-1">
              Family Analytics · {data.relation ?? "Family"}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight truncate">{name}</h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
              {data.updatedAt
                ? <>Updated {format(new Date(data.updatedAt), "MMM d, p")}</>
                : <>No analytics generated yet</>}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium self-start sm:self-auto shrink-0">
          <Eye className="size-3" /> Read-only view
        </span>
      </header>

      <AnalyticsView
        snap={data.snap}
        reports={data.reports}
        emptyLabel={`${name} hasn't uploaded any reports yet`}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/family"
      className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
    >
      <ArrowLeft className="size-3.5" /> Back to Family
    </Link>
  );
}
