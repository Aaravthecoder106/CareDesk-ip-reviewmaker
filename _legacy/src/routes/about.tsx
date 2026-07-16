import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About CareDesk — Personal medical companion" },
      { name: "description", content: "How CareDesk uses AI to help patients and caregivers understand and organize their medical history." },
      { property: "og:title", content: "About CareDesk" },
      { property: "og:description", content: "How CareDesk helps patients and caregivers understand their medical history." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div className="max-w-2xl mx-auto py-16 px-6">
      <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Back</Link>
      <h1 className="font-display text-4xl font-extrabold tracking-tight mb-6 mt-4">About CareDesk</h1>
      <div className="prose prose-sm dark:prose-invert">
        <p>CareDesk is a private, AI-powered home for your medical records. Upload any report — blood test, MRI, prescription, discharge summary — and CareDesk reads it, extracts the important numbers, tracks them over time, and explains what they mean in plain language.</p>
        <p>Invite family members to your Care Network so parents, siblings, or caregivers stay informed about important changes — with your permission.</p>
        <p><strong>What CareDesk is not:</strong> a substitute for professional medical advice. Always consult a doctor for medical decisions.</p>
      </div>
    </div>
  );
}
