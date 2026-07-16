import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — CareDesk" },
      { name: "description", content: "How CareDesk stores, protects, and never shares your medical data." },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <div className="max-w-2xl mx-auto py-16 px-6">
      <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Back</Link>
      <h1 className="font-display text-4xl font-extrabold tracking-tight mb-6 mt-4">Privacy</h1>
      <div className="prose prose-sm dark:prose-invert">
        <p>Your reports are stored in a private, encrypted bucket. Only you can access your files.</p>
        <p>The Report Library has an additional password lock. AI analysis runs server-side using your data as context, and never shares your data with third parties beyond the AI model provider for the duration of the request.</p>
        <p>This is a working prototype. Do not upload production medical records until CareDesk is certified for clinical use.</p>
      </div>
    </div>
  );
}
