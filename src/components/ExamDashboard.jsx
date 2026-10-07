import React, { useEffect, useState } from 'react';
import { fetchExamSets } from '../services/supabaseApi';
import ExamScreen from './ExamScreen';

const LOCAL_ATTEMPTS_KEY = 'smart_exam_local_attempts';

export default function Dashboard() {
  const [examSets, setExamSets] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedExam, setSelectedExam] = useState(null);
  const [attemptHistory, setAttemptHistory] = useState([]);

  useEffect(() => {
    const load = async () => {
      const sets = await fetchExamSets();
      setExamSets(sets || []);

      try {
        const raw = localStorage.getItem(LOCAL_ATTEMPTS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        setAttemptHistory(parsed);
      } catch (err) {
        console.warn('read local attempts failed', err);
      }
    };

    load();
  }, []);

  const filtered = activeTab === 'all' ? examSets : examSets.filter(e => e.mode === activeTab);

  if (selectedExam) {
    return <ExamScreen exam={selectedExam} onExit={() => setSelectedExam(null)} />;
  }

  return (
    <div className="space-y-8">
      <section className="bg-gradient-to-r from-[#17150F] via-[#1A1812] to-[#121212] border border-[#2E2818] rounded-3xl p-6 md:p-8 mb-10 relative overflow-hidden">
        <div className="max-w-2xl relative z-10">
          <span className="inline-block bg-[#F2C744]/10 border border-[#F2C744]/30 text-[#F2C744] text-xs font-bold px-3 py-1 rounded-full mb-3">
            ✨ คลังข้อสอบจริงตามระบบ Supabase & SQL Database
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-3">
            เตรียมพร้อมสอบ ก.พ. ด้วยระบบจำลองสนามจริง
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-6">
            ฝึกทำข้อสอบวิชาการคิดวิเคราะห์ ภาษาอังกฤษ และกฎหมายข้าราชการ พร้อมระบบเฉลยละเอียดและวิเคราะห์ข้อผิดพลาดรายข้อด้วย AI Tutor
          </p>
        </div>
      </section>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <i className="fa-solid fa-list-check text-[#F2C744]"></i> เลือกชุดข้อสอบ
        </h3>

        <div className="flex bg-[#141414] p-1 rounded-xl border border-[#222]">
          <button onClick={() => setActiveTab('all')} className={`px-4 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'all' ? 'bg-[#262626] text-white shadow' : 'text-gray-400 hover:text-white'}`}>ทั้งหมด</button>
          <button onClick={() => setActiveTab('simulation')} className={`px-4 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'simulation' ? 'bg-[#262626] text-white shadow' : 'text-gray-400 hover:text-white'}`}>🎯 จำลองสอบ</button>
          <button onClick={() => setActiveTab('archive')} className={`px-4 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'archive' ? 'bg-[#262626] text-white shadow' : 'text-gray-400 hover:text-white'}`}>📂 คลังข้อสอบจริง (E-EXAM)</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map(exam => (
          <div key={exam.id} className="bg-[#141414] border border-[#222] hover:border-[#333] rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 group">
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-[#1F1F1F] text-[#F2C744] border border-[#2D2D2D]">{exam.badge}</span>
                <span className="text-xs text-gray-500 font-mono">{exam.slug}</span>
              </div>

              <h4 className="text-lg font-bold text-white mb-2 group-hover:text-[#F2C744] transition-colors">{exam.name}</h4>

              <div className="space-y-2 my-4 text-xs text-gray-400">
                <div className="flex items-center gap-2"><i className="fa-regular fa-file-lines w-4 text-[#C8922A]"></i><span>จำนวน {exam.question_count} ข้อ ({exam.max_score} คะแนน)</span></div>
                <div className="flex items-center gap-2"><i className="fa-regular fa-clock w-4 text-[#C8922A]"></i><span>เวลา {exam.time_limit_minutes} นาที</span></div>
                <div className="flex items-center gap-2"><i className="fa-solid fa-bullseye w-4 text-[#C8922A]"></i><span>เกณฑ์ผ่าน {exam.pass_score} คะแนน</span></div>
              </div>
            </div>

            <button onClick={() => setSelectedExam(exam)} className="w-full mt-2 py-3 bg-[#1D1D1D] group-hover:bg-gradient-to-r group-hover:from-[#C8922A] group-hover:to-[#F2C744] text-gray-300 group-hover:text-black font-bold text-sm rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-sm">
              เริ่มทำข้อสอบ <i className="fa-solid fa-arrow-right text-xs"></i>
            </button>
          </div>
        ))}
      </div>

      {attemptHistory.length > 0 && (
        <div className="bg-[#141414] border border-[#222] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-white">ประวัติการสอบ (Local)</h3>
            <button
              onClick={() => {
                localStorage.removeItem(LOCAL_ATTEMPTS_KEY);
                setAttemptHistory([]);
              }}
              className="bg-red-600/20 border border-red-500/40 text-red-400 px-3 py-1 rounded-lg text-xs font-bold"
            >
              ล้างประวัติ
            </button>
          </div>

          <div className="space-y-3">
            {[...attemptHistory].reverse().slice(0, 5).map(item => (
              <div key={item.id} className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3">
                <div className="flex justify-between items-center gap-2">
                  <div>
                    <div className="font-bold text-white">{item.exam_name || item.exam_set_id}</div>
                    <div className="text-xs text-gray-500">{new Date(item.finished_at || item.createdAt).toLocaleString('th-TH')}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#F2C744]">{item.score ?? 0}/{item.max_score ?? 0}</div>
                    <div className="text-[10px] text-gray-400">{item.percentage ?? 0}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
