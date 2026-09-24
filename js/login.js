// js/login.js
// ตรรกะหน้าเข้าสู่ระบบ: Email/Password + Google Sign-In (Supabase Auth เวอร์ชัน)
//
// หมายเหตุสำคัญ: การสร้าง profile แถวใหม่ (ทั้งอีเมลและ Google) ถูกจัดการอัตโนมัติ
// โดย Postgres trigger "on_auth_user_created" ฝั่งฐานข้อมูลแล้ว ไม่ต้องทำที่ client อีก

redirectIfAuthenticated("dashboard.html");

function showError(message) {
  const banner = document.getElementById("error-banner");
  banner.textContent = message;
  banner.classList.remove("hidden");
}

function hideError() {
  document.getElementById("error-banner").classList.add("hidden");
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const submitBtn = document.getElementById("login-submit-btn");

  submitBtn.disabled = true;
  submitBtn.textContent = "กำลังเข้าสู่ระบบ...";

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // อัปเดตเวลาล็อกอินล่าสุด (ไม่ critical ถ้าพลาดจึงไม่ throw ต่อ)
    await sb.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", data.user.id);

    window.location.href = "dashboard.html";
  } catch (err) {
    showError(getSupabaseAuthErrorMessage(err));
    submitBtn.disabled = false;
    submitBtn.textContent = "เข้าสู่ระบบ";
  }
});

document.getElementById("google-signin-btn").addEventListener("click", async () => {
  hideError();
  try {
    // Supabase OAuth ใช้ full-page redirect ไม่ใช่ popup แบบ Firebase
    // เมื่อ Google ยืนยันตัวตนเสร็จ จะ redirect กลับมาที่ redirectTo พร้อม session ที่ตั้งค่าให้อัตโนมัติ
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname.replace("login.html", "dashboard.html") }
    });
    if (error) throw error;
    // ไม่ต้องทำอะไรต่อ — เบราว์เซอร์จะ redirect ออกจากหน้านี้ทันที
  } catch (err) {
    showError(getSupabaseAuthErrorMessage(err));
  }
});
