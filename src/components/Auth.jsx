import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Auth({ onLoginSuccess }) {
  const [isLoginView, setIsLoginView] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState('');

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

        if (data?.user) {
          await supabase.from('profiles').upsert([{ id: data.user.id, full_name: fullName }]);
        }

        alert('สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมลเพื่อยืนยันตัวตน');
        setIsLoginView(true);
      }
    } catch (error) {
      setErrorMsg(error?.message || 'เกิดข้อผิดพลาดในการดำเนินการ');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotStatus('');

    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-callback`,
      });
      if (error) throw error;
      setForgotStatus('ส่งลิงก์รีเซ็ตรหัสผ่านสำเร็จ โปรดตรวจสอบอีเมล');
    } catch (err) {
      setForgotStatus(err?.message || 'ส่งลิงก์รีเซ็ตรหัสผ่านไม่ได้');
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

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => setIsForgotOpen(true)}
              className="text-[#F2C744] hover:underline"
            >
              ลืมรหัสผ่าน?
            </button>

            <button
              type="button"
              onClick={() => {
                setIsLoginView((prev) => !prev);
                setErrorMsg('');
              }}
              className="text-gray-400 hover:underline"
            >
              {isLoginView ? 'สมัครสมาชิก' : 'กลับเข้าสู่ระบบ'}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#C8922A] to-[#F2C744] text-black font-bold p-3 rounded-lg mt-4 disabled:opacity-50"
          >
            {loading ? 'กำลังประมวลผล...' : isLoginView ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
          </button>
        </form>

        {isForgotOpen && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-[#121212] border border-[#222] rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-3">รีเซ็ตรหัสผ่าน</h3>
              <p className="text-sm text-gray-400 mb-4">กรอกอีเมลของคุณ ระบบจะส่งลิงก์รีเซ็ตรหัสผ่านให้</p>

              <form onSubmit={handleForgotPassword} className="space-y-3">
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#333] p-3 rounded-lg text-white"
                  placeholder="email@example.com"
                />
                {forgotStatus && <div className="text-sm text-gray-300">{forgotStatus}</div>}

                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-[#C8922A] text-black font-bold p-3 rounded-lg">
                    ส่งลิงก์รีเซ็ต
                  </button>
                  <button type="button" onClick={() => setIsForgotOpen(false)} className="flex-1 bg-[#1A1A1A] border border-[#333] p-3 rounded-lg">
                    ยกเลิก
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}