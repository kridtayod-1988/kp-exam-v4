// js/login.js
// เข้าสู่ระบบ: Email/Password + Google + showcase
//
// หมายเหตุสำคัญ: การสร้าง profile แถวใหม่ (ทั้งอีเมลและ Google) ถูกจัดการอัตโนมัติ
// โดย Postgres trigger "on_auth_user_created" ฝั่งฐานข้อมูลแล้ว ไม่ต้องทำที่ client อีก

function getSubmitUi() {
  const submitBtn = document.getElementById("login-submit-btn");
  if (!submitBtn) return null;

  const textEl = submitBtn.querySelector(".login-submit-text") || submitBtn;
  const spinner = submitBtn.querySelector(".login-submit-spinner");

  return { submitBtn, textEl, spinner };
}

function setSubmitLoading(isLoading, message = "กำลังเข้าสู่ระบบ...") {
  const ui = getSubmitUi();
  if (!ui) return;

  const { submitBtn, textEl, spinner } = ui;
  submitBtn.disabled = isLoading;

  if (spinner) {
    spinner.classList.toggle("hidden", !isLoading);
    spinner.style.display = isLoading ? "inline-flex" : "none";
  }

  const text = isLoading ? message : "เข้าสู่ระบบ";
  if (textEl === submitBtn) {
    submitBtn.textContent = text;
  } else {
    textEl.textContent = text;
  }
}

function showError(message) {
  const banner = document.getElementById("error-banner");
  if (!banner) return;
  banner.textContent = message;
  banner.classList.remove("hidden");
}

function hideError() {
  document.getElementById("error-banner")?.classList.add("hidden");
}

(async function bootstrap() {
  const form = document.getElementById("login-form");
  if (!form) return;

  if (typeof sb === "undefined") {
    console.error("[login] sb ไม่ได้โหลด");
    showError("ระบบยังโหลดไม่ครบ กรุณา refresh หน้าอีกครั้ง");
    return;
  }

  try {
    await redirectIfAuthenticated("dashboard.html");
  } catch (err) {
    console.warn("[login] redirect check failed:", err);
  }

  form.addEventListener("submit", handleLogin);
  document.getElementById("google-signin-btn")?.addEventListener("click", handleGoogleSignin);
})();

async function handleLogin(e) {
  e.preventDefault();
  hideError();

  const email = document.getElementById("login-email")?.value.trim() || "";
  const password = document.getElementById("login-password")?.value || "";

  if (!email || !password) {
    showError("กรุณากรอกอีเมลและรหัสผ่านก่อนเข้าสู่ระบบ");
    return;
  }

  setSubmitLoading(true);

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
    setSubmitLoading(false, "เข้าสู่ระบบ");
  }
}

async function handleGoogleSignin() {
  hideError();

  const googleBtn = document.getElementById("google-signin-btn");
  if (!googleBtn) return;

  const originalHtml = googleBtn.innerHTML;
  const originalDisabled = googleBtn.disabled;

  googleBtn.disabled = true;
  googleBtn.innerHTML = `
    <span class="login-submit-spinner" style="display:inline-flex;width:18px;height:18px;margin-right:0.5rem;"></span>
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
