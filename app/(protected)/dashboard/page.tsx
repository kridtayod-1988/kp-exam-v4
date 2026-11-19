import Link from "next/link";
import { requireUser } from "@/lib/auth";

export default async function DashboardPage() {
  const profile = await requireUser();
  return (
    <section className="stack">
      <div>
        <p className="gold" style={{ fontWeight: 700 }}>ยินดีต้อนรับ</p>
        <h1 style={{ fontSize: 32, margin: "8px 0" }}>สวัสดี {profile.display_name}</h1>
        <p className="muted">พื้นที่เตรียมสอบ ก.พ. ของคุณ</p>
      </div>
      <div className="card stack">
        <h2 style={{ margin: 0 }}>เริ่มต้นใช้งาน</h2>
        <p className="muted">โครงสร้าง App Router และระบบยืนยันตัวตนพร้อมแล้ว ขั้นต่อไปจะย้ายหน้าคลังข้อสอบและ Exam Engine เข้ามาโดยคง schema เดิม</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Link className="btn" href="/exam">ไปหน้าสอบ</Link>
          <Link className="btn btn-secondary" href="/profile">โปรไฟล์</Link>
        </div>
      </div>
    </section>
  );
}
