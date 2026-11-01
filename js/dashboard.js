// js/dashboard.js
// ═══════════════════════════════════════════════════════════════
// Dashboard — เลือกโหมดทำข้อสอบ + EXP/Level + Showcase
// ═══════════════════════════════════════════════════════════════

let dashboardUser = null;
let selectedCategoryCount = 10;
let selectedYearCount = 10;

(function initDashboard() {
  console.log("[dashboard] init start");

  if (typeof sb === "undefined") {
    console.error("[dashboard] ❌ sb ไม่ได้โหลด");
    showToast("ระบบยังโหลดไม่ครบ กรุณา refresh", "error");
    return;
  }

  const pageReady = () => {
    const loginForm = document.getElementById("login-form");
    const categorySelect = document.getElementById("category-select");
    const fullExamButton = document.getElementById("start-full-exam-btn");
    const categoryButton = document.getElementById("start-category-exam-btn");
    const yearButton = document.getElementById("start-year-exam-btn");

    if (!loginForm && !categorySelect && !fullExamButton && !categoryButton && !yearButton) {
      return false;
    }

    return true;
  };

  if (!pageReady()) {
    return;
  }

  (async function run() {
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

      bindEvents();
      await Promise.all([
        loadSystemConfig(),
        loadCategoryOptions(),
        loadYearOptions(),
        loadExamSets()
      ]);
    } catch (err) {
      console.error("[dashboard] init error:", err);
    }
  })();
})();

function bindEvents() {
  document.getElementById("logout-btn")?.addEventListener("click", signOutUser);

  document.getElementById("start-full-exam-btn")?.addEventListener("click", () => {
    sessionStorage.setItem("examConfig", JSON.stringify({
      mode: "full",
      count: 100,
      timeLimitMinutes: 180
    }));
    window.location.href = "exam.html";
  });

  document.querySelectorAll("#category-count-buttons .count-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#category-count-buttons .count-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedCategoryCount = Number(btn.dataset.count || 10);
    });
  });

  document.getElementById("start-category-exam-btn")?.addEventListener("click", () => {
    const select = document.getElementById("category-select");
    const categoryId = select?.value;
    const categoryName = select?.selectedOptions?.[0]?.textContent || "";

    if (!categoryId) {
      showToast("กรุณาเลือกหมวดหมู่ก่อน", "warning");
      return;
    }

    sessionStorage.setItem("examConfig", JSON.stringify({
      mode: "category",
      categoryId,
      categoryName,
      count: selectedCategoryCount,
      timeLimitMinutes: 30
    }));

    window.location.href = "exam.html";
  });

  document.querySelectorAll("#year-count-buttons .count-btn-year").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#year-count-buttons .count-btn-year").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedYearCount = Number(btn.dataset.count || 10);
    });
  });

  document.getElementById("start-year-exam-btn")?.addEventListener("click", () => {
    const yearSelect = document.getElementById("year-select");
    const yearId = yearSelect?.value;

    if (!yearId) {
      showToast("กรุณาเลือกปีข้อสอบก่อน", "warning");
      return;
    }

    sessionStorage.setItem("examConfig", JSON.stringify({
      mode: "year",
      yearId,
      count: selectedYearCount,
      timeLimitMinutes: 30
    }));

    window.location.href = "exam.html";
  });
}

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

    setTextSafe(
      "full-exam-description",
      `สุ่มข้อสอบ ${count} ข้อ • ${minutes} นาที • เลี่ยงข้อที่เคยทำ`
    );
  } catch (err) {
    console.error("[dashboard] loadSystemConfig error:", err);
  }
}

async function loadCategoryOptions() {
  const select = document.getElementById("category-select");
  if (!select) return;

  try {
    const { data, error } = await sb
      .from("categories")
      .select("id, name, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    select.innerHTML = "<option value=''>เลือกหมวดหมู่</option>";

    if (!data || data.length === 0) {
      select.innerHTML = "<option value=''>ยังไม่มีหมวดหมู่</option>";
      return;
    }

    data.forEach((row) => {
      const option = document.createElement("option");
      option.value = row.id;
      option.textContent = row.name;
      select.appendChild(option);
    });
  } catch (err) {
    console.error("[dashboard] loadCategoryOptions error:", err);
    select.innerHTML = "<option value=''>โหลดไม่สำเร็จ</option>";
  }
}

async function loadYearOptions() {
  const select = document.getElementById("year-select");
  if (!select) return;

  try {
    const { data, error } = await sb
      .from("exam_years")
      .select("id, label, year")
      .order("year", { ascending: false });

    if (error) throw error;

    select.innerHTML = "<option value=''>เลือกปีข้อสอบ</option>";

    if (!data || data.length === 0) {
      select.innerHTML = "<option value=''>ยังไม่มีปีข้อสอบ</option>";
      return;
    }

    data.forEach((row) => {
      const option = document.createElement("option");
      option.value = row.id;
      option.textContent = row.label || row.year || "ปีข้อสอบ";
      select.appendChild(option);
    });
  } catch (err) {
    console.error("[dashboard] loadYearOptions error:", err);
    select.innerHTML = "<option value=''>โหลดไม่สำเร็จ</option>";
  }
}

async function loadExamSets() {
  const grid = document.getElementById("papers-grid");
  const empty = document.getElementById("papers-empty");
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
      return;
    }

    data.forEach((set) => {
      grid.appendChild(buildExamSetCard(set));
    });
  } catch (err) {
    console.error("[dashboard] loadExamSets error:", err);
    grid.innerHTML = "";
    empty?.classList.remove("hidden");
  }
}

function buildExamSetCard(set) {
  const card = document.createElement("div");
  card.className = "paper-card";
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-label", `เริ่มทำชุด ${set.name}`);

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

  const label = document.createElement("p");
  label.className = "paper-card-label";
  label.textContent = set.name;
  card.appendChild(label);

  if (set.description) {
    const desc = document.createElement("p");
    desc.className = "paper-card-desc";
    desc.textContent = set.description;
    card.appendChild(desc);
  }

  const meta = document.createElement("div");
  meta.className = "paper-card-meta";

  const count = document.createElement("span");
  count.className = "paper-card-count";
  const countBold = document.createElement("b");
  countBold.textContent = String(set.question_count || 0);
  count.appendChild(countBold);
  count.appendChild(document.createTextNode(" ข้อ"));

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

if (typeof setTextSafe !== "function") {
  window.setTextSafe = function (id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
}
