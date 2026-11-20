📄 README.md — ฉบับปรับปรุง

วางทับไฟล์เดิมทั้งไฟล์


# เตรียมสอบ ก.พ. — Supabase Edition

เว็บแอปฝึกทำข้อสอบ ก.พ. พร้อมระบบสมาชิก (Email/Password + Google), แผงควบคุมผู้ดูแลระบบเต็มรูปแบบ,
ระบบเกม EXP/Level, ระบบนำเข้าข้อสอบ CSV, ระบบ Blueprint-based sampling, และฟีเจอร์สร้างข้อสอบด้วย AI (Claude/Gemini)
— ขับเคลื่อนด้วย **Supabase** (Postgres + Auth + RLS)

> โปรเจกต์นี้ย้ายจาก Firebase มาเป็น Supabase — ดูรายละเอียดสถาปัตยกรรมที่ [`ARCHITECTURE.md`](./ARCHITECTURE.md)

## Supabase Project

- **Project name:** kp-exam-v4
- **Project ref:** `wefgreavazpfctayjnmp`
- **Region:** `ap-southeast-1` (Singapore)
- **Database:** Postgres 17
- **Security:** RLS ทุกตาราง, Advisor ผ่าน 0 warnings

---

## 📁 โครงสร้างโปรเจกต์

```

kp-exam-v4/
├── index.html                    Landing
├── login.html                    เข้าสู่ระบบ (Email + Google)
├── signup.html                   สมัครสมาชิก (2 ขั้น + strength meter)
├── forgot-password.html          ลืมรหัสผ่าน
├── dashboard.html                เลือกโหมด + ชุดข้อสอบ (cards)
├── exam.html                     หน้าทำข้อสอบ (4 context blocks)
├── result.html                   ผล + เฉลย + EXP
├── profile.html                  โปรไฟล์ + ประวัติ + Level
│
├── admin/                        แผงควบคุม admin (เข้า /admin ตรง ไม่มีลิงก์ในเมนู)
│   ├── index.html                แดชบอร์ดสรุป
│   ├── questions.html            จัดการคำถาม (CRUD + preview/edit)
│   ├── import-questions.html     นำเข้าข้อสอบ CSV (drag-drop)
│   ├── papers.html               จัดการชุดข้อสอบ
│   ├── ai-generate.html          สร้างข้อสอบด้วย AI (draft → review)
│   ├── users.html                จัดการผู้ใช้
│   ├── taxonomy.html             จัดการหมวดหมู่ / ปี
│   └── settings.html             ตั้งค่าระบบ + AI keys
│
├── css/
│   └── style.css                 Design System (Dark + Light theme)
│
├── js/
│   ├── supabase-config.js        ⚠️ URL + publishable key
│   ├── utils.js                  escapeHtml, mapping, EXP/Level
│   ├── auth-guard.js             requireAuth / requireAdmin
│   ├── exam-engine.js            Blueprint sampling + startExam/submit
│   ├── showcase.js               Shared component (login/signup)
│   ├── landing.js                FAQ accordion
│   ├── login.js                  Email + Google
│   ├── signup.js                 2-step + validation
│   ├── forgot-password.js        Reset password
│   ├── dashboard.js              โหลด categories + papers cards
│   ├── exam.js                   Handle 4 context types
│   ├── result.js                 Instant render (sessionStorage first)
│   ├── profile.js                โปรไฟล์ + history
│   │
│   ├── lib/                      ✨ ใหม่
│   │   ├── rng.js                mulberry32 + shuffle + makeSeed
│   │   ├── blueprint.js          TAXONOMY + BLUEPRINTS
│   │   └── supabase-esm.js       ES module bridge
│   │
│   └── admin/                    โค้ดแอดมิน (10 ไฟล์)
│       ├── admin-layout.js
│       ├── admin-dashboard.js
│       ├── questions.js
│       ├── import-questions.js
│       ├── papers.js
│       ├── ai-generate.js
│       ├── users.js
│       ├── taxonomy.js
│       ├── settings.js
│       └── export-questions.js
│
├── supabase/
│   ├── migrations/               SQL migrations (8 ไฟล์)
│   ├── seed.sql                  คำถามเริ่มต้น 100 ข้อ
│   └── verify_schema.sql         สคริปต์ตรวจสอบ
│
├── catalog/                      ✨ ใหม่
│   ├── taxonomy.csv              SC codes ทั้ง 24
│   └── seed-example.csv          ตัวอย่าง import 10 ข้อ
│
├── scripts/
│   ├── seed-ai-keys.sql          ตั้งค่า AI keys แบบ SQL
│   └── seed-ai-keys.sh           ตั้งค่า AI keys ผ่าน CLI
│
├── tests/                        Playwright smoke tests
│   ├── helpers.js
│   ├── 01-landing.spec.js
│   ├── 02-auth.spec.js
│   ├── 03-exam.spec.js
│   ├── 04-admin.spec.js
│   └── 05-non-admin-guard.spec.js
│
├── .github/workflows/deploy.yml  CI/CD
├── .vscode/                      Extensions + Settings
├── .gitignore
├── .env.test.example             Test credentials template
├── package.json
├── playwright.config.js
└── setup-dev.sh                  Script สร้างโครงสร้าง dev

```

---

## 🗄️ Schema ฐานข้อมูล

### ตาราง 7 ตาราง

| ตาราง | หน้าที่ |
|---|---|
| `profiles` | ข้อมูลผู้ใช้ + role + สถิติ + EXP |
| `categories` | หมวดหมู่วิชา (ปัจจุบัน 3 หมวด) |
| `exam_years` | **ชุดข้อสอบ** (paper) — มี code/description/exam_date |
| `questions` | คลังคำถาม — มี cat/sub taxonomy + table_data |
| `exam_attempts` | ประวัติการทำ + seed + blueprint |
| `user_seen_questions` | ข้อที่เคยเจอ (array) |
| `system_config` | ตั้งค่า (2 แถว: public/secrets) |

### 3 Views

| View | หน้าที่ |
|---|---|
| `v_questions_public` | คำถามไม่มีเฉลย (สำหรับ exam engine) |
| `v_item_exposure` | นับจำนวนครั้งที่ข้อถูกใช้ |
| `v_papers_summary` | ชุดข้อสอบ + จำนวนข้อ (สำหรับ admin/papers) |

### 3 RPC Functions

| Function | หน้าที่ | Role |
|---|---|---|
| `submit_exam(attempt_id, answers)` | ให้คะแนน + EXP + merge seen | authenticated |
| `get_exam_review(attempt_id)` | คืน JSON เฉลย | authenticated |
| `get_public_question_count()` | นับข้อสอบ (public showcase) | anon + auth |

### 2 Helper Functions

- `is_admin()` — `SECURITY DEFINER` + revoke จาก PUBLIC
- `handle_new_user()` — trigger สร้าง profile อัตโนมัติ

---

## 🗺️ Taxonomy

### 5 หมวดหลัก (cat)

`math` · `reason` · `thai` · `eng` · `law`

### 24 หมวดย่อย (sub — SC codes)

```

SC_M1..M5  คณิตศาสตร์ (พื้นฐาน, อนุกรม, โจทย์, สมการ, ตาราง)
SC_R1..R3  เหตุผล (สัญลักษณ์, ภาษา, ตรรกศาสตร์)
SC_T1..T4  ภาษาไทย (เรียงลำดับ, จับใจความ, อุปมาอุปไมย, คำ)
SC_E1..E4  อังกฤษ (Conversation, Vocab, Grammar, Reading)
SC_L1..L8  กฎหมาย (8 หมวด)

```

ดูรายละเอียดทั้งหมดใน `catalog/taxonomy.csv`

---

## 🚀 ขั้นตอนติดตั้ง (สำหรับโปรเจกต์ใหม่)

### 1. สร้าง Supabase Project

ไปที่ [supabase.com/dashboard](https://supabase.com/dashboard) → New Project

### 2. รัน Migrations (8 ไฟล์)

**วิธี A — ผ่าน Supabase CLI:**
```bash
npm install -g supabase
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
supabase db push
```

วิธี B — ผ่าน SQL Editor:
รันไฟล์ใน supabase/migrations/ ทีละไฟล์ตาม timestamp:

```
1. 20260811222754_initial_schema.sql
2. 20260811222821_rls_policies_and_triggers.sql
3. 20260811222843_lock_down_security_definer_functions.sql
4. 20260811222904_revoke_public_execute_on_functions.sql
5. 20260811223007_optimize_rls_and_indexes.sql
6. 20260812000000_add_soft_delete_to_questions.sql
7. 20261001120000_extend_exam_years.sql           ← ชุดข้อสอบ (code/description)
8. 20261001130000_public_question_count.sql       ← RPC showcase
```

3. Seed ข้อมูลเริ่มต้น

เปิด SQL Editor → วาง supabase/seed.sql → Run

จะได้: 3 หมวดหมู่ + 1 ปีเริ่มต้น + คำถาม 100 ข้อ

4. ตรวจสอบ Schema

รัน supabase/verify_schema.sql → ควรเห็น ✅ ทุกบรรทัด

5. เปิดใช้ Authentication Providers

Supabase Dashboard → Authentication → Providers:

· Email: เปิด (default)
· Google: เปิด + ใส่ Client ID/Secret จาก Google Cloud Console
  · Authorized redirect URI: https://<project-ref>.supabase.co/auth/v1/callback

Confirm email: ถ้าต้องการให้ผู้ใช้ล็อกอินทันทีหลังสมัคร → ปิด
ถ้าต้องการยืนยันอีเมลก่อน → เปิด (default) — โค้ด signup.js จัดการทั้ง 2 กรณี

6. ใส่ Supabase Config

เปิด js/supabase-config.js → แทนที่ URL + publishable key จาก Project Settings → API

7. ตั้ง Admin คนแรก

1. สมัครสมาชิกผ่านหน้าเว็บด้วยอีเมลจริง (role='user' อัตโนมัติ)
2. Dashboard → Table Editor → profiles → หา row ของตัวเอง
3. แก้ role จาก 'user' → 'admin'
4. เข้า /admin/index.html ตรง ๆ
5. ตั้ง admin คนต่อไปผ่านหน้า "จัดการผู้ใช้"

8. ตั้งค่า AI API Keys (optional)

ไปที่ /admin/settings.html → กรอก Claude + Gemini keys

หรือรัน SQL:

```bash
# ใช้ scripts/seed-ai-keys.sql
# แทนที่ <YOUR_CLAUDE_KEY> + <YOUR_GEMINI_KEY> แล้วรัน
```

⚠️ Key ใช้ร่วมกันทุก admin + เห็นผ่าน DevTools → อ่านคำเตือนในหน้าตั้งค่า

---

📥 การนำเข้าข้อสอบ CSV

รูปแบบไฟล์

```csv
paper_code,paper_label,year,paper_description,question_text,options,correct_answer_index,explanation,difficulty,cat,sub,table_data
```

ขั้นตอน

```
1. Admin → /admin/import-questions.html
2. ดาวน์โหลด template (ปุ่มด้านล่าง)
3. เตรียม CSV (UTF-8, options เป็น JSON array 4 ตัว)
4. Drag-drop หรือเลือกไฟล์
5. Preview → ตรวจสอบ (แก้ได้ผ่าน modal)
6. ติ๊กยืนยัน → นำเข้า (progress bar)
```

Context ที่รองรับ

· คำถามเดี่ยว — ไม่มี table_data
· เงื่อนไขสัญลักษณ์ — {"condition": "A ≥ B > C"}
· บทความ — {"passage": "บทความ..."}
· ตาราง — {"table": {"headers": [...], "rows": [[...]]}}

ดูตัวอย่างได้ที่ catalog/seed-example.csv

---

🤖 AI สร้างข้อสอบ

```
1. Admin → /admin/ai-generate.html
2. เลือก provider (Claude/Gemini) + หมวด + จำนวน + ความยาก
3. กด "ร่างข้อสอบ" → การ์ด draft ขึ้นทีละข้อ
4. แก้ไข/ลบ/เลือก → "บันทึกข้อที่เลือกลงคลัง"
5. ทุกข้อจาก AI → badge 🤖 ในตาราง
```

---

🧪 Testing

Playwright Smoke Tests

```bash
# ติดตั้ง
npm install
npx playwright install chromium

# เตรียม test users ใน Supabase (2 บัญชี: user + admin)
cp .env.test.example .env.test
# แก้ไข credentials ใน .env.test

# รัน
npm test                  # headless
npm run test:headed       # เปิด browser
npm run test:ui           # UI mode (แนะนำ)
npm run test:report       # ดู report
```

Test coverage

· ✅ Landing + FAQ accordion
· ✅ Auth (login + signup 2-step + forgot)
· ✅ Exam flow (โหลด, กดปุ่ม, options)
· ✅ Admin panel (dashboard, questions, users, settings, taxonomy)
· ✅ Access control (user/admin/guest)

Schema Verification

รันใน SQL Editor:

```
supabase/verify_schema.sql → ตรวจสอบ tables, columns, functions, views, RLS
```

---

🚢 Deploy ขึ้น GitHub Pages

โปรเจกต์เป็น static site ล้วน → deploy ฟรี ผ่าน GitHub Pages

วิธีที่ 1: Deploy ด้วยมือ

```bash
cd kp-exam-v4
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

→ GitHub repo → Settings → Pages → Source: Deploy from a branch → main / root

วิธีที่ 2: GitHub Actions (auto-deploy)

ไฟล์ .github/workflows/deploy.yml มีพร้อมแล้ว — push ขึ้น main จะ deploy อัตโนมัติ

ไปที่ Settings → Pages → Source: GitHub Actions

⚠️ ก่อน push

· js/supabase-config.js มี publishable key (ออกแบบมาให้เปิดเผยได้ — RLS คุมที่ DB)
· AI keys เก็บใน DB ไม่ใช่ในโค้ด → ไม่หลุดกับ git push
· .env.test ถูก gitignore ไว้ → ไม่หลุด

---

🔒 ความปลอดภัย

· RLS ทุกตาราง — คุมสิทธิ์ฝั่ง server, bypass ไม่ได้ผ่าน DevTools
· SECURITY DEFINER functions — revoke EXECUTE จาก PUBLIC, เรียกได้จาก RLS/trigger เท่านั้น
· XSS protection — ใช้ textContent ทุกจุด, CSP ทุกหน้า
· Soft-delete — deleted_at column + confirmation modal ทุกจุด
· AI draft-review — ต้องผ่าน admin ตรวจก่อนเข้าคลัง
· Security Advisor ผ่าน 0 warnings
· Performance Advisor ไม่มี WARN-level issues

---

⚠️ ข้อจำกัดที่ควรทราบ

· ลบผู้ใช้ — ลบเฉพาะ profiles row, ไม่ลบบัญชี Supabase Auth จริง (ต้องทำผ่าน Dashboard)
· AI keys — shared ใน system_config.secrets — admin ทุกคนเห็นผ่าน DevTools
· Google OAuth — ใช้ full-page redirect (ไม่ใช่ popup) → ต้องตั้ง redirect URL ใน Google Cloud Console
· Paper ลบ — ลบชุดข้อสอบจะไม่ลบ questions (FK on delete set null)
· Import CSV — ถ้า paper_code ซ้ำ → append ไม่ overwrite (ต้องลบก่อนถ้าต้องการแทนที่)

---

🎯 ฟีเจอร์ที่ implement แล้ว

ผู้ใช้

· ✅ สมัคร 2 ขั้น + strength meter + show/hide password
· ✅ Email + Google Sign-In
· ✅ ลืมรหัสผ่าน
· ✅ EXP/Level (gamification)
· ✅ ประวัติ + สถิติ

ข้อสอบ

· ✅ 7 Blueprints (full/quick/thai/math/reason/eng/law)
· ✅ Reproducible seed
· ✅ Exposure control
· ✅ Anti-repeat
· ✅ 4 context types (ข้อความ/เงื่อนไข/บทความ/ตาราง)
· ✅ Submitting overlay + instant review

Admin

· ✅ Dashboard สรุป
· ✅ CRUD คำถาม
· ✅ นำเข้า/ส่งออก CSV
· ✅ จัดการ papers
· ✅ AI draft flow
· ✅ จัดการผู้ใช้/หมวด/ปี
· ✅ ตั้งค่าระบบ

Security

· ✅ RLS ครบ
· ✅ SECURITY DEFINER + revoke
· ✅ CSP ทุกหน้า
· ✅ XSS prevention

DevOps

· ✅ GitHub Actions
· ✅ Playwright tests
· ✅ verify_schema.sql
· ✅ setup-dev.sh
· ✅ AI keys seed scripts
· ✅ .vscode settings

---

License: สำหรับการศึกษา — ไม่ใช่ระบบสอบจริงของสำนักงาน ก.พ.

## Security architecture upgrade

See [README-SECURITY-UPGRADE.md](./README-SECURITY-UPGRADE.md) for the isolated Next.js, server-side sampling, RLS, AI Edge Function, and verification plan. The migration is prepared only; it has not been applied to Production.
