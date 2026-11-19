"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const next = new URLSearchParams(window.location.search).get("next") || "/dashboard";
        window.location.assign(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          },
        });
        if (error) throw error;
        if (data.session) window.location.assign("/dashboard");
        else setMessage("สมัครสำเร็จ กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชีก่อนเข้าสู่ระบบ");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
    });
    if (error) {
      setMessage(error.message);
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ marginBlock: 20 }}>
      <form className="stack" onSubmit={handleSubmit}>
        {mode === "signup" && <label className="stack"><span>ชื่อที่แสดง</span><input className="field" value={name} onChange={e => setName(e.target.value)} required maxLength={100} /></label>}
        <label className="stack"><span>อีเมล</span><input className="field" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label className="stack"><span>รหัสผ่าน</span><input className="field" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} /></label>
        <button className="btn" type="submit" disabled={busy}>{busy ? "กำลังดำเนินการ..." : mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}</button>
      </form>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ height: 1, background: "#333", flex: 1 }} /><span className="muted" style={{ fontSize: 12 }}>หรือ</span><span style={{ height: 1, background: "#333", flex: 1 }} /></div>
      <button className="btn btn-secondary" type="button" onClick={signInWithGoogle} disabled={busy}>เข้าสู่ระบบด้วย Google</button>
      {message && <p role="status" className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>{message}</p>}
    </div>
  );
}
