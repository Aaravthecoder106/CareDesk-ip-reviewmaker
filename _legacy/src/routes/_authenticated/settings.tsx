import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { setLibraryPassword } from "@/lib/library.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — CareDesk" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const setPw = useServerFn(setLibraryPassword);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw2] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? "");
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      setName(data?.full_name ?? "");
    })();
  }, []);

  async function saveName() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
    if (error) toast.error(error.message); else toast.success("Saved");
  }

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    await setPw({ data: { password: pw } });
    sessionStorage.removeItem("caredesk_lib_unlocked");
    toast.success("Library password updated");
    setPw2("");
  }

  return (
    <div className="max-w-2xl">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Settings</h1>
      </header>
      <div className="space-y-6">
        <section className="bg-surface ring-1 ring-black/5 dark:ring-white/5 rounded-2xl p-6">
          <h3 className="font-display font-bold mb-4">Profile</h3>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-mono uppercase text-muted-foreground">Email</span>
              <input value={email} disabled className="w-full py-2 px-3 mt-1 rounded-lg border border-border bg-secondary/50 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-mono uppercase text-muted-foreground">Full name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full py-2 px-3 mt-1 rounded-lg border border-border bg-background text-sm" />
            </label>
            <button onClick={saveName} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">Save</button>
          </div>
        </section>

        <section className="bg-surface ring-1 ring-black/5 dark:ring-white/5 rounded-2xl p-6">
          <h3 className="font-display font-bold mb-2">Report Library password</h3>
          <p className="text-xs text-muted-foreground mb-4">Change the password used to unlock your report library.</p>
          <form onSubmit={changePw} className="flex gap-2">
            <input type="password" required minLength={4} value={pw} onChange={(e) => setPw2(e.target.value)}
              placeholder="New password" className="flex-1 py-2 px-3 rounded-lg border border-border bg-background text-sm" />
            <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">Update</button>
          </form>
        </section>
      </div>
    </div>
  );
}
