const DEFAULT_SUPABASE_URL = "https://wefgreavazpfctayjnmp.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_91tqJTiGiTOvbrO7To4frQ_eEhivQyk";

const readWindowValue = (key, fallback) => {
  if (typeof window === "undefined") return fallback;
  return window[key] || fallback;
};

const SUPABASE_URL = readWindowValue("SUPABASE_URL", DEFAULT_SUPABASE_URL);
const SUPABASE_ANON_KEY = readWindowValue(
  "SUPABASE_ANON_KEY",
  readWindowValue("SUPABASE_PUBLISHABLE_KEY", DEFAULT_SUPABASE_ANON_KEY)
);

const sb =
  typeof window !== "undefined" && window.supabase && typeof window.supabase.createClient === "function"
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

if (typeof window !== "undefined") {
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
  window.sb = sb;
}

export { SUPABASE_URL, SUPABASE_ANON_KEY, sb };
export default { SUPABASE_URL, SUPABASE_ANON_KEY, sb };
