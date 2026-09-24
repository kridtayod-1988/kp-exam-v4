# สถาปัตยกรรมระบบ: เตรียมสอบ ก.พ. (Firebase Edition)

เอกสารนี้คือแบบร่างก่อนลงมือเขียนโค้ดจริง — ขอให้ตรวจทาน schema และ flow ก่อน
ถ้า OK แล้วจะ implement เป็น Firebase project จริงในขั้นต่อไป

---

## 1. Firebase Services ที่ใช้

| Service | ใช้ทำอะไร |
|---|---|
| **Firebase Authentication** | Email/Password (สมัคร, ล็อกอิน, ลืมรหัสผ่าน) + Google Sign-In |
| **Cloud Firestore** | เก็บข้อมูลทั้งหมด (users, questions, exam attempts, settings) |
| **Firestore Security Rules** | คุมสิทธิ์ admin/user แบบ server-side (แทนการเช็ค role ใน JS ฝั่ง client) |
| **Firebase Hosting** (แนะนำ) | deploy ฟรี รองรับ custom domain, SSL อัตโนมัติ |

> หมายเหตุ: ไม่ใช้ Cloud Functions เพื่อให้ยังเป็น "ฟรีระดับ Spark plan" ได้
> ฟีเจอร์ "สุ่มไม่ซ้ำ" และการเช็คสิทธิ์ทำได้ด้วย client SDK + Security Rules พอ

---

## 2. โครงสร้างฐานข้อมูล (Firestore Collections)

```
firestore/
├── users/{uid}
│     displayName: string
│     email: string
│     role: "user" | "admin"          ← ตัวคุมสิทธิ์ทั้งระบบ
│     photoURL: string | null
│     createdAt: timestamp
│     lastLoginAt: timestamp
│     stats: {
│        totalAttempts: number
│        bestScore: number
│        lastAttemptAt: timestamp | null
│     }
│
├── categories/{categoryId}            ← หมวดหมู่ข้อสอบ (วิชา)
│     name: string                     เช่น "ความสามารถทั่วไป"
│     order: number                    ลำดับการแสดงผล
│     isActive: boolean
│
├── examYears/{yearId}                 ← ชุดข้อสอบแยกปี เช่น "2568"
│     label: string                    เช่น "ก.พ. 2568"
│     year: number                     2568 (พ.ศ.)
│     isActive: boolean
│     createdAt: timestamp
│
├── questions/{questionId}             ← คลังคำถามทั้งหมด (รวมศูนย์)
│     categoryId: string               ref → categories
│     examYearId: string | null        ref → examYears (null = ไม่ระบุปี/ใช้ทั่วไป)
│     questionText: string
│     tableData: {                     ← ออปชัน: ตารางข้อมูลประกอบคำถาม
│        headers: string[]             เช่น ["ปี", "รายได้ (ล้านบาท)"]
│        rows: string[][]              เช่น [["2563","120"], ["2564","150"]]
│     } | null
│     options: string[]                ตัวเลือก 4 ข้อ
│     correctAnswerIndex: number       0-3
│     explanation: string              คำอธิบายเฉลย
│     difficulty: "easy"|"medium"|"hard"
│     isActive: boolean                สำหรับ soft-delete
│     createdBy: string                uid ของ admin ที่เพิ่ม
│     createdAt: timestamp
│     updatedAt: timestamp
│
├── examAttempts/{attemptId}           ← ประวัติการทำข้อสอบจริงแต่ละครั้ง
│     userId: string
│     mode: "full100" | "category" | "year" | "custom"
│     categoryId: string | null
│     examYearId: string | null
│     questionIds: string[]            ข้อที่ออกในรอบนี้ (ใช้กันสุ่มซ้ำ)
│     userAnswers: number[]            index คำตอบที่เลือก (-1 = ไม่ตอบ)
│     score: number
│     totalQuestions: number
│     startedAt: timestamp
│     finishedAt: timestamp | null
│     durationSeconds: number
│
├── userSeenQuestions/{uid}            ← เอกสารเดียวต่อ user เก็บ "ข้อที่เคยเจอ"
│     seenQuestionIds: string[]        รวมทุกครั้งที่ทำโหมด full100
│     lastResetAt: timestamp           กรณี admin สั่งล้างประวัติ
│
└── systemConfig/main                  ← การตั้งค่าระบบที่ admin ปรับได้
      fullExamQuestionCount: number     default 100
      fullExamTimeMinutes: number       default 180
      allowGoogleSignIn: boolean
      allowEmailSignup: boolean
      maintenanceMode: boolean
      maintenanceMessage: string
      aiKeys: {                         ← ⚠️ ดูคำเตือนด้านความปลอดภัยในหัวข้อ 7
        claudeApiKey: string | null
        geminiApiKey: string | null
      }
```

### ทำไมออกแบบแบบนี้

- **`questions` รวมศูนย์ที่เดียว** ไม่แยกตามวิชา เพราะ query ข้ามวิชา/ปี (เช่น โหมด 100 ข้อแบบสุ่มทั้งหมด) ทำง่ายกว่า แค่ filter ด้วย `categoryId` / `examYearId` ตอน query
- **`tableData` เป็น object แยก ไม่ฝังใน `questionText`** เพื่อให้ renderer แสดงเป็นตาราง HTML จริงได้ ไม่ใช่ string ตาราง ASCII ที่จัดรูปแบบยาก
- **`userSeenQuestions` แยกออกจาก `examAttempts`** เพราะการเช็ค "ข้อไหนเคยออกแล้ว" ต้องเร็ว (อ่าน doc เดียว) ไม่ต้องวน loop หลาย attempts
- **`role` อยู่ใน `users/{uid}` ไม่ใช่ custom claims** เพราะ custom claims ต้องใช้ Cloud Functions/Admin SDK ตั้งค่า (มีค่าใช้จ่ายเชิง setup) — เก็บใน Firestore document แล้วคุมด้วย Security Rules ทำได้ฟรีและพอเพียงกับสเกลนี้

---

## 3. ตรรกะ "สุ่ม 100 ข้อ ไม่ซ้ำข้ามรอบ"

```
1. โหลด userSeenQuestions/{uid}.seenQuestionIds → set ของข้อที่เคยเจอ
2. Query questions ที่ isActive == true และ id NOT IN seenQuestionIds
   - Firestore ไม่มี "NOT IN" ที่ดีกับ list ใหญ่ → วิธีจริง:
     ดึงคำถามทั้งหมด (isActive==true) ของหมวดที่เกี่ยวข้อง มาเป็น array ฝั่ง client
     แล้วกรอง seenQuestionIds ออกด้วย JS (เหมาะกับคลังขนาดหลักพันข้อ)
3. ถ้าคำถามที่ "ยังไม่เคยเจอ" เหลือ >= 100 ข้อ → สุ่มเลือก 100 จากกลุ่มนี้
4. ถ้าเหลือไม่พอ (เช่น เหลือ 40 ข้อที่ยังไม่เคยเจอ) →
   ใช้ 40 ข้อนั้นก่อน แล้วสุ่มเติมจากข้อที่ "เคยเจอน้อยที่สุด/นานที่สุด" ให้ครบ 100
   (ป้องกันกรณีคลังข้อสอบมีน้อยกว่าที่ผู้ใช้ทำสะสมไปแล้ว)
5. บันทึก questionIds ที่ออกจริงลง examAttempts ใหม่
6. หลังส่งคำตอบเสร็จ (finishedAt ถูกเซ็ต) → merge questionIds เข้า
   userSeenQuestions.seenQuestionIds (ใช้ Set เพื่อไม่ให้ซ้ำ)
```

**ทางเลือกที่ปรับได้**: ถ้าต้องการ "เคยเจอแล้วห้ามออกอีกเด็ดขาดตลอดไป" (ไม่มี fallback) ก็ตัดขั้นตอน 4 ออกแล้วแจ้งผู้ใช้ว่า "คลังข้อสอบไม่พอ กรุณาติดต่อแอดมิน" แทน — แจ้งได้ถ้าต้องการแบบนี้

---

## 4. หน้าจอ (Screens) ทั้งหมด

### กลุ่มผู้ใช้ทั่วไป
1. **หน้าแรก / Landing** — แนะนำระบบ + ปุ่มเข้าสู่ระบบ/สมัคร
2. **ล็อกอิน** — Email/Password, ปุ่ม "เข้าสู่ระบบด้วย Google", ลิงก์ "ลืมรหัสผ่าน", ลิงก์ "สมัครสมาชิก"
3. **สมัครสมาชิก** — ชื่อ, อีเมล, รหัสผ่าน, ยืนยันรหัสผ่าน
4. **ลืมรหัสผ่าน** — กรอกอีเมล → ส่งลิงก์รีเซ็ตผ่าน Firebase
5. **หน้าหลังล็อกอิน (Dashboard)** — เลือกโหมด: ข้อสอบจริง 100 ข้อ / แยกหมวดหมู่ / แยกปี
6. **หน้าทำข้อสอบ** — แสดงคำถาม + ตาราง (ถ้ามี) + ตัวเลือก + ตัวจับเวลา
7. **หน้าผลลัพธ์** — คะแนน, เฉลยพร้อมคำอธิบาย
8. **หน้าโปรไฟล์** — ชื่อ, อีเมล, รูป, สถิติ (จำนวนครั้งที่ทำ, คะแนนดีที่สุด), ปุ่มแก้ไขโปรไฟล์/เปลี่ยนรหัสผ่าน

### กลุ่มแอดมิน (ซ่อนแท็บ ไม่โชว์ในเมนูทั่วไป เข้าผ่าน URL เฉพาะ เช่น `/admin`)
9. **Admin Dashboard** — สรุปจำนวนคำถาม/ผู้ใช้/การทำข้อสอบวันนี้
10. **จัดการคำถาม** — ตาราง list คำถามทั้งหมด, ค้นหา/กรองตามหมวดหมู่-ปี, ปุ่มเพิ่ม/แก้ไข/ลบ (soft delete)
11. **ฟอร์มเพิ่ม/แก้ไขคำถาม** — หมวดหมู่, ปี, คำถาม, ตารางข้อมูล (ออปชัน, เพิ่ม/ลบแถวคอลัมน์ได้), ตัวเลือก 4 ข้อ, เฉลย, คำอธิบาย, ระดับความยาก
12. **สร้างข้อสอบด้วย AI (ร่างก่อนบันทึก)** — ดูหัวข้อ 7 ด้านล่าง
13. **จัดการผู้ใช้** — ตาราง list ผู้ใช้ทั้งหมด, ปุ่มแก้ไข role, ลบผู้ใช้ (มี modal ยืนยันก่อนทุกครั้ง)
14. **จัดการหมวดหมู่ / ปี** — เพิ่ม/แก้ไข/ลบหมวดหมู่และปีข้อสอบ
15. **ตั้งค่าระบบ** — จำนวนข้อสอบเต็ม, เวลาสอบ, เปิด/ปิด Google Sign-in, โหมดปิดปรับปรุงระบบ, ตั้งค่า AI API keys

ทุกการกระทำที่ "ทำลายข้อมูล" (ลบคำถาม, ลบผู้ใช้, ล้างประวัติ, เปลี่ยนค่าระบบสำคัญ) ต้องเด้ง **confirmation modal** ที่ระบุชัดว่ากำลังจะทำอะไร เช่น
> "คุณกำลังจะลบผู้ใช้ 'somchai@email.com' การกระทำนี้ไม่สามารถย้อนกลับได้ ยืนยันหรือไม่?"

### สิ่งที่ตัดออกตามที่แจ้ง
- ❌ ฟีเจอร์ AI สร้างข้อสอบที่หน้าหลัก (ตัดทั้งปุ่มและ modal — ย้ายไปอยู่ฝั่ง Admin เท่านั้น)
- ❌ ฟีเจอร์สรุปเนื้อหาด้วย AI ที่หน้าหลัก (ตัดทั้งปุ่มและ modal)
- ❌ AI ติวเตอร์ (ตัดทั้งปุ่ม, modal, และฟังก์ชันที่เกี่ยวข้องทั้งหมด)

---

## 7. AI ออกข้อสอบในหน้า Admin (ร่างก่อนบันทึกจริง)

### หลักการ: AI ไม่มีสิทธิ์เขียนลง `questions` collection โดยตรง

```
1. Admin เข้าหน้า "สร้างข้อสอบด้วย AI" → เลือก provider (Claude / Gemini)
   → เลือกหมวดหมู่ + ปี (ถ้ามี) + จำนวนข้อที่ต้องการร่าง + ระดับความยาก
2. กด "ร่างข้อสอบ" → เรียก API ตรงจาก browser ของ admin คนนั้น
   (Claude: https://api.anthropic.com/v1/messages, Gemini: ตามเดิม)
3. ผลลัพธ์ที่ AI ส่งกลับ แสดงเป็น "การ์ดร่าง" ทีละข้อ ในสถานะ DRAFT (ยังไม่บันทึก)
   แต่ละการ์ดมีปุ่ม:
   - ✏️ แก้ไข (เปิดฟอร์มเดียวกับฟอร์มเพิ่มคำถามปกติ ให้แก้คำถาม/ตัวเลือก/เฉลย/คำอธิบายได้ทุกช่อง)
   - 🗑️ ลบทิ้ง (ไม่ต้องการข้อนี้)
   - ✅ ไม่ต้องแก้ ใช้ตามนี้ (mark ว่าพร้อมบันทึก)
4. ปุ่ม "บันทึกข้อที่เลือกทั้งหมดลงคลัง" ที่ด้านล่าง
   → เด้ง confirmation modal สรุปจำนวนข้อที่จะถูกเพิ่ม
   → เมื่อยืนยัน ระบบจึงเขียนแต่ละข้อเข้า questions collection จริง
     พร้อม field createdBy = uid ของ admin, source: "ai_generated"
5. ถ้า admin ปิดหน้าหรือกด "ยกเลิกทั้งหมด" ก่อนกดบันทึก ร่างทั้งหมดจะหายไป
   (ไม่มีการ auto-save ร่างที่ยังไม่ผ่านการตรวจ)
```

ทุกข้อที่มาจาก AI จะมี badge "🤖 AI" ติดอยู่ถาวรในตาราง "จัดการคำถาม"
เพื่อให้รู้ทีหลังว่าข้อไหน admin เขียนเอง ข้อไหนมาจาก AI (มี field `source: "manual" | "ai_generated"` ใน schema คำถาม)

### ⚠️ ข้อจำกัดด้านความปลอดภัยของการเก็บ AI API Key

ตามที่ตกลง: **เก็บ key กลางไว้ใน `systemConfig.aiKeys`** ใช้ร่วมกันทุก admin
เพื่อความโปร่งใส ขอบันทึกข้อจำกัดไว้ตรงนี้ (และจะแสดงคำเตือนเดียวกันนี้ในหน้า "ตั้งค่าระบบ" ของแอดมินด้วย):

- เนื่องจากแอปนี้เป็น static site (ไม่มี backend server) การเรียก Claude/Gemini API
  ต้องทำจาก browser ของ admin ตรง ๆ ซึ่งหมายความว่า **key จะปรากฏใน Network request
  ของเบราว์เซอร์ admin คนนั้น และสามารถถูกคัดลอกออกได้ผ่าน DevTools**
- **ทุกคนที่มี role admin สามารถเห็น/คัดลอก key ทั้งสองตัวได้** (ไม่ได้ถูกซ่อนจาก admin ด้วยกันเอง)
- หาก admin คนใดคนหนึ่งทำ key หลุด หรือบัญชี admin ถูกแฮ็ก ต้องไป **revoke/regenerate key
  ที่ฝั่งผู้ให้บริการ** (Anthropic Console / Google AI Studio) แล้วอัปเดตค่าใหม่ใน systemConfig
- ทางเลือกที่ปลอดภัยกว่า (ไม่ทำในเฟสนี้): ย้ายการเรียก AI ไปอยู่หลัง Cloud Function
  ที่เก็บ key เป็น server-side secret — ต้องเปิด Firebase Blaze plan (มี free tier ในตัว
  แต่ต้องผูก billing account) — แจ้งได้ถ้าต้องการอัปเกรดในอนาคต

---

## 8. หน้าสมัครสมาชิก — ยืนยันข้อมูลก่อนสมัครจริง

แทนที่จะกดสมัครแล้วสร้างบัญชีทันที จะมี 2 ขั้นตอน:

```
ขั้นที่ 1 — ฟอร์มกรอกข้อมูล
  - ชื่อที่แสดง (Display Name)
  - อีเมล
  - รหัสผ่าน + ยืนยันรหัสผ่าน (เช็ค match ฝั่ง client ก่อน)
  - ☑ Checkbox บังคับติ๊ก: "ข้าพเจ้าได้อ่านและยอมรับ [คำชี้แจงการใช้งานระบบ]"
    (ปุ่ม "สมัครสมาชิก" จะถูก disabled ไว้จนกว่าจะติ๊กช่องนี้)

ขั้นที่ 2 — หน้า/การ์ดยืนยันก่อนส่งจริง (ไม่ใช่ modal เดียว ใช้เป็น step แยก)
  - แสดงข้อมูลที่กรอกซ้ำอีกครั้ง (ชื่อ, อีเมล) ให้ตรวจทาน
  - ปุ่ม "← กลับไปแก้ไข" และ "✅ ยืนยันสมัครสมาชิก"
  - กด "ยืนยันสมัครสมาชิก" ถึงจะเรียก Firebase Auth createUserWithEmailAndPassword จริง
```

**คำชี้แจงการใช้งานระบบ** (เนื้อหาเริ่มต้น ปรับแก้ได้):
- ระบบนี้ใช้สำหรับฝึกทำข้อสอบ ก.พ. เพื่อการศึกษาเท่านั้น ไม่ใช่ระบบสอบจริงของสำนักงาน ก.พ.
- ข้อมูลที่กรอก (ชื่อ, อีเมล, ประวัติการทำข้อสอบ) จะถูกเก็บไว้ในระบบเพื่อแสดงผลสถิติส่วนตัวเท่านั้น
- กรุณาใช้รหัสผ่านที่ไม่ซ้ำกับบริการอื่น และไม่เปิดเผยรหัสผ่านให้ผู้อื่น

---

## 9. Firestore Security Rules (โครงร่าง)

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }
    function isAdmin() {
      return isSignedIn() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }
    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }

    match /users/{uid} {
      allow read: if isOwner(uid) || isAdmin();
      allow create: if isOwner(uid);              // สมัครสมาชิกครั้งแรก สร้าง doc ตัวเอง role=user เท่านั้น
      allow update: if isOwner(uid)
                    && request.resource.data.role == resource.data.role; // user แก้ role ตัวเองไม่ได้
      allow update: if isAdmin();                  // admin แก้ของใครก็ได้ (รวม role)
      allow delete: if isAdmin();
    }

    match /categories/{id} {
      allow read: if true;                         // public อ่านได้ (ใช้ตอนยังไม่ล็อกอินก็ได้)
      allow write: if isAdmin();
    }

    match /examYears/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /questions/{id} {
      allow read: if isSignedIn();                  // ต้องล็อกอินถึงเห็นคลังคำถาม
      allow write: if isAdmin();
    }

    match /examAttempts/{id} {
      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
      allow read, update: if isSignedIn() && resource.data.userId == request.auth.uid;
      allow read: if isAdmin();
      allow delete: if isAdmin();
    }

    match /userSeenQuestions/{uid} {
      allow read, write: if isOwner(uid) || isAdmin();
    }

    match /systemConfig/{id} {
      allow read: if true;               // ⚠️ สำหรับ public read ทั่วไป (ค่าตั้งค่าทั่วไป)
      allow write: if isAdmin();
      // หมายเหตุ: เนื่องจาก field aiKeys อยู่ใน doc เดียวกัน
      // การตั้ง "allow read: if true" จะทำให้ aiKeys หลุดไปด้วย!
      // ดูทางแก้ในหัวข้อ 10 ด้านล่าง
    }
  }
}
```

จุดสำคัญ: **`role` เปลี่ยนได้โดย admin เท่านั้น** — ผู้ใช้ทั่วไปแก้ field นี้ของตัวเองไม่ได้แม้จะแก้ผ่าน client โดยตรง เพราะ rule บังคับที่ฝั่งเซิร์ฟเวอร์

> ⚠️ **จุดที่ต้องแก้ก่อนใช้งานจริง**: ในโครงร่างข้างบน `systemConfig` เปิด `read: if true`
> เพื่อให้หน้า public (ยังไม่ล็อกอิน) อ่านค่าทั่วไปได้ (เช่น maintenanceMode) — แต่ field `aiKeys`
> ต้องไม่ถูกอ่านแบบ public ดูวิธีแก้ในหัวข้อ 10

---

## 10. การป้องกัน XSS และความปลอดภัยฝั่ง Client

### 10.1 แยก `systemConfig` ออกเป็น 2 เอกสาร เพื่อไม่ให้ aiKeys รั่วผ่าน public read

```
systemConfig/public     ← อ่านได้ทุกคน (รวมไม่ล็อกอิน)
   fullExamQuestionCount, fullExamTimeMinutes, allowGoogleSignIn,
   allowEmailSignup, maintenanceMode, maintenanceMessage

systemConfig/secrets    ← อ่าน/เขียนได้เฉพาะ admin เท่านั้น
   aiKeys: { claudeApiKey, geminiApiKey }
```

```js
match /systemConfig/public {
  allow read: if true;
  allow write: if isAdmin();
}
match /systemConfig/secrets {
  allow read, write: if isAdmin();   // ผู้ใช้ทั่วไปอ่านไม่ได้แม้จะรู้ path ตรง
}
```

### 10.2 หลักการป้องกัน XSS ในโค้ดแอป

แอปนี้มีจุดเสี่ยง XSS หลักอยู่ 2 จุด คือ (1) การแสดงคำถาม/ตัวเลือก/คำอธิบายที่ admin หรือ AI
เป็นคนกรอก และ (2) ฟอร์มต่าง ๆ ที่รับ input จากผู้ใช้ทั่วไป (ชื่อโปรไฟล์)

| มาตรการ | รายละเอียด |
|---|---|
| **ห้ามใช้ `innerHTML` กับข้อมูลที่ผู้ใช้/AI ป้อน** | ใช้ `textContent` หรือ `el.innerText` แทนเสมอ เมื่อ render คำถาม/ตัวเลือก/ชื่อผู้ใช้/คำอธิบาย ที่เดิมโค้ดใช้ `innerHTML` แสดงคำถาม (`document.getElementById('question-text').innerHTML = question.question`) จะถูกเปลี่ยนเป็น `textContent` หรือผ่านฟังก์ชัน sanitize ก่อนทุกครั้ง |
| **Sanitize ก่อน render ถ้าจำเป็นต้องใช้ HTML** | ถ้าต้องการให้ admin ใส่ตัวหนา/ตัวเอียงในคำอธิบายได้ ให้ผ่านไลบรารี sanitize (เช่น DOMPurify) ก่อนใส่ผ่าน innerHTML ไม่ใช้ string ดิบจาก input ตรง ๆ เด็ดขาด |
| **Escape ข้อมูลในตาราง (tableData)** | ตาราง headers/rows ที่ admin กรอก ต้อง escape ตัวอักษรพิเศษ (`<`, `>`, `&`, `"`) ก่อน render เป็น `<td>`/`<th>` เสมอ — สร้างฟังก์ชัน `escapeHtml()` กลางใช้ร่วมกันทุกจุดที่ต้องประกอบ HTML string |
| **Validate input ฝั่ง client + Security Rules ฝั่ง server** | จำกัดความยาวของ string fields (เช่น questionText ≤ 2000 ตัวอักษร, displayName ≤ 100 ตัวอักษร) ทั้งใน UI form และใน Firestore Rules (`request.resource.data.questionText.size() < 2000`) เพื่อกันทั้งการโจมตีและการกรอกข้อมูลผิดปกติ |
| **Content Security Policy (CSP) header** | ตั้งค่า CSP ผ่าน meta tag หรือ Firebase Hosting header config จำกัดให้โหลด script จาก domain ที่ระบุไว้เท่านั้น (self, Tailwind CDN, Google Fonts) ป้องกัน script injection จากแหล่งอื่น |
| **ป้องกัน AI-generated content เป็นช่องโหว่** | เนื้อหาที่ AI ร่างมาให้ ก็ต้องผ่าน sanitize เดียวกันกับที่ admin กรอกมือ ก่อน render ในหน้า "การ์ดร่าง" เพราะในทางทฤษฎี prompt injection อาจทำให้ AI คืนค่าที่มี HTML/script แปลกปลอมมาได้ |
| **ห้ามใช้ `eval()`, `new Function()`, หรือ `setTimeout`/`setInterval` กับ string** | ไม่มีจุดใดในแอปที่ต้องใช้ dynamic code execution อยู่แล้ว แต่ระบุไว้เป็นกฎตายตัวของโค้ดเบสนี้ |
| **Firebase Auth คุม session ให้** | ไม่ต้องเขียน custom token handling เอง ใช้ SDK ของ Firebase Auth ทั้งหมดเพื่อลดความเสี่ยงเรื่อง token ถูกขโมยผ่าน XSS (Firebase SDK จัดการ token แบบไม่ฝัง raw token ใน DOM) |

สรุปสั้น ๆ: **กฎทองคือ "ข้อมูลจากใครก็ตามที่ไม่ใช่ตัวเราเอง (user, admin, หรือ AI) ให้ถือว่าไม่น่าเชื่อถือ
เสมอ ต้อง escape/sanitize ก่อน render เป็น HTML ทุกครั้งไม่มีข้อยกเว้น"**

---

## 11. ขั้นตอนตั้งค่า Admin คนแรก (ตามที่ตกลง)

1. คุณ deploy เว็บเสร็จ แล้วสมัครสมาชิกด้วยอีเมลจริงของคุณตามปกติผ่านหน้าเว็บ (จะได้ role: "user" โดย default)
2. แจ้งอีเมลที่ใช้สมัครมา (หรือเปิด Firebase Console เอง)
3. ไปที่ Firestore Console → `users/{uid ของคุณ}` → แก้ field `role` จาก `"user"` เป็น `"admin"` ด้วยมือ (ทำครั้งเดียว)
4. ตั้งแต่นั้น คุณจะเห็นทางเข้าหน้า Admin (ผ่าน URL `/admin` ที่ไม่โชว์ในเมนู) และ Security Rules จะยอมให้คุณเขียน/ลบข้อมูลผ่าน Admin Dashboard เพื่อตั้ง admin คนต่อไปได้เองโดยไม่ต้องเข้า Console อีก

---

## สรุปสิ่งที่ confirm แล้ว ✅ (ครบทุกข้อ พร้อมเริ่มเขียนโค้ด)

- ✅ AI ติวเตอร์ — ตัดทิ้ง
- ✅ AI สร้างข้อสอบ — ย้ายไปอยู่ฝั่ง Admin เท่านั้น แบบร่างก่อนบันทึกจริง (หัวข้อ 7)
- ✅ Provider — เลือกได้ทั้ง Claude (4.5+) และ Gemini (2.5 Flash+) ทุกครั้งที่กดสร้าง
- ✅ เก็บ API key กลางไว้ใน `systemConfig/secrets` ใช้ร่วมกันทุก admin (รับทราบข้อจำกัดด้านความปลอดภัยตามหัวข้อ 7.1)
- ✅ Admin คนแรก — สมัครผ่านระบบปกติด้วยอีเมลจริง แล้วตั้ง role ด้วยมือใน Firestore Console
- ✅ สุ่มข้อสอบ 100 ข้อ — ไม่ซ้ำข้ามรอบ มี fallback ถ้าคลังไม่พอ
- ✅ หน้าสมัครสมาชิก — เพิ่มขั้นยืนยันข้อมูล + checkbox ยอมรับคำชี้แจงก่อนสมัครจริง
- ✅ ป้องกัน XSS — sanitize/escape ทุกจุดที่ render ข้อมูลจาก user/admin/AI (หัวข้อ 10)
- ✅ **โหมดแยกหมวดหมู่/แยกปี** — ผู้ใช้เลือกจำนวนข้อเอง ผ่านตัวเลือกสำเร็จรูป **10 / 25 / 50 ข้อ** (ไม่ใช่กรอกตัวเลขอิสระ เพื่อกันค่าผิดปกติ เช่น 0 หรือ 99999)
- ✅ **Google Sign-In** — เปิดใช้งานทั้ง 2 ทาง (Email/Password + Google) ตั้งแต่เริ่มต้น
- ✅ **คลังคำถามเริ่มต้น** — Import คำถามเดิมจากไฟล์ `quizData` (~125 ข้อ จาก 3 หมวด: ความสามารถทั่วไป/ภาษาอังกฤษ/การเป็นข้าราชการที่ดี) เข้า Firestore เป็นชุดเริ่มต้น ผ่านสคริปต์ one-time seed (จะเตรียมให้ในขั้น implement พร้อมกับการตั้งค่า Firebase project)

### รายละเอียดเพิ่มเติมที่เกี่ยวกับมติข้างบน

**ตัวเลือกจำนวนข้อ (10/25/50)** จะใช้กับโหมด "แยกหมวดหมู่" และ "แยกปี" เท่านั้น
ส่วนโหมด "ข้อสอบจริง 100 ข้อ" คงจำนวนตายตัวที่ 100 ตามที่ระบุไว้ตั้งแต่ต้น (ปรับได้จาก `systemConfig.fullExamQuestionCount` โดย admin)

**สคริปต์ seed ข้อมูลเริ่มต้น** จะทำเป็นไฟล์ Node.js แยก (รันครั้งเดียวตอน setup โปรเจกต์)
ใช้ Firebase Admin SDK เขียนข้อมูลเข้า `categories`, `examYears` (ปีตั้งต้น เช่น "2568"), และ `questions`
พร้อมแปลงคำถามเดิมทั้งหมดให้มี field `source: "manual"`, `isActive: true`, `difficulty: "medium"` (ค่าเริ่มต้น admin ปรับทีหลังได้)

---

## ขั้นตอนถัดไป

เอกสารสถาปัตยกรรมสมบูรณ์แล้ว ขั้นต่อไปคือลงมือ implement จริง ได้แก่:

1. ตั้งค่า Firebase project (Auth + Firestore + Hosting) และ Security Rules ตามหัวข้อ 9-10
2. เขียนหน้าเว็บทั้งหมดตามหัวข้อ 4 (landing, auth flow, dashboard, exam, profile, admin panel)
3. เขียนสคริปต์ seed คำถามเริ่มต้น
4. ทดสอบ flow ทั้งหมด (สมัคร → ยืนยัน admin role ด้วยมือ → ทดลองเพิ่มคำถาม → ทดลอง AI draft → ทดลองทำข้อสอบ)

พร้อมเริ่มเขียนโค้ดได้เลยครับ — จะเริ่มจากโครงสร้างโปรเจกต์และ Firebase config ก่อน


