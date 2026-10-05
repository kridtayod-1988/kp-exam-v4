import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

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
  });

  const [config, setConfig] = useState({
    full_exam_question_count: 30,
    full_exam_time_minutes: 180,
  });

  useEffect(() => {
    const load = async () => {
      const [qRes, cRes] = await Promise.all([
        supabase.from('questions').select('*').order('created_at', { ascending: true }),
        supabase.from('system_config').select('*'),
      ]);

      if (qRes.data) setQuestions(qRes.data);
      if (cRes.data) {
        const next = {};
        for (const row of cRes.data) {
          next[row.key] = row.value;
        }
        setConfig(next);
      }

      setLoading(false);
    };

    load();
  }, []);

  const saveConfig = async (key, value) => {
    const { error } = await supabase.from('system_config').upsert([{ key, value }]);
    if (error) throw error;
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleCreateQuestion = async () => {
    if (!form.text.trim()) return alert('กรุณาใส่ข้อความคำถาม');
    const { error } = await supabase.from('questions').insert([
      {
        category: form.category || 'general',
        subcategory: form.sub || '',
        text: form.text,
        options: form.options,
        correct: Number(form.correct),
        explanation: 'เพิ่มจาก Admin',
      },
    ]);

    if (error) throw error;

    const qRes = await supabase.from('questions').select('*').order('created_at', { ascending: true });
    setQuestions(qRes.data || []);
    setForm({ category: '', sub: '', text: '', options: ['', '', '', ''], correct: 0 });
  };

  const handleUpdateQuestion = async () => {
    if (!editingId) return;
    const { error } = await supabase.from('questions').update({
      category: form.category || 'general',
      subcategory: form.sub || '',
      text: form.text,
      options: form.options,
      correct: Number(form.correct),
      explanation: 'อัปเดตจาก Admin',
    }).eq('id', editingId);

    if (error) throw error;

    const qRes = await supabase.from('questions').select('*').order('created_at', { ascending: true });
    setQuestions(qRes.data || []);
    setEditingId(null);
    setForm({ category: '', sub: '', text: '', options: ['', '', '', ''], correct: 0 });
  };

  const handleDeleteQuestion = async (id) => {
    if (!window.confirm('ลบคำถามนี้จริงหรือไม่?')) return;
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
      options: Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]'),
      correct: Number(q.correct || 0),
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ category: '', sub: '', text: '', options: ['', '', '', ''], correct: 0 });
  };

  if (loading) return <div className="text-white p-6">Loading admin...</div>;

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-2xl font-bold text-[#F2C744]">Admin Panel</h2>

      <section className="bg-[#141414] border border-[#222] rounded-xl p-4">
        <h3 className="text-lg font-bold mb-3">System Config</h3>

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
              บันทึกจำนวนคำถาม
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
              บันทึกเวลาทำข้อสอบ
            </button>
          </div>
        </div>
      </section>

      <section className="bg-[#141414] border border-[#222] rounded-xl p-4">
        <h3 className="text-lg font-bold mb-3">เพิ่ม/แก้ไขคำถาม</h3>

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
        <h3 className="text-lg font-bold mb-3">รายการคำถามที่มีอยู่</h3>
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
      </section>
    </div>
  );
}