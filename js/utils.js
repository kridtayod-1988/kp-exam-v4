// js/utils.js
// ฟังก์ชันช่วยเหลือกลางที่ใช้ทั่วทั้งแอป
// กฎทอง: ข้อมูลจากใครก็ตามที่ไม่ใช่ตัวเราเอง (user, admin, AI) ถือว่าไม่น่าเชื่อถือเสมอ
//        ต้อง escape/sanitize ก่อน render เป็น HTML ทุกครั้ง

/**
 * Escape ตัวอักษรพิเศษของ HTML เพื่อป้องกัน XSS
 * ใช้ก่อน insert ข้อความที่มาจากผู้ใช้/admin/AI เข้า innerHTML เสมอ
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * แปลง newline เป็น <br> อย่างปลอดภัย (escape ก่อน แล้วค่อยแทน \n ด้วย <br>)
 * ใช้กับข้อความยาว เช่น คำอธิบายเฉลย ที่อาจมีการขึ้นบรรทัดใหม่
 */
function escapeHtmlWithBreaks(str) {
  return escapeHtml(str).replace(/\n/g, "<br>");
}

/**
 * สร้าง element ด้วย textContent (ปลอดภัยกว่า innerHTML เสมอ)
 * เป็นวิธี "default" ที่ควรใช้แทน innerHTML เมื่อแสดงข้อความล้วน ๆ
 */
function setTextSafe(elementId, text) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = text;
}

/**
 * Validate ความยาว string ฝั่ง client (สอดคล้องกับ Firestore Security Rules)
 */
function isValidLength(str, maxLength) {
  return typeof str === "string" && str.trim().length > 0 && str.length <= maxLength;
}

/**
 * Format วันที่แบบไทย (วัน/เดือน/ปี เวลา)
 */
function formatThaiDateTime(timestamp) {
  let date;
  if (timestamp && typeof timestamp.toDate === "function") {
    date = timestamp.toDate(); // Firestore Timestamp
  } else {
    date = new Date(timestamp);
  }
  return date.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/**
 * สุ่มเลือก n รายการจาก array โดยไม่ซ้ำกัน (Fisher-Yates shuffle แบบ partial)
 */
function sampleArray(arr, n) {
  const copy = arr.slice();
  const result = [];
  const count = Math.min(n, copy.length);
  for (let i = 0; i < count; i++) {
    const randIndex = Math.floor(Math.random() * copy.length);
    result.push(copy[randIndex]);
    copy.splice(randIndex, 1);
  }
  return result;
}

/**
 * แสดง toast/alert แบบง่าย (สามารถปรับเป็น UI component ที่สวยขึ้นได้ทีหลัง)
 */
function showToast(message, type = "info") {
  // เวอร์ชันพื้นฐาน ใช้ alert ไปก่อน — UI จริงจะแทนด้วย toast component
  alert(message);
}

/**
 * ===== Mapping functions: Postgres row (snake_case) → รูปแบบที่ UI เดิมคาดหวัง (camelCase) =====
 * ใช้ร่วมกันทุกไฟล์ที่ดึงข้อมูลจาก Supabase เพื่อให้โค้ด UI/component ไม่ต้องแก้ตามชื่อ column จริง
 */

function mapProfileRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    role: row.role,
    photoURL: row.photo_url,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    stats: {
      totalAttempts: row.total_attempts,
      bestScore: row.best_score,
      totalExp: row.total_exp,
      lastAttemptAt: row.last_attempt_at
    }
  };
}

function mapQuestionRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    categoryId: row.category_id,
    examYearId: row.exam_year_id,
    questionText: row.question_text,
    tableData: row.table_data,
    options: row.options,
    correctAnswerIndex: row.correct_answer_index,
    explanation: row.explanation,
    difficulty: row.difficulty,
    isActive: row.is_active,
    source: row.source,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapExamAttemptRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    mode: row.mode,
    categoryId: row.category_id,
    examYearId: row.exam_year_id,
    questionIds: row.question_ids,
    userAnswers: row.user_answers,
    score: row.score,
    totalQuestions: row.total_questions,
    expGained: row.exp_gained,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationSeconds: row.duration_seconds
  };
}

/**
 * ===== ระบบ EXP / Level (Gamification) =====
 *
 * สูตร: EXP ที่ต้องใช้เพื่อขึ้นแต่ละเลเวลจะเพิ่มขึ้นเรื่อย ๆ (progressive curve)
 * เลเวล N ต้องใช้ EXP สะสมทั้งหมด = 50 * N * (N - 1)
 * ตัวอย่าง: เลเวล 1→2 ใช้ 100 EXP, เลเวล 2→3 ใช้ 200 EXP เพิ่ม (สะสม 300), ฯลฯ
 *
 * ที่มาของ EXP: ตอบถูก 1 ข้อ = 10 EXP (คำนวณตอนจบการทำข้อสอบใน exam-engine.js)
 */
const EXP_PER_CORRECT_ANSWER = 10;

function expRequiredForLevel(level) {
  return 50 * level * (level - 1);
}

/**
 * แปลง totalExp สะสม → { level, currentLevelExp, expToNextLevel, progressPercent }
 */
function calculateLevelInfo(totalExp) {
  const exp = Math.max(0, totalExp || 0);
  let level = 1;

  // หา level สูงสุดที่ totalExp ผ่านเกณฑ์แล้ว (วนแบบง่าย เพดานที่ level 200 กันลูปไม่รู้จบ)
  while (level < 200 && exp >= expRequiredForLevel(level + 1)) {
    level++;
  }

  const expAtCurrentLevel = expRequiredForLevel(level);
  const expAtNextLevel = expRequiredForLevel(level + 1);
  const currentLevelExp = exp - expAtCurrentLevel;
  const expNeededForThisLevel = expAtNextLevel - expAtCurrentLevel;
  const progressPercent = expNeededForThisLevel > 0
    ? Math.min(100, Math.round((currentLevelExp / expNeededForThisLevel) * 100))
    : 100;

  return {
    level,
    currentLevelExp,
    expNeededForThisLevel,
    progressPercent,
    totalExp: exp
  };
}

/**
 * Render EXP bar + Level badge ลงใน element ที่ระบุ (ใช้ id ของ container)
 * โครงสร้าง HTML ที่คาดหวังภายใน container: ดูตัวอย่างใน dashboard.html
 */
function renderLevelWidget(totalExp, elIds) {
  const info = calculateLevelInfo(totalExp);
  const levelNumEl = document.getElementById(elIds.levelNum);
  const expFillEl = document.getElementById(elIds.expFill);
  const expLabelEl = document.getElementById(elIds.expLabel);

  if (levelNumEl) levelNumEl.textContent = info.level;
  if (expFillEl) expFillEl.style.width = info.progressPercent + "%";
  if (expLabelEl) {
    expLabelEl.textContent = `${info.currentLevelExp} / ${info.expNeededForThisLevel} EXP`;
  }
  return info;
}

/**
 * ดึงข้อความ error ที่เข้าใจง่ายจาก Supabase Auth error
 * (Supabase ส่ง error กลับมาเป็น { message, status } ไม่ใช่ error code แบบ Firebase
 * จึงต้อง match จากข้อความแทน)
 */
function getSupabaseAuthErrorMessage(error) {
  const msg = (error && error.message) || "";
  const map = [
    { match: "User already registered", th: "อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว" },
    { match: "Invalid login credentials", th: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" },
    { match: "Email not confirmed", th: "กรุณายืนยันอีเมลของคุณก่อนเข้าสู่ระบบ" },
    { match: "Password should be at least", th: "รหัสผ่านสั้นเกินไป (ต้องมีอย่างน้อย 6 ตัวอักษร)" },
    { match: "Unable to validate email address", th: "รูปแบบอีเมลไม่ถูกต้อง" },
    { match: "For security purposes", th: "พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่" },
    { match: "Email rate limit exceeded", th: "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" },
    { match: "network", th: "เชื่อมต่อเครือข่ายไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต" }
  ];
  const found = map.find((m) => msg.toLowerCase().includes(m.match.toLowerCase()));
  return found ? found.th : ("เกิดข้อผิดพลาด: " + (msg || "ไม่ทราบสาเหตุ"));
}
