"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { submitExamAction } from "@/lib/exams/actions";

type Question = { id: string; question_text: string; choices: string[]; table_data: unknown };
export function ExamRunner({ attemptId, questions, startedAt, durationMinutes }: {
  attemptId: string; questions: Question[]; startedAt: string; durationMinutes: number;
}) {
  const [answers, setAnswers] = useState<number[]>(() => questions.map(() => -1));
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(() => Math.max(0, durationMinutes * 60 - Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const answered = useMemo(() => answers.filter(value => value >= 0).length, [answers]);

  const submit = useCallback(async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await submitExamAction(attemptId, answers);
      window.location.assign(`/result/${attemptId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่งคำตอบไม่สำเร็จ");
      setBusy(false);
    }
  }, [attemptId, answers, busy]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemaining(Math.max(0, durationMinutes * 60 - Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, durationMinutes]);

  useEffect(() => {
    if (remaining === 0 && !busy) void submit();
  }, [remaining, busy, submit]);

  const question = questions[current];
  const minutes = Math.floor(remaining / 60).toString().padStart(2, "0");
  const seconds = (remaining % 60).toString().padStart(2, "0");
  if (!question) return <section className="card">ไม่พบข้อสอบในชุดนี้</section>;

  return (
    <section className="stack">
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div><p className="muted" style={{ margin: 0 }}>ความคืบหน้า</p><strong>{answered} / {questions.length} ข้อที่ตอบแล้ว</strong></div>
        <div style={{ fontSize: 24, fontWeight: 800, color: remaining < 300 ? "#fca5a5" : "var(--gold)", fontVariantNumeric: "tabular-nums" }}>{minutes}:{seconds}</div>
      </div>
      <div className="card stack">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span className="gold">ข้อที่ {current + 1} / {questions.length}</span>
          <span className="muted">ตอบแล้ว {answered} ข้อ</span>
        </div>
        <div style={{ height: 6, background: "#303030", borderRadius: 99, overflow: "hidden" }}><div style={{ height: "100%", width: `${(answered / questions.length) * 100}%`, background: "var(--gold)" }} /></div>
        <h2 style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 20 }}>{question.question_text}</h2>
        {question.table_data && typeof question.table_data === "object" && <pre className="card" style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}>{JSON.stringify(question.table_data, null, 2)}</pre>}
        <div className="stack">
          {question.choices.map((choice, index) => (
            <button key={index} type="button" onClick={() => setAnswers(prev => prev.map((value, i) => i === current ? index : value))}
              className={answers[current] === index ? "btn" : "btn btn-secondary"}
              style={{ justifyContent: "flex-start", textAlign: "left", whiteSpace: "normal", lineHeight: 1.5 }}>
              <span style={{ minWidth: 24 }}>{["ก","ข","ค","ง"][index]}.</span>{choice}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" disabled={current === 0} onClick={() => setCurrent(v => v - 1)}>← ก่อนหน้า</button>
          <button className="btn btn-secondary" disabled={current === questions.length - 1} onClick={() => setCurrent(v => v + 1)}>ข้อถัดไป →</button>
        </div>
      </div>
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>ไปยังข้อ</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(40px,1fr))", gap: 7 }}>
          {questions.map((item, index) => <button key={item.id} className={index === current ? "btn" : answers[index] >= 0 ? "btn btn-secondary" : "btn btn-secondary"} style={{ padding: 8, borderColor: index === current ? "var(--gold)" : answers[index] >= 0 ? "#4ade80" : undefined }} onClick={() => setCurrent(index)}>{index + 1}</button>)}
        </div>
      </div>
      {error && <p role="alert" style={{ color: "#fca5a5" }}>{error}</p>}
      <button className="btn" disabled={busy} onClick={() => { if (window.confirm(`ยืนยันส่งคำตอบ? ตอบแล้ว ${answered} จาก ${questions.length} ข้อ`)) void submit(); }}>
        {busy ? "กำลังตรวจคำตอบ..." : "ส่งคำตอบและดูผลคะแนน"}
      </button>
    </section>
  );
}
