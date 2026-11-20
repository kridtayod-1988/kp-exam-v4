"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type BlueprintRule = { category_id?: string; cat?: string; sub_codes?: string[]; quota: number; pass_pct?: number; name?: string };

export async function saveBlueprintAction(input: {
  id?: string; code: string; title: string; description?: string;
  timeLimitMinutes: number; rules: BlueprintRule[]; isActive: boolean;
}) {
  const admin = await requireAdmin();
  const code = input.code.trim().toUpperCase();
  const title = input.title.trim();
  if (!/^[A-Z0-9_-]{2,60}$/.test(code)) throw new Error("รหัส Blueprint ต้องเป็น A-Z, 0-9, _ หรือ -");
  if (title.length < 2 || title.length > 160) throw new Error("กรุณาระบุชื่อ Blueprint 2-160 ตัวอักษร");
  if (!Number.isInteger(input.timeLimitMinutes) || input.timeLimitMinutes < 1 || input.timeLimitMinutes > 600) throw new Error("เวลาไม่ถูกต้อง");
  if (!Array.isArray(input.rules) || input.rules.length === 0) throw new Error("กรุณากำหนดโควตาอย่างน้อยหนึ่งหมวด");
  const rules = input.rules.filter(r => Number.isInteger(r.quota) && r.quota > 0);
  const total = rules.reduce((sum, rule) => sum + rule.quota, 0);
  if (total < 1 || total > 200 || rules.length !== input.rules.length) throw new Error("โควตารวมต้องอยู่ระหว่าง 1-200 ข้อ และทุกหมวดต้องมีโควตามากกว่า 0");
  for (const rule of rules) {
    if ((!rule.category_id || !/^[0-9a-f-]{36}$/i.test(rule.category_id)) && !rule.cat) throw new Error("แต่ละกฎต้องระบุ category_id หรือ cat");
    if (rule.sub_codes && (!Array.isArray(rule.sub_codes) || rule.sub_codes.some(x => typeof x !== "string" || x.length > 40))) throw new Error("รหัสหมวดย่อยไม่ถูกต้อง");
  }

  const supabase = await createClient();
  const payload = {
    code, title, description: input.description?.trim() || null,
    total_questions: total, time_limit_minutes: input.timeLimitMinutes,
    rules, is_active: input.isActive, created_by: admin.id, updated_at: new Date().toISOString(),
  };
  const result = input.id
    ? await supabase.from("exam_blueprints").update(payload).eq("id", input.id)
    : await supabase.from("exam_blueprints").insert(payload);
  if (result.error) throw new Error(result.error.message);
  revalidatePath("/admin/blueprints");
  revalidatePath("/dashboard");
}

export async function toggleBlueprintAction(id: string, isActive: boolean) {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Blueprint ID ไม่ถูกต้อง");
  const supabase = await createClient();
  const { error } = await supabase.from("exam_blueprints").update({ is_active: isActive, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/blueprints");
  revalidatePath("/dashboard");
}

export async function reviewAiDraftAction(id: string, decision: "approve" | "reject") {
  const admin = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Draft ID ไม่ถูกต้อง");
  const supabase = await createClient();
  const { data: draft, error: readError } = await supabase.from("ai_question_drafts")
    .select("id,payload,status").eq("id", id).single();
  if (readError || !draft) throw new Error("ไม่พบ AI Draft");
  if (draft.status !== "draft") throw new Error("Draft นี้ได้รับการตรวจสอบแล้ว");

  if (decision === "approve") {
    const payload = draft.payload as Record<string, unknown>;
    const allowed = ["category_id","cat","sub","question_text","table_data","options","correct_answer_index","explanation","difficulty","source"];
    const question = Object.fromEntries(Object.entries(payload).filter(([key]) => allowed.includes(key)));
    const { error: insertError } = await supabase.from("questions").insert({
      ...question, source: "ai_generated", created_by: admin.id, is_active: true,
    });
    if (insertError) throw new Error("บันทึกข้อสอบไม่สำเร็จ: " + insertError.message);
  }
  const { error: updateError } = await supabase.from("ai_question_drafts").update({
    status: decision === "approve" ? "approved" : "rejected",
    reviewed_at: new Date().toISOString(), reviewed_by: admin.id,
  }).eq("id", id).eq("status", "draft");
  if (updateError) throw new Error(updateError.message);
  revalidatePath("/admin/ai-generator");
  revalidatePath("/admin/questions");
}
