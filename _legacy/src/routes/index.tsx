import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, MessageCircle, FileLock2, LineChart, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 bg-primary rounded-lg flex items-center justify-center">
              <Sparkles className="size-4 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="font-display text-xl font-bold">CareDesk</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground">About</Link>
            <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground">Privacy</Link>
            <Link to="/auth" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Sign in</Link>
          </div>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-6">Personal Medical Companion · Beta</p>
        <h1 className="font-display text-6xl font-extrabold tracking-tight text-balance mb-6">
          Your entire health history, understood in plain language.
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 text-pretty">
          CareDesk keeps every medical report in one private, encrypted place — reads them for you, tracks trends over time, and keeps your family informed.
        </p>
        <div className="flex justify-center gap-3">
          <Link to="/auth" className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90">Get started free</Link>
          <Link to="/about" className="px-6 py-3 border border-border rounded-lg font-medium hover:bg-secondary">How it works</Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-24 grid md:grid-cols-4 gap-4">
        {[
          { icon: FileLock2, title: "Report Library", body: "Password-locked storage for every scan, prescription, and lab result." },
          { icon: MessageCircle, title: "AI Assistant", body: "Ask questions about your health — grounded in your actual reports." },
          { icon: LineChart, title: "Analytics", body: "Trend lines and visuals across every value in your history." },
          { icon: Users, title: "Family Care", body: "Invite loved ones. Get alerted when something changes." },
        ].map((f) => (
          <div key={f.title} className="p-6 bg-surface rounded-2xl ring-1 ring-black/5 dark:ring-white/5">
            <f.icon className="size-5 text-primary mb-4" strokeWidth={1.75} />
            <h3 className="font-display font-bold mb-2">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © 2026 CareDesk · Not a substitute for professional medical advice.
      </footer>
    </div>
  );
}
