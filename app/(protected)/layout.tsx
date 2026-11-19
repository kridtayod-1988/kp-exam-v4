import { requireUser } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser();
  return (
    <>
      <header style={{ borderBottom: "1px solid #292929", background: "#101010" }}>
        <div className="container" style={{ minHeight: 68, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <a href="/dashboard" className="gold" style={{ fontWeight: 800 }}>🎓 ก.พ. E-EXAM 2569</a>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
            <span className="muted">{profile.display_name}</span>
            {profile.role === "admin" && <a className="gold" href="/admin">Admin</a>}
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="container" style={{ paddingBlock: 32 }}>{children}</main>
    </>
  );
}
