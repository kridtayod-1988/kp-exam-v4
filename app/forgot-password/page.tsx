"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` });
    setMessage(error ? error.message : "ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว กรุณาตรวจสอบอีเมล");
    setBusy(false);
  }
  return <main className="container" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><section className="card stack" style={{ width: "min(100%, 440px)" }}><h1>ลืมรหัสผ่าน</h1><form className="stack" onSubmit={submit}><input className="field" type="email" placeholder="อีเมล" value={email} onChange={e => setEmail(e.target.value)} required /><button className="btn" disabled={busy}>{busy ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ต"}</button></form>{message && <p className="muted">{message}</p>}<Link className="gold" href="/login">กลับไปเข้าสู่ระบบ</Link></section></main>;
}