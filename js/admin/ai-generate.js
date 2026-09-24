// js/admin/ai-generate.js
// สร้างข้อสอบด้วย AI: ร่างก่อนบันทึกจริง — admin ต้องตรวจ/แก้ไข/ยืนยันก่อนเขียนลงคลัง

let aiCategoriesCache = [];
let aiYearsCache = [];
let draftQuestions = []; // { questionText, options, correctAnswerIndex, explanation, _selected }
let aiKeysCache = { claudeApiKey: null, geminiApiKey: null };
let currentAdminUidForAI = null;

(async function init() {
  try {
    const { user, userData } = await requireAdmin();
    currentAdminUidForAI = user.id;
    renderAdminLayout("ai-generate", userData);
    await loadCategoriesAndYearsForAI();
    await loadAiKeys();
    bindAiEvents();
  } catch (err) {
    console.error("เข้าถึงหน้าสร้างข้อสอบด้วย AI ไม่สำเร็จ:", err);
  }
})();

async function loadCategoriesAndYearsForAI() {
  const [catRes, yearRes] = await Promise.all([
    sb.from("categories").select("id, name").eq("is_active", true).order("sort_order", { ascending: true }),
    sb.from("exam_years").select("id, label").eq("is_active", true).order("year", { ascending: false })
  ]);

  if (catRes.error) throw catRes.error;
  if (yearRes.error) throw yearRes.error;

  aiCategoriesCache = catRes.data || [];
  aiYearsCache = yearRes.data || [];

  const catSelect = document.getElementById("ai-category-select");
  catSelect.innerHTML = "";
  aiCategoriesCache.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    catSelect.appendChild(opt);
  });

  const yearSelect = document.getElementById("ai-year-select");
  aiYearsCache.forEach((y) => {
    const opt = document.createElement("option");
    opt.value = y.id;
    opt.textContent = y.label;
    yearSelect.appendChild(opt);
  });
}

async function loadAiKeys() {
  try {
    const { data, error } = await sb
      .from("system_config")
      .select("claude_api_key, gemini_api_key")
      .eq("key", "secrets")
      .single();

    if (error) throw error;
    aiKeysCache = {
      claudeApiKey: data?.claude_api_key || null,
      geminiApiKey: data?.gemini_api_key || null
    };
  } catch (err) {
    console.error("โหลด AI keys ไม่สำเร็จ:", err);
  }
}

function bindAiEvents() {
  document.getElementById("generate-draft-btn").addEventListener("click", handleGenerateDrafts);
  document.getElementById("discard-all-btn").addEventListener("click", handleDiscardAll);
  document.getElementById("save-all-drafts-btn").addEventListener("click", handleSaveAllDrafts);
  document.getElementById("edit-draft-cancel").addEventListener("click", () => {
    document.getElementById("edit-draft-modal").classList.add("hidden");
  });
  document.getElementById("edit-draft-save").addEventListener("click", handleSaveDraftEdit);
}

function showAiConfigError(message) {
  const el = document.getElementById("ai-config-error");
  el.textContent = message;
  el.classList.remove("hidden");
}

function hideAiConfigError() {
  document.getElementById("ai-config-error").classList.add("hidden");
}

// ----- ร่างข้อสอบด้วย AI -----

async function handleGenerateDrafts() {
  hideAiConfigError();

  const provider = document.getElementById("ai-provider-select").value;
  const numQuestions = parseInt(document.getElementById("ai-num-questions").value, 10);
  const categoryId = document.getElementById("ai-category-select").value;
  const examYearId = document.getElementById("ai-year-select").value;
  const difficulty = document.getElementById("ai-difficulty-select").value;
  const extraInstructions = document.getElementById("ai-extra-instructions").value.trim();

  if (!categoryId) {
    return showAiConfigError("กรุณาเลือกหมวดหมู่");
  }
  if (!numQuestions || numQuestions < 1 || numQuestions > 20) {
    return showAiConfigError("จำนวนข้อต้องอยู่ระหว่าง 1-20 ข้อต่อรอบ");
  }

  const apiKey = provider === "claude" ? aiKeysCache.claudeApiKey : aiKeysCache.geminiApiKey;
  if (!apiKey) {
    return showAiConfigError(
      `ยังไม่ได้ตั้งค่า ${provider === "claude" ? "Claude" : "Gemini"} API Key กรุณาไปที่หน้า "ตั้งค่าระบบ" ก่อน`
    );
  }

  const categoryName = aiCategoriesCache.find((c) => c.id === categoryId)?.name || "";
  const yearLabel = aiYearsCache.find((y) => y.id === examYearId)?.label || "";

  const prompt = buildGenerationPrompt({
    categoryName,
    yearLabel,
    numQuestions,
    difficulty,
    extraInstructions
  });

  document.getElementById("generate-form-section").classList.add("hidden");
  document.getElementById("generating-indicator").classList.remove("hidden");
  document.getElementById("drafts-section").classList.add("hidden");

  try {
    const rawQuestions = provider === "claude"
      ? await callClaudeForQuestions(apiKey, prompt)
      : await callGeminiForQuestions(apiKey, prompt);

    draftQuestions = sanitizeDraftQuestions(rawQuestions, categoryId, examYearId, difficulty);

    renderDraftsList();
    document.getElementById("drafts-section").classList.remove("hidden");
  } catch (err) {
    console.error("สร้างข้อสอบด้วย AI ไม่สำเร็จ:", err);
    showAiConfigError("เกิดข้อผิดพลาด: " + err.message);
    document.getElementById("generate-form-section").classList.remove("hidden");
  } finally {
    document.getElementById("generating-indicator").classList.add("hidden");
  }
}

function buildGenerationPrompt({ categoryName, yearLabel, numQuestions, difficulty, extraInstructions }) {
  const difficultyTh = { easy: "ง่าย", medium: "ปานกลาง", hard: "ยาก" }[difficulty] || "ปานกลาง";
  let prompt = `สร้างคำถามปรนัย 4 ตัวเลือกสำหรับสอบ ก.พ. จำนวน ${numQuestions} ข้อ
หมวดหมู่: ${categoryName}
ระดับความยาก: ${difficultyTh}
${yearLabel ? `อ้างอิงสไตล์ข้อสอบปี: ${yearLabel}` : ""}
${extraInstructions ? `คำแนะนำเพิ่มเติม: ${extraInstructions}` : ""}

ตอบกลับเป็น JSON array เท่านั้น ไม่ต้องมีคำอธิบายอื่นใดนอกเหนือจาก JSON โดยแต่ละข้อมีโครงสร้างดังนี้:
{
  "questionText": "คำถาม",
  "options": ["ตัวเลือก1", "ตัวเลือก2", "ตัวเลือก3", "ตัวเลือก4"],
  "correctAnswerIndex": 0,
  "explanation": "คำอธิบายเฉลยโดยละเอียด"
}`;
  return prompt;
}

// ----- เรียก Claude API -----

async function callClaudeForQuestions(apiKey, prompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errBody.slice(0, 200)}`);
  }

  const result = await response.json();
  const textBlock = result.content.find((c) => c.type === "text");
  if (!textBlock) throw new Error("ไม่พบข้อความตอบกลับจาก Claude");

  return parseJsonFromAiResponse(textBlock.text);
}

// ----- เรียก Gemini API -----

async function callGeminiForQuestions(apiKey, prompt) {
  const schema = {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {
        questionText: { type: "STRING" },
        options: { type: "ARRAY", items: { type: "STRING" } },
        correctAnswerIndex: { type: "NUMBER" },
        explanation: { type: "STRING" }
      }
    }
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema }
      })
    }
  );

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errBody.slice(0, 200)}`);
  }

  const result = await response.json();
  const text = result.candidates[0].content.parts[0].text;
  return parseJsonFromAiResponse(text);
}

function parseJsonFromAiResponse(text) {
  // Claude อาจห่อ JSON ด้วย markdown code fence — ตัดออกก่อน parse
  const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error("รูปแบบข้อมูลที่ AI ส่งกลับไม่ถูกต้อง (ไม่ใช่ array)");
  return parsed;
}

/**
 * ทำความสะอาดและตรวจสอบข้อมูลจาก AI ก่อนเก็บเป็น draft
 * (ป้องกัน prompt injection ที่อาจพยายามใส่ HTML/script เข้ามาในผลลัพธ์)
 */
function sanitizeDraftQuestions(rawQuestions, categoryId, examYearId, difficulty) {
  return rawQuestions
    .filter((q) => q && typeof q.questionText === "string" && Array.isArray(q.options) && q.options.length === 4)
    .map((q) => ({
      categoryId,
      examYearId: examYearId || null,
      questionText: String(q.questionText).slice(0, 2000),
      tableData: null, // AI generation เวอร์ชันนี้ยังไม่รองรับสร้างตารางอัตโนมัติ — admin เพิ่มเองได้ตอนแก้ไข
      options: q.options.map((o) => String(o).slice(0, 500)),
      correctAnswerIndex: Number.isInteger(q.correctAnswerIndex) ? q.correctAnswerIndex : 0,
      explanation: String(q.explanation || "").slice(0, 2000),
      difficulty,
      _selected: true // ค่าเริ่มต้น: เลือกบันทึกทุกข้อ admin ค่อยลดทีหลัง
    }));
}

// ----- แสดงรายการ draft -----

function renderDraftsList() {
  const container = document.getElementById("drafts-list");
  container.innerHTML = "";
  setTextSafe("draft-count", String(draftQuestions.length));

  draftQuestions.forEach((draft, idx) => {
    container.appendChild(buildDraftCard(draft, idx));
  });
}

function buildDraftCard(draft, idx) {
  const card = document.createElement("div");
  card.className = "card";
  card.style.cssText = "padding:1.25rem;border-left:3px solid " + (draft._selected ? "var(--gold-500)" : "var(--border-subtle)") + ";" + (draft._selected ? "" : "opacity:0.55;");

  const topRow = document.createElement("div");
  topRow.className = "flex justify-between items-start gap-2 mb-2";

  const badge = document.createElement("span");
  badge.className = "badge badge-ai";
  badge.textContent = "🤖 AI ร่าง";
  topRow.appendChild(badge);

  const checkboxLabel = document.createElement("label");
  checkboxLabel.className = "checkbox-label";
  checkboxLabel.style.fontSize = "0.85rem";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = draft._selected;
  checkbox.addEventListener("change", () => {
    draft._selected = checkbox.checked;
    renderDraftsList();
  });
  checkboxLabel.appendChild(checkbox);
  checkboxLabel.appendChild(document.createTextNode("ใช้ข้อนี้"));
  topRow.appendChild(checkboxLabel);

  card.appendChild(topRow);

  // คำถาม — ใช้ textContent เสมอ (กัน XSS จากเนื้อหาที่ AI ร่างมา)
  const qText = document.createElement("p");
  qText.style.cssText = "font-weight:600;color:var(--text-primary);margin-bottom:0.6rem;";
  qText.textContent = draft.questionText;
  card.appendChild(qText);

  // ตัวเลือก
  const optList = document.createElement("ul");
  optList.style.cssText = "font-size:0.9rem;color:var(--text-secondary);margin-bottom:0.6rem;list-style:none;display:flex;flex-direction:column;gap:0.3rem;";
  draft.options.forEach((opt, optIdx) => {
    const li = document.createElement("li");
    li.style.color = optIdx === draft.correctAnswerIndex ? "#4ade80" : "";
    li.style.fontWeight = optIdx === draft.correctAnswerIndex ? "600" : "400";
    li.textContent = `${optIdx + 1}. ${opt}` + (optIdx === draft.correctAnswerIndex ? " ✓" : "");
    optList.appendChild(li);
  });
  card.appendChild(optList);

  // คำอธิบาย
  const explanation = document.createElement("p");
  explanation.style.cssText = "font-size:0.85rem;color:var(--text-muted);border-top:1px solid var(--border-subtle);padding-top:0.6rem;";
  explanation.textContent = "คำอธิบาย: " + draft.explanation;
  card.appendChild(explanation);

  // ปุ่ม
  const btnRow = document.createElement("div");
  btnRow.className = "flex gap-2 mt-2";

  const editBtn = document.createElement("button");
  editBtn.style.cssText = "background:none;border:none;color:var(--gold-400);cursor:pointer;font-size:0.85rem;font-family:var(--font-body);padding:0;";
  editBtn.textContent = "✏️ แก้ไข";
  editBtn.addEventListener("click", () => openEditDraftModal(idx));
  btnRow.appendChild(editBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.style.cssText = "background:none;border:none;color:#f87171;cursor:pointer;font-size:0.85rem;font-family:var(--font-body);padding:0;";
  deleteBtn.textContent = "🗑️ ลบทิ้ง";
  deleteBtn.addEventListener("click", () => {
    draftQuestions.splice(idx, 1);
    renderDraftsList();
  });
  btnRow.appendChild(deleteBtn);

  card.appendChild(btnRow);

  return card;
}

// ----- แก้ไข draft -----

function openEditDraftModal(idx) {
  const draft = draftQuestions[idx];
  document.getElementById("edit-draft-index").value = idx;
  document.getElementById("edit-draft-question").value = draft.questionText;
  document.getElementById("edit-draft-explanation").value = draft.explanation;

  const optionsContainer = document.getElementById("edit-draft-options");
  optionsContainer.innerHTML = "";
  draft.options.forEach((opt, optIdx) => {
    const row = document.createElement("div");
    row.className = "flex items-center gap-2 mb-2";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "edit-correct-option";
    radio.value = String(optIdx);
    radio.checked = optIdx === draft.correctAnswerIndex;
    radio.style.cssText = "width:18px;height:18px;accent-color:var(--gold-500);cursor:pointer;flex-shrink:0;";

    const input = document.createElement("input");
    input.type = "text";
    input.value = opt;
    input.maxLength = 500;
    input.className = "edit-option-input form-input";
    input.style.flex = "1";
    input.dataset.index = String(optIdx);

    row.appendChild(radio);
    row.appendChild(input);
    optionsContainer.appendChild(row);
  });

  document.getElementById("edit-draft-modal").classList.remove("hidden");
}

function handleSaveDraftEdit() {
  const idx = parseInt(document.getElementById("edit-draft-index").value, 10);
  const draft = draftQuestions[idx];

  draft.questionText = document.getElementById("edit-draft-question").value.trim().slice(0, 2000);
  draft.explanation = document.getElementById("edit-draft-explanation").value.trim().slice(0, 2000);

  const optionInputs = Array.from(document.querySelectorAll(".edit-option-input"));
  draft.options = optionInputs.map((inp) => inp.value.trim().slice(0, 500));

  const correctRadio = document.querySelector('input[name="edit-correct-option"]:checked');
  draft.correctAnswerIndex = correctRadio ? parseInt(correctRadio.value, 10) : 0;

  document.getElementById("edit-draft-modal").classList.add("hidden");
  renderDraftsList();
}

// ----- ยกเลิกทั้งหมด -----

function handleDiscardAll() {
  showConfirmModal("คุณกำลังจะยกเลิกร่างข้อสอบทั้งหมดที่ยังไม่บันทึก ยืนยันหรือไม่?", () => {
    draftQuestions = [];
    document.getElementById("drafts-section").classList.add("hidden");
    document.getElementById("generate-form-section").classList.remove("hidden");
  });
}

// ----- บันทึกข้อที่เลือกลงคลังจริง -----

function handleSaveAllDrafts() {
  const selected = draftQuestions.filter((d) => d._selected);
  if (selected.length === 0) {
    showToast("กรุณาเลือกข้อที่ต้องการบันทึกอย่างน้อย 1 ข้อ");
    return;
  }

  showConfirmModal(
    `คุณกำลังจะบันทึกคำถาม ${selected.length} ข้อเข้าคลังคำถามจริง การกระทำนี้จะทำให้ข้อเหล่านี้พร้อมใช้งานทันที ยืนยันหรือไม่?`,
    async () => {
      const saveBtn = document.getElementById("save-all-drafts-btn");
      saveBtn.disabled = true;
      saveBtn.textContent = "กำลังบันทึก...";

      try {
        const rows = selected.map((draft) => ({
          category_id: draft.categoryId,
          exam_year_id: draft.examYearId,
          question_text: draft.questionText,
          table_data: draft.tableData,
          options: draft.options,
          correct_answer_index: draft.correctAnswerIndex,
          explanation: draft.explanation,
          difficulty: draft.difficulty,
          is_active: true,
          source: "ai_generated",
          created_by: currentAdminUidForAI,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        const { error } = await sb.from("questions").insert(rows);
        if (error) throw error;

        // เอาข้อที่บันทึกแล้วออกจาก draft list เหลือไว้แต่ข้อที่ยังไม่เลือก
        draftQuestions = draftQuestions.filter((d) => !d._selected);
        renderDraftsList();

        if (draftQuestions.length === 0) {
          document.getElementById("drafts-section").classList.add("hidden");
          document.getElementById("generate-form-section").classList.remove("hidden");
        }

        showToast(`บันทึกคำถาม ${selected.length} ข้อเข้าคลังเรียบร้อยแล้ว`);
      } catch (err) {
        showToast("เกิดข้อผิดพลาด: " + err.message);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "💾 บันทึกข้อที่เลือกลงคลัง";
      }
    }
  );
}
