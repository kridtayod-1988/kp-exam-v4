// ═══════════════════════ js/auth.js ═══════════════════════
import { sb as sharedSb } from "./config.js";

const sb = sharedSb || window.sb;

export async function getSession() {
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session ?? null;
}

export async function getProfile() {
  const s = await getSession();
  if (!s) return null;
  const { data } = await sb.from("profiles").select("*").eq("id", s.user.id).single();
  return data;
}

/** Route Guard — บังคับให้ล็อกอินก่อนเข้าถึงหน้า */
export async function requireAuth(redirect = "login.html") {
  const p = await getProfile();
  if (!p) {
    location.replace(`${redirect}?next=${encodeURIComponent(location.pathname)}`);
    return null;
  }
  if (p.is_banned) {
    await sb.auth.signOut();
    location.replace("login.html?banned=1");
    return null;
  }
  return p;
}

/** Guard ระดับผู้ดูแล — ตรวจซ้ำที่ฝั่งเซิร์ฟเวอร์ผ่าน RLS อีกชั้นเสมอ */
export async function requireAdmin() {
  const p = await requireAuth();
  if (!p) return null;
  if (p.role !== "admin") {
    location.replace("dashboard.html");
    return null;
  }
  return p;
}

export const signOut = async () => {
  if (!sb) return;
  await sb.auth.signOut();
  location.href = "index.html";
};

/** ผูก Navbar: แสดงชื่อ/เลเวล และ "เปิดเผยแท็บแอดมิน" เมื่อ role = admin */
export async function mountNavbar() {
  const p = await getProfile();
  const guest = document.getElementById("nav-guest");
  const user = document.getElementById("nav-user");
  const adminLink = document.getElementById("nav-admin");
  if (!p) {
    guest?.classList.remove("hidden");
    user?.classList.add("hidden");
    return null;
  }
  guest?.classList.add("hidden");
  user?.classList.remove("hidden");
  const nameEl = document.getElementById("nav-name");
  if (nameEl) nameEl.textContent = `${p.display_name ?? "ผู้ใช้"} · Lv.${p.level}`;
  if (p.role === "admin") adminLink?.classList.remove("hidden");
  document.getElementById("nav-logout")?.addEventListener("click", signOut);
  return p;
}
