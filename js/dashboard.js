// js/dashboard.js
// ═══════════════════════════════════════════════════════════════
// Dashboard — เลือกโหมดทำข้อสอบ + EXP/Level + Showcase
// ═══════════════════════════════════════════════════════════════
// 2 โหมด:
//   1. Practice (ฝึก) — เลือกหมวด + count → เฉลยทันที
//   2. Exam Sets (สอบ) — เลือกชุดสอบ → จับเวลา → ส่งทีเดียว
// ═══════════════════════════════════════════════════════════════

// ─── State ───
let dashboardUser = null;
let selectedPracticeCount = 10;    // default
let currentPracticeCategoryId = null;

// ═══════════════════════════════════════════
// Init
// ═══════════════════════════════════════════
(async function init() {
  console.log("[dashboard] init start");

  if (typeof sb === "undefined") {
    console.error("[dashboard] ❌ sb ไม่ได้โหลด");
    showToast("ระบบยังโหลดไม่ครบ กรุณา refresh", "error");
    return;
  }

  try {
    const { user, userData } = await requireAuth();
    dashboardUser = user;

    // ─── User greeting + stats ───
    setTextSafe("user-greeting", `สวัสดี, ${userData?.displayName || user.email}`);
    setTextSafe("stat-total-attempts", String(userData?.stats?.totalAttempts ?? 0));
    setTextSafe("stat-best-score", String(userData?.stats?.bestScore ?? 0));

    renderLevelWidget(userData?.stats?.totalExp ?? 0, {
      levelNum: "level-num",
      expFill: "exp-fill",
      expLabel: "exp-label"
    });

    // ─── Bind events ───
    bindEvents();

    // ─── Load data (parallel) ───
    await Promise.all([
      loadSystemConfig(),
      loadPracticeCategories(),
      loadExamSets()
    ]);

  } catch (err) {
    console.error("[dashboard] init error:", err);
  }
})();

// ═══════════════════════════════════════════
// Bind events
// ═══════════════════════════════════════════
function bindEvents() {
  // Logout
  document.getElementById("logout-btn")?.addEventListener("click", signOutUser);

  // ─── Practice count buttons (10/25/50) ───
  document.querySelectorAll("#practice-count-group .count-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#practice-count-group .count-btn").forEach((b) => {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      selectedPracticeCount = parseInt(btn.dataset.count, 10);
    });
  });

  // ─── Start Practice ───
  document.getElementById("start-practice-btn")?.addEventListener("click", () => {
    const select = document.getElementById("practice-category-select");
    const categoryId = select?.value;
    const selectedOption = select?.options[select.selectedIndex];

    if (!categoryId) {
      showToast("กรุณาเลือกหมวดหมู่ก่อน", "warning");
      return;
    }

    // เก็บ config ไปหน้า practice
    sessionStorage.setItem("practiceConfig", JSON.stringify({
      categoryId,
      categoryName: selectedOption?.textContent || "",
      count: selectedPracticeCount
    }));

    window.location.href = "practice.html";
  });
}

// ═══════════════════════════════════════════
// Load: System Config
// ═══════════════════════════════════════════
async function loadSystemConfig() {
  try {
    const { data, error } = await sb
      .from("system_config")
      .select("full_exam_question_count, full_exam_time_minutes")
      .eq("key", "public")
      .single();

    if (error) throw error;

    const count = data?.full_exam_question_count || 100;
    const minutes = data?.full_exam_time_minutes || 180;

    setTextSafe("full-exam-description",
      `สุ่มข้อสอบ ${count} ข้อ • ${minutes} นาที • เลี่ยงข้อที่เคยทำ`);

  } catch (err) {
    console.error("[dashboard] loadSystemConfig error:", err);
  }
}

// ═══════════════════════════════════════════
// Load: Practice Categories
// ═══════════════════════════════════════════
async function loadPracticeCategories() {
  const select = document.getElementById("practice-category-select");
  if (!select) return;

  try {
    const { data, error } = await sb
      .from("categories")
      .select("id, name, sort_order")
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
      option.textContent = row.name;
      select.appendChild(option);
    });

    console.log("[dashboard] โหลดหมวดหมู่ฝึก:", data.length, "รายการ");

  } catch (err) {
    console.error("[dashboard] loadPracticeCategories error:", err);
    select.innerHTML = `<option value="">โหลดไม่สำเร็จ</option>`;
  }
}

// ═══════════════════════════════════════════
// Load: Exam Sets (การ์ดชุดสอบ)
// ═══════════════════════════════════════════
async function loadExamSets() {
  const grid = document.getElementById("exam-sets-grid");
  const empty = document.getElementById("exam-sets-empty");

  if (!grid) return;

  try {
    const { data, error } = await sb
      .from("exam_sets")
      .select(`
        id,
        name,
        description,
        question_count,
        time_limit_minutes,
        max_score,
        pass_score,
        is_active,
        exam_years (label, year)
      `)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) throw error;

    grid.innerHTML = "";

    if (!data || data.length === 0) {
      grid.classList.add("hidden");
      empty?.classList.remove("hidden");
      console.log("[dashboard] ไม่มี exam_sets");
      return;
    }

    data.forEach((set) => {
      grid.appendChild(buildExamSetCard(set));
    });

    console.log("[dashboard] โหลด exam_sets:", data.length, "ชุด");

  } catch (err) {
    console.error("[dashboard] loadExamSets error:", err);
    grid.innerHTML = "";
    if (empty) empty.classList.remove("hidden");
  }
}

// ═══════════════════════════════════════════
// Build Exam Set Card
// ═══════════════════════════════════════════
function buildExamSetCard(set) {
  const card = document.createElement("div");
  card.className = "paper-card";
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-label", `เริ่มทำชุด ${set.name}`);

  // ─── Top row ───
  const top = document.createElement("div");
  top.className = "paper-card-top";

  const icon = document.createElement("div");
  icon.className = "paper-card-icon";
  icon.textContent = "📝";

  const yearBadge = document.createElement("span");
  yearBadge.className = "paper-card-year";
  yearBadge.textContent = set.exam_years?.year || "—";

  top.appendChild(icon);
  top.appendChild(yearBadge);
  card.appendChild(top);

  // ─── Name ───
  const label = document.createElement("p");
  label.className = "paper-card-label";
  label.textContent = set.name;
  card.appendChild(label);

  // ─── Description ───
  if (set.description) {
    const desc = document.createElement("p");
    desc.className = "paper-card-desc";
    desc.textContent = set.description;
    card.appendChild(desc);
  }

  // ─── Meta (count + time + arrow) ───
  const meta = document.createElement("div");
  meta.className = "paper-card-meta";

  const count = document.createElement("span");
  count.className = "paper-card-count";
  const countBold = document.createElement("b");
  countBold.textContent = String(set.question_count || 0);
  count.appendChild(countBold);
  count.appendChild(document.createTextNode(" ข้อ"));

  // Time info
  const timeWrap = document.createElement("span");
  timeWrap.style.cssText = "font-size:0.7rem;color:var(--text-muted);font-family:var(--font-mono);";
  timeWrap.textContent = `⏱ ${set.time_limit_minutes || 0} นาที`;

  const leftWrap = document.createElement("div");
  leftWrap.style.cssText = "display:flex;flex-direction:column;gap:0.15rem;";
  leftWrap.appendChild(count);
  leftWrap.appendChild(timeWrap);

  const arrow = document.createElement("span");
  arrow.className = "paper-card-arrow";
  arrow.textContent = "→";

  meta.appendChild(leftWrap);
  meta.appendChild(arrow);
  card.appendChild(meta);

  // ─── Click handler ───
  const startExam = () => {
    sessionStorage.setItem("examConfig", JSON.stringify({
      mode: "exam_set",
      examSetId: set.id,
      count: set.question_count,
      timeLimitMinutes: set.time_limit_minutes
    }));
    window.location.href = "exam.html";
  };

  card.addEventListener("click", startExam);
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      startExam();
    }
  });

  return card;
}

// ═══════════════════════════════════════════
// Helper (ถ้าไม่มีใน utils.js)
// ═══════════════════════════════════════════
if (typeof setTextSafe !== "function") {
  window.setTextSafe = function (id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
}