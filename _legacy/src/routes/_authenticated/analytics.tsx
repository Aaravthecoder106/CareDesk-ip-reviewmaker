import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { regenerateAnalytics } from "@/lib/ai.functions";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { AnalyticsView, type SnapshotShape } from "@/components/analytics-view";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — CareDesk" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const qc = useQueryClient();
  const regenerate = useServerFn(regenerateAnalytics);
  const { data: snap, isLoading } = useQuery({
    queryKey: ["analytics-full"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("analytics_snapshots")
        .select("data, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const refreshMut = useMutation({
    mutationFn: () => regenerate(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["analytics-full"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      toast.success(`Analytics refreshed from ${res?.report_count ?? 0} report${res?.report_count === 1 ? "" : "s"}.`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to refresh"),
  });

  const snapshot = (snap?.data ?? null) as SnapshotShape | null;
  const updatedAt = snap?.updated_at ?? (snapshot && typeof snapshot.updated_at === "string" ? snapshot.updated_at : null);

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

  return (
    <div>
      <header className="mb-6 sm:mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Health Analytics</p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">Your health in charts</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            Auto-generated from your uploaded reports.
            {updatedAt && <span className="ml-1 hidden sm:inline">Updated {format(new Date(updatedAt), "MMM d, p")}.</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refreshMut.mutate()}
          disabled={refreshMut.isPending}
          className="shrink-0 inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-foreground text-background text-xs sm:text-sm font-medium disabled:opacity-60 hover:opacity-90 transition shadow-sm"
        >
          <RefreshCw className={`h-4 w-4 ${refreshMut.isPending ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">{refreshMut.isPending ? "Refreshing…" : "Refresh analytics"}</span>
          <span className="sm:hidden">{refreshMut.isPending ? "…" : "Refresh"}</span>
        </button>
      </header>

      <AnalyticsView snap={snapshot} />
    </div>
  );
}
