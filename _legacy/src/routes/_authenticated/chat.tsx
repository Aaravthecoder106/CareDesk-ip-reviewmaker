import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { chatWithAI, clearChat } from "@/lib/ai.functions";
import { Send, Trash2, Image as ImageIcon, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "AI Assistant — CareDesk" }] }),
  component: ChatPage,
});

function ChatPage() {
  const send = useServerFn(chatWithAI);
  const clear = useServerFn(clearChat);
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [image, setImage] = useState<{ base64: string; mime: string; preview: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: messages } = useQuery({
    queryKey: ["chat"],
    queryFn: async () => {
      const { data } = await supabase.from("chat_messages")
        .select("id, role, content, created_at").order("created_at", { ascending: true });
      return data ?? [];
    },
    refetchInterval: false,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    textareaRef.current?.focus();
  }, [messages]);

  const sendMut = useMutation({
    mutationFn: async (payload: { message: string; imageBase64: string | null; imageMime: string | null }) => {
      return await send({ data: payload });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Chat failed"),
  });

  function submitMessage() {
    const msg = input.trim();
    if (!msg || sendMut.isPending) return;
    const payload = { message: msg, imageBase64: image?.base64 ?? null, imageMime: image?.mime ?? null };
    setInput("");
    setImage(null);
    sendMut.mutate(payload);
  }

  async function pickImage(f: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      setImage({ base64, mime: f.type, preview: dataUrl });
    };
    reader.readAsDataURL(f);
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-9rem)]">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Grounded in your reports</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">AI Health Assistant</h1>
        </div>
        <button onClick={async () => {
          if (!confirm("Clear chat history?")) return;
          await clear({}); qc.invalidateQueries({ queryKey: ["chat"] });
        }} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-secondary flex items-center gap-2">
          <Trash2 className="size-3" /> Clear
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-6 pr-2">
        {!messages?.length && (
          <div className="text-center py-16">
            <p className="font-display text-xl font-bold mb-2">Ask about your health.</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              I've read every report in your library. Ask about a specific value, compare over time, or get plain-language explanations.
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
              {[
                "Summarize my latest report",
                "What's my cholesterol trend?",
                "Any medications I should be aware of?",
              ].map((s) => (
                <button key={s} onClick={() => setInput(s)} className="px-3 py-1.5 text-xs bg-secondary rounded-full hover:bg-accent">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages?.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={m.role === "user"
              ? "bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl rounded-br-md max-w-[80%] text-sm"
              : "max-w-[85%] text-sm prose prose-sm dark:prose-invert text-foreground [&_p]:my-2 [&_ul]:my-2 [&_strong]:text-primary"
            }>
              {m.role === "assistant"
                ? <ReactMarkdown>{m.content}</ReactMarkdown>
                : m.content}
            </div>
          </div>
        ))}

        {sendMut.isPending && (
          <div className="text-sm text-muted-foreground animate-pulse">CareDesk is thinking…</div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submitMessage(); }}
            className="border border-border rounded-2xl bg-surface p-3">
        {image && (
          <div className="mb-2 relative inline-block">
            <img src={image.preview} alt="preview" className="h-16 rounded-lg" />
            <button type="button" onClick={() => setImage(null)} className="absolute -top-2 -right-2 bg-background border border-border rounded-full p-0.5">
              <X className="size-3" />
            </button>
          </div>
        )}
        <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitMessage(); } }}
          placeholder="Ask about your reports…"
          rows={2}
          className="w-full bg-transparent outline-none text-sm resize-none" />
        <div className="flex items-center justify-between mt-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="p-1.5 text-muted-foreground hover:text-foreground">
            <ImageIcon className="size-4" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => {
            const f = e.target.files?.[0]; if (f) pickImage(f); e.target.value = "";
          }} />
          <button type="submit" disabled={!input.trim() || sendMut.isPending} className="size-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center disabled:opacity-40">
            <Send className="size-3.5" />
          </button>
        </div>
      </form>
      <p className="text-[10px] text-muted-foreground text-center mt-2">
        Not medical advice. Always consult a doctor. Attach images inline; upload files/PDFs via Report Library.
      </p>
    </div>
  );
}
