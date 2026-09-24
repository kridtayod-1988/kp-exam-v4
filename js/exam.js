// js/exam.js
// ตรรกะหน้าทำข้อสอบ — ใช้ textContent/escapeHtml เสมอเมื่อ render ข้อมูลจาก database

let examUser = null;
let examQuestions = [];
let examAnswers = [];
let currentIndex = 0;
let attemptId = null;
let examTimer = null;
let startTime = null;
let timeLimitSeconds = 0;

const MODE_LABELS = {
  full100: "ข้อสอบจริง 100 ข้อ",
  category: "แบบทดสอบแยกหมวดหมู่",
  year: "แบบทดสอบแยกปี"
};

(async function init() {
  try {
    const { user } = await requireAuth();
    examUser = user;

    const configRaw = sessionStorage.getItem("examConfig");
    if (!configRaw) {
      window.location.href = "dashboard.html";
      return;
    }
    const config = JSON.parse(configRaw);

    await setupExam(config);
  } catch (err) {
    console.error("เริ่มข้อสอบไม่สำเร็จ:", err);
  }
})();

async function setupExam(config) {
  // โหลดจำนวนข้อและเวลาตามโหมด
  let count = 100;
  let timeMinutes = 180;
  const filter = {};

  if (config.mode === "full100") {
    const { data: sysConfig, error: sysError } = await sb
      .from("system_config")
      .select("full_exam_question_count, full_exam_time_minutes")
      .eq("key", "public")
      .single();

    if (sysError) throw sysError;
    count = sysConfig?.full_exam_question_count || 100;
    timeMinutes = sysConfig?.full_exam_time_minutes || 180;
  } else if (config.mode === "category") {
    count = config.count;
    filter.categoryId = config.categoryId;
    timeMinutes = Math.ceil(count * 1); // 1 นาทีต่อข้อ
  } else if (config.mode === "year") {
    count = config.count;
    filter.examYearId = config.examYearId;
    timeMinutes = Math.ceil(count * 1);
  }

  const { questions, totalAvailable } = await drawQuestionsNoRepeat(examUser.id, count, filter);

  if (questions.length === 0) {
    document.getElementById("loading-screen").classList.add("hidden");
    document.getElementById("not-enough-screen").classList.remove("hidden");
    return;
  }

  examQuestions = questions;
  examAnswers = new Array(questions.length).fill(-1);
  timeLimitSeconds = timeMinutes * 60;

  attemptId = await createExamAttempt({
    userId: examUser.id,
    mode: config.mode,
    categoryId: filter.categoryId || null,
    examYearId: filter.examYearId || null,
    questionIds: questions.map((q) => q.id)
  });

  setTextSafe("exam-mode-title", MODE_LABELS[config.mode] || "แบบทดสอบ");
  setTextSafe("total-questions", String(questions.length));
  document.getElementById("modal-total-questions").textContent = String(questions.length);

  document.getElementById("loading-screen").classList.add("hidden");
  document.getElementById("exam-screen").classList.remove("hidden");

  startTime = Date.now();
  startExamTimer();
  renderQuestion();
}

function startExamTimer() {
  let remaining = timeLimitSeconds;
  const display = document.getElementById("time-left");

  examTimer = setInterval(() => {
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    display.textContent =
      (hours > 0 ? String(hours).padStart(2, "0") + ":" : "") +
      String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");

    if (remaining <= 60) {
      display.classList.add("warning");
    }

    if (--remaining < 0) {
      clearInterval(examTimer);
      submitExam(); // เวลาหมด → ส่งอัตโนมัติ
    }
  }, 1000);
}

function renderQuestion() {
  const q = examQuestions[currentIndex];

  setTextSafe("current-question-number", String(currentIndex + 1));

  // อัปเดต progress bar ด้านบน
  const progressPercent = ((currentIndex + 1) / examQuestions.length) * 100;
  const progressFillEl = document.getElementById("exam-progress-fill");
  if (progressFillEl) progressFillEl.style.width = progressPercent + "%";

  // ใช้ textContent เสมอ — ป้องกัน XSS จากคำถามที่ admin/AI กรอกมา
  setTextSafe("question-text", q.questionText);

  // ตารางข้อมูลประกอบคำถาม (ถ้ามี)
  const tableContainer = document.getElementById("question-table-container");
  const table = document.getElementById("question-table");
  if (q.tableData && q.tableData.headers && q.tableData.headers.length > 0) {
    renderQuestionTable(table, q.tableData);
    tableContainer.classList.remove("hidden");
  } else {
    table.innerHTML = "";
    tableContainer.classList.add("hidden");
  }

  // ตัวเลือก
  const optionsContainer = document.getElementById("options-container");
  optionsContainer.innerHTML = "";
  const optionLabels = ["ก", "ข", "ค", "ง"];

  q.options.forEach((option, idx) => {
    const optionDiv = document.createElement("div");
    optionDiv.className = "option-item";
    if (examAnswers[currentIndex] === idx) {
      optionDiv.classList.add("selected");
    }

    const bullet = document.createElement("span");
    bullet.className = "option-bullet";
    bullet.textContent = optionLabels[idx] || String(idx + 1);

    const label = document.createElement("label");
    label.style.cssText = "flex:1;cursor:pointer;font-size:1rem;";
    label.textContent = option; // textContent ป้องกัน XSS

    optionDiv.appendChild(bullet);
    optionDiv.appendChild(label);
    optionsContainer.appendChild(optionDiv);

    optionDiv.addEventListener("click", () => {
      examAnswers[currentIndex] = idx;
      optionsContainer.querySelectorAll(".option-item").forEach((item) => {
        item.classList.remove("selected");
      });
      optionDiv.classList.add("selected");
    });
  });

  document.getElementById("prev-button").style.visibility = currentIndex === 0 ? "hidden" : "visible";
  document.getElementById("next-button").textContent =
    currentIndex === examQuestions.length - 1 ? "ส่งคำตอบ ✅" : "ข้อต่อไป →";
}

/**
 * Render ตารางข้อมูลแบบปลอดภัย — escape ทุกเซลล์ก่อนใส่ผ่าน DOM API
 * (ไม่ใช้ string concatenation + innerHTML กับข้อมูลจาก database)
 */
function renderQuestionTable(tableEl, tableData) {
  tableEl.innerHTML = "";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  tableData.headers.forEach((headerText) => {
    const th = document.createElement("th");
    th.textContent = headerText; // textContent = ปลอดภัยจาก XSS โดยอัตโนมัติ
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  tableEl.appendChild(thead);

  const tbody = document.createElement("tbody");
  tableData.rows.forEach((row) => {
    const tr = document.createElement("tr");
    row.forEach((cellText) => {
      const td = document.createElement("td");
      td.textContent = cellText;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  tableEl.appendChild(tbody);
}

document.getElementById("prev-button").addEventListener("click", () => {
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion();
  }
});

document.getElementById("next-button").addEventListener("click", () => {
  if (currentIndex < examQuestions.length - 1) {
    currentIndex++;
    renderQuestion();
  } else {
    openSubmitConfirmModal();
  }
});

function openSubmitConfirmModal() {
  const answeredCount = examAnswers.filter((a) => a !== -1).length;
  document.getElementById("answered-count").textContent = String(answeredCount);
  document.getElementById("confirm-submit-modal").classList.remove("hidden");
}

document.getElementById("cancel-submit-btn").addEventListener("click", () => {
  document.getElementById("confirm-submit-modal").classList.add("hidden");
});

document.getElementById("confirm-submit-btn").addEventListener("click", () => {
  document.getElementById("confirm-submit-modal").classList.add("hidden");
  submitExam();
});

async function submitExam() {
  clearInterval(examTimer);
  const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

  try {
    const result = await finishExamAttempt({
      attemptId,
      userId: examUser.id,
      userAnswers: examAnswers,
      questions: examQuestions,
      durationSeconds
    });

    sessionStorage.setItem("lastAttemptId", attemptId);
    sessionStorage.setItem("lastExpGained", String(result.expGained));
    sessionStorage.setItem("lastLeveledUp", String(result.leveledUp));
    sessionStorage.setItem("lastNewLevel", String(result.newLevel));
    sessionStorage.removeItem("examConfig");
    window.location.href = `result.html?attemptId=${encodeURIComponent(attemptId)}`;
  } catch (err) {
    console.error("ส่งคำตอบไม่สำเร็จ:", err);
    showToast("เกิดข้อผิดพลาดในการส่งคำตอบ กรุณาลองใหม่");
  }
}

// เตือนผู้ใช้ก่อนปิดหน้าระหว่างทำข้อสอบ
window.addEventListener("beforeunload", (e) => {
  if (examQuestions.length > 0) {
    e.preventDefault();
    e.returnValue = "";
  }
});
