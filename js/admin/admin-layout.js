// js/admin/admin-layout.js
// สร้าง sidebar navigation ของ admin panel ใช้ร่วมกันทุกหน้า
// เรียก renderAdminLayout(activePage) ใน DOMContentLoaded ของแต่ละหน้า admin

const ADMIN_NAV_ITEMS = [
  { id: "dashboard", label: "แดชบอร์ด", href: "index.html", icon: "📊" },
  { id: "questions", label: "จัดการคำถาม", href: "questions.html", icon: "❓" },
  { id: "ai-generate", label: "สร้างข้อสอบด้วย AI", href: "ai-generate.html", icon: "🤖" },
  { id: "users", label: "จัดการผู้ใช้", href: "users.html", icon: "👥" },
  { id: "taxonomy", label: "หมวดหมู่ / ปี", href: "taxonomy.html", icon: "🗂️" },
  { id: "settings", label: "ตั้งค่าระบบ", href: "settings.html", icon: "⚙️" }
];

/**
 * Render sidebar + topbar ของ admin panel
 * @param {string} activePage - id ของหน้าปัจจุบัน (ต้องตรงกับ ADMIN_NAV_ITEMS)
 * @param {object} userData - ข้อมูล users/{uid} ของ admin ที่ล็อกอินอยู่
 */
function renderAdminLayout(activePage, userData) {
  const sidebar = document.getElementById("admin-sidebar");
  if (!sidebar) return;

  sidebar.innerHTML = "";

  const logo = document.createElement("div");
  logo.style.cssText = "padding:0.5rem 0.75rem 1.25rem;border-bottom:1px solid var(--border-subtle);margin-bottom:1rem;";
  logo.innerHTML = `
    <a href="../dashboard.html" style="display:flex;align-items:center;gap:0.5rem;text-decoration:none;">
      <span style="width:28px;height:28px;background:linear-gradient(135deg,var(--gold-500),var(--gold-300));border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:0.9rem;">⚔️</span>
      <span style="font-family:var(--font-display);font-weight:800;font-size:1rem;color:var(--text-primary);">เตรียมสอบ <span style="color:var(--gold-400);">ก.พ.</span></span>
    </a>
    <p style="font-size:0.72rem;color:var(--text-muted);margin-top:0.35rem;letter-spacing:0.03em;">แผงควบคุมผู้ดูแลระบบ</p>
  `;
  sidebar.appendChild(logo);

  const nav = document.createElement("nav");
  nav.style.cssText = "display:flex;flex-direction:column;gap:0.25rem;flex:1;";

  ADMIN_NAV_ITEMS.forEach((item) => {
    const link = document.createElement("a");
    link.href = item.href;
    link.className = "admin-sidebar-link" + (item.id === activePage ? " active" : "");
    link.innerHTML = `<span>${item.icon}</span><span>${escapeHtml(item.label)}</span>`;
    nav.appendChild(link);
  });

  sidebar.appendChild(nav);

  const footer = document.createElement("div");
  footer.style.cssText = "padding:1rem 0.75rem 0.25rem;margin-top:auto;border-top:1px solid var(--border-subtle);";
  footer.innerHTML = `
    <p style="font-size:0.85rem;font-weight:600;color:var(--text-primary);">${escapeHtml(userData?.displayName || "")}</p>
    <p style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.75rem;">${escapeHtml(userData?.email || "")}</p>
    <a href="../dashboard.html" style="font-size:0.85rem;color:var(--gold-400);display:block;margin-bottom:0.5rem;text-decoration:none;">← กลับสู่หน้าผู้ใช้</a>
    <button id="admin-logout-btn" style="font-size:0.85rem;color:#f87171;background:none;border:none;cursor:pointer;padding:0;font-family:var(--font-body);">ออกจากระบบ</button>
  `;
  sidebar.appendChild(footer);

  document.getElementById("admin-logout-btn").addEventListener("click", signOutUser);
}

/**
 * Modal ยืนยันก่อนทำลายข้อมูล — ใช้ร่วมกันทุกหน้า admin
 * @param {string} message ข้อความที่จะแสดง
 * @param {function} onConfirm callback เมื่อกดยืนยัน
 */
function showConfirmModal(message, onConfirm) {
  const existing = document.getElementById("global-confirm-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "global-confirm-modal";
  modal.className = "modal-overlay";

  const box = document.createElement("div");
  box.className = "modal-box";

  const title = document.createElement("h3");
  title.className = "modal-title";
  title.textContent = "⚠️ ยืนยันการดำเนินการ";
  box.appendChild(title);

  const msg = document.createElement("p");
  msg.className = "modal-desc";
  msg.textContent = message; // textContent ป้องกัน XSS แม้ message จะมีข้อมูลจาก database ปนอยู่
  box.appendChild(msg);

  const btnRow = document.createElement("div");
  btnRow.className = "modal-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn btn-ghost";
  cancelBtn.textContent = "ยกเลิก";
  cancelBtn.addEventListener("click", () => modal.remove());

  const confirmBtn = document.createElement("button");
  confirmBtn.className = "btn btn-danger";
  confirmBtn.textContent = "ยืนยัน";
  confirmBtn.addEventListener("click", () => {
    modal.remove();
    onConfirm();
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  box.appendChild(btnRow);
  modal.appendChild(box);
  document.body.appendChild(modal);
}
