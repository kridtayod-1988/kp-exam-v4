import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <main className="container" style={{ minHeight: "100vh", display: "grid", placeItems: "center", paddingBlock: 32 }}>
      <section className="card" style={{ width: "min(100%, 440px)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 38 }}>🎓</div>
          <h1 className="gold" style={{ margin: "8px 0" }}>ก.พ. E-EXAM 2569</h1>
          <p className="muted" style={{ margin: 0 }}>เข้าสู่ระบบเพื่อเริ่มเตรียมสอบ</p>
        </div>
        <AuthForm mode="login" />
        <p className="muted" style={{ textAlign: "center", fontSize: 14, marginBottom: 0 }}>
          ยังไม่มีบัญชี? <Link className="gold" href="/signup">สมัครสมาชิก</Link>
          {" · "}<Link className="gold" href="/forgot-password">ลืมรหัสผ่าน</Link>
        </p>
      </section>
    </main>
  );
}
