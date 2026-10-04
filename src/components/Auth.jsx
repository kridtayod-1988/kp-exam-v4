import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Auth({ onLoginSuccess }) {
  const [isLoginView, setIsLoginView] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (isLoginView) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data?.user) {
          onLoginSuccess?.(data.user);
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) throw error;

        alert('สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมลของคุณเพื่อยืนยันตัวตน');
        setIsLoginView(true);
      }
    } catch (error) {
      setErrorMsg(error?.message || 'เกิดข้อผิดพลาดในการดำเนินการ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#0D0D0D] text-white">
      <div className="bg-[#141414] border border-[#252525] p-8 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#1A1A1A] border border-[#333] mb-4">
            <span className="text-2xl">🎓</span>
          </div>
          <h1 className="text-2xl font-bold text-[#F2C744]">Smart Exam Pro</h1>
          <p className="text-gray-400 text-sm mt-1">
            {isLoginView ? 'เข้าสู่ระบบเพื่อทำข้อสอบ' : 'สร้างบัญชีใหม่เพื่อเริ่มต้นเรียนรู้'}
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-900/30 border border-red-800 text-red-400 p-3 rounded-lg text-sm mb-4 text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLoginView && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">ชื่อ - นามสกุล</label>
              <input
                required
                type="text"
                placeholder="สมชาย ใจดี"
                className="w-full bg-[#1A1A1A] border border-[#333] p-3 rounded-lg text-white outline-none focus:border-[#F2C744]"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">อีเมล</label>
            <input
              required
              type="email"
              placeholder="email@example.com"
              className="w-full bg-[#1A1A1A] border border-[#333] p-3 rounded-lg text-white outline-none focus:border-[#F2C744]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">รหัสผ่าน</label>
            <input
              required
              type="password"
              placeholder="••••••••"
              minLength={6}
              className="w-full bg-[#1A1A1A] border border-[#333] p-3 rounded-lg text-white outline-none focus:border-[#F2C744]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#C8922A] to-[#F2C744] hover:from-[#d19b33] hover:to-[#f5ce55] text-black font-bold p-3 rounded-lg mt-6 disabled:opacity-50"
          >
            {loading ? 'กำลังประมวลผล...' : isLoginView ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
          </button>
        </form>

        <div className="text-center mt-6 text-sm text-gray-500 border-t border-[#222] pt-6">
          {isLoginView ? (
            <p>
              ยังไม่มีบัญชีใช่หรือไม่?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsLoginView(false);
                  setErrorMsg('');
                }}
                className="text-[#F2C744] hover:underline font-medium"
              >
                สมัครสมาชิก
              </button>
            </p>
          ) : (
            <p>
              มีบัญชีอยู่แล้วใช่หรือไม่?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsLoginView(true);
                  setErrorMsg('');
                }}
                className="text-[#F2C744] hover:underline font-medium"
              >
                เข้าสู่ระบบ
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}