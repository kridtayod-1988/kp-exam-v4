import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Review = { attempt_id: string; score: number; total: number; exp_gained: number; duration_seconds: number; items: Array<{
  no: number; question_id: string; question_text: string; choices: string[]; correct_answer_index: number; user_choice: number; is_correct: boolean; explanation: string;
}> };

export default async function ResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const profile = await requireUser();
  const supabase = await createClient();
  const { data: attempt } = await supabase.from("exam_attempts").select("id, score, total_questions, exp_gained, finished_at").eq("id", attemptId).eq("user_id", profile.id).maybeSingle();
  if (!attempt || !attempt.finished_at) notFound();

  const { data, error } = await supabase.rpc("get_exam_review", { p_attempt_id: attemptId });
  if (error || !data) notFound();
  const review = data as unknown as Review;
  const percent = review.total ? Math.round((review.score / review.total) * 100) : 0;

  return (
    <section className="stack">
      <div className="card" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 44 }}>🏆</div>
        <p className="gold" style={{ fontWeight: 700 }}>สรุปผลการสอบ</p>
        <h1 style={{ fontSize: 44, margin: "8px 0" }}>{review.score} / {review.total}</h1>
        <p className="muted">{percent}% คะแนนที่ได้</p>
        <p>ได้รับ {review.exp_gained} EXP</p>
        <Link className="btn" href="/dashboard">กลับหน้า Dashboard</Link>
      </div>
      <div className="card stack">
        <h2 style={{ marginTop: 0 }}>เฉลยและคำอธิบาย</h2>
        {review.items.map(item => (
          <article key={item.question_id} style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <p><strong>ข้อ {item.no}.</strong> {item.question_text}</p>
            <p style={{ color: item.is_correct ? "#4ade80" : "#fca5a5" }}>{item.is_correct ? "ตอบถูก" : "ตอบไม่ถูก"} · คำตอบที่ถูก: {["ก","ข","ค","ง"][item.correct_answer_index]}</p>
            {item.explanation && <p className="muted">{item.explanation}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
