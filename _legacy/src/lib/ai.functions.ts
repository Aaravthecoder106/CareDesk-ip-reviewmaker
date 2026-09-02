import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider, CHAT_MODEL } from "./ai-gateway.server";

const EXTRACT_SYSTEM = `You are a medical records assistant. Given a medical report (image or PDF), extract structured data. Return ONLY valid JSON with this exact shape (no markdown fences):

{
  "summary": "one paragraph plain-language summary for a patient",
  "report_type": "e.g. Blood test, MRI, Prescription, Lipid Panel",
  "report_date": "YYYY-MM-DD or null if unknown",
  "conditions": ["diagnoses or conditions mentioned"],
  "medications": [{"name": "...", "dose": "..."}],
  "labs": [{"name": "Hemoglobin", "value": 13.5, "unit": "g/dL", "reference_low": 13.0, "reference_high": 17.0, "flag": "normal|high|low"}],
  "vitals": [{"name": "Blood Pressure", "value": "120/80", "unit": "mmHg"}],
  "flags": ["important findings worth attention, plain language"],
  "recommendations": ["what the report suggests"]
}

If a field is unknown, use null or []. Never invent values.`;

async function fetchFileAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
  const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
  const buf = await res.arrayBuffer();
  const base64 = Buffer.from(buf).toString("base64");
  return { base64, mimeType };
}

export const analyzeReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ reportId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY ?? "";
    if (!key) {
      throw new Error("AI is not configured. LOVABLE_API_KEY is missing.");
    }

    const { data: report, error } = await context.supabase
      .from("reports")
      .select("id, user_id, title, file_path, mime_type")
      .eq("id", data.reportId)
      .single();
    if (error || !report) throw new Error("Report not found");

    const { data: signed, error: sErr } = await context.supabase.storage
      .from("reports")
      .createSignedUrl(report.file_path, 60);
    if (sErr || !signed) throw new Error("Cannot access file");

    const { base64, mimeType } = await fetchFileAsBase64(signed.signedUrl);
    const isImage = mimeType.startsWith("image/");
    const isPdf = mimeType === "application/pdf" || report.file_path.toLowerCase().endsWith(".pdf");

    const gateway = createLovableAiGatewayProvider(key);

    let extractedJson = "";
    try {
      const result = await generateText({
        model: gateway(CHAT_MODEL),
        system: EXTRACT_SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: `Title provided by user: "${report.title}". Extract the report data as JSON.` },
              isImage
                ? { type: "image", image: `data:${mimeType};base64,${base64}` }
                : isPdf
                  ? { type: "file", data: `data:application/pdf;base64,${base64}`, mediaType: "application/pdf" }
                  : { type: "text", text: "(non-image, non-pdf attachment omitted)" },
            ],
          },
        ],
      });
      extractedJson = result.text.trim();
    } catch (e) {
      console.error("AI extract failed", e);
      await context.supabase
        .from("reports")
        .update({ status: "failed", ai_summary: "Analysis failed. You can retry from the report list." })
        .eq("id", report.id);
      throw e;
    }

    // strip fences if present
    extractedJson = extractedJson.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(extractedJson);
    } catch {
      parsed = { summary: extractedJson, raw: true };
    }

    const summary = typeof parsed.summary === "string" ? parsed.summary : "Report analyzed.";

    await context.supabase
      .from("reports")
      .update({ status: "ready", ai_summary: summary, ai_extracted: parsed as never })
      .eq("id", report.id);

    // Regenerate analytics snapshot
    const { data: all } = await context.supabase
      .from("reports")
      .select("id, title, created_at, ai_extracted")
      .eq("user_id", context.userId)
      .eq("status", "ready")
      .order("created_at", { ascending: true });

    const labs: Record<string, Array<{ date: string; value: number; unit: string | null }>> = {};
    const conditions = new Set<string>();
    const meds: string[] = [];
    const flags: Array<{ date: string; text: string; report: string }> = [];

    for (const r of all ?? []) {
      const ex = (r.ai_extracted ?? {}) as Record<string, unknown>;
      const labsList = Array.isArray(ex.labs) ? (ex.labs as Array<Record<string, unknown>>) : [];
      for (const l of labsList) {
        const name = String(l.name ?? "");
        const value = Number(l.value);
        if (!name || !Number.isFinite(value)) continue;
        (labs[name] ??= []).push({
          date: r.created_at,
          value,
          unit: typeof l.unit === "string" ? l.unit : null,
        });
      }
      const cList = Array.isArray(ex.conditions) ? ex.conditions : [];
      for (const c of cList) if (typeof c === "string" && c) conditions.add(c);
      const mList = Array.isArray(ex.medications) ? ex.medications : [];
      for (const m of mList) {
        const mo = m as Record<string, unknown>;
        if (typeof mo.name === "string") meds.push(mo.name);
      }
      const fList = Array.isArray(ex.flags) ? ex.flags : [];
      for (const f of fList) if (typeof f === "string") flags.push({ date: r.created_at, text: f, report: r.title });
    }

    const snapshot = {
      labs,
      conditions: Array.from(conditions),
      medications: Array.from(new Set(meds)),
      flags: flags.slice(-20),
      report_count: (all ?? []).length,
      updated_at: new Date().toISOString(),
    };

    await context.supabase
      .from("analytics_snapshots")
      .upsert({ user_id: context.userId, data: snapshot, updated_at: new Date().toISOString() });

    // Anomaly notifications: for each new flag, notify user and accepted family
    if (Array.isArray(parsed.flags) && parsed.flags.length > 0) {
      const flagText = (parsed.flags as string[]).slice(0, 2).join("; ");
      await context.supabase.from("notifications").insert({
        user_id: context.userId,
        type: "anomaly",
        title: `New findings in ${report.title}`,
        body: flagText,
      });
      const { data: fam } = await context.supabase
        .from("family_members")
        .select("owner_id, member_id")
        .eq("status", "accepted");
      const others = new Set<string>();
      for (const f of fam ?? []) {
        if (f.owner_id !== context.userId) others.add(f.owner_id);
        if (f.member_id !== context.userId) others.add(f.member_id);
      }
      if (others.size > 0) {
        const { data: prof } = await context.supabase
          .from("profiles").select("full_name").eq("id", context.userId).maybeSingle();
        const name = prof?.full_name ?? "A family member";
        await context.supabase.from("notifications").insert(
          Array.from(others).map((uid) => ({
            user_id: uid,
            type: "family_anomaly",
            title: `${name} has new findings`,
            body: flagText,
          })),
        );
      }
    }

    return { ok: true, summary };
  });

export const chatWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    message: z.string().min(1).max(4000),
    imageBase64: z.string().nullable().optional(),
    imageMime: z.string().nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY ?? "";
    if (!key) {
      throw new Error("AI is not configured. LOVABLE_API_KEY is missing.");
    }

    // Persist user message
    await context.supabase.from("chat_messages").insert({
      user_id: context.userId,
      role: "user",
      content: data.message,
    });

    // Build context from all reports
    const { data: reports } = await context.supabase
      .from("reports")
      .select("title, created_at, ai_summary, ai_extracted")
      .eq("user_id", context.userId)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(30);

    const contextBlock = (reports ?? []).map((r) => {
      const ex = r.ai_extracted ? JSON.stringify(r.ai_extracted).slice(0, 1500) : "";
      return `[${new Date(r.created_at).toLocaleDateString()}] ${r.title}\nSummary: ${r.ai_summary ?? "-"}\nData: ${ex}`;
    }).join("\n\n---\n\n") || "(No reports uploaded yet.)";

    // Fetch chat history
    const { data: history } = await context.supabase
      .from("chat_messages")
      .select("role, content")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(40);

    const messages: Array<{ role: "user" | "assistant"; content: unknown }> = (history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content as unknown,
    }));

    // Attach image to last user turn if provided
    if (data.imageBase64 && data.imageMime && messages.length > 0) {
      const last = messages[messages.length - 1];
      last.content = [
        { type: "text", text: String(last.content) },
        { type: "image", image: `data:${data.imageMime};base64,${data.imageBase64}` },
      ];
    }

    const gateway = createLovableAiGatewayProvider(key);

    const system = `You are CareDesk, a warm, careful AI health companion. You are NOT a doctor and must remind users to consult professionals for medical decisions.
You have access to the user's uploaded medical reports below. Ground every answer in that data — cite the specific report, date, and value when relevant.
If the user asks about something not covered by their reports, say so and offer general information.
Keep answers concise and use plain language. Format with short paragraphs, bullet lists, and bold for key values when helpful.

USER'S MEDICAL REPORTS:
${contextBlock}`;

    let reply = "";
    try {
      const result = await generateText({
        model: gateway(CHAT_MODEL),
        system,
        messages: messages as never,
      });
      reply = result.text;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg.includes("429")) reply = "I'm getting a lot of requests right now — please try again in a moment.";
      else if (msg.includes("402")) reply = "AI credits are exhausted. Please top up in workspace billing.";
      else reply = `Sorry, something went wrong: ${msg}`;
    }

    await context.supabase.from("chat_messages").insert({
      user_id: context.userId,
      role: "assistant",
      content: reply,
    });

    return { reply };
  });

export const clearChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("chat_messages").delete().eq("user_id", context.userId);
    return { ok: true };
  });

export const regenerateAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: all } = await context.supabase
      .from("reports")
      .select("id, title, created_at, ai_extracted")
      .eq("user_id", context.userId)
      .eq("status", "ready")
      .order("created_at", { ascending: true });

    const labs: Record<string, Array<{ date: string; value: number; unit: string | null }>> = {};
    const conditions = new Set<string>();
    const meds: string[] = [];
    const flags: Array<{ date: string; text: string; report: string }> = [];

    for (const r of all ?? []) {
      const ex = (r.ai_extracted ?? {}) as Record<string, unknown>;
      const labsList = Array.isArray(ex.labs) ? (ex.labs as Array<Record<string, unknown>>) : [];
      for (const l of labsList) {
        const name = String(l.name ?? "");
        const value = Number(l.value);
        if (!name || !Number.isFinite(value)) continue;
        (labs[name] ??= []).push({
          date: r.created_at,
          value,
          unit: typeof l.unit === "string" ? l.unit : null,
        });
      }
      const cList = Array.isArray(ex.conditions) ? ex.conditions : [];
      for (const c of cList) if (typeof c === "string" && c) conditions.add(c);
      const mList = Array.isArray(ex.medications) ? ex.medications : [];
      for (const m of mList) {
        const mo = m as Record<string, unknown>;
        if (typeof mo.name === "string") meds.push(mo.name);
      }
      const fList = Array.isArray(ex.flags) ? ex.flags : [];
      for (const f of fList) if (typeof f === "string") flags.push({ date: r.created_at, text: f, report: r.title });
    }

    const snapshot = {
      labs,
      conditions: Array.from(conditions),
      medications: Array.from(new Set(meds)),
      flags: flags.slice(-20),
      report_count: (all ?? []).length,
      updated_at: new Date().toISOString(),
    };

    await context.supabase
      .from("analytics_snapshots")
      .upsert({ user_id: context.userId, data: snapshot, updated_at: new Date().toISOString() });

    return { ok: true, report_count: snapshot.report_count };
  });
