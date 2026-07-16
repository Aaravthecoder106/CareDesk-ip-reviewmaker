import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — CareDesk" }] }),
  component: NotifsPage,
});

function NotifsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifs-list"],
    queryFn: async () => {
      const { data } = await supabase.from("notifications")
        .select("id, type, title, body, read_at, created_at").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    (async () => {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
      qc.invalidateQueries({ queryKey: ["notif-count"] });
    })();
  }, [qc]);

  return (
    <div className="max-w-2xl">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Notifications</h1>
      </header>
      {!data?.length ? (
        <div className="p-16 bg-surface ring-1 ring-dashed ring-border rounded-3xl text-center">
          <Bell className="size-8 text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.map((n) => (
            <li key={n.id} className="p-4 bg-surface ring-1 ring-black/5 dark:ring-white/5 rounded-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-sm">{n.title}</p>
                  {n.body && <p className="text-xs text-muted-foreground mt-1">{n.body}</p>}
                </div>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
