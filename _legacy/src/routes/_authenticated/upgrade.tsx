import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/upgrade")({
  head: () => ({ meta: [{ title: "Upgrade — CareDesk" }] }),
  component: UpgradePage,
});

function UpgradePage() {
  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-10 text-center">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Pricing</p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight mb-3">Simple, honest pricing</h1>
        <p className="text-muted-foreground">Free covers most families. Upgrade when you need more.</p>
      </header>
      <div className="grid md:grid-cols-2 gap-6">
        {[
          { name: "Free", price: "$0", desc: "For personal use.", features: ["Unlimited reports", "AI chat (fair use)", "Basic analytics", "1 family member"] },
          { name: "Pro", price: "$9/mo", desc: "For families and caregivers.", features: ["Everything in Free", "Unlimited family members", "Priority AI analysis", "Anomaly alerts", "Export & sharing"], featured: true },
        ].map((p) => (
          <div key={p.name} className={"p-8 rounded-3xl " + (p.featured ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20" : "bg-surface ring-1 ring-black/5 dark:ring-white/5")}>
            <h3 className="font-display text-xl font-bold mb-1">{p.name}</h3>
            <p className={"text-sm mb-4 " + (p.featured ? "opacity-80" : "text-muted-foreground")}>{p.desc}</p>
            <p className="font-display text-4xl font-extrabold mb-6">{p.price}</p>
            <ul className="space-y-2 mb-6">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="size-4" strokeWidth={2.5} /> {f}
                </li>
              ))}
            </ul>
            <button disabled className={"w-full py-2.5 rounded-lg text-sm font-medium disabled:opacity-70 " + (p.featured ? "bg-white text-primary" : "bg-primary text-primary-foreground")}>
              {p.featured ? "Coming soon" : "Current plan"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
