import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ExamRunner } from "@/components/exam-runner";

export default async function ExamPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const profile = await requireUser();
  const supabase = await createClient();

  const { data: attempt, error } = await supabase
    .from("exam_attempts")
    .select("id, mode, question_ids, started_at, finished_at")
    .eq("id", attemptId)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (error || !attempt) notFound();
  if (attempt.finished_at) redirect(`/result/${attemptId}`);

  const ids = (attempt.question_ids ?? []) as string[];
  if (!ids.length) notFound();
  const { data: rows, error: questionsError } = await supabase
    .from("v_questions_public")
    .select("id, question_text, choices, table_data")
    .in("id", ids);
  if (questionsError || !rows?.length) notFound();

  const byId = new Map(rows.map(row => [row.id, row]));
  const questions = ids.map(id => byId.get(id)).filter(Boolean) as Array<{id:string;question_text:string;choices:string[];table_data:unknown}>;
  if (questions.length !== ids.length) notFound();

  const durationMinutes = attempt.mode === "full100" ? 180 : 30;
  return (
    <section className="stack">
      <div><p className="gold" style={{ marginBottom: 6 }}>กำลังทำข้อสอบ</p><h1 style={{ marginTop: 0 }}>ข้อสอบ ก.พ.</h1></div>
      <ExamRunner attemptId={attemptId} questions={questions} startedAt={attempt.started_at} durationMinutes={durationMinutes} />
    </section>
  );
}
