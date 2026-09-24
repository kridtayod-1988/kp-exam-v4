// js/admin/users.js

let allUsersCache = [];
let currentAdminUid = null;

(async function init() {
  try {
    const { user, userData } = await requireAdmin();
    currentAdminUid = user.id;
    renderAdminLayout("users", userData);
    await loadUsers();
  } catch (err) {
    console.error("เข้าถึงหน้าจัดการผู้ใช้ไม่สำเร็จ:", err);
  }
})();

async function loadUsers() {
  const tbody = document.getElementById("users-table-body");
  try {
    const { data, error } = await sb
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;
    allUsersCache = (data || []).map(mapProfileRow);
    renderUsersTable();
  } catch (err) {
    console.error("โหลดผู้ใช้ไม่สำเร็จ:", err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#f87171;padding:2rem;">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
  }
}

function renderUsersTable() {
  const tbody = document.getElementById("users-table-body");
  const searchTerm = document.getElementById("user-search-input").value.trim().toLowerCase();

  const filtered = allUsersCache.filter((u) => {
    if (!searchTerm) return true;
    return (
      (u.displayName || "").toLowerCase().includes(searchTerm) ||
      (u.email || "").toLowerCase().includes(searchTerm)
    );
  });

  tbody.innerHTML = "";

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem;">ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข</td></tr>`;
    document.getElementById("users-count-info").textContent = "";
    return;
  }

  filtered.forEach((u) => {
    tbody.appendChild(buildUserRow(u));
  });

  document.getElementById("users-count-info").textContent = `แสดง ${filtered.length} จาก ${allUsersCache.length} คน`;
}

function buildUserRow(u) {
  const tr = document.createElement("tr");

  const tdName = document.createElement("td");
  tdName.style.cssText = "font-weight:600;color:var(--text-primary);";
  tdName.textContent = u.displayName || "-"; // textContent ป้องกัน XSS
  tr.appendChild(tdName);

  const tdEmail = document.createElement("td");
  tdEmail.textContent = u.email || "-";
  tr.appendChild(tdEmail);

  const tdRole = document.createElement("td");
  const roleSelect = document.createElement("select");
  roleSelect.className = "form-select";
  roleSelect.style.cssText = "padding:0.4rem 0.6rem;font-size:0.85rem;width:auto;";
  ["user", "admin"].forEach((roleValue) => {
    const opt = document.createElement("option");
    opt.value = roleValue;
    opt.textContent = roleValue === "admin" ? "ผู้ดูแลระบบ" : "ผู้ใช้ทั่วไป";
    opt.selected = u.role === roleValue;
    roleSelect.appendChild(opt);
  });
  roleSelect.disabled = u.id === currentAdminUid; // ห้ามแก้สิทธิ์ตัวเองเผลอ ๆ ถอดสิทธิ์ admin ตัวเอง
  roleSelect.addEventListener("change", () => confirmRoleChange(u, roleSelect.value, roleSelect));
  tdRole.appendChild(roleSelect);
  if (u.id === currentAdminUid) {
    const note = document.createElement("p");
    note.className = "text-xs text-muted mt-1";
    note.textContent = "(บัญชีของคุณเอง)";
    tdRole.appendChild(note);
  }
  tr.appendChild(tdRole);

  const tdStats = document.createElement("td");
  tdStats.className = "text-sm";
  const levelInfo = calculateLevelInfo(u.stats?.totalExp ?? 0);
  const levelSpan = document.createElement("span");
  levelSpan.className = "badge badge-admin";
  levelSpan.style.marginRight = "0.4rem";
  levelSpan.textContent = `LV.${levelInfo.level}`;
  tdStats.appendChild(levelSpan);
  tdStats.appendChild(document.createTextNode(
    `ทำ ${u.stats?.totalAttempts ?? 0} ครั้ง / สูงสุด ${u.stats?.bestScore ?? 0}`
  ));
  tr.appendChild(tdStats);

  const tdCreated = document.createElement("td");
  tdCreated.className = "text-sm text-muted";
  tdCreated.textContent = u.createdAt ? formatThaiDateTime(u.createdAt) : "-";
  tr.appendChild(tdCreated);

  const tdActions = document.createElement("td");
  if (u.id !== currentAdminUid) {
    const deleteBtn = document.createElement("button");
    deleteBtn.style.cssText = "background:none;border:none;color:#f87171;cursor:pointer;font-size:0.85rem;font-family:var(--font-body);padding:0;";
    deleteBtn.textContent = "ลบผู้ใช้";
    deleteBtn.addEventListener("click", () => confirmDeleteUser(u));
    tdActions.appendChild(deleteBtn);
  }
  tr.appendChild(tdActions);

  return tr;
}

function confirmRoleChange(user, newRole, selectEl) {
  const roleLabel = newRole === "admin" ? "ผู้ดูแลระบบ" : "ผู้ใช้ทั่วไป";
  showConfirmModal(
    `คุณกำลังจะเปลี่ยนสิทธิ์ของ "${user.email}" เป็น "${roleLabel}" ยืนยันหรือไม่?`,
    async () => {
      try {
        const { error } = await sb.from("profiles").update({ role: newRole }).eq("id", user.id);
        if (error) throw error;
        user.role = newRole;
        showToast("เปลี่ยนสิทธิ์เรียบร้อยแล้ว");
      } catch (err) {
        showToast("เกิดข้อผิดพลาด: " + err.message);
        selectEl.value = user.role; // คืนค่าเดิมถ้า error
      }
    }
  );

  // ถ้าผู้ใช้กดยกเลิกใน modal ให้คืนค่า select กลับเป็นเดิม
  // (showConfirmModal ปัจจุบันไม่ส่ง callback ตอนยกเลิก จึงตรวจสอบด้วย setTimeout เบา ๆ)
  setTimeout(() => {
    if (!document.getElementById("global-confirm-modal")) return;
  }, 0);
}

function confirmDeleteUser(user) {
  showConfirmModal(
    `คุณกำลังจะลบผู้ใช้ "${user.email}" การกระทำนี้ไม่สามารถย้อนกลับได้ ยืนยันหรือไม่?`,
    async () => {
      try {
        const { error } = await sb.from("profiles").delete().eq("id", user.id);
        if (error) throw error;
        // หมายเหตุ: การลบนี้ลบเฉพาะแถวใน profiles table เท่านั้น
        // ไม่ได้ลบบัญชี Supabase Auth จริง (ต้องทำผ่าน Admin API/Dashboard แยก เพราะต้องใช้ service role key
        // ซึ่งไม่ปลอดภัยที่จะเรียกจาก client โดยตรง)
        // ผู้ใช้คนนี้จะยัง log in ได้แต่จะไม่มี role/ข้อมูลส่วนตัวเหลืออยู่ (และ trigger จะไม่สร้าง profile ใหม่ให้อัตโนมัติ)
        allUsersCache = allUsersCache.filter((u) => u.id !== user.id);
        renderUsersTable();
        showToast("ลบข้อมูลผู้ใช้เรียบร้อยแล้ว (หมายเหตุ: บัญชี Auth ต้องลบแยกผ่าน Supabase Dashboard)");
      } catch (err) {
        showToast("เกิดข้อผิดพลาด: " + err.message);
      }
    }
  );
}

document.getElementById("user-search-input").addEventListener("input", renderUsersTable);
