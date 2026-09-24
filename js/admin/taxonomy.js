// js/admin/taxonomy.js

let categoriesData = [];
let yearsData = [];

(async function init() {
  try {
    const { userData } = await requireAdmin();
    renderAdminLayout("taxonomy", userData);
    await loadCategories();
    await loadYears();
    bindEvents();
  } catch (err) {
    console.error("เข้าถึงหน้าจัดการหมวดหมู่/ปีไม่สำเร็จ:", err);
  }
})();

// ----- หมวดหมู่ -----

async function loadCategories() {
  const container = document.getElementById("category-list");
  try {
    const { data, error } = await sb.from("categories").select("*").order("sort_order", { ascending: true });
    if (error) throw error;
    categoriesData = (data || []).map((c) => ({ id: c.id, name: c.name, order: c.sort_order, isActive: c.is_active }));
    renderCategoryList();
  } catch (err) {
    console.error("โหลดหมวดหมู่ไม่สำเร็จ:", err);
    container.innerHTML = `<p style="color:#f87171;font-size:0.875rem;">โหลดข้อมูลไม่สำเร็จ</p>`;
  }
}

function renderCategoryList() {
  const container = document.getElementById("category-list");
  container.innerHTML = "";

  if (categoriesData.length === 0) {
    container.innerHTML = `<p class="text-muted text-sm">ยังไม่มีหมวดหมู่ กดปุ่ม "+ เพิ่ม" เพื่อสร้างใหม่</p>`;
    return;
  }

  categoriesData.forEach((cat) => {
    const row = document.createElement("div");
    row.className = "flex justify-between items-center";
    row.style.cssText = "padding:0.75rem 1rem;border:1px solid var(--border-subtle);border-radius:var(--radius-sm);" + (cat.isActive === false ? "opacity:0.5;" : "");

    const left = document.createElement("div");
    const name = document.createElement("p");
    name.style.cssText = "font-weight:600;color:var(--text-primary);";
    name.textContent = cat.name; // textContent ป้องกัน XSS
    left.appendChild(name);

    const order = document.createElement("p");
    order.className = "text-xs text-muted";
    order.textContent = `ลำดับ: ${cat.order ?? 0}`;
    left.appendChild(order);

    row.appendChild(left);

    const actions = document.createElement("div");
    actions.className = "flex gap-2";

    const editBtn = document.createElement("button");
    editBtn.style.cssText = "background:none;border:none;color:var(--gold-400);cursor:pointer;font-size:0.85rem;font-family:var(--font-body);padding:0;";
    editBtn.textContent = "แก้ไข";
    editBtn.addEventListener("click", () => openCategoryModal(cat));
    actions.appendChild(editBtn);

    const toggleBtn = document.createElement("button");
    toggleBtn.style.cssText = `background:none;border:none;cursor:pointer;font-size:0.85rem;font-family:var(--font-body);padding:0;color:${cat.isActive === false ? "#4ade80" : "#f87171"};`;
    toggleBtn.textContent = cat.isActive === false ? "เปิดใช้" : "ปิดใช้";
    toggleBtn.addEventListener("click", () => confirmToggleCategory(cat));
    actions.appendChild(toggleBtn);

    row.appendChild(actions);
    container.appendChild(row);
  });
}

function openCategoryModal(category = null) {
  document.getElementById("category-modal").classList.remove("hidden");
  if (category) {
    setTextSafe("category-modal-title", "แก้ไขหมวดหมู่");
    document.getElementById("category-id-input").value = category.id;
    document.getElementById("category-name-input").value = category.name;
    document.getElementById("category-order-input").value = category.order ?? 0;
  } else {
    setTextSafe("category-modal-title", "เพิ่มหมวดหมู่");
    document.getElementById("category-id-input").value = "";
    document.getElementById("category-name-input").value = "";
    document.getElementById("category-order-input").value = categoriesData.length;
  }
}

function confirmToggleCategory(category) {
  const action = category.isActive === false ? "เปิดใช้งาน" : "ปิดใช้งาน";
  showConfirmModal(
    `คุณกำลังจะ${action}หมวดหมู่ "${category.name}" ยืนยันหรือไม่? (คำถามที่อยู่ในหมวดนี้จะไม่ถูกลบ แต่จะไม่แสดงในตัวเลือกสำหรับผู้ใช้)`,
    async () => {
      try {
        const { error } = await sb
          .from("categories")
          .update({ is_active: !(category.isActive !== false) })
          .eq("id", category.id);
        if (error) throw error;
        await loadCategories();
      } catch (err) {
        showToast("เกิดข้อผิดพลาด: " + err.message);
      }
    }
  );
}

// ----- ปีข้อสอบ -----

async function loadYears() {
  const container = document.getElementById("year-list");
  try {
    const { data, error } = await sb.from("exam_years").select("*").order("year", { ascending: false });
    if (error) throw error;
    yearsData = (data || []).map((y) => ({ id: y.id, label: y.label, year: y.year, isActive: y.is_active }));
    renderYearList();
  } catch (err) {
    console.error("โหลดปีข้อสอบไม่สำเร็จ:", err);
    container.innerHTML = `<p style="color:#f87171;font-size:0.875rem;">โหลดข้อมูลไม่สำเร็จ</p>`;
  }
}

function renderYearList() {
  const container = document.getElementById("year-list");
  container.innerHTML = "";

  if (yearsData.length === 0) {
    container.innerHTML = `<p class="text-muted text-sm">ยังไม่มีปีข้อสอบ กดปุ่ม "+ เพิ่ม" เพื่อสร้างใหม่</p>`;
    return;
  }

  yearsData.forEach((yr) => {
    const row = document.createElement("div");
    row.className = "flex justify-between items-center";
    row.style.cssText = "padding:0.75rem 1rem;border:1px solid var(--border-subtle);border-radius:var(--radius-sm);" + (yr.isActive === false ? "opacity:0.5;" : "");

    const left = document.createElement("div");
    const label = document.createElement("p");
    label.style.cssText = "font-weight:600;color:var(--text-primary);";
    label.textContent = yr.label;
    left.appendChild(label);

    const yearNum = document.createElement("p");
    yearNum.className = "text-xs text-muted";
    yearNum.textContent = `ปี: ${yr.year}`;
    left.appendChild(yearNum);

    row.appendChild(left);

    const actions = document.createElement("div");
    actions.className = "flex gap-2";

    const editBtn = document.createElement("button");
    editBtn.style.cssText = "background:none;border:none;color:var(--gold-400);cursor:pointer;font-size:0.85rem;font-family:var(--font-body);padding:0;";
    editBtn.textContent = "แก้ไข";
    editBtn.addEventListener("click", () => openYearModal(yr));
    actions.appendChild(editBtn);

    const toggleBtn = document.createElement("button");
    toggleBtn.style.cssText = `background:none;border:none;cursor:pointer;font-size:0.85rem;font-family:var(--font-body);padding:0;color:${yr.isActive === false ? "#4ade80" : "#f87171"};`;
    toggleBtn.textContent = yr.isActive === false ? "เปิดใช้" : "ปิดใช้";
    toggleBtn.addEventListener("click", () => confirmToggleYear(yr));
    actions.appendChild(toggleBtn);

    row.appendChild(actions);
    container.appendChild(row);
  });
}

function openYearModal(year = null) {
  document.getElementById("year-modal").classList.remove("hidden");
  if (year) {
    setTextSafe("year-modal-title", "แก้ไขปีข้อสอบ");
    document.getElementById("year-id-input").value = year.id;
    document.getElementById("year-label-input").value = year.label;
    document.getElementById("year-number-input").value = year.year;
  } else {
    setTextSafe("year-modal-title", "เพิ่มปีข้อสอบ");
    document.getElementById("year-id-input").value = "";
    document.getElementById("year-label-input").value = "";
    document.getElementById("year-number-input").value = "";
  }
}

function confirmToggleYear(year) {
  const action = year.isActive === false ? "เปิดใช้งาน" : "ปิดใช้งาน";
  showConfirmModal(
    `คุณกำลังจะ${action}ปีข้อสอบ "${year.label}" ยืนยันหรือไม่?`,
    async () => {
      try {
        const { error } = await sb
          .from("exam_years")
          .update({ is_active: !(year.isActive !== false) })
          .eq("id", year.id);
        if (error) throw error;
        await loadYears();
      } catch (err) {
        showToast("เกิดข้อผิดพลาด: " + err.message);
      }
    }
  );
}

// ----- bind events -----

function bindEvents() {
  document.getElementById("add-category-btn").addEventListener("click", () => openCategoryModal());
  document.getElementById("category-modal-cancel").addEventListener("click", () => {
    document.getElementById("category-modal").classList.add("hidden");
  });
  document.getElementById("category-modal-save").addEventListener("click", saveCategory);

  document.getElementById("add-year-btn").addEventListener("click", () => openYearModal());
  document.getElementById("year-modal-cancel").addEventListener("click", () => {
    document.getElementById("year-modal").classList.add("hidden");
  });
  document.getElementById("year-modal-save").addEventListener("click", saveYear);
}

async function saveCategory() {
  const id = document.getElementById("category-id-input").value;
  const name = document.getElementById("category-name-input").value.trim();
  const order = parseInt(document.getElementById("category-order-input").value, 10) || 0;

  if (!isValidLength(name, 100)) {
    showToast("กรุณากรอกชื่อหมวดหมู่");
    return;
  }

  try {
    if (id) {
      const { error } = await sb.from("categories").update({ name, sort_order: order }).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await sb.from("categories").insert({ name, sort_order: order, is_active: true });
      if (error) throw error;
    }
    document.getElementById("category-modal").classList.add("hidden");
    await loadCategories();
  } catch (err) {
    showToast("เกิดข้อผิดพลาด: " + err.message);
  }
}

async function saveYear() {
  const id = document.getElementById("year-id-input").value;
  const label = document.getElementById("year-label-input").value.trim();
  const year = parseInt(document.getElementById("year-number-input").value, 10);

  if (!isValidLength(label, 50)) {
    showToast("กรุณากรอกป้ายชื่อปีข้อสอบ");
    return;
  }
  if (!year || isNaN(year)) {
    showToast("กรุณากรอกปี พ.ศ. เป็นตัวเลข");
    return;
  }

  try {
    if (id) {
      const { error } = await sb.from("exam_years").update({ label, year }).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await sb.from("exam_years").insert({
        label,
        year,
        is_active: true,
        created_at: new Date().toISOString()
      });
      if (error) throw error;
    }
    document.getElementById("year-modal").classList.add("hidden");
    await loadYears();
  } catch (err) {
    showToast("เกิดข้อผิดพลาด: " + err.message);
  }
}
