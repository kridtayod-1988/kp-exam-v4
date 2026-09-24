// js/admin/settings.js

(async function init() {
  try {
    const { userData } = await requireAdmin();
    renderAdminLayout("settings", userData);
    await loadSettings();
    document.getElementById("save-settings-btn").addEventListener("click", saveSettings);
  } catch (err) {
    console.error("เข้าถึงหน้าตั้งค่าไม่สำเร็จ:", err);
  }
})();

async function loadSettings() {
  try {
    const { data, error } = await sb.from("system_config").select("*").in("key", ["public", "secrets"]);
    if (error) throw error;

    const publicConfig = data.find((r) => r.key === "public") || {};
    const secrets = data.find((r) => r.key === "secrets") || {};

    document.getElementById("setting-full-count").value = publicConfig.full_exam_question_count ?? 100;
    document.getElementById("setting-full-time").value = publicConfig.full_exam_time_minutes ?? 180;
    document.getElementById("setting-allow-email").checked = publicConfig.allow_email_signup !== false;
    document.getElementById("setting-allow-google").checked = publicConfig.allow_google_signin !== false;
    document.getElementById("setting-maintenance").checked = !!publicConfig.maintenance_mode;
    document.getElementById("setting-maintenance-msg").value = publicConfig.maintenance_message || "";

    document.getElementById("setting-claude-key").value = secrets.claude_api_key || "";
    document.getElementById("setting-gemini-key").value = secrets.gemini_api_key || "";
  } catch (err) {
    console.error("โหลดการตั้งค่าไม่สำเร็จ:", err);
    showSettingsError("โหลดการตั้งค่าไม่สำเร็จ: " + err.message);
  }
}

async function saveSettings() {
  hideSettingsBanners();

  const fullCount = parseInt(document.getElementById("setting-full-count").value, 10);
  const fullTime = parseInt(document.getElementById("setting-full-time").value, 10);

  if (!fullCount || fullCount < 1 || fullCount > 500) {
    return showSettingsError("จำนวนข้อสอบจริงต้องอยู่ระหว่าง 1-500 ข้อ");
  }
  if (!fullTime || fullTime < 1) {
    return showSettingsError("เวลาสอบต้องมากกว่า 0 นาที");
  }

  const publicPayload = {
    full_exam_question_count: fullCount,
    full_exam_time_minutes: fullTime,
    allow_email_signup: document.getElementById("setting-allow-email").checked,
    allow_google_signin: document.getElementById("setting-allow-google").checked,
    maintenance_mode: document.getElementById("setting-maintenance").checked,
    maintenance_message: document.getElementById("setting-maintenance-msg").value.trim()
  };

  const secretsPayload = {
    claude_api_key: document.getElementById("setting-claude-key").value.trim() || null,
    gemini_api_key: document.getElementById("setting-gemini-key").value.trim() || null
  };

  const btn = document.getElementById("save-settings-btn");
  btn.disabled = true;
  btn.textContent = "กำลังบันทึก...";

  try {
    const [publicRes, secretsRes] = await Promise.all([
      sb.from("system_config").update(publicPayload).eq("key", "public"),
      sb.from("system_config").update(secretsPayload).eq("key", "secrets")
    ]);
    if (publicRes.error) throw publicRes.error;
    if (secretsRes.error) throw secretsRes.error;
    showSettingsSuccess("บันทึกการตั้งค่าเรียบร้อยแล้ว");
  } catch (err) {
    showSettingsError("เกิดข้อผิดพลาด: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "บันทึกการตั้งค่า";
  }
}

function showSettingsSuccess(message) {
  const el = document.getElementById("settings-success");
  el.textContent = message;
  el.classList.remove("hidden");
}

function showSettingsError(message) {
  const el = document.getElementById("settings-error");
  el.textContent = message;
  el.classList.remove("hidden");
}

function hideSettingsBanners() {
  document.getElementById("settings-success").classList.add("hidden");
  document.getElementById("settings-error").classList.add("hidden");
}
