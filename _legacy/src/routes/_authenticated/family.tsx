import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createInvite, confirmFamilyMember } from "@/lib/family.functions";
import { UserPlus, Copy, Users, Trash2, Check, Clock, ShieldCheck, ArrowRight, FileText, HeartPulse, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { healthScoreFrom, type SnapshotShape } from "@/components/analytics-view";

export const Route = createFileRoute("/_authenticated/family")({
  head: () => ({ meta: [{ title: "Care Network — CareDesk" }] }),
  component: FamilyPage,
});

type MemberRow = {
  id: string;
  owner_id: string;
  member_id: string;
  relation: string | null;
  status: string;
  created_at: string;
  other_id: string;
  other_name: string;
  other_avatar: string | null;
  amOwner: boolean;
  reportCount: number;
  lastReportAt: string | null;
  healthScore: number | null;
};

function FamilyPage() {
  const invite = useServerFn(createInvite);
  const confirmFn = useServerFn(confirmFamilyMember);
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [relation, setRelation] = useState("");

  const { data: members, isLoading } = useQuery<MemberRow[]>({
    queryKey: ["family"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from("family_members")
        .select("id, owner_id, member_id, relation, status, created_at")
        .in("status", ["pending_owner", "accepted"]);
      if (!data?.length) return [];
      const otherIds = data.map((f) => f.owner_id === user.id ? f.member_id : f.owner_id);
      const acceptedIds = data
        .filter((f) => f.status === "accepted")
        .map((f) => f.owner_id === user.id ? f.member_id : f.owner_id);

      const [{ data: profs }, { data: reports }, { data: snaps }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url").in("id", otherIds),
        acceptedIds.length
          ? supabase.from("reports").select("user_id, created_at").in("user_id", acceptedIds)
          : Promise.resolve({ data: [] as Array<{ user_id: string; created_at: string }> }),
        acceptedIds.length
          ? supabase.from("analytics_snapshots").select("user_id, data").in("user_id", acceptedIds)
          : Promise.resolve({ data: [] as Array<{ user_id: string; data: unknown }> }),
      ]);

      const statsByUser = new Map<string, { count: number; last: string | null }>();
      for (const r of reports ?? []) {
        const s = statsByUser.get(r.user_id) ?? { count: 0, last: null };
        s.count += 1;
        if (!s.last || r.created_at > s.last) s.last = r.created_at;
        statsByUser.set(r.user_id, s);
      }
      const snapByUser = new Map<string, SnapshotShape>();
      for (const sn of snaps ?? []) snapByUser.set(sn.user_id, (sn.data ?? {}) as SnapshotShape);

      return data.map((f) => {
        const other_id = f.owner_id === user.id ? f.member_id : f.owner_id;
        const prof = profs?.find((p) => p.id === other_id);
        const stats = statsByUser.get(other_id);
        return {
          ...f,
          other_id,
          other_name: prof?.full_name ?? "Family member",
          other_avatar: prof?.avatar_url ?? null,
          amOwner: f.owner_id === user.id,
          reportCount: stats?.count ?? 0,
          lastReportAt: stats?.last ?? null,
          healthScore: healthScoreFrom(snapByUser.get(other_id) ?? null),
        };
      });
    },
  });

  const { data: invites } = useQuery({
    queryKey: ["family-invites"],
    queryFn: async () => {
      const { data } = await supabase.from("family_invites")
        .select("id, email, relation, token, status, created_at").eq("status", "pending");
      return data ?? [];
    },
  });

  const inviteMut = useMutation({
    mutationFn: async () => invite({ data: { email, relation: relation || null } }),
    onSuccess: () => { toast.success("Invite created — copy the link and share it."); setEmail(""); setRelation(""); qc.invalidateQueries(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const confirmMut = useMutation({
    mutationFn: (id: string) => confirmFn({ data: { memberRowId: id } }),
    onSuccess: () => {
      toast.success("Family link confirmed — shared analytics unlocked.");
      qc.invalidateQueries({ queryKey: ["family"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  async function removeMember(id: string) {
    if (!confirm("Remove family member?")) return;
    await supabase.from("family_members").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["family"] });
  }

  async function deleteInvite(id: string) {
    await supabase.from("family_invites").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["family-invites"] });
  }

  function inviteLink(token: string) {
    return `${window.location.origin}/invite/${token}`;
  }

  const accepted = (members ?? []).filter((m) => m.status === "accepted");
  const pendingOwner = (members ?? []).filter((m) => m.status === "pending_owner");
  const awaitingMyConfirm = pendingOwner.filter((m) => m.amOwner);
  const awaitingTheirConfirm = pendingOwner.filter((m) => !m.amOwner);

  return (
    <div>
      <header className="mb-6 sm:mb-8">
        <p className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Care Network</p>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">Family & caregivers</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-1 max-w-2xl">
          Sharing works both ways. After someone accepts your invite, confirm the link to unlock shared analytics, trends,
          summaries and health alerts for both of you.
        </p>
      </header>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Awaiting my confirmation */}
          {awaitingMyConfirm.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-500/30 rounded-2xl p-5 sm:p-6">
              <h3 className="font-display font-bold mb-1 flex items-center gap-2 text-sm sm:text-base">
                <ShieldCheck className="size-4 text-amber-700 dark:text-amber-400" /> Confirm to unlock sharing
              </h3>
              <p className="text-xs text-muted-foreground mb-4">These people accepted your invite. Confirm to grant mutual access.</p>
              <ul className="space-y-3">
                {awaitingMyConfirm.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 min-w-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 shrink-0 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center">
                        {m.other_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{m.other_name}</p>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{m.relation ?? "Family"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => confirmMut.mutate(m.id)}
                        disabled={confirmMut.isPending}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-full hover:opacity-90 disabled:opacity-50 transition"
                      >
                        <Check className="size-3" /> Confirm
                      </button>
                      <button onClick={() => removeMember(m.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded">
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Awaiting the other person */}
          {awaitingTheirConfirm.length > 0 && (
            <div className="bg-surface ring-1 ring-black/5 dark:ring-white/5 rounded-2xl p-5 sm:p-6">
              <h3 className="font-display font-bold mb-1 flex items-center gap-2 text-sm sm:text-base">
                <Clock className="size-4 text-muted-foreground" /> Waiting for confirmation
              </h3>
              <p className="text-xs text-muted-foreground mb-4">You accepted their invite. They still need to confirm on their side.</p>
              <ul className="divide-y divide-border">
                {awaitingTheirConfirm.map((m) => (
                  <li key={m.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 shrink-0 rounded-full bg-secondary text-muted-foreground text-xs font-bold flex items-center justify-center">
                        {m.other_name.slice(0, 2).toUpperCase()}
                      </div>
                      <p className="text-sm font-medium truncate">{m.other_name}</p>
                    </div>
                    <span className="text-[10px] font-mono uppercase text-muted-foreground">Pending</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Accepted members */}
          <div className="bg-surface ring-1 ring-black/5 dark:ring-white/5 rounded-2xl p-5 sm:p-6">
            <h3 className="font-display font-bold mb-4 flex items-center gap-2 text-sm sm:text-base">
              <Users className="size-4" /> Connected family
            </h3>
            {isLoading ? (
              <ul className="space-y-3 animate-pulse">
                {[0, 1].map((i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-secondary" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-32 bg-secondary rounded" />
                      <div className="h-2 w-20 bg-secondary rounded" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : !accepted.length ? (
              <div className="py-8 text-center">
                <div className="mx-auto size-12 rounded-full bg-secondary flex items-center justify-center mb-3">
                  <Users className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium mb-1">No family connected yet</p>
                <p className="text-xs text-muted-foreground">Invite someone to start sharing.</p>
              </div>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {accepted.map((m) => (
                  <li key={m.id} className="group ring-1 ring-black/5 dark:ring-white/10 rounded-2xl p-4 bg-gradient-to-br from-surface to-surface/60 hover:shadow-md transition-shadow flex flex-col gap-3 min-w-0">
                    <div className="flex items-start gap-3 min-w-0">
                      {m.other_avatar ? (
                        <img src={m.other_avatar} alt={m.other_name} className="size-11 rounded-full object-cover ring-2 ring-primary/20 shrink-0" />
                      ) : (
                        <div className="size-11 shrink-0 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center ring-2 ring-primary/20">
                          {m.other_name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{m.other_name}</p>
                        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground truncate">
                          {m.relation ?? "Family"}
                        </p>
                        <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          <span className="size-1.5 rounded-full bg-emerald-500" /> Mutual access
                        </span>
                      </div>
                      <button
                        onClick={() => removeMember(m.id)}
                        title="Remove"
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 text-destructive hover:bg-destructive/10 rounded transition shrink-0"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <StatCell
                        icon={<FileText className="size-3" />}
                        label="Reports"
                        value={String(m.reportCount)}
                      />
                      <StatCell
                        icon={<Calendar className="size-3" />}
                        label="Last report"
                        value={m.lastReportAt ? formatDistanceToNow(new Date(m.lastReportAt), { addSuffix: false }) : "—"}
                      />
                      <StatCell
                        icon={<HeartPulse className="size-3" />}
                        label="Health score"
                        value={m.healthScore !== null ? String(m.healthScore) : "—"}
                      />
                    </div>

                    <Link
                      to="/family/$memberId"
                      params={{ memberId: m.other_id }}
                      className="inline-flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-90 transition"
                    >
                      View analytics <ArrowRight className="size-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>


          {(invites?.length ?? 0) > 0 && (
            <div className="bg-surface ring-1 ring-black/5 dark:ring-white/5 rounded-2xl p-5 sm:p-6">
              <h3 className="font-display font-bold mb-4 text-sm sm:text-base">Pending invites</h3>
              <ul className="space-y-3">
                {invites!.map((iv) => (
                  <li key={iv.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{iv.email}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{iv.relation ?? "Family"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => {
                        navigator.clipboard.writeText(inviteLink(iv.token));
                        toast.success("Invite link copied");
                      }} className="px-2 py-1.5 text-[11px] border border-border rounded hover:bg-secondary flex items-center gap-1">
                        <Copy className="size-3" /> Copy link
                      </button>
                      <button onClick={() => deleteInvite(iv.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded">
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="bg-primary text-primary-foreground rounded-3xl p-5 sm:p-6 lg:sticky lg:top-20 h-fit shadow-lg">
          <h3 className="font-display font-bold mb-2 flex items-center gap-2">
            <UserPlus className="size-4" /> Invite family
          </h3>
          <p className="text-xs opacity-80 mb-4 leading-relaxed">
            Send them a link. Once they sign in and accept, confirm them here to unlock shared analytics.
          </p>
          <form onSubmit={(e) => { e.preventDefault(); if (email) inviteMut.mutate(); }} className="space-y-3">
            <input type="email" required placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg py-2 px-3 text-sm placeholder:text-white/50 outline-none focus:ring-2 ring-white/30 transition" />
            <input type="text" placeholder="Relation (e.g. Mother)" value={relation} onChange={(e) => setRelation(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg py-2 px-3 text-sm placeholder:text-white/50 outline-none focus:ring-2 ring-white/30 transition" />
            <button type="submit" disabled={inviteMut.isPending} className="w-full py-2 bg-white text-primary rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition">
              {inviteMut.isPending ? "Creating…" : "Create invite link"}
            </button>
          </form>
          <div className="mt-4 pt-4 border-t border-white/20 text-[11px] opacity-80 leading-relaxed">
            <p className="font-mono uppercase tracking-widest mb-1 text-[10px]">Mutual permission</p>
            Both people must confirm before any health data is shared. You can revoke access at any time.
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/50 px-2 py-2 min-w-0">
      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
        {icon}
        <p className="text-[9px] font-mono uppercase tracking-widest truncate">{label}</p>
      </div>
      <p className="text-sm font-display font-bold truncate">{value}</p>
    </div>
  );
}

