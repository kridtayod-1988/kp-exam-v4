// js/dashboard.js

let dashboardUser = null;
let selectedCategoryCount = null;
let selectedYearCount = null;

(async function init() {
  try {
    const { user, userData } = await requireAuth();
    dashboardUser = user;

    setTextSafe("user-greeting", `สวัสดี, ${userData?.displayName || user.email}`);
    setTextSafe("stat-total-attempts", String(userData?.stats?.totalAttempts ?? 0));
    setTextSafe("stat-best-score", String(userData?.stats?.bestScore ?? 0));

    renderLevelWidget(userData?.stats?.totalExp ?? 0, {
      levelNum: "level-num",
      expFill: "exp-fill",
      expLabel: "exp-label"
    });

    await loadSystemConfig();
    await loadCategories();
    await loadExamYears();
  } catch (err) {
    console.error("เกิดข้อผิดพลาดตอนโหลดหน้า dashboard:", err);
  }
})();

document.getElementById("logout-btn").addEventListener("click", signOutUser);

async function loadSystemConfig() {
  try {
    const { data, error } = await sb
      .from("system_config")
      .select("full_exam_question_count")
      .eq("key", "public")
      .single();

    if (error) throw error;
    const fullCount = data?.full_exam_question_count || 100;
    setTextSafe(
      "full-exam-description",
      `สุ่มข้อสอบ ${fullCount} ข้อจากคลังทั้งหมด พยายามเลี่ยงข้อที่คุณเคยทำไปแล้ว`
    );
  } catch (err) {
    console.error("โหลด systemConfig ไม่สำเร็จ:", err);
  }
}

async function loadCategories() {
  const select = document.getElementById("category-select");
  try {
    const { data, error } = await sb
      .from("categories")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    select.innerHTML = "";
    if (!data || data.length === 0) {
      select.innerHTML = `<option value="">ยังไม่มีหมวดหมู่</option>`;
      return;
    }
    data.forEach((row) => {
      const option = document.createElement("option");
      option.value = row.id;
      option.textContent = row.name; // textContent ปลอดภัยจาก XSS
      select.appendChild(option);
    });
  } catch (err) {
    console.error("โหลดหมวดหมู่ไม่สำเร็จ:", err);
    select.innerHTML = `<option value="">โหลดไม่สำเร็จ</option>`;
  }
}

async function loadExamYears() {
  const select = document.getElementById("year-select");
  try {
    const { data, error } = await sb
      .from("exam_years")
      .select("id, label")
      .eq("is_active", true)
      .order("year", { ascending: false });

    if (error) throw error;

    select.innerHTML = "";
    if (!data || data.length === 0) {
      select.innerHTML = `<option value="">ยังไม่มีข้อมูลปี</option>`;
      return;
    }
    data.forEach((row) => {
      const option = document.createElement("option");
      option.value = row.id;
      option.textContent = row.label;
      select.appendChild(option);
    });
  } catch (err) {
    console.error("โหลดปีข้อสอบไม่สำเร็จ:", err);
    select.innerHTML = `<option value="">โหลดไม่สำเร็จ</option>`;
  }
}

// ----- ปุ่มเลือกจำนวนข้อ (หมวดหมู่) -----
document.querySelectorAll(".count-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".count-btn").forEach((b) => {
      b.classList.remove("active");
    });
    btn.classList.add("active");
    selectedCategoryCount = parseInt(btn.dataset.count, 10);
  });
});

// ----- ปุ่มเลือกจำนวนข้อ (ปี) -----
document.querySelectorAll(".count-btn-year").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".count-btn-year").forEach((b) => {
      b.classList.remove("active");
    });
    btn.classList.add("active");
    selectedYearCount = parseInt(btn.dataset.count, 10);
  });
});

// ----- เริ่มข้อสอบจริง 100 ข้อ -----
document.getElementById("start-full-exam-btn").addEventListener("click", () => {
  sessionStorage.setItem("examConfig", JSON.stringify({ mode: "full100" }));
  window.location.href = "exam.html";
});

// ----- เริ่มข้อสอบแยกหมวดหมู่ -----
document.getElementById("start-category-exam-btn").addEventListener("click", () => {
  const categoryId = document.getElementById("category-select").value;
  if (!categoryId) {
    showToast("กรุณาเลือกหมวดหมู่ก่อน");
    return;
  }
  if (!selectedCategoryCount) {
    showToast("กรุณาเลือกจำนวนข้อก่อน (10/25/50 ข้อ)");
    return;
  }
  sessionStorage.setItem(
    "examConfig",
    JSON.stringify({ mode: "category", categoryId, count: selectedCategoryCount })
  );
  window.location.href = "exam.html";
});

// ----- เริ่มข้อสอบแยกปี -----
document.getElementById("start-year-exam-btn").addEventListener("click", () => {
  const examYearId = document.getElementById("year-select").value;
  if (!examYearId) {
    showToast("กรุณาเลือกปีข้อสอบก่อน");
    return;
  }
  if (!selectedYearCount) {
    showToast("กรุณาเลือกจำนวนข้อก่อน (10/25/50 ข้อ)");
    return;
  }
  sessionStorage.setItem(
    "examConfig",
    JSON.stringify({ mode: "year", examYearId, count: selectedYearCount })
  );
  window.location.href = "exam.html";
});
