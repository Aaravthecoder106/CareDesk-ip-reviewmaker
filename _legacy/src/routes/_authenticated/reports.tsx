import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { analyzeReport } from "@/lib/ai.functions";
import { hasLibraryPassword, setLibraryPassword, verifyLibraryPassword } from "@/lib/library.functions";
import { Upload, FileText, Lock, Trash2, RefreshCw, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Report Library — CareDesk" }] }),
  component: ReportsPage,
});

const UNLOCK_KEY = "caredesk_lib_unlocked";

function ReportsPage() {
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeReport);
  const setPw = useServerFn(setLibraryPassword);
  const verifyPw = useServerFn(verifyLibraryPassword);
  const hasPw = useServerFn(hasLibraryPassword);

  const [unlocked, setUnlocked] = useState(false);
  const [pwState, setPwState] = useState<"unknown" | "setup" | "locked">("unknown");
  const [password, setPassword] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sessionStorage.getItem(UNLOCK_KEY) === "1") { setUnlocked(true); return; }
    hasPw().then((r) => setPwState(r.exists ? "locked" : "setup"));
  }, [hasPw]);

  const { data: reports, refetch } = useQuery({
    queryKey: ["reports-full"],
    enabled: unlocked,
    queryFn: async () => {
      const { data } = await supabase.from("reports")
        .select("id, title, file_path, mime_type, ai_summary, ai_extracted, status, created_at")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("reports").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: row, error } = await supabase.from("reports").insert({
        user_id: user.id, title: file.name.replace(/\.[^.]+$/, ""), file_path: path, mime_type: file.type, status: "processing",
      }).select("id").single();
      if (error) throw error;
      await analyze({ data: { reportId: row.id } });
      return row.id;
    },
    onSuccess: () => { toast.success("Report analyzed"); qc.invalidateQueries(); refetch(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Upload failed"),
  });

  const reanalyzeMut = useMutation({
    mutationFn: async (id: string) => analyze({ data: { reportId: id } }),
    onSuccess: () => { toast.success("Re-analyzed"); qc.invalidateQueries(); refetch(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  async function deleteReport(id: string, path: string) {
    if (!confirm("Delete this report?")) return;
    await supabase.storage.from("reports").remove([path]);
    await supabase.from("reports").delete().eq("id", id);
    qc.invalidateQueries();
    refetch();
    toast.success("Deleted");
  }

  async function downloadReport(path: string) {
    const { data } = await supabase.storage.from("reports").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwState === "setup") {
      await setPw({ data: { password } });
      toast.success("Library password set");
    } else {
      const r = await verifyPw({ data: { password } });
      if (!r.ok) { toast.error("Wrong password"); return; }
    }
    sessionStorage.setItem(UNLOCK_KEY, "1");
    setUnlocked(true);
    setPassword("");
  }

  if (!unlocked) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <div className="bg-surface ring-1 ring-black/5 dark:ring-white/5 rounded-3xl p-10 text-center">
          <div className="size-14 mx-auto bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
            <Lock className="size-6" strokeWidth={1.75} />
          </div>
          <h1 className="font-display text-2xl font-bold mb-2">
            {pwState === "setup" ? "Set a library password" : "Unlock your Report Library"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {pwState === "setup"
              ? "Your reports are encrypted at rest. Set a password to add an extra lock."
              : "Enter your library password to view your reports."}
          </p>
          <form onSubmit={submitPassword} className="space-y-3">
            <input type="password" required minLength={4} value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={pwState === "setup" ? "Choose a password (min 4 chars)" : "Library password"}
              className="w-full py-2.5 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            <button type="submit" className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
              {pwState === "setup" ? "Set password & unlock" : "Unlock"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-8 flex items-end justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Encrypted Library</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Report Library</h1>
          <p className="text-muted-foreground text-sm mt-1">Upload PDFs or images. AI extracts data and updates your analytics.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { sessionStorage.removeItem(UNLOCK_KEY); setUnlocked(false); }} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-secondary flex items-center gap-2">
            <Lock className="size-3" /> Lock
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={uploadMut.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
            <Upload className="size-4" /> {uploadMut.isPending ? "Analyzing…" : "Upload report"}
          </button>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => {
            const f = e.target.files?.[0]; if (f) uploadMut.mutate(f); e.target.value = "";
          }} />
        </div>
      </header>

      {!reports?.length ? (
        <div className="p-16 bg-surface ring-1 ring-dashed ring-border rounded-3xl text-center">
          <Upload className="size-10 text-muted-foreground mx-auto mb-4" strokeWidth={1.5} />
          <p className="font-display text-lg font-bold mb-1">No reports yet</p>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            Drop a blood test, MRI, prescription or discharge summary. CareDesk will read it and remember every value.
          </p>
          <button onClick={() => fileRef.current?.click()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            Upload your first report
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const ex = (r.ai_extracted ?? {}) as Record<string, unknown>;
            const flags = Array.isArray(ex.flags) ? (ex.flags as string[]) : [];
            return (
              <div key={r.id} className="p-5 bg-surface ring-1 ring-black/5 dark:ring-white/5 rounded-2xl">
                <div className="flex items-start gap-4">
                  <div className="size-11 bg-secondary rounded-lg border border-border flex items-center justify-center shrink-0">
                    <FileText className="size-4 text-muted-foreground" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <h3 className="font-semibold text-sm truncate">{r.title}</h3>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono uppercase text-muted-foreground">
                          {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      {typeof ex.report_type === "string" ? ex.report_type : (r.mime_type ?? "Report")} · {r.status}
                    </p>
                    {r.ai_summary && (
                      <div className="bg-secondary/50 rounded-lg p-3 border-l-2 border-primary/30 mb-3">
                        <p className="text-xs leading-relaxed text-foreground/80">{r.ai_summary}</p>
                      </div>
                    )}
                    {flags.length > 0 && (
                      <ul className="text-xs text-amber-800 dark:text-amber-300 space-y-1 mb-2">
                        {flags.slice(0, 3).map((f, i) => <li key={i}>⚠ {f}</li>)}
                      </ul>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => downloadReport(r.file_path)} className="px-2 py-1 text-[11px] border border-border rounded hover:bg-secondary flex items-center gap-1">
                        <Download className="size-3" /> Open file
                      </button>
                      <button onClick={() => reanalyzeMut.mutate(r.id)} disabled={reanalyzeMut.isPending} className="px-2 py-1 text-[11px] border border-border rounded hover:bg-secondary flex items-center gap-1 disabled:opacity-50">
                        <RefreshCw className="size-3" /> Re-analyze
                      </button>
                      <button onClick={() => deleteReport(r.id, r.file_path)} className="px-2 py-1 text-[11px] border border-destructive/20 text-destructive rounded hover:bg-destructive/10 flex items-center gap-1">
                        <Trash2 className="size-3" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
