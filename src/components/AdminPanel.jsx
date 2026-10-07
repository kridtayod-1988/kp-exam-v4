import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { EXAM_SETS, RAW_QUESTION_BANK } from '../data/examData';

const USE_SUPABASE = (import.meta.env.VITE_USE_SUPABASE || 'true').toLowerCase() === 'true';
const LOCAL_QUESTIONS_KEY = 'smart_exam_local_questions';
const LOCAL_CONFIG_KEY = 'smart_exam_local_config';

export default function AdminPanel() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    category: '',
    sub: '',
    text: '',
    options: ['', '', '', ''],
    correct: 0,
    explanation: ''
  });

  const [config, setConfig] = useState({
    full_exam_question_count: 30,
    full_exam_time_minutes: 180,
  });

  // Helpers for local storage
  function loadLocalQuestions() {
    try {
      const raw = localStorage.getItem(LOCAL_QUESTIONS_KEY);
      if (raw) return JSON.parse(raw);
      // initialize from RAW_QUESTION_BANK
      const initial = RAW_QUESTION_BANK.map((q, idx) => ({
        id: `local-q-${idx}-${Date.now()}`,
        category: q.cat || 'general',
        subcategory: q.sub || '',
        text: q.text,
        options: q.options || [],
        correct: typeof q.correct === 'number' ? q.correct : Number(q.correct) || 0,
        explanation: q.exp || q.explanation || ''
      }));
      localStorage.setItem(LOCAL_QUESTIONS_KEY, JSON.stringify(initial));
      return initial;
    } catch (err) {
      console.warn('[AdminPanel] loadLocalQuestions failed', err);
      return [];
    }
  }

  function saveLocalQuestions(qs) {
    try {
      localStorage.setItem(LOCAL_QUESTIONS_KEY, JSON.stringify(qs));
    } catch (err) {
      console.warn('[AdminPanel] saveLocalQuestions failed', err);
    }
  }

  function loadLocalConfig() {
    try {
      const raw = localStorage.getItem(LOCAL_CONFIG_KEY);
      if (raw) return JSON.parse(raw);
      const defaults = { full_exam_question_count: 30, full_exam_time_minutes: 180 };
      localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(defaults));
      return defaults;
    } catch (err) {
      console.warn('[AdminPanel] loadLocalConfig failed', err);
      return { full_exam_question_count: 30, full_exam_time_minutes: 180 };
    }
  }

  function saveLocalConfig(cfg) {
    try {
      localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(cfg));
    } catch (err) {
      console.warn('[AdminPanel] saveLocalConfig failed', err);
    }
  }

  useEffect(() => {
    const load = async () => {
      if (!USE_SUPABASE) {
        const localQs = loadLocalQuestions();
        setQuestions(localQs);

        const localCfg = loadLocalConfig();
        setConfig(localCfg);

        setLoading(false);
        return;
      }

      // Supabase mode
      try {
        const [qRes, cRes] = await Promise.all([
          supabase.from('questions').select('*').order('created_at', { ascending: true }),
          supabase.from('system_config').select('*'),
        ]);

        if (qRes.data) setQuestions(qRes.data.map(r => ({
          id: r.id,
          category: r.category || r.cat || 'general',
          subcategory: r.subcategory || r.sub || '',
          text: r.text,
          options: Array.isArray(r.options) ? r.options : (r.options ? JSON.parse(r.options) : []),
          correct: Number(r.correct || 0),
          explanation: r.explanation || r.exp || ''
        })));

        if (cRes.data) {
          const next = {};
          for (const row of cRes.data) next[row.key] = row.value;
          setConfig(next);
        }
      } catch (err) {
        console.warn('[AdminPanel] supabase load failed, falling back to local', err);
        const localQs = loadLocalQuestions();
        setQuestions(localQs);
        const localCfg = loadLocalConfig();
        setConfig(localCfg);
      }

      setLoading(false);
    };

    load();
  }, []);

  // Config save
  const saveConfig = async (key, value) => {
    if (!USE_SUPABASE) {
      const next = { ...config, [key]: value };
      setConfig(next);
      saveLocalConfig(next);
      alert('บันทึกค่าตั้งค่าท้องถิ่นเรียบร้อย');
      return;
    }

    const { error } = await supabase.from('system_config').upsert([{ key, value }]);
    if (error) {
      alert('บันทึกล้มเหลว: ' + error.message);
      throw error;
    }
    setConfig(prev => ({ ...prev, [key]: value }));
    alert('บันทึกค่าตั้งค่าเรียบร้อย');
  };

  // Question CRUD
  const handleCreateQuestion = async () => {
    if (!form.text.trim()) return alert('กรุณาใส่ข้อความคำถาม');

    const newQ = {
      id: `local-q-${Date.now()}`,
      category: form.category || 'general',
      subcategory: form.sub || '',
      text: form.text,
      options: form.options,
      correct: Number(form.correct),
      explanation: form.explanation || ''
    };

    if (!USE_SUPABASE) {
      const next = [newQ, ...questions];
      setQuestions(next);
      saveLocalQuestions(next);
      setForm({ category: '', sub: '', text: '', options: ['', '', '', ''], correct: 0, explanation: '' });
      return;
    }

    const { error } = await supabase.from('questions').insert([{
      category: newQ.category,
      subcategory: newQ.subcategory,
      text: newQ.text,
      options: newQ.options,
      correct: newQ.correct,
      explanation: newQ.explanation
    }]);

    if (error) throw error;

    const qRes = await supabase.from('questions').select('*').order('created_at', { ascending: true });
    setQuestions(qRes.data || []);
    setForm({ category: '', sub: '', text: '', options: ['', '', '', ''], correct: 0, explanation: '' });
  };

  const handleUpdateQuestion = async () => {
    if (!editingId) return;

    if (!USE_SUPABASE) {
      const next = questions.map(q => q.id === editingId ? ({ ...q, category: form.category, subcategory: form.sub, text: form.text, options: form.options, correct: Number(form.correct), explanation: form.explanation }) : q);
      setQuestions(next);
      saveLocalQuestions(next);
      setEditingId(null);
      setForm({ category: '', sub: '', text: '', options: ['', '', '', ''], correct: 0, explanation: '' });
      return;
    }

    const { error } = await supabase.from('questions').update({
      category: form.category || 'general',
      subcategory: form.sub || '',
      text: form.text,
      options: form.options,
      correct: Number(form.correct),
      explanation: form.explanation || ''
    }).eq('id', editingId);

    if (error) throw error;

    const qRes = await supabase.from('questions').select('*').order('created_at', { ascending: true });
    setQuestions(qRes.data || []);
    setEditingId(null);
    setForm({ category: '', sub: '', text: '', options: ['', '', '', ''], correct: 0, explanation: '' });
  };

  const handleDeleteQuestion = async (id) => {
    if (!window.confirm('ลบคำถามนี้จริงหรือไม่?')) return;

    if (!USE_SUPABASE) {
      const next = questions.filter(q => q.id !== id);
      setQuestions(next);
      saveLocalQuestions(next);
      return;
    }

    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) throw error;
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const startEdit = (q) => {
    setEditingId(q.id);
    setForm({
      category: q.category || '',
      sub: q.subcategory || '',
      text: q.text || '',
      options: Array.isArray(q.options) ? q.options : (q.options ? JSON.parse(q.options) : []),
      correct: Number(q.correct || 0),
      explanation: q.explanation || ''
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ category: '', sub: '', text: '', options: ['', '', '', ''], correct: 0, explanation: '' });
  };

  if (loading) return <div className="text-white p-6">Loading admin...</div>;

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-2xl font-bold text-[#F2C744]">Admin Panel (Local)</h2>

      <section className="bg-[#141414] border border-[#222] rounded-xl p-4">
        <h3 className="text-lg font-bold mb-3">System Config (Local)</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">full_exam_question_count</label>
            <input
              type="number"
              value={config.full_exam_question_count ?? 30}
              onChange={(e) => {
                const val = Number(e.target.value);
                setConfig(prev => ({ ...prev, full_exam_question_count: val }));
              }}
              className="w-full bg-[#1A1A1A] border border-[#333] p-3 rounded-lg"
            />
            <button
              onClick={() => saveConfig('full_exam_question_count', Number(config.full_exam_question_count ?? 30))}
              className="mt-2 px-3 py-2 bg-[#C8922A] text-black font-bold rounded-lg"
            >
              บันทึกจำนวนคำถาม (Local)
            </button>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">full_exam_time_minutes</label>
            <input
              type="number"
              value={config.full_exam_time_minutes ?? 180}
              onChange={(e) => {
                const val = Number(e.target.value);
                setConfig(prev => ({ ...prev, full_exam_time_minutes: val }));
              }}
              className="w-full bg-[#1A1A1A] border border-[#333] p-3 rounded-lg"
            />
            <button
              onClick={() => saveConfig('full_exam_time_minutes', Number(config.full_exam_time_minutes ?? 180))}
              className="mt-2 px-3 py-2 bg-[#C8922A] text-black font-bold rounded-lg"
            >
              บันทึกเวลาทำข้อสอบ (Local)
            </button>
          </div>
        </div>

        <div className="mt-3 text-sm text-gray-400">ข้อมูลการตั้งค่าจะถูกเก็บไว้ใน Local Storage ระบุใน key: <code>{LOCAL_CONFIG_KEY}</code></div>
      </section>

      <section className="bg-[#141414] border border-[#222] rounded-xl p-4">
        <h3 className="text-lg font-bold mb-3">เพิ่ม/แก้ไขคำถาม (Local)</h3>

        <div className="space-y-3">
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="category"
            className="w-full bg-[#1A1A1A] border border-[#333] p-3 rounded-lg"
          />
          <input
            value={form.sub}
            onChange={(e) => setForm({ ...form, sub: e.target.value })}
            placeholder="subcategory"
            className="w-full bg-[#1A1A1A] border border-[#333] p-3 rounded-lg"
          />
          <textarea
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            placeholder="ข้อความคำถาม"
            className="w-full bg-[#1A1A1A] border border-[#333] p-3 rounded-lg min-h-[100px]"
          />

          {form.options.map((opt, index) => (
            <input
              key={index}
              value={opt}
              onChange={(e) => {
                const next = [...form.options];
                next[index] = e.target.value;
                setForm({ ...form, options: next });
              }}
              placeholder={`ตัวเลือกที่ ${index + 1}`}
              className="w-full bg-[#1A1A1A] border border-[#333] p-3 rounded-lg"
            />
          ))}

          <input
            value={form.explanation}
            onChange={(e) => setForm({ ...form, explanation: e.target.value })}
            placeholder="คำอธิบาย (เฉลย)"
            className="w-full bg-[#1A1A1A] border border-[#333] p-3 rounded-lg"
          />

          <div className="flex items-center gap-2">
            <label className="block text-sm text-gray-400">Correct index</label>
            <input
              type="number"
              min="0"
              value={form.correct}
              onChange={(e) => setForm({ ...form, correct: Number(e.target.value) })}
              className="w-20 bg-[#1A1A1A] border border-[#333] p-2 rounded-lg"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={editingId ? handleUpdateQuestion : handleCreateQuestion}
              className="bg-[#C8922A] text-black font-bold px-4 py-2 rounded-lg"
            >
              {editingId ? 'บันทึกการแก้ไข' : 'เพิ่มคำถาม'}
            </button>

            {editingId && (
              <button
                onClick={resetForm}
                className="bg-[#1A1A1A] border border-[#333] px-4 py-2 rounded-lg"
              >
                ยกเลิก
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="bg-[#141414] border border-[#222] rounded-xl p-4">
        <h3 className="text-lg font-bold mb-3">รายการคำถามที่มีอยู่ (Local)</h3>
        <div className="space-y-3">
          {questions.map((q) => (
            <div key={q.id} className="bg-[#1A1A1A] border border-[#333] rounded-lg p-3">
              <div className="flex justify-between gap-3">
                <div>
                  <div className="text-xs text-[#F2C744]">{q.category}</div>
                  <div className="font-semibold">{q.text}</div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(q)}
                    className="bg-yellow-600 text-white px-2 py-1 rounded text-sm"
                  >
                    แก้ไข
                  </button>
                  <button
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="bg-red-600 text-white px-2 py-1 rounded text-sm"
                  >
                    ลบ
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-sm text-gray-400">ข้อมูลคำถามจะถูกเก็บใน Local Storage key: <code>{LOCAL_QUESTIONS_KEY}</code></div>
      </section>
    </div>
  );
}
