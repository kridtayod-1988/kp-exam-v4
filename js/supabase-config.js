// js/supabase-config.js
// ✅ ตั้งค่าแล้วสำหรับโปรเจกต์ Supabase "KPOR"
//
// ใช้หนึ่งชุดค่าเดียวกันกับ js/config.js เพื่อหลีกเลี่ยงปัญหาจาก import mismatch
const DEFAULT_SUPABASE_URL = "https://wefgreavazpfctayjnmp.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_91tqJTiGiTOvbrO7To4frQ_eEhivQyk";

(function initializeSupabaseConfig() {
  const globalScope = typeof window !== "undefined" ? window : globalThis;

  globalScope.SUPABASE_URL = globalScope.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  globalScope.SUPABASE_ANON_KEY =
    globalScope.SUPABASE_ANON_KEY ||
    globalScope.SUPABASE_PUBLISHABLE_KEY ||
    DEFAULT_SUPABASE_KEY;
  globalScope.SUPABASE_PUBLISHABLE_KEY = globalScope.SUPABASE_ANON_KEY;

  if (globalScope.supabase && typeof globalScope.supabase.createClient === "function") {
    globalScope.sb = globalScope.supabase.createClient(
      globalScope.SUPABASE_URL,
      globalScope.SUPABASE_ANON_KEY
    );
  } else {
    globalScope.sb = null;
  }
})();
