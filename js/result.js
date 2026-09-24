// js/result.js
// โหลดผล attempt และคำถามที่เกี่ยวข้อง มาแสดงเฉลยพร้อมคำอธิบาย (escape ทุกจุดที่มาจาก database)

(async function init() {
  try {
    const { user } = await requireAuth();

    const params = new URLSearchParams(window.location.search);
    const attemptId = params.get("attemptId") || sessionStorage.getItem("lastAttemptId");

    if (!attemptId) {
      window.location.href = "dashboard.html";
      return;
    }

    await loadResult(attemptId, user.id);
  } catch (err) {
    console.error("โหลดผลลัพธ์ไม่สำเร็จ:", err);
  }
})();

async function loadResult(attemptId, uid) {
  const { data: attemptRow, error: attemptError } = await sb
    .from("exam_attempts")
    .select("*")
    .eq("id", attemptId)
    .maybeSingle();

  if (attemptError || !attemptRow) {
    showToast("ไม่พบข้อมูลผลการทดสอบนี้");
    window.location.href = "dashboard.html";
    return;
  }

  const attempt = mapExamAttemptRow(attemptRow);
  if (attempt.userId !== uid) {
    // ป้องกันไม่ให้ดูผลของคนอื่นผ่านการเดา attemptId (เผื่อ RLS หลุด ให้เช็คซ้ำฝั่ง client ด้วย)
    showToast("คุณไม่มีสิทธิ์ดูผลการทดสอบนี้");
    window.location.href = "dashboard.html";
    return;
  }

  // โหลดคำถามทั้งหมดที่เกี่ยวข้อง
  const questionIds = attempt.questionIds || [];
  const questions = await fetchQuestionsByIds(questionIds);
  const questionsById = {};
  questions.forEach((q) => { questionsById[q.id] = q; });

  let score = 0;
  const reviewContainer = document.getElementById("answer-review");
  reviewContainer.innerHTML = "";

  questionIds.forEach((qid, index) => {
    const question = questionsById[qid];
    if (!question) return; // คำถามอาจถูกลบไปแล้วหลังทำข้อสอบ

    const userAnswerIdx = attempt.userAnswers[index];
    const isCorrect = userAnswerIdx === question.correctAnswerIndex;
    if (isCorrect) score++;

    reviewContainer.appendChild(buildReviewCard(index, question, userAnswerIdx, isCorrect));
  });

  setTextSafe("final-score", String(score));
  setTextSafe("total-possible-score", String(questionIds.length));
  setTextSafe(
    "result-message",
    score >= questionIds.length / 2 ? "ยอดเยี่ยมมาก! 🎉" : "ลองทบทวนอีกครั้งนะครับ 💪"
  );

  // แสดง EXP ที่ได้รับจากรอบนี้ (เก็บไว้ใน sessionStorage ตอน submitExam ในหน้า exam.js)
  const expGained = sessionStorage.getItem("lastExpGained");
  const leveledUp = sessionStorage.getItem("lastLeveledUp") === "true";
  const newLevel = sessionStorage.getItem("lastNewLevel");

  const expBanner = document.getElementById("exp-gained-banner");
  if (expGained !== null && expBanner) {
    setTextSafe("exp-gained-amount", expGained);
    expBanner.classList.remove("hidden");

    const levelUpBanner = document.getElementById("level-up-banner");
    if (leveledUp && levelUpBanner) {
      setTextSafe("level-up-num", newLevel);
      levelUpBanner.classList.remove("hidden");
    }
  }

  // คะแนนวงกลม (score ring) — ตั้งค่า CSS variable --pct สำหรับ conic-gradient
  const scoreRing = document.getElementById("score-ring");
  if (scoreRing) {
    const pct = questionIds.length > 0 ? Math.round((score / questionIds.length) * 100) : 0;
    scoreRing.style.setProperty("--pct", pct + "%");
  }

  // เคลียร์ sessionStorage ของผลลัพธ์นี้ ป้องกันไม่ให้แสดงซ้ำถ้าโหลดหน้าอื่นแล้วย้อนกลับมา
  sessionStorage.removeItem("lastExpGained");
  sessionStorage.removeItem("lastLeveledUp");
  sessionStorage.removeItem("lastNewLevel");

  document.getElementById("loading-indicator").classList.add("hidden");
  document.getElementById("result-content").classList.remove("hidden");
}

/**
 * ดึงคำถามหลายข้อพร้อมกันด้วย id — Postgres "in" ไม่มีข้อจำกัด 30 ค่าเหมือน Firestore
 * จึงทำเป็น query เดียวได้เลย (ไม่ต้องแบ่ง batch)
 */
async function fetchQuestionsByIds(ids) {
  if (ids.length === 0) return [];

  const { data, error } = await sb.from("questions").select("*").in("id", ids);
  if (error) throw error;
  return (data || []).map(mapQuestionRow);
}

/**
 * สร้างการ์ดแสดงเฉลยทีละข้อ — ใช้ DOM API + textContent ทั้งหมด ไม่ใช้ innerHTML กับข้อมูลจาก DB
 */
function buildReviewCard(index, question, userAnswerIdx, isCorrect) {
  const card = document.createElement("div");
  card.className = `review-card ${isCorrect ? "correct" : "wrong"}`;

  const title = document.createElement("p");
  title.className = "review-q";
  title.textContent = `ข้อที่ ${index + 1}: ${question.questionText}`;
  card.appendChild(title);

  // ตารางข้อมูลประกอบคำถาม (ถ้ามี)
  if (question.tableData && question.tableData.headers && question.tableData.headers.length > 0) {
    const tableWrapper = document.createElement("div");
    tableWrapper.style.overflowX = "auto";
    tableWrapper.style.marginBottom = "0.75rem";
    const table = document.createElement("table");
    table.className = "question-table";
    renderTableSafe(table, question.tableData);
    tableWrapper.appendChild(table);
    card.appendChild(tableWrapper);
  }

  const userAnswerP = document.createElement("p");
  userAnswerP.className = "review-your-answer mb-1";
  const userAnswerText = userAnswerIdx !== -1 && question.options[userAnswerIdx] !== undefined
    ? question.options[userAnswerIdx]
    : "ไม่ได้ตอบ";
  userAnswerP.textContent = `คำตอบของคุณ: ${userAnswerText}`;
  card.appendChild(userAnswerP);

  const correctAnswerP = document.createElement("p");
  correctAnswerP.className = "review-correct-answer";
  correctAnswerP.textContent = `เฉลย: ${question.options[question.correctAnswerIndex]}`;
  card.appendChild(correctAnswerP);

  if (question.explanation) {
    const explanationP = document.createElement("p");
    explanationP.className = "review-explanation";
    explanationP.textContent = `คำอธิบาย: ${question.explanation}`;
    card.appendChild(explanationP);
  }

  return card;
}

function renderTableSafe(tableEl, tableData) {
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
