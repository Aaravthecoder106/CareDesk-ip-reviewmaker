import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Sign in — CareDesk" }, { name: "description", content: "Sign in to CareDesk to manage your health records with AI." }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: (search.redirect ?? "/dashboard") as "/dashboard" });
    });
  }, [navigate, search.redirect]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name || email.split("@")[0] } },
        });
        if (error) throw error;
        toast.success("Account created — you're signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: (search.redirect ?? "/") as "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast.error(result.error.message);
    if (!result.redirected) navigate({ to: (search.redirect ?? "/") as "/" });
  }

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-primary text-primary-foreground p-14">
        <div className="flex items-center gap-2">
          <div className="size-8 bg-white/10 rounded-lg flex items-center justify-center">
            <Sparkles className="size-4" strokeWidth={2.5} />
          </div>
          <span className="font-display text-xl font-bold">CareDesk</span>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest opacity-70 mb-4">Personal Medical Companion</p>
          <h2 className="font-display text-4xl font-extrabold tracking-tight leading-tight mb-4 text-balance">
            Your entire health history, understood in plain language.
          </h2>
          <p className="text-primary-foreground/80 leading-relaxed max-w-md">
            Upload reports, ask questions, share insights with family. CareDesk reads every value, remembers every trend, and never forgets.
          </p>
        </div>
        <p className="text-[11px] font-mono uppercase tracking-widest opacity-50">Private by design · You control access</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-2xl font-bold mb-2">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
          <p className="text-sm text-muted-foreground mb-8">
            {mode === "signin" ? "Sign in to your health desk." : "Free forever for personal use."}
          </p>

          <button onClick={google} className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-border rounded-lg text-sm font-medium hover:bg-secondary transition-colors mb-4">
            <svg className="size-4" viewBox="0 0 24 24"><path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-4 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />OR<div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
                className="w-full py-2.5 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            )}
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
              className="w-full py-2.5 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
              className="w-full py-2.5 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            <button type="submit" disabled={loading} className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-primary font-medium hover:underline">
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
