// js/admin/questions.js

let allQuestionsCache = [];
let categoriesCache = [];
let examYearsCache = [];
let tableHeaders = [];
let tableRows = [];

(async function init() {
  try {
    const { userData } = await requireAdmin();
    renderAdminLayout("questions", userData);

    await loadCategoriesAndYears();
    await loadQuestionsList();
    setupOptionsBuilder();
    bindEvents();

    // ถ้ามาจากทางลัด "+ เพิ่มคำถามใหม่" ใน dashboard
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "new") {
      openForm();
    }
  } catch (err) {
    console.error("เข้าถึงหน้าจัดการคำถามไม่สำเร็จ:", err);
  }
})();

// ----- โหลดหมวดหมู่และปี (ใช้ทั้ง filter และฟอร์ม) -----

async function loadCategoriesAndYears() {
  const [catRes, yearRes] = await Promise.all([
    sb.from("categories").select("*").order("sort_order", { ascending: true }),
    sb.from("exam_years").select("*").order("year", { ascending: false })
  ]);

  if (catRes.error) throw catRes.error;
  if (yearRes.error) throw yearRes.error;

  categoriesCache = (catRes.data || []).map((c) => ({
    id: c.id, name: c.name, order: c.sort_order, isActive: c.is_active
  }));
  examYearsCache = (yearRes.data || []).map((y) => ({
    id: y.id, label: y.label, year: y.year, isActive: y.is_active
  }));

  fillSelectOptions("filter-category", categoriesCache, "ทุกหมวดหมู่");
  fillSelectOptions("filter-year", examYearsCache, "ทุกปี", "label");
  fillSelectOptions("form-category", categoriesCache, null);
  fillSelectOptions("form-year", examYearsCache, "ไม่ระบุปี", "label");
}

function fillSelectOptions(selectId, items, placeholderText, labelField = "name") {
  const select = document.getElementById(selectId);
  const keepFirst = placeholderText !== null;
  select.innerHTML = keepFirst ? `<option value="">${escapeHtml(placeholderText)}</option>` : "";
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item[labelField]; // textContent ปลอดภัยจาก XSS
    select.appendChild(option);
  });
}

// ----- รายการคำถาม -----

async function loadQuestionsList() {
  const tbody = document.getElementById("questions-table-body");
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem;">กำลังโหลด...</td></tr>`;

  try {
    const { data, error } = await sb
      .from("questions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;
    allQuestionsCache = (data || []).map(mapQuestionRow);
    renderQuestionsTable();
  } catch (err) {
    console.error("โหลดคำถามไม่สำเร็จ:", err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#f87171;padding:2rem;">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
  }
}

function renderQuestionsTable() {
  const tbody = document.getElementById("questions-table-body");
  const searchTerm = document.getElementById("search-input").value.trim().toLowerCase();
  const filterCategory = document.getElementById("filter-category").value;
  const filterYear = document.getElementById("filter-year").value;
  const filterSource = document.getElementById("filter-source").value;

  const filtered = allQuestionsCache.filter((q) => {
    if (filterCategory && q.categoryId !== filterCategory) return false;
    if (filterYear && q.examYearId !== filterYear) return false;
    if (filterSource && q.source !== filterSource) return false;
    if (searchTerm && !(q.questionText || "").toLowerCase().includes(searchTerm)) return false;
    return true;
  });

  tbody.innerHTML = "";

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem;">ไม่พบคำถามที่ตรงกับเงื่อนไข</td></tr>`;
    document.getElementById("pagination-info").textContent = "";
    return;
  }

  filtered.forEach((q) => {
    tbody.appendChild(buildQuestionRow(q));
  });

  document.getElementById("pagination-info").textContent = `แสดง ${filtered.length} จาก ${allQuestionsCache.length} ข้อ`;
}

function buildQuestionRow(q) {
  const tr = document.createElement("tr");
  if (!q.isActive) tr.style.opacity = "0.5";

  // คอลัมน์คำถาม
  const tdQuestion = document.createElement("td");
  tdQuestion.style.maxWidth = "320px";
  const qText = document.createElement("p");
  qText.textContent = q.questionText; // textContent ป้องกัน XSS
  qText.style.cssText = "overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;color:var(--text-primary);";
  tdQuestion.appendChild(qText);
  tr.appendChild(tdQuestion);

  // คอลัมน์หมวดหมู่
  const tdCategory = document.createElement("td");
  const category = categoriesCache.find((c) => c.id === q.categoryId);
  tdCategory.textContent = category ? category.name : "-";
  tr.appendChild(tdCategory);

  // คอลัมน์ปี
  const tdYear = document.createElement("td");
  const year = examYearsCache.find((y) => y.id === q.examYearId);
  tdYear.textContent = year ? year.label : "-";
  tr.appendChild(tdYear);

  // คอลัมน์ที่มา
  const tdSource = document.createElement("td");
  const badge = document.createElement("span");
  badge.className = q.source === "ai_generated" ? "badge badge-ai" : "badge badge-manual";
  badge.textContent = q.source === "ai_generated" ? "🤖 AI" : "✍️ เขียนเอง";
  tdSource.appendChild(badge);
  tr.appendChild(tdSource);

  // คอลัมน์สถานะ
  const tdStatus = document.createElement("td");
  tdStatus.textContent = q.isActive ? "ใช้งาน" : "ถูกลบ (soft-delete)";
  tdStatus.style.color = q.isActive ? "#4ade80" : "var(--text-muted)";
  tr.appendChild(tdStatus);

  // คอลัมน์ปุ่ม
  const tdActions = document.createElement("td");
  tdActions.style.whiteSpace = "nowrap";

  const editBtn = document.createElement("button");
  editBtn.className = "btn-sm";
  editBtn.style.cssText = "background:none;border:none;color:var(--gold-400);cursor:pointer;margin-right:0.75rem;font-size:0.85rem;font-family:var(--font-body);padding:0;";
  editBtn.textContent = "แก้ไข";
  editBtn.addEventListener("click", () => openForm(q));
  tdActions.appendChild(editBtn);

  const toggleBtn = document.createElement("button");
  toggleBtn.style.cssText = `background:none;border:none;cursor:pointer;font-size:0.85rem;font-family:var(--font-body);padding:0;color:${q.isActive ? "#f87171" : "#4ade80"};`;
  toggleBtn.textContent = q.isActive ? "ลบ" : "กู้คืน";
  toggleBtn.addEventListener("click", () => confirmToggleActive(q));
  tdActions.appendChild(toggleBtn);

  tr.appendChild(tdActions);

  return tr;
}

function confirmToggleActive(q) {
  const action = q.isActive ? "ลบ" : "กู้คืน";
  const preview = q.questionText.length > 60 ? q.questionText.slice(0, 60) + "..." : q.questionText;
  showConfirmModal(
    `คุณกำลังจะ${action}คำถาม: "${preview}" ยืนยันหรือไม่?`,
    async () => {
      try {
        const { error } = await sb
          .from("questions")
          .update({ is_active: !q.isActive, updated_at: new Date().toISOString() })
          .eq("id", q.id);

        if (error) throw error;
        await loadQuestionsList();
      } catch (err) {
        showToast("เกิดข้อผิดพลาด: " + err.message);
      }
    }
  );
}

// ----- ฟิลเตอร์/ค้นหา -----

document.getElementById("search-input").addEventListener("input", renderQuestionsTable);
document.getElementById("filter-category").addEventListener("change", renderQuestionsTable);
document.getElementById("filter-year").addEventListener("change", renderQuestionsTable);
document.getElementById("filter-source").addEventListener("change", renderQuestionsTable);

// ----- สลับ view ระหว่าง list และ form -----

function bindEvents() {
  document.getElementById("new-question-btn").addEventListener("click", () => openForm());
  document.getElementById("back-to-list-btn").addEventListener("click", closeForm);
  document.getElementById("cancel-form-btn").addEventListener("click", closeForm);
  document.getElementById("enable-table-checkbox").addEventListener("change", toggleTableBuilder);
  document.getElementById("add-column-btn").addEventListener("click", addTableColumn);
  document.getElementById("add-row-btn").addEventListener("click", addTableRow);
  document.getElementById("question-form").addEventListener("submit", handleFormSubmit);
}

function openForm(question = null) {
  document.getElementById("view-list").classList.add("hidden");
  document.getElementById("view-form").classList.remove("hidden");
  document.getElementById("form-error").classList.add("hidden");

  if (question) {
    setTextSafe("form-title", "แก้ไขคำถาม");
    document.getElementById("question-id-input").value = question.id;
    document.getElementById("form-category").value = question.categoryId || "";
    document.getElementById("form-year").value = question.examYearId || "";
    document.getElementById("form-question-text").value = question.questionText || "";
    document.getElementById("form-explanation").value = question.explanation || "";
    document.getElementById("form-difficulty").value = question.difficulty || "medium";

    fillOptionsBuilder(question.options || ["", "", "", ""], question.correctAnswerIndex ?? 0);

    if (question.tableData && question.tableData.headers && question.tableData.headers.length > 0) {
      document.getElementById("enable-table-checkbox").checked = true;
      tableHeaders = question.tableData.headers.slice();
      tableRows = question.tableData.rows.map((r) => r.slice());
      document.getElementById("table-builder").classList.remove("hidden");
      renderTableGrid();
    } else {
      document.getElementById("enable-table-checkbox").checked = false;
      document.getElementById("table-builder").classList.add("hidden");
      resetTableBuilderState();
    }
  } else {
    setTextSafe("form-title", "เพิ่มคำถามใหม่");
    document.getElementById("question-form").reset();
    document.getElementById("question-id-input").value = "";
    fillOptionsBuilder(["", "", "", ""], 0);
    document.getElementById("table-builder").classList.add("hidden");
    resetTableBuilderState();
  }
}

function closeForm() {
  document.getElementById("view-form").classList.add("hidden");
  document.getElementById("view-list").classList.remove("hidden");
  // ล้าง query param ?action=new ถ้ามี เพื่อไม่ให้เปิดฟอร์มซ้ำตอน refresh
  if (window.history.replaceState) {
    window.history.replaceState(null, "", "questions.html");
  }
}

// ----- ตัวเลือกคำตอบ (4 ข้อ + radio เลือกข้อที่ถูก) -----

function setupOptionsBuilder() {
  fillOptionsBuilder(["", "", "", ""], 0);
}

function fillOptionsBuilder(options, correctIndex) {
  const container = document.getElementById("options-builder");
  container.innerHTML = "";
  const optionLabels = ["ก", "ข", "ค", "ง"];

  options.forEach((optionText, idx) => {
    const row = document.createElement("div");
    row.className = "flex items-center gap-2 mb-2";

    const radioWrap = document.createElement("label");
    radioWrap.style.cssText = "display:flex;align-items:center;gap:0.4rem;cursor:pointer;flex-shrink:0;color:var(--text-secondary);font-size:0.85rem;font-weight:600;";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "correct-option";
    radio.value = String(idx);
    radio.checked = idx === correctIndex;
    radio.style.cssText = "width:18px;height:18px;accent-color:var(--gold-500);cursor:pointer;";

    radioWrap.appendChild(radio);
    radioWrap.appendChild(document.createTextNode(optionLabels[idx] || String(idx + 1)));

    const input = document.createElement("input");
    input.type = "text";
    input.required = true;
    input.maxLength = 500;
    input.value = optionText;
    input.placeholder = `ตัวเลือกที่ ${idx + 1}`;
    input.className = "option-input form-input";
    input.style.flex = "1";
    input.dataset.index = String(idx);

    row.appendChild(radioWrap);
    row.appendChild(input);
    container.appendChild(row);
  });
}

// ----- Table Builder (ตารางข้อมูลประกอบคำถาม) -----

function toggleTableBuilder() {
  const enabled = document.getElementById("enable-table-checkbox").checked;
  const builder = document.getElementById("table-builder");
  if (enabled) {
    builder.classList.remove("hidden");
    if (tableHeaders.length === 0) {
      tableHeaders = ["คอลัมน์ 1", "คอลัมน์ 2"];
      tableRows = [["", ""]];
      renderTableGrid();
    }
  } else {
    builder.classList.add("hidden");
  }
}

function resetTableBuilderState() {
  tableHeaders = [];
  tableRows = [];
  document.getElementById("table-grid-container").innerHTML = "";
}

function addTableColumn() {
  tableHeaders.push(`คอลัมน์ ${tableHeaders.length + 1}`);
  tableRows = tableRows.map((row) => [...row, ""]);
  renderTableGrid();
}

function addTableRow() {
  tableRows.push(new Array(tableHeaders.length).fill(""));
  renderTableGrid();
}

function removeTableColumn(colIndex) {
  if (tableHeaders.length <= 1) return;
  tableHeaders.splice(colIndex, 1);
  tableRows = tableRows.map((row) => {
    row.splice(colIndex, 1);
    return row;
  });
  renderTableGrid();
}

function removeTableRow(rowIndex) {
  if (tableRows.length <= 1) return;
  tableRows.splice(rowIndex, 1);
  renderTableGrid();
}

function renderTableGrid() {
  const container = document.getElementById("table-grid-container");
  container.innerHTML = "";

  const cellInputStyle = "padding:0.35rem 0.5rem;background:rgba(255,255,255,0.04);border:1px solid var(--border-subtle);border-radius:6px;font-size:0.85rem;width:100%;color:var(--text-primary);font-family:var(--font-body);";
  const removeBtnStyle = "background:none;border:none;color:#f87171;font-size:0.75rem;cursor:pointer;padding:0 0.25rem;";

  const table = document.createElement("table");
  table.className = "question-table";

  // หัวตาราง — แต่ละ header เป็น input แก้ไขได้ + ปุ่มลบคอลัมน์
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  tableHeaders.forEach((headerText, colIdx) => {
    const th = document.createElement("th");
    const wrapper = document.createElement("div");
    wrapper.className = "flex items-center gap-1";

    const input = document.createElement("input");
    input.type = "text";
    input.value = headerText;
    input.style.cssText = cellInputStyle;
    input.addEventListener("input", (e) => { tableHeaders[colIdx] = e.target.value; });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "✕";
    removeBtn.style.cssText = removeBtnStyle;
    removeBtn.addEventListener("click", () => removeTableColumn(colIdx));

    wrapper.appendChild(input);
    wrapper.appendChild(removeBtn);
    th.appendChild(wrapper);
    headRow.appendChild(th);
  });
  headRow.appendChild(document.createElement("th")); // ช่องว่างสำหรับปุ่มลบแถว
  thead.appendChild(headRow);
  table.appendChild(thead);

  // เนื้อตาราง
  const tbody = document.createElement("tbody");
  tableRows.forEach((row, rowIdx) => {
    const tr = document.createElement("tr");
    row.forEach((cellText, colIdx) => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "text";
      input.value = cellText;
      input.style.cssText = cellInputStyle;
      input.addEventListener("input", (e) => { tableRows[rowIdx][colIdx] = e.target.value; });
      td.appendChild(input);
      tr.appendChild(td);
    });

    const tdRemove = document.createElement("td");
    const removeRowBtn = document.createElement("button");
    removeRowBtn.type = "button";
    removeRowBtn.textContent = "✕ ลบแถว";
    removeRowBtn.style.cssText = removeBtnStyle;
    removeRowBtn.addEventListener("click", () => removeTableRow(rowIdx));
    tdRemove.appendChild(removeRowBtn);
    tr.appendChild(tdRemove);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  container.appendChild(table);
}

// ----- บันทึกฟอร์ม -----

async function handleFormSubmit(e) {
  e.preventDefault();
  const errorBanner = document.getElementById("form-error");
  errorBanner.classList.add("hidden");

  const questionId = document.getElementById("question-id-input").value;
  const categoryId = document.getElementById("form-category").value;
  const examYearId = document.getElementById("form-year").value || null;
  const questionText = document.getElementById("form-question-text").value.trim();
  const explanation = document.getElementById("form-explanation").value.trim();
  const difficulty = document.getElementById("form-difficulty").value;

  const optionInputs = Array.from(document.querySelectorAll(".option-input"));
  const options = optionInputs.map((inp) => inp.value.trim());
  const correctRadio = document.querySelector('input[name="correct-option"]:checked');

  // Validation ฝั่ง client (สอดคล้องกับ Security Rules ฝั่ง server)
  if (!categoryId) {
    return showFormError("กรุณาเลือกหมวดหมู่");
  }
  if (!isValidLength(questionText, 2000)) {
    return showFormError("กรุณากรอกคำถาม (ไม่เกิน 2000 ตัวอักษร)");
  }
  if (options.length !== 4 || options.some((o) => !o)) {
    return showFormError("กรุณากรอกตัวเลือกให้ครบทั้ง 4 ข้อ");
  }
  if (!correctRadio) {
    return showFormError("กรุณาเลือกตัวเลือกที่ถูกต้อง");
  }
  if (!isValidLength(explanation, 2000)) {
    return showFormError("กรุณากรอกคำอธิบายเฉลย");
  }

  let tableData = null;
  if (document.getElementById("enable-table-checkbox").checked) {
    const cleanHeaders = tableHeaders.map((h) => h.trim());
    const cleanRows = tableRows.map((row) => row.map((c) => c.trim()));
    if (cleanHeaders.some((h) => !h)) {
      return showFormError("กรุณากรอกหัวตารางให้ครบทุกคอลัมน์ หรือไม่ติ๊กใช้งานตาราง");
    }
    tableData = { headers: cleanHeaders, rows: cleanRows };
  }

  const payload = {
    category_id: categoryId,
    exam_year_id: examYearId,
    question_text: questionText,
    table_data: tableData,
    options,
    correct_answer_index: parseInt(correctRadio.value, 10),
    explanation,
    difficulty,
    is_active: true,
    updated_at: new Date().toISOString()
  };

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "กำลังบันทึก...";

  try {
    if (questionId) {
      const { error } = await sb.from("questions").update(payload).eq("id", questionId);
      if (error) throw error;
    } else {
      const { data: { session } } = await sb.auth.getSession();
      payload.source = "manual";
      payload.created_by = session.user.id;
      payload.created_at = new Date().toISOString();

      const { error } = await sb.from("questions").insert(payload);
      if (error) throw error;
    }

    await loadQuestionsList();
    closeForm();
  } catch (err) {
    showFormError("เกิดข้อผิดพลาด: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "บันทึก";
  }
}

function showFormError(message) {
  const banner = document.getElementById("form-error");
  banner.textContent = message;
  banner.classList.remove("hidden");
}
