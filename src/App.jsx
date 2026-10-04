import React, { useEffect, useState } from 'react';
import Auth from './components/Auth';
import { supabase } from './supabaseClient';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setLoading(false);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const handleLoginSuccess = (user) => {
    console.log('login success', user);
    // สามารถ redirect หรือ set state ได้ตรงนี้
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] text-white flex items-center justify-center">
        <span className="text-[#F2C744]">Loading...</span>
      </div>
    );
  }

  if (!session) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-[#F2C744]">Smart Exam Pro</h1>
          <button
            onClick={handleLogout}
            className="bg-[#1A1A1A] border border-[#333] px-4 py-2 rounded-lg text-sm hover:bg-[#222]"
          >
            ออกจากระบบ
          </button>
        </div>

        <div className="bg-[#141414] border border-[#252525] rounded-2xl p-6">
          <p className="text-gray-400">ยินดีต้อนรับ</p>
          <h2 className="text-xl font-bold mt-2">
            {session.user?.user_metadata?.full_name || session.user?.email}
          </h2>
        </div>
      </div>
    </div>
  );
}