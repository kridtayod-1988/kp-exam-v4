// js/auth-guard.js
// ใช้ตรวจสอบสถานะล็อกอิน + ดึงข้อมูล role ของผู้ใช้ปัจจุบัน (Supabase Auth เวอร์ชัน)
// หน้าที่ต้องล็อกอินก่อนถึงเข้าได้ (dashboard, exam, profile, admin/*) ต้องเรียกใช้ไฟล์นี้

let currentUserData = null; // cache ข้อมูล profiles row (แปลงรูปแบบแล้ว) ของคนที่ล็อกอินอยู่

/**
 * ตรวจสอบว่าล็อกอินอยู่หรือไม่ ถ้าไม่ → เด้งไปหน้า login
 * คืนค่า { user, userData } ถ้าล็อกอินอยู่ (user = Supabase auth user, userData = profile ที่แปลงรูปแบบแล้ว)
 */
async function requireAuth(redirectTo = "login.html") {
  const { data: { session }, error: sessionError } = await sb.auth.getSession();

  if (sessionError || !session || !session.user) {
    window.location.href = redirectTo;
    throw new Error("not-authenticated");
  }

  const user = session.user;

  try {
    const { data: profile, error: profileError } = await sb
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) throw profileError;
    const mapped = mapProfileRow(profile);
    currentUserData = mapped;
    return { user, userData: mapped };
  } catch (err) {
    console.error("โหลดข้อมูลผู้ใช้ไม่สำเร็จ:", err);
    throw err;
  }
}

/**
 * ตรวจสอบว่าเป็น admin หรือไม่ ถ้าไม่ → เด้งกลับหน้า dashboard
 * ใช้ในทุกหน้าใต้ /admin/*
 */
async function requireAdmin(redirectTo = "../dashboard.html") {
  const { user, userData } = await requireAuth("../login.html");

  if (!userData || userData.role !== "admin") {
    window.location.href = redirectTo;
    throw new Error("not-admin");
  }

  return { user, userData };
}

/**
 * สำหรับหน้า login/signup: ถ้าล็อกอินอยู่แล้ว ให้เด้งไป dashboard ทันที
 */
async function redirectIfAuthenticated(redirectTo = "dashboard.html") {
  const { data: { session } } = await sb.auth.getSession();
  if (session && session.user) {
    window.location.href = redirectTo;
  }
}

/**
 * ออกจากระบบ
 */
async function signOutUser() {
  try {
    await sb.auth.signOut();
    // path ต่างกันระหว่างหน้าปกติกับหน้าใน /admin/ จึงเช็คจาก path ปัจจุบัน
    const isInAdminFolder = window.location.pathname.includes("/admin/");
    window.location.href = isInAdminFolder ? "../index.html" : "index.html";
  } catch (err) {
    console.error("ออกจากระบบไม่สำเร็จ:", err);
  }
}
