// js/admin/admin-dashboard.js

(async function init() {
  try {
    const { userData } = await requireAdmin();
    renderAdminLayout("dashboard", userData);
    await loadStats();
    await loadRecentAttempts();
  } catch (err) {
    console.error("เข้าถึง admin dashboard ไม่สำเร็จ:", err);
  }
})();

async function loadStats() {
  try {
    const [questionsRes, usersRes, attemptsRes, categoriesRes] = await Promise.all([
      sb.from("questions").select("id", { count: "exact", head: true }).eq("is_active", true),
      sb.from("profiles").select("id", { count: "exact", head: true }),
      sb.from("exam_attempts").select("id", { count: "exact", head: true }),
      sb.from("categories").select("id", { count: "exact", head: true }).eq("is_active", true)
    ]);

    setTextSafe("stat-total-questions", String(questionsRes.count ?? 0));
    setTextSafe("stat-total-users", String(usersRes.count ?? 0));
    setTextSafe("stat-total-attempts", String(attemptsRes.count ?? 0));
    setTextSafe("stat-total-categories", String(categoriesRes.count ?? 0));
  } catch (err) {
    console.error("โหลดสถิติไม่สำเร็จ:", err);
  }
}

async function loadRecentAttempts() {
  const container = document.getElementById("recent-attempts-list");
  try {
    const { data, error } = await sb
      .from("exam_attempts")
      .select("started_at, score, total_questions")
      .order("started_at", { ascending: false })
      .limit(5);

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = "";
      const p = document.createElement("p");
      p.className = "text-muted";
      p.textContent = "ยังไม่มีการทำข้อสอบ";
      container.appendChild(p);
      return;
    }

    container.innerHTML = "";
    data.forEach((attempt, idx, arr) => {
      const row = document.createElement("div");
      row.className = "flex justify-between items-center";
      row.style.cssText = "padding:0.6rem 0;" + (idx < arr.length - 1 ? "border-bottom:1px solid var(--border-subtle);" : "");

      const left = document.createElement("span");
      left.className = "text-secondary";
      left.textContent = attempt.started_at ? formatThaiDateTime(attempt.started_at) : "-";

      const right = document.createElement("span");
      right.className = "font-bold text-gold";
      right.textContent = `${attempt.score ?? 0}/${attempt.total_questions ?? 0}`;

      row.appendChild(left);
      row.appendChild(right);
      container.appendChild(row);
    });
  } catch (err) {
    console.error("โหลดการทำข้อสอบล่าสุดไม่สำเร็จ:", err);
    container.innerHTML = "";
    const p = document.createElement("p");
    p.style.color = "#f87171";
    p.textContent = "โหลดข้อมูลไม่สำเร็จ";
    container.appendChild(p);
  }
}
