import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { randomBytes } from "crypto";

export const createInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    email: z.string().email(),
    relation: z.string().max(60).optional().nullable(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const token = randomBytes(24).toString("hex");
    const { error } = await context.supabase.from("family_invites").insert({
      owner_id: context.userId,
      email: data.email,
      relation: data.relation ?? null,
      token,
    });
    if (error) throw new Error(error.message);
    return { token };
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ token: z.string().min(10) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase.rpc("accept_family_invite", { _token: data.token });
    if (error) throw new Error(error.message);
    return res as { ok: boolean; owner_id: string; status?: string };
  });

export const confirmFamilyMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ memberRowId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: res, error } = await (context.supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)("confirm_family_member", { _member_id: data.memberRowId });
    if (error) throw new Error(error.message);
    return res as { ok: boolean };
  });
