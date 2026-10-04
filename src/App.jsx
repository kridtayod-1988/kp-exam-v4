import React, { useEffect, useState } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/ExamDashboard';
import { supabase } from './supabaseClient';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setLoading(false);
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  const handleLoginSuccess = (user) => {
    console.log('login success', user);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] text-white">
        <span className="text-[#F2C744]">Loading...</span>
      </div>
    );
  }

  if (!session) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white">
      <header className="border-b border-[#1F1F1F] bg-[#121212]/90 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#C8922A] to-[#F2C744] flex items-center justify-center text-black font-extrabold text-xl">
              🎓
            </div>
            <div>
              <h1 className="font-bold text-white tracking-wide text-lg leading-none">Smart Exam Pro</h1>
              <span className="text-xs text-[#F2C744] font-medium">ก.พ. Online Testing & AI Tutor</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-[#1A1A1A] border border-[#2B2B2B] px-3 py-1.5 rounded-full flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs text-gray-300">
                {session.user?.user_metadata?.full_name || session.user?.email}
              </span>
            </div>

            <button onClick={handleLogout} className="bg-[#1A1A1A] border border-[#333] px-3 py-1.5 rounded-lg text-sm hover:bg-[#222]">
              ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-8 pb-12">
        <Dashboard />
      </main>
    </div>
  );
}