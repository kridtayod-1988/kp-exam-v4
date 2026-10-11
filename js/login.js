// js/login.js
// เข้าสู่ระบบ: Email/Password + Google + showcase
//
// หมายเหตุสำคัญ: การสร้าง profile แถวใหม่ (ทั้งอีเมลและ Google) ถูกจัดการอัตโนมัติ
// โดย Postgres trigger "on_auth_user_created" ฝั่งฐานข้อมูลแล้ว ไม่ต้องทำที่ client อีก

(async function bootstrap() {
  const wrap = document.getElementById("login-wrap");
  if (!wrap) return;

  if (typeof sb === "undefined") {
    console.error("[login] sb ไม่ได้โหลด");
    wrap.style.visibility = "visible";
    showError("ระบบยังโหลดไม่ครบ กรุณา refresh หน้าอีกครั้ง");
    return;
  }

  try {
    await redirectIfAuthenticated("dashboard.html");
  } catch (err) {
    console.warn("[login] redirect check failed:", err);
  }

  wrap.style.visibility = "visible";

  // ─── Login form ───
  document.getElementById("login-form")?.addEventListener("submit", handleLogin);

  // ─── Google ───
  document.getElementById("google-signin-btn")?.addEventListener("click", handleGoogleSignin);
})();

function showError(message) {
  const banner = document.getElementById("error-banner");
  if (!banner) return;
  banner.textContent = message;
  banner.classList.remove("hidden");
}

function hideError() {
  document.getElementById("error-banner")?.classList.add("hidden");
}

// ═══════════════════════════════════════════
// Login with Email/Password
// ═══════════════════════════════════════════
async function handleLogin(e) {
  e.preventDefault();
  hideError();

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const submitBtn = document.getElementById("login-submit-btn");
  const submitText = submitBtn.querySelector(".login-submit-text");
  const submitSpinner = submitBtn.querySelector(".login-submit-spinner");

  submitBtn.disabled = true;
  submitText.textContent = "กำลังเข้าสู่ระบบ...";
  submitSpinner.classList.remove("hidden");

  try {
    const { data, error } = await withRetry(
      () => sb.auth.signInWithPassword({ email, password }),
      { operationName: "login" }
    );
    if (error) throw error;

    await withRetry(
      () => sb
        .from("profiles")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", data.user.id),
      { operationName: "updateLastLogin" }
    );

    window.location.href = "dashboard.html";
  } catch (err) {
    showError(getSupabaseAuthErrorMessage(err));
    submitBtn.disabled = false;
    submitText.textContent = "เข้าสู่ระบบ";
    submitSpinner.classList.add("hidden");
  }
}

// ═══════════════════════════════════════════
// Google Sign-In
// ═══════════════════════════════════════════
async function handleGoogleSignin() {
  hideError();

  const googleBtn = document.getElementById("google-signin-btn");
  const originalHtml = googleBtn.innerHTML;
  const originalDisabled = googleBtn.disabled;

  googleBtn.disabled = true;
  googleBtn.innerHTML = `
    <div class="login-submit-spinner" style="display:inline-flex;width:18px;height:18px; margin-right:0.5rem;"></div>
    <span>กำลังเข้าสู่ระบบ...</span>
  `;

  try {
    const redirectUrl = new URL("dashboard.html", window.location.href).href;

    const { error } = await withRetry(
      () => sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectUrl }
      }),
      { operationName: "googleSignIn" }
    );
    if (error) throw error;
  } catch (err) {
    showError(getSupabaseAuthErrorMessage(err));
    googleBtn.disabled = originalDisabled;
    googleBtn.innerHTML = originalHtml;
  }
}
