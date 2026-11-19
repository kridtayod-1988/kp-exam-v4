"use client";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/login");
  }
  return <button className="btn btn-secondary" onClick={signOut} style={{ padding: "8px 12px", fontSize: 12 }}>ออกจากระบบ</button>;
}
