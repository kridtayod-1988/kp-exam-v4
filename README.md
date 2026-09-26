# เตรียมสอบ ก.พ. — Supabase Edition

เว็บแอปฝึกทำข้อสอบ ก.พ. พร้อมระบบสมาชิก (Email/Password + Google), แผงควบคุมผู้ดูแลระบบเต็มรูปแบบ,
ระบบเกม EXP/Level, และฟีเจอร์สร้างข้อสอบด้วย AI (Claude/Gemini) — ขับเคลื่อนด้วย **Supabase** (Postgres + Auth + RLS)

> โปรเจกต์นี้ย้ายจาก Firebase มาเป็น Supabase แล้ว ดูรายละเอียดสถาปัตยกรรมและการตัดสินใจออกแบบทั้งหมด
> ได้ที่ [`ARCHITECTURE.md`](./ARCHITECTURE.md) (เอกสารต้นฉบับอ้างอิง Firestore แต่แนวคิดเรื่อง role/security/gamification ยังใช้ได้เหมือนเดิม)

## Supabase Project ที่ใช้งานอยู่

- **Project name:** KPOR
- **Project ref:** `wefgreavazpfctayjnmp`
- **Region:** `ap-southeast-1` (Singapore)
- **Database:** Postgres 17, เปิดใช้ RLS ทุกตาราง, Security Advisor ผ่าน 0 warnings

## โครงสร้างโปรเจกต์

```
kp-exam-v4/
├── index.html                 หน้า Landing
├── login.html                 เข้าสู่ระบบ (Email + Google)
├── signup.html                สมัครสมาชิก (2 ขั้นตอน + ยอมรับคำชี้แจง)
├── forgot-password.html       ลืมรหัสผ่าน
├── dashboard.html             เลือกโหมดทำข้อสอบ + EXP/Level widget
├── exam.html                  หน้าทำข้อสอบ (รองรับตารางข้อมูล)
├── result.html                ผลลัพธ์ + เฉลย + EXP ที่ได้รับ
├── profile.html                โปรไฟล์ + ประวัติ + Level
│
├── admin/                     แผงควบคุมผู้ดูแลระบบ (เข้าผ่าน URL ตรง ไม่โชว์ในเมนูทั่วไป)
│   ├── index.html              แดชบอร์ดสรุป
│   ├── questions.html          จัดการคำถาม (CRUD + ตัวสร้างตาราง)
│   ├── ai-generate.html        สร้างข้อสอบด้วย AI (ร่างก่อนบันทึก)
│   ├── users.html              จัดการผู้ใช้ (role + ลบ)
│   ├── taxonomy.html           จัดการหมวดหมู่ / ปี
│   └── settings.html           ตั้งค่าระบบ + AI API keys
│
├── css/style.css              ดีไซน์ Dark Navy + Gold (gaming theme)
├── js/
│   ├── supabase-config.js      ⚠️ ตั้งค่า Supabase URL + publishable key
│   ├── utils.js                escapeHtml, mapping functions, ระบบ EXP/Level
│   ├── auth-guard.js           requireAuth / requireAdmin (Supabase Auth)
│   ├── exam-engine.js          ตรรกะสุ่มข้อสอบไม่ซ้ำข้ามรอบ + คำนวณ EXP
│   └── ... (login.js, signup.js, dashboard.js, exam.js, result.js, profile.js)
│
├── js/admin/                  โค้ดฝั่งแอดมิน (7 ไฟล์)
│
├── supabase/
│   ├── migrations/             SQL migrations ตามลำดับที่ deploy จริง (5 ไฟล์)
│   └── seed.sql                ข้อมูลเริ่มต้น: 3 หมวดหมู่ + 1 ปี + คำถาม 100 ข้อ
│
└── .github/workflows/          (แนะนำเพิ่มเอง — ดูหัวข้อ GitHub Pages ด้านล่าง)
```

## Schema ฐานข้อมูล (Postgres)

| ตาราง | หน้าที่ | เทียบเท่า Firestore เดิม |
|---|---|---|
| `profiles` | ข้อมูลผู้ใช้ + role + สถิติ + EXP | `users/{uid}` |
| `categories` | หมวดหมู่ข้อสอบ | `categories/{id}` |
| `exam_years` | ปีข้อสอบ | `examYears/{id}` |
| `questions` | คลังคำถาม (รองรับ `table_data` เป็น JSONB) | `questions/{id}` |
| `exam_attempts` | ประวัติการทำข้อสอบแต่ละครั้ง | `examAttempts/{id}` |
| `user_seen_questions` | ข้อที่แต่ละคนเคยเจอ (กันสุ่มซ้ำ) | `userSeenQuestions/{uid}` |
| `system_config` | ตั้งค่าระบบ (2 แถว: `public`/`secrets`) | `systemConfig/public`, `systemConfig/secrets` |

**Row Level Security (RLS)** ใช้แทน Firestore Security Rules ทั้งหมด — ทุกตารางเปิด RLS, มี helper function
`is_admin()` เช็ค role จาก `profiles` table, policy คุมสิทธิ์ read/write แยกตาม role เหมือนเดิมทุกจุด

## ขั้นตอนติดตั้ง (จากศูนย์ ในโปรเจกต์ Supabase ใหม่)

หากต้องการ deploy ไปยัง Supabase project อื่น (ไม่ใช่ `mivyilrytsoncvolhhev` ที่ตั้งค่าไว้แล้ว):

### 1. สร้าง Supabase Project

ไปที่ [supabase.com/dashboard](https://supabase.com/dashboard) → New Project → เลือก region ที่ใกล้ผู้ใช้

### 2. รัน Migrations

ติดตั้ง Supabase CLI:
```bash
npm install -g supabase
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
```

รัน migrations ทั้งหมดตามลำดับ (สร้าง schema + RLS + performance fixes):
```bash
supabase db push
```

หรือถ้าไม่อยากใช้ CLI: เปิด Supabase Dashboard → SQL Editor → รันไฟล์ใน `supabase/migrations/`
ทีละไฟล์ตามลำดับชื่อไฟล์ (มี timestamp นำหน้าเรียงไว้ให้แล้ว)

### 3. Seed ข้อมูลเริ่มต้น

เปิด Supabase Dashboard → SQL Editor → วางเนื้อหาไฟล์ `supabase/seed.sql` ทั้งหมด → Run

จะได้: 3 หมวดหมู่, 1 ปีเริ่มต้น ("ทั่วไป/ไม่ระบุปี"), คำถาม 100 ข้อ

> หมายเหตุ: คำถามที่ seed เข้ามาไม่มีคำอธิบายเฉลยจากต้นฉบับเดิม (ใส่ placeholder ไว้ให้)
> กรุณาเข้าไปเติมทีละข้อผ่านหน้า "จัดการคำถาม" หรือใช้ AI ช่วยร่างคำอธิบายเพิ่มเติมทีหลังได้

### 4. เปิดใช้ Authentication Providers

Supabase Dashboard → Authentication → Providers:
- **Email:** เปิดใช้งาน (เปิดอยู่โดย default)
- **Google:** เปิดใช้งาน + ใส่ Client ID/Secret จาก [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
  (ต้องตั้ง Authorized redirect URI เป็น `https://<project-ref>.supabase.co/auth/v1/callback`)

> **หมายเหตุสำคัญ:** ค่าเริ่มต้นของ Supabase เปิด "Confirm email" ไว้ (ผู้ใช้ต้องกดลิงก์ยืนยันในอีเมลก่อนเข้าระบบได้)
> ต่างจาก Firebase ที่ auto-login ทันทีหลังสมัคร โค้ด `signup.js` จัดการทั้ง 2 กรณีไว้แล้ว
> (ถ้าอยากปิดการยืนยันอีเมล ไปที่ Authentication → Settings → Email Auth → ปิด "Confirm email")

### 5. ใส่ Supabase Config ใน Frontend

เปิดไฟล์ `js/supabase-config.js` แทนที่ `SUPABASE_URL` และ `SUPABASE_PUBLISHABLE_KEY`
ด้วยค่าจาก Project Settings → API (มีคำอธิบายในไฟล์นั้นแล้ว)

### 6. ตั้งค่า Admin คนแรก

1. เปิดเว็บ → สมัครสมาชิกด้วยอีเมลจริงของคุณผ่านหน้าเว็บตามปกติ (จะได้ role: `user` อัตโนมัติผ่าน trigger)
2. Supabase Dashboard → Table Editor → `profiles` → หา row ที่ตรงกับอีเมลคุณ
3. แก้ field `role` จาก `"user"` เป็น `"admin"` (ทำครั้งเดียว)
4. เข้า URL `/admin/index.html` ตรง ๆ (ไม่มีลิงก์ในเมนูทั่วไป ตามที่ออกแบบไว้)
5. ตั้งแต่นั้น ตั้ง admin คนต่อไปได้เองผ่านหน้า "จัดการผู้ใช้" โดยไม่ต้องเข้า Dashboard อีก

### 7. ตั้งค่า AI API Keys (ถ้าต้องการใช้ฟีเจอร์สร้างข้อสอบด้วย AI)

ไปที่ `/admin/settings.html` → กรอก Claude API Key และ/หรือ Gemini API Key
- Claude: [console.anthropic.com](https://console.anthropic.com/)
- Gemini: [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

⚠️ อ่านคำเตือนเรื่องความปลอดภัยของ key เหล่านี้ในหน้าตั้งค่าก่อนใช้งาน (key ใช้ร่วมกันทุก admin
และเรียกจาก browser ตรง เห็นผ่าน DevTools ได้)

---

## Deploy ขึ้น GitHub Pages

โปรเจกต์นี้เป็น static site ล้วน (HTML/CSS/JS เรียก Supabase ผ่าน REST API จาก browser)
จึง deploy บน GitHub Pages ได้ฟรีโดยตรง ไม่ต้องมี backend server

### วิธีที่ 1: Deploy ด้วยมือ (เร็วที่สุด)

```bash
# สร้าง repo ใหม่บน GitHub ก่อน (ผ่านเว็บ github.com หรือ gh cli)
cd kp-exam-v4
git init
git add .
git commit -m "Initial commit: เตรียมสอบ ก.พ. (Supabase edition)"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

จากนั้น: GitHub repo → **Settings → Pages** → Source: `Deploy from a branch` →
Branch: `main` / `root` → Save

รอ 1-2 นาที จะได้ลิงก์ `https://<your-username>.github.io/<repo-name>/`

### วิธีที่ 2: GitHub Actions (auto-deploy ทุกครั้งที่ push)

สร้างไฟล์ `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: ["main"]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Pages
        uses: actions/configure-pages@v5
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: "."
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

จากนั้นไปที่ **Settings → Pages** → Source: `GitHub Actions` — ทุกครั้งที่ push ขึ้น `main`
จะ deploy อัตโนมัติ

### ⚠️ ข้อควรระวังก่อน push ขึ้น GitHub (public repo)

`js/supabase-config.js` มี **publishable key** (ไม่ใช่ secret key) ฝังอยู่ — ค่านี้ออกแบบมาให้เปิดเผยได้
ปลอดภัยเพราะทุก request ถูกคุมด้วย RLS policies ฝั่งฐานข้อมูลอยู่แล้ว **ไม่ใช่ปัญหา** ถ้า repo เป็น public

แต่ถ้าคุณเคยตั้งค่า AI API keys (Claude/Gemini) ผ่านหน้า admin settings แล้ว **คีย์เหล่านั้นอยู่ในฐานข้อมูล
ไม่ใช่ในโค้ด** จึงไม่หลุดไปกับ git push — ปลอดภัยอยู่แล้วโดยธรรมชาติของสถาปัตยกรรมนี้

## ความปลอดภัยที่ implement ไว้

- **Row Level Security (RLS)** ทุกตาราง — คุมสิทธิ์ฝั่งเซิร์ฟเวอร์ แก้ผ่าน DevTools ไม่ได้
- **`is_admin()` เป็น `SECURITY DEFINER` function** ที่ revoke EXECUTE จาก `PUBLIC`/`anon`/`authenticated`
  แล้ว เรียกได้เฉพาะจากภายใน RLS policy/trigger เท่านั้น ป้องกันการเรียกตรงผ่าน `/rpc/is_admin`
- **XSS protection**: ทุกจุดที่ render ข้อมูลจาก user/admin/AI ใช้ `textContent`/DOM API ไม่ใช่ `innerHTML` กับข้อมูลดิบ
- **Soft-delete** สำหรับคำถาม (กู้คืนได้) + **confirmation modal** ก่อนการกระทำที่ทำลายข้อมูลทุกจุด
- **AI draft-review flow**: เนื้อหาจาก AI ต้องผ่าน admin ตรวจสอบก่อนเข้าคลังจริงเสมอ
- **Security Advisor ผ่าน 0 warnings**, **Performance Advisor** ไม่มี WARN-level issues เหลือ

## ข้อจำกัดที่ควรทราบ

- การลบผู้ใช้ในหน้า "จัดการผู้ใช้" ลบเฉพาะแถวใน `profiles` table เท่านั้น ไม่ได้ลบบัญชี Supabase Auth จริง
  (ต้องใช้ Admin API/service role key ซึ่งไม่ปลอดภัยที่จะเรียกจาก client — ทำผ่าน Supabase Dashboard แทน)
- AI API keys เก็บแบบ shared key ใน `system_config` table เรียกจาก client ตรง — admin ทุกคนเห็น key
  ผ่าน DevTools ได้ (อธิบายละเอียดในหน้าตั้งค่า)
- Google OAuth ใช้ full-page redirect (ไม่ใช่ popup แบบ Firebase เดิม) — ต้องตั้งค่า redirect URL
  ให้ตรงกับโดเมนที่ deploy จริงใน Google Cloud Console + Supabase Auth settings
