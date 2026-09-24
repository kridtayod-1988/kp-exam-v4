// js/profile.js

let profileUser = null;

(async function init() {
  try {
    const { user, userData } = await requireAuth();
    profileUser = user;

    renderProfileInfo(user, userData);
    await loadHistory(user.id);
  } catch (err) {
    console.error("โหลดโปรไฟล์ไม่สำเร็จ:", err);
  }
})();

function renderProfileInfo(user, userData) {
  setTextSafe("profile-name", userData?.displayName || user.email);
  setTextSafe("profile-email", user.email);
  setTextSafe("stat-total-attempts", String(userData?.stats?.totalAttempts ?? 0));
  setTextSafe("stat-best-score", String(userData?.stats?.bestScore ?? 0));

  renderLevelWidget(userData?.stats?.totalExp ?? 0, {
    levelNum: "level-num",
    expFill: "exp-fill",
    expLabel: "exp-label"
  });

  document.getElementById("edit-name").value = userData?.displayName || "";

  const photoUrl = userData?.photoURL;
  if (photoUrl) {
    const img = document.getElementById("profile-photo");
    img.src = photoUrl;
    img.classList.remove("hidden");
    document.getElementById("profile-photo-placeholder").classList.add("hidden");
  } else {
    const initial = (userData?.displayName || user.email || "?").charAt(0).toUpperCase();
    document.getElementById("profile-photo-placeholder").textContent = initial;
  }
}

document.getElementById("logout-btn").addEventListener("click", signOutUser);

document.getElementById("edit-profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorBanner = document.getElementById("edit-error");
  const successBanner = document.getElementById("edit-success");
  errorBanner.classList.add("hidden");
  successBanner.classList.add("hidden");

  const newName = document.getElementById("edit-name").value.trim();
  if (!isValidLength(newName, 100)) {
    errorBanner.textContent = "กรุณากรอกชื่อที่แสดง (ไม่เกิน 100 ตัวอักษร)";
    errorBanner.classList.remove("hidden");
    return;
  }

  try {
    const { error } = await sb
      .from("profiles")
      .update({ display_name: newName })
      .eq("id", profileUser.id);

    if (error) throw error;

    setTextSafe("profile-name", newName);
    successBanner.textContent = "บันทึกการเปลี่ยนแปลงเรียบร้อยแล้ว";
    successBanner.classList.remove("hidden");
  } catch (err) {
    errorBanner.textContent = "เกิดข้อผิดพลาด: " + err.message;
    errorBanner.classList.remove("hidden");
  }
});

document.getElementById("change-password-btn").addEventListener("click", async () => {
  try {
    const { error } = await sb.auth.resetPasswordForEmail(profileUser.email, {
      redirectTo: window.location.origin + window.location.pathname.replace("profile.html", "login.html")
    });
    if (error) throw error;
    showToast("ส่งลิงก์เปลี่ยนรหัสผ่านไปที่อีเมลของคุณแล้ว");
  } catch (err) {
    showToast(getSupabaseAuthErrorMessage(err));
  }
});

async function loadHistory(uid) {
  const listContainer = document.getElementById("history-list");
  try {
    const { data, error } = await sb
      .from("exam_attempts")
      .select("*")
      .eq("user_id", uid)
      .order("started_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    if (!data || data.length === 0) {
      listContainer.innerHTML = "";
      const emptyMsg = document.createElement("p");
      emptyMsg.className = "text-secondary text-sm";
      emptyMsg.textContent = "ยังไม่มีประวัติการทำข้อสอบ";
      listContainer.appendChild(emptyMsg);
      return;
    }

    listContainer.innerHTML = "";
    data.forEach((row) => {
      const attempt = mapExamAttemptRow(row);
      listContainer.appendChild(buildHistoryCard(attempt.id, attempt));
    });
  } catch (err) {
    console.error("โหลดประวัติไม่สำเร็จ:", err);
    listContainer.innerHTML = "";
    const errMsg = document.createElement("p");
    errMsg.className = "form-error";
    errMsg.textContent = "โหลดประวัติไม่สำเร็จ";
    listContainer.appendChild(errMsg);
  }
}

const MODE_LABELS_TH = {
  full100: "ข้อสอบจริง",
  category: "แยกหมวดหมู่",
  year: "แยกปี"
};

const MODE_ICONS = {
  full100: "📝",
  category: "📚",
  year: "📅"
};

function buildHistoryCard(attemptId, attempt) {
  const card = document.createElement("a");
  card.href = `result.html?attemptId=${encodeURIComponent(attemptId)}`;
  card.className = "history-item";

  const leftGroup = document.createElement("div");
  leftGroup.className = "flex items-center gap-2";

  const icon = document.createElement("span");
  icon.style.fontSize = "1.3rem";
  icon.textContent = MODE_ICONS[attempt.mode] || "🎮";
  leftGroup.appendChild(icon);

  const infoCol = document.createElement("div");

  const modeLabel = document.createElement("p");
  modeLabel.className = "font-bold";
  modeLabel.style.fontSize = "0.95rem";
  modeLabel.textContent = MODE_LABELS_TH[attempt.mode] || "แบบทดสอบ";
  infoCol.appendChild(modeLabel);

  const dateLabel = document.createElement("p");
  dateLabel.className = "text-xs text-muted";
  dateLabel.textContent = attempt.startedAt ? formatThaiDateTime(attempt.startedAt) : "";
  infoCol.appendChild(dateLabel);

  leftGroup.appendChild(infoCol);
  card.appendChild(leftGroup);

  const scoreLabel = document.createElement("span");
  scoreLabel.className = "history-score";
  scoreLabel.style.fontSize = "1.15rem";
  scoreLabel.textContent = `${attempt.score} / ${attempt.totalQuestions}`;
  card.appendChild(scoreLabel);

  return card;
}
