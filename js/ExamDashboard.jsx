import React, { useEffect, useState } from 'react';
import { fetchExamSets } from '../services/supabaseApi';
import ExamScreen from './ExamScreen';

export default function ExamDashboard() {
  const [examSets, setExamSets] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedExam, setSelectedExam] = useState(null);

  useEffect(() => {
    const load = async () => {
      const sets = await fetchExamSets();
      setExamSets(sets);
    };
    load();
  }, []);

  const filtered = activeTab === 'all'
    ? examSets
    : examSets.filter((set) => set.mode === activeTab);

  if (selectedExam) {
    return <ExamScreen exam={selectedExam} onExit={() => setSelectedExam(null)} />;
  }

  return (
    <div>
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
          <button onClick={() => setActiveTab('all')} className={`px-4 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'all' ? 'bg-[#262626] text-white' : 'text-gray-400 hover:text-white'}`}>ทั้งหมด</button>
          <button onClick={() => setActiveTab('simulation')} className={`px-4 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'simulation' ? 'bg-[#262626] text-white' : 'text-gray-400 hover:text-white'}`}>🎯 จำลองสอบ</button>
          <button onClick={() => setActiveTab('archive')} className={`px-4 py-2 rounded-lg text-xs font-bold transition ${activeTab === 'archive' ? 'bg-[#262626] text-white' : 'text-gray-400 hover:text-white'}`}>📂 คลังข้อสอบจริง (E-EXAM)</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((exam) => (
          <div key={exam.id} className="bg-[#141414] border border-[#222] hover:border-[#333] rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1">
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-[#1F1F1F] text-[#F2C744] border border-[#2D2D2D]">{exam.badge}</span>
                <span className="text-xs text-gray-500 font-mono">{exam.slug}</span>
              </div>

              <h4 className="text-lg font-bold text-white mb-2">{exam.name}</h4>

              <div className="space-y-2 my-4 text-xs text-gray-400">
                <div className="flex items-center gap-2"><i className="fa-regular fa-file-lines w-4 text-[#C8922A]"></i><span>จำนวน {exam.question_count} ข้อ ({exam.max_score} คะแนน)</span></div>
                <div className="flex items-center gap-2"><i className="fa-regular fa-clock w-4 text-[#C8922A]"></i><span>เวลา {exam.time_limit_minutes} นาที</span></div>
                <div className="flex items-center gap-2"><i className="fa-solid fa-bullseye w-4 text-[#C8922A]"></i><span>เกณฑ์ผ่าน {exam.pass_score} คะแนน</span></div>
              </div>
            </div>

            <button onClick={() => setSelectedExam(exam)} className="w-full mt-2 py-3 bg-[#1D1D1D] hover:bg-gradient-to-r hover:from-[#C8922A] hover:to-[#F2C744] text-gray-300 hover:text-black font-bold text-sm rounded-xl">
              เริ่มทำข้อสอบ
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}