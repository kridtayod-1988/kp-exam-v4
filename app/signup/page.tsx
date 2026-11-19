import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function SignupPage() {
  return (
    <main className="container" style={{ minHeight: "100vh", display: "grid", placeItems: "center", paddingBlock: 32 }}>
      <section className="card" style={{ width: "min(100%, 440px)" }}>
        <h1 className="gold" style={{ textAlign: "center" }}>สมัครสมาชิก</h1>
        <p className="muted" style={{ textAlign: "center" }}>สร้างบัญชีเพื่อบันทึกประวัติการฝึกสอบ</p>
        <AuthForm mode="signup" />
        <p className="muted" style={{ textAlign: "center", fontSize: 14 }}>มีบัญชีแล้ว? <Link className="gold" href="/login">เข้าสู่ระบบ</Link></p>
      </section>
    </main>
  );
}
