"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

export type ExamMode = "full100" | "category" | "year";

export async function startExamAction(input: {
  mode: ExamMode;
  count?: number;
  categoryId?: string;
  examYearId?: string;
}) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("กรุณาเข้าสู่ระบบก่อนเริ่มทำข้อสอบ");

  const supabase = await createClient();
  let query = supabase
    .from("v_questions_public")
    .select("id, category_id, exam_year_id, cat, sub, difficulty, question_text, choices, table_data");

  if (input.mode === "category") {
    if (!input.categoryId) throw new Error("กรุณาเลือกหมวดหมู่");
    query = query.eq("category_id", input.categoryId);
  }
  if (input.mode === "year") {
    if (!input.examYearId) throw new Error("กรุณาเลือกปีข้อสอบ");
    query = query.eq("exam_year_id", input.examYearId);
  }

  const { data, error } = await query;
  if (error) throw new Error("ไม่สามารถโหลดคลังข้อสอบได้: " + error.message);
  const bank = (data ?? []) as Array<{
    id: string; category_id: string; exam_year_id: string | null;
    cat: string | null; sub: string | null; difficulty: number | null;
    question_text: string; choices: string[]; table_data: unknown;
  }>;
  if (!bank.length) throw new Error("ยังไม่มีข้อสอบในหมวดที่เลือก");

  const requested = input.mode === "full100" ? 100 : Math.max(1, Math.min(input.count ?? 10, 50));
  const [{ data: seenRow }, { data: exposureRows }] = await Promise.all([
    supabase.from("user_seen_questions").select("seen_question_ids").eq("user_id", profile.id).maybeSingle(),
    supabase.from("v_item_exposure").select("id, times_served"),
  ]);
  const seenIds = new Set<string>((seenRow?.seen_question_ids ?? []) as string[]);
  const exposure = new Map<string, number>((exposureRows ?? []).map((row: {id:string;times_served:number}) => [row.id, row.times_served]));

  // Prefer unseen questions and lower-exposure questions; preserve a randomized order.
  const ranked = bank.map(question => ({
    question,
    rank: Math.random() / (1 + (exposure.get(question.id) ?? 0)),
    seen: seenIds.has(question.id),
  })).sort((a, b) => Number(a.seen) - Number(b.seen) || b.rank - a.rank);
  const selected = ranked.slice(0, Math.min(requested, bank.length)).map(item => item.question);

  const durationMinutes = input.mode === "full100" ? 180 : 30;
  const { data: attempt, error: insertError } = await supabase
    .from("exam_attempts")
    .insert({
      user_id: profile.id,
      mode: input.mode,
      category_id: input.mode === "category" ? input.categoryId : null,
      exam_year_id: input.mode === "year" ? input.examYearId : null,
      question_ids: selected.map(question => question.id),
      user_answers: selected.map(() => -1),
      total_questions: selected.length,
      started_at: new Date().toISOString(),
      paper_id: `${input.mode}-${Date.now()}`,
    })
    .select("id")
    .single();

  if (insertError || !attempt) throw new Error("สร้างชุดข้อสอบไม่สำเร็จ: " + (insertError?.message ?? "unknown error"));
  return { attemptId: attempt.id, total: selected.length, durationMinutes };
}

export async function submitExamAction(attemptId: string, answers: number[]) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
  if (!Array.isArray(answers) || answers.some(value => !Number.isInteger(value) || value < -1 || value > 3)) {
    throw new Error("รูปแบบคำตอบไม่ถูกต้อง");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_exam", {
    p_attempt_id: attemptId,
    p_answers: answers,
  });
  if (error) throw new Error(error.message);
  return data;
}
