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

  if (input.mode === "category" && !input.categoryId) throw new Error("กรุณาเลือกหมวดหมู่");
  if (input.mode === "year" && !input.examYearId) throw new Error("กรุณาเลือกปีข้อสอบ");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_exam_attempt_sampled", {
    p_mode: input.mode,
    p_count: input.mode === "full100" ? 100 : Math.max(1, Math.min(input.count ?? 10, 50)),
    p_category_id: input.mode === "category" ? input.categoryId : null,
    p_exam_year_id: input.mode === "year" ? input.examYearId : null,
  });

  if (error) throw new Error("เตรียมชุดข้อสอบไม่สำเร็จ: " + error.message);
  const result = data as { attempt_id?: string; total_questions?: number };
  if (!result?.attempt_id) throw new Error("ระบบไม่สามารถสร้างรอบสอบได้");
  return {
    attemptId: result.attempt_id,
    total: result.total_questions ?? 0,
    durationMinutes: input.mode === "full100" ? 180 : 30,
  };
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

export async function startBlueprintExamAction(code: string) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("กรุณาเข้าสู่ระบบก่อนเริ่มทำข้อสอบ");
  if (!/^[A-Z0-9_-]{2,60}$/.test(code)) throw new Error("Blueprint code ไม่ถูกต้อง");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_exam_attempt_from_blueprint", { p_blueprint_code: code });
  if (error) throw new Error("เริ่มชุดสอบไม่สำเร็จ: " + error.message);
  const result = data as { attempt_id?: string; total_questions?: number; time_limit_minutes?: number };
  if (!result?.attempt_id) throw new Error("ไม่สามารถสร้างรอบสอบได้");
  return { attemptId: result.attempt_id, total: result.total_questions ?? 0, durationMinutes: result.time_limit_minutes ?? 0 };
}
