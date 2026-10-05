import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchQuestionsForExam, saveAttempt } from '../services/supabaseApi';
import { askAiExplanation } from '../services/aiService';
import { supabase } from '../supabaseClient';

function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return { h: String(h).padStart(2, '0'), m: String(m).padStart(2, '0'), s: String(s).padStart(2, '0') };
}

export default function ExamScreen({ exam, onExit }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [view, setView] = useState('running');
  const [session, setSession] = useState(null);
  const [aiText, setAiText] = useState({});
  const [loadingAi, setLoadingAi] = useState({});
  const timerRef = useRef(null);

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    };
    getSession();
  }, []);

  useEffect(() => {
    const loadQuestions = async () => {
      const q = await fetchQuestionsForExam(exam);
      setQuestions(q);
      setAnswers(Array(q.length).fill(null));
      setCurrentQIndex(0);
      setRemainingSeconds(exam.time_limit_minutes * 60);
    };
    if (exam) loadQuestions();
  }, [exam]);

  useEffect(() => {
    if (view === 'running' && remainingSeconds > 0) {
      timerRef.current = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            finishExam(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(timerRef.current);
  }, [view, remainingSeconds]);

  const finishExam = async (isTimeout = false) => {
    clearInterval(timerRef.current);
    setView('result');

    if (isTimeout) {
      console.log('Auto submit due to timeout');
    }

    // Save attempt to Supabase if session exists
    if (session?.user?.id && questions.length) {
      try {
        const scoreResult = calcScore();
        await saveAttempt({
          userId: session.user.id,
          exam,
          questions,
          answers,
          scoreResult
        });
      } catch (err) {
        console.error('saveAttempt failed:', err);
      }
    }
  };

  const calcScore = () => {
    let correctCount = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.correct) correctCount += 1;
    });

    const total = questions.length || 0;
    const percentage = total ? Math.round((correctCount / total) * 100) : 0;
    const passMark = exam ? Math.round((exam.pass_score / exam.max_score) * 100) : 60;

    return {
      score: correctCount,
      total,
      percentage,
      passed: percentage >= passMark
    };
  };

  const scoreResult = useMemo(() => calcScore(), [questions, answers, exam]);

  const handleAiExplain = async (idx) => {
    const q = questions[idx];
    if (!q) return;

    setLoadingAi(prev => ({ ...prev, [idx]: true }));
    try {
      const responseText = await askAiExplanation(
        q.text,
        answers[idx] !== null ? q.options[answers[idx]] : 'ไม่ได้ตอบ',
        q.options[q.correct],
        q.exp
      );
      setAiText(prev => ({ ...prev, [idx]: responseText }));
    } catch (err) {
      setAiText(prev => ({
        ...prev,
        [idx]: 'เกิดข้อผิดพลาดขณะสรุปคำอธิบาย AI กรุณาลองใหม่อีกครั้ง'
      }));
    } finally {
      setLoadingAi(prev => ({ ...prev, [idx]: false }));
    }
  };

  if (!questions.length) return <div className="text-white p-8">กำลังเตรียมข้อสอบ...</div>;

  if (view === 'result') {
    return (
      <div className="min-h-screen bg-[#0D0D0D] text-gray-200 pb-16">
        <header className="border-b border-[#1F1F1F] bg-[#121212]/90 sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
            <h1 className="font-bold text-white text-lg">สรุปผลการสอบ</h1>
            <button onClick={onExit} className="px-4 py-2 bg-[#1F1F1F] border border-[#333] rounded-xl text-xs font-bold hover:bg-[#2B2B2B]">
              กลับสู่หน้าหลัก
            </button>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 pt-8">
          <div className="bg-[#141414] border border-[#222] rounded-3xl p-6 md:p-8 text-center mb-8">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl border ${scoreResult.passed ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>
              {scoreResult.passed ? '🎉' : '📚'}
            </div>

            <h2 className="text-2xl font-extrabold text-white mb-1">
              {scoreResult.passed ? 'ผ่านเกณฑ์การสอบ!' : 'ยังไม่ผ่านเกณฑ์ พยายามอีกนิด!'}
            </h2>
            <p className="text-gray-400 text-xs mb-6">ชุดข้อสอบ: {exam.name}</p>

            <div className="inline-flex items-baseline gap-2 bg-[#1A1A1A] border border-[#2A2A2A] px-6 py-3 rounded-2xl mb-6">
              <span className={`text-4xl md:text-5xl font-black ${scoreResult.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                {scoreResult.score}
              </span>
              <span className="text-gray-500 text-lg font-bold">/ {scoreResult.total} คะแนน ({scoreResult.percentage}%)</span>
            </div>

            <div className="grid grid-cols-2 max-w-sm mx-auto gap-4 text-left pt-4 border-t border-[#222]">
              <div className="bg-[#181818] p-3 rounded-xl border border-[#2A2A2A]">
                <div className="text-xs text-gray-500">ตอบถูก</div>
                <div className="text-lg font-bold text-emerald-400">{scoreResult.score} ข้อ</div>
              </div>
              <div className="bg-[#181818] p-3 rounded-xl border border-[#2A2A2A]">
                <div className="text-xs text-gray-500">ตอบผิด/ไม่ตอบ</div>
                <div className="text-lg font-bold text-rose-400">{scoreResult.total - scoreResult.score} ข้อ</div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {questions.map((q, idx) => {
              const userAns = answers[idx];
              const isCorrect = userAns === q.correct;
              const isUnanswered = userAns === null;

              return (
                <div key={idx} className="bg-[#141414] border border-[#222] rounded-2xl p-6">
                  <div className="flex justify-between items-center mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${isCorrect ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40' : 'bg-rose-950/40 text-rose-400 border-rose-800/40'}`}>
                      ข้อ {idx + 1} : {isCorrect ? '✓ ตอบถูกต้อง' : isUnanswered ? '⚠️ ไม่ได้ตอบ' : '✕ ตอบผิด'}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">หมวด {q.cat.toUpperCase()}</span>
                  </div>

                  <p className="text-base font-bold text-white mb-4 leading-relaxed">{q.text}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-sm">
                    <div className={`p-3 rounded-xl border ${isCorrect ? 'bg-emerald-950/20 border-emerald-800/30' : 'bg-rose-950/20 border-rose-800/30'}`}>
                      <div className="text-xs text-gray-500 mb-1">คำตอบของคุณ:</div>
                      <div className={`font-semibold ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {userAns !== null ? q.options[userAns] : 'ไม่ได้เลือกคำตอบ'}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl border border-blue-900/40 bg-blue-950/20">
                      <div className="text-xs text-gray-500 mb-1">เฉลยที่ถูกต้อง:</div>
                      <div className="font-semibold text-blue-400">{q.options[q.correct]}</div>
                    </div>
                  </div>

                  <div className="bg-[#1A1A1A] border border-[#262626] p-4 rounded-xl text-xs text-gray-300 leading-relaxed mb-4">
                    <span className="text-[#F2C744] font-bold block mb-1">💡 เฉลยคำอธิบาย:</span>
                    {q.exp}
                  </div>

                  {!aiText[idx] ? (
                    <button
                      onClick={() => handleAiExplain(idx)}
                      disabled={loadingAi[idx]}
                      className="w-full py-2.5 bg-gradient-to-r from-indigo-950/50 to-purple-950/50 border border-indigo-800/40 text-indigo-300 rounded-xl text-xs font-bold"
                    >
                      {loadingAi[idx] ? 'AI กำลังวิเคราะห์...' : 'ให้ AI Tutor วิเคราะห์จุดแข็ง/จุดอ่อนข้อนี้'}
                    </button>
                  ) : (
                    <div className="bg-indigo-950/30 border border-indigo-800/50 p-4 rounded-xl text-xs text-indigo-200 leading-relaxed whitespace-pre-line">
                      {aiText[idx]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  const currentQ = questions[currentQIndex];
  const { h, m, s } = formatTime(remainingSeconds);

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white flex flex-col justify-between">
      <header className="sticky top-0 z-40 bg-[#121212] border-b border-[#222] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="bg-[#1C1C1C] hover:bg-[#282828] border border-[#333] px-3 py-1.5 rounded-lg text-xs font-bold text-gray-300">กลับ</button>
          <div className="text-xs text-gray-400 hidden md:block">
            <span className="font-bold text-white">{exam.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl border bg-[#181818] border-[#333] text-[#F2C744] font-mono font-bold text-lg">
          <i className="fa-regular fa-clock text-sm"></i>
          <span>{h}:{m}:{s}</span>
        </div>

        <button
          onClick={() => finishExam(false)}
          className="bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-400 font-bold px-4 py-1.5 rounded-xl text-xs transition"
        >
          ส่งข้อสอบ
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto w-full">
        <div className="flex justify-between items-center mb-6">
          <span className="bg-[#1A1A1A] border border-[#2D2D2D] text-[#F2C744] text-xs font-bold px-3 py-1 rounded-full">
            ข้อที่ {currentQIndex + 1} จาก {questions.length}
          </span>
        </div>

        <div className="bg-[#141414] border border-[#222] rounded-2xl p-6 mb-6 shadow-xl">
          <p className="text-lg md:text-xl font-semibold text-gray-100 leading-relaxed">
            {currentQ.text}
          </p>
        </div>

        <div className="space-y-3">
          {currentQ.options.map((opt, optIdx) => {
            const isSelected = answers[currentQIndex] === optIdx;
            return (
              <button
                key={optIdx}
                onClick={() => {
                  const updated = [...answers];
                  updated[currentQIndex] = optIdx;
                  setAnswers(updated);
                }}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-start gap-3 ${isSelected ? 'bg-[#F2C744]/10 border-[#F2C744] text-white shadow-lg' : 'bg-[#141414] border-[#222] text-gray-300 hover:border-[#333] hover:bg-[#1A1A1A]'}`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${isSelected ? 'bg-[#F2C744] text-black' : 'bg-[#1F1F1F] text-gray-400 border border-[#2E2E2E]'}`}>
                  {optIdx + 1}
                </div>
                <span className="text-sm md:text-base leading-relaxed">{opt}</span>
              </button>
            );
          })}
        </div>
      </div>

      <footer className="bg-[#121212] border-t border-[#222] px-6 py-4">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <button onClick={() => setCurrentQIndex(prev => Math.max(0, prev - 1))} disabled={currentQIndex === 0} className="px-5 py-2.5 rounded-xl border border-[#333] bg-[#181818] text-gray-300 font-bold text-sm disabled:opacity-30">
            <i className="fa-solid fa-chevron-left mr-2"></i> ข้อก่อนหน้า
          </button>

          <button onClick={() => setCurrentQIndex(prev => Math.min(questions.length - 1, prev + 1))} disabled={currentQIndex === questions.length - 1} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#C8922A] to-[#F2C744] text-black font-bold text-sm disabled:opacity-30">
            ข้อถัดไป <i className="fa-solid fa-chevron-right ml-2"></i>
          </button>
        </div>
      </footer>
    </div>
  );
}