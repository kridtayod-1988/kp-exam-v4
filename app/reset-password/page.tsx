"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setMessage(error ? error.message : "เปลี่ยนรหัสผ่านสำเร็จ");
    setBusy(false);
    if (!error) window.location.assign("/dashboard");
  }
  return <main className="container" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><section className="card stack" style={{ width: "min(100%, 440px)" }}><h1>ตั้งรหัสผ่านใหม่</h1><form className="stack" onSubmit={submit}><input className="field" type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)" required /><button className="btn" disabled={busy}>{busy ? "กำลังบันทึก..." : "บันทึกรหัสผ่าน"}</button></form>{message && <p className="muted">{message}</p>}</section></main>;
}