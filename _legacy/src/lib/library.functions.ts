import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

function hash(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

export const setLibraryPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ password: z.string().min(4).max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    const salt = randomBytes(16).toString("hex");
    const password_hash = hash(data.password, salt);
    const { error } = await context.supabase
      .from("library_settings")
      .upsert({ user_id: context.userId, password_hash, salt, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const verifyLibraryPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ password: z.string().min(1).max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("library_settings")
      .select("password_hash, salt")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row) return { ok: false, reason: "not_set" as const };
    const test = hash(data.password, row.salt);
    const a = Buffer.from(test, "hex");
    const b = Buffer.from(row.password_hash, "hex");
    if (a.length !== b.length) return { ok: false, reason: "wrong" as const };
    const ok = timingSafeEqual(a, b);
    return { ok, reason: ok ? "ok" as const : "wrong" as const };
  });

export const hasLibraryPassword = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("library_settings")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { exists: Boolean(data) };
  });
