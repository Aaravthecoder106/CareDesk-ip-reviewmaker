import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { acceptInvite } from "@/lib/family.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  head: () => ({ meta: [{ title: "Accept invite — CareDesk" }] }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = useParams({ from: "/invite/$token" });
  const navigate = useNavigate();
  const accept = useServerFn(acceptInvite);
  const [state, setState] = useState<"loading" | "signin" | "done" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setState("signin");
        return;
      }
      try {
        await accept({ data: { token } });
        toast.success("You're connected!");
        setState("done");
        setTimeout(() => navigate({ to: "/family" }), 800);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
        setState("error");
      }
    })();
  }, [accept, navigate, token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-surface ring-1 ring-black/5 rounded-3xl p-10 text-center">
        <h1 className="font-display text-2xl font-bold mb-2">Care Network invite</h1>
        {state === "loading" && <p className="text-sm text-muted-foreground">Connecting…</p>}
        {state === "signin" && (
          <>
            <p className="text-sm text-muted-foreground mb-6">Sign in to accept this invite.</p>
            <button onClick={() => navigate({ to: "/auth", search: { redirect: `/invite/${token}` } })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
              Sign in
            </button>
          </>
        )}
        {state === "done" && <p className="text-sm text-emerald-600">Connected! Taking you to your family…</p>}
        {state === "error" && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
