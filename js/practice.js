// js/practice.js
// Practice Mode — Instant Feedback

// ═══════════════════════════════════════════
// State
// ═══════════════════════════════════════════
let practiceUser = null;
let questions = [];
let currentIndex = 0;
let userAnswer = null;
let isAnswered = false;
let stats = { correct: 0, wrong: 0, skipped: 0 };
let categoryId = null;
let categoryName = '';

const PRACTICE_COUNT = 10;  // จำนวนข้อต่อรอบฝึก

// ═══════════════════════════════════════════
// Init
// ═══════════════════════════════════════════
(async function init() {
  try {
    const { user } = await requireAuth();
    practiceUser = user;

    // อ่าน config จาก sessionStorage (ส่งมาจาก dashboard)
    const configRaw = sessionStorage.getItem("practiceConfig");
    if (!configRaw) {
      window.location.href = "dashboard.html";
      return;
    }
    const config = JSON.parse(configRaw);
    categoryId = config.categoryId;
    categoryName = config.categoryName;

    setTextSafe("practice-category-title", categoryName);

    await loadQuestions();
    bindEvents();
  } catch (err) {
    console.error("[practice] init error:", err);
    showError("เริ่มฝึกไม่สำเร็จ");
  }
})();

// ═══════════════════════════════════════════
// Load questions
// ═══════════════════════════════════════════
async function loadQuestions() {
  try {
    // สุ่มข้อสอบจาก category
    const { data, error } = await sb
      .from("questions")
      .select("id, question_text, options, correct_answer_index, explanation, table_data, difficulty")
      .eq("category_id", categoryId)
      .eq("is_active", true)
      .limit(50);  // โหลด 50 ข้อ → สุ่ม 10

    if (error) throw error;

    if (!data || data.length === 0) {
      showError("หมวดนี้ยังไม่มีข้อสอบ");
      return;
    }

    // สุ่มข้อสอบ 10 ข้อ
    questions = shuffleArray(data).slice(0, PRACTICE_COUNT);

    // แสดงหน้า practice
    document.getElementById("loading-screen").classList.add("hidden");
    document.getElementById("practice-screen").classList.remove("hidden");

    setTextSafe("total-count", String(questions.length));

    renderQuestion();
  } catch (err) {
    console.error("[practice] loadQuestions error:", err);
    showError("โหลดข้อสอบไม่สำเร็จ");
  }
}

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ═══════════════════════════════════════════
// Render question
// ═══════════════════════════════════════════
function renderQuestion() {
  const q = questions[currentIndex];
  if (!q) return finishPractice();

  userAnswer = null;
  isAnswered = false;

  setTextSafe("current-number", String(currentIndex + 1));

  // Progress bar
  const pct = ((currentIndex) / questions.length) * 100;
  document.getElementById("practice-progress-fill").style.width = pct + "%";

  // Context
  renderContext(q.table_data);

  // Question text
  setTextSafe("question-text", q.question_text);

  // Options
  renderOptions(q.options);

  // Reset UI
  document.getElementById("feedback-container").classList.add("hidden");
  document.getElementById("check-btn").disabled = false;
  document.getElementById("check-btn").classList.remove("hidden");
  document.getElementById("skip-btn").style.display = "block";

  // Scroll top
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderOptions(options) {
  const container = document.getElementById("options-container");
  container.innerHTML = "";
  const labels = ["ก", "ข", "ค", "ง"];

  options.forEach((opt, idx) => {
    const div = document.createElement("div");
    div.className = "option-item";
    div.dataset.index = idx;
    div.setAttribute("role", "button");
    div.setAttribute("tabindex", "0");

    const bullet = document.createElement("span");
    bullet.className = "option-bullet";
    bullet.textContent = labels[idx] || String(idx + 1);

    const label = document.createElement("label");
    label.style.cssText = "flex:1;cursor:pointer;font-size:1rem;";
    label.textContent = opt;

    div.appendChild(bullet);
    div.appendChild(label);
    container.appendChild(div);

    div.addEventListener("click", () => selectOption(idx));
    div.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectOption(idx);
      }
    });
  });
}

function selectOption(idx) {
  if (isAnswered) return;  // ตอบแล้ว ไม่ให้เปลี่ยน

  userAnswer = idx;
  document.querySelectorAll(".option-item").forEach((el) => {
    el.classList.toggle("selected", Number(el.dataset.index) === idx);
  });
}

// ═══════════════════════════════════════════
// Check answer — Instant feedback
// ═══════════════════════════════════════════
function checkAnswer() {
  if (userAnswer === null) {
    showToast("กรุณาเลือกคำตอบก่อน", "warning");
    return;
  }
  if (isAnswered) return;

  isAnswered = true;
  const q = questions[currentIndex];
  const isCorrect = userAnswer === q.correct_answer_index;

  // Update stats
  if (isCorrect) stats.correct++;
  else stats.wrong++;

  // Highlight options
  document.querySelectorAll(".option-item").forEach((el) => {
    const idx = Number(el.dataset.index);
    el.style.pointerEvents = "none";
    if (idx === q.correct_answer_index) {
      el.classList.add("correct");
      el.classList.remove("selected");
    } else if (idx === userAnswer) {
      el.classList.add("wrong");
      el.classList.remove("selected");
    }
  });

  // Show feedback
  showFeedback(isCorrect, q);

  // Update buttons
  document.getElementById("check-btn").classList.add("hidden");
  document.getElementById("skip-btn").style.display = "none";
}

function showFeedback(isCorrect, q) {
  const container = document.getElementById("feedback-container");
  container.innerHTML = "";

  // Result box
  const box = document.createElement("div");
  box.style.cssText = `
    padding:1.25rem;
    border-radius:var(--radius-md);
    background:${isCorrect ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)"};
    border:1px solid ${isCorrect ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"};
    margin-top:1.5rem;
  `;

  const title = document.createElement("p");
  title.style.cssText = `font-weight:700;font-size:1.1rem;margin-bottom:0.75rem;color:${isCorrect ? "#4ade80" : "#f87171"};`;
  title.textContent = isCorrect ? "✅ ถูกต้อง!" : "❌ ยังไม่ถูก";
  box.appendChild(title);

  // เฉลย
  if (!isCorrect) {
    const labels = ["ก", "ข", "ค", "ง"];
    const correctP = document.createElement("p");
    correctP.style.cssText = "font-size:0.9rem;margin-bottom:0.5rem;color:#4ade80;";
    correctP.textContent = `เฉลย: ${labels[q.correct_answer_index]}. ${q.options[q.correct_answer_index]}`;
    box.appendChild(correctP);
  }

  // คำอธิบาย
  if (q.explanation) {
    const expLabel = document.createElement("p");
    expLabel.style.cssText = "font-size:0.8rem;color:var(--text-muted);margin-top:0.75rem;margin-bottom:0.25rem;font-weight:600;";
    expLabel.textContent = "📖 คำอธิบาย:";
    box.appendChild(expLabel);

    const exp = document.createElement("p");
    exp.style.cssText = "font-size:0.9rem;line-height:1.6;color:var(--text-secondary);";
    exp.textContent = q.explanation;
    box.appendChild(exp);
  }

  container.appendChild(box);

  // Next button
  const nextBtn = document.createElement("button");
  nextBtn.className = "btn btn-gold btn-full";
  nextBtn.style.marginTop = "1.25rem";
  nextBtn.textContent = (currentIndex === questions.length - 1)
    ? "🎉 ดูสรุปผล"
    : "ข้อต่อไป →";
  nextBtn.addEventListener("click", nextQuestion);

  container.appendChild(nextBtn);

  container.classList.remove("hidden");
}

// ═══════════════════════════════════════════
// Next / Skip
// ═══════════════════════════════════════════
function nextQuestion() {
  currentIndex++;
  if (currentIndex >= questions.length) {
    finishPractice();
  } else {
    renderQuestion();
  }
}

function skipQuestion() {
  // Skip ไม่นับว่า wrong ก็ได้ หรือนับเป็น wrong ก็ได้
  // เลือก: skip ดูเฉลยเลย แต่นับเป็น skipped
  isAnswered = true;
  stats.skipped++;

  const q = questions[currentIndex];

  // Highlight correct answer
  document.querySelectorAll(".option-item").forEach((el) => {
    const idx = Number(el.dataset.index);
    el.style.pointerEvents = "none";
    if (idx === q.correct_answer_index) {
      el.classList.add("correct");
    }
  });

  // Show feedback (แบบ skip)
  const container = document.getElementById("feedback-container");
  container.innerHTML = "";

  const box = document.createElement("div");
  box.style.cssText = `
    padding:1.25rem;
    border-radius:var(--radius-md);
    background:rgba(96,165,250,0.12);
    border:1px solid rgba(96,165,250,0.4);
    margin-top:1.5rem;
  `;

  const title = document.createElement("p");
  title.style.cssText = "font-weight:700;font-size:1.1rem;margin-bottom:0.5rem;color:#60a5fa;";
  title.textContent = "⏭️ ข้ามข้อ";
  box.appendChild(title);

  const labels = ["ก", "ข", "ค", "ง"];
  const exp = document.createElement("p");
  exp.style.cssText = "font-size:0.9rem;color:var(--text-secondary);line-height:1.6;";
  exp.textContent = q.explanation || "ไม่มีคำอธิบาย";
  box.appendChild(exp);

  container.appendChild(box);

  const nextBtn = document.createElement("button");
  nextBtn.className = "btn btn-gold btn-full";
  nextBtn.style.marginTop = "1.25rem";
  nextBtn.textContent = (currentIndex === questions.length - 1) ? "🎉 ดูสรุปผล" : "ข้อต่อไป →";
  nextBtn.addEventListener("click", nextQuestion);
  container.appendChild(nextBtn);

  container.classList.remove("hidden");

  document.getElementById("check-btn").classList.add("hidden");
  document.getElementById("skip-btn").style.display = "none";
}

// ═══════════════════════════════════════════
// Finish
// ═══════════════════════════════════════════
function finishPractice() {
  document.getElementById("practice-screen").classList.add("hidden");
  document.getElementById("summary-screen").classList.remove("hidden");

  const total = stats.correct + stats.wrong + stats.skipped;
  const score = total > 0 ? Math.round((stats.correct / total) * 100) : 0;

  setTextSafe("summary-correct", String(stats.correct));
  setTextSafe("summary-wrong", String(stats.wrong + stats.skipped));
  setTextSafe("summary-score", score + "%");

  // Scroll top
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ═══════════════════════════════════════════
// Context rendering (เหมือน exam.js)
// ═══════════════════════════════════════════
function renderContext(tableData) {
  const container = document.getElementById("context-container");
  container.innerHTML = "";

  if (!tableData) return;

  const ctx = normalizeContext(tableData);

  // Condition
  if (ctx.condition) {
    const block = document.createElement("div");
    block.className = "context-condition";

    const label = document.createElement("span");
    label.className = "context-label";
    label.textContent = "🔷 เงื่อนไข";

    const content = document.createElement("div");
    content.className = "context-condition-content";
    content.textContent = ctx.condition;

    block.appendChild(label);
    block.appendChild(content);
    container.appendChild(block);
  }

  // Passage
  if (ctx.passage) {
    const block = document.createElement("div");
    block.className = "context-passage";

    const header = document.createElement("div");
    header.className = "context-passage-header";

    const label = document.createElement("span");
    label.className = "context-label";
    label.textContent = "📖 บทความ";

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "context-passage-toggle";
    toggleBtn.type = "button";
    toggleBtn.textContent = "▲ ย่อ";
    toggleBtn.addEventListener("click", () => {
      block.classList.toggle("collapsed");
      toggleBtn.textContent = block.classList.contains("collapsed") ? "▼ ขยาย" : "▲ ย่อ";
    });

    header.appendChild(label);
    header.appendChild(toggleBtn);

    const content = document.createElement("div");
    content.className = "context-passage-content";
    content.textContent = ctx.passage;

    block.appendChild(header);
    block.appendChild(content);
    container.appendChild(block);
  }

  // Table
  if (ctx.table && ctx.table.headers) {
    const wrapper = document.createElement("div");
    wrapper.className = "context-table-wrap";

    const label = document.createElement("span");
    label.className = "context-label";
    label.textContent = "📊 ตารางข้อมูล";

    const table = document.createElement("table");
    table.className = "question-table";
    renderTableSafe(table, ctx.table);

    wrapper.appendChild(label);
    wrapper.appendChild(table);
    container.appendChild(wrapper);
  }
}

function normalizeContext(tableData) {
  if (!tableData) return {};
  if (Array.isArray(tableData.headers) && Array.isArray(tableData.rows)) {
    return { table: tableData };
  }
  return tableData;
}

function renderTableSafe(tableEl, tableData) {
  tableEl.innerHTML = "";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  tableData.headers.forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  tableEl.appendChild(thead);

  const tbody = document.createElement("tbody");
  tableData.rows.forEach((row) => {
    const tr = document.createElement("tr");
    row.forEach((cell) => {
      const td = document.createElement("td");
      td.textContent = cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  tableEl.appendChild(tbody);
}

// ═══════════════════════════════════════════
// Events
// ═══════════════════════════════════════════
function bindEvents() {
  document.getElementById("check-btn").addEventListener("click", checkAnswer);
  document.getElementById("skip-btn").addEventListener("click", skipQuestion);

  document.getElementById("back-btn").addEventListener("click", () => {
    if (currentIndex > 0 || stats.correct + stats.wrong > 0) {
      if (!confirm("ออกจากการฝึก? ความคืบหน้าจะหายไป")) return;
    }
    sessionStorage.removeItem("practiceConfig");
    window.location.href = "dashboard.html";
  });

  document.getElementById("restart-btn").addEventListener("click", () => {
    window.location.reload();
  });
}

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════
function showError(msg) {
  document.getElementById("loading-screen").innerHTML = `
    <div style="text-align:center;padding:2rem;max-width:420px;">
      <div style="font-size:2.5rem;margin-bottom:0.75rem;">⚠️</div>
      <h2 style="margin-bottom:0.5rem;">เกิดข้อผิดพลาด</h2>
      <p style="color:var(--text-secondary);margin-bottom:1.5rem;">${escapeHtml(msg)}</p>
      <a href="dashboard.html" class="btn btn-gold">← กลับหน้าหลัก</a>
    </div>
  `;
}