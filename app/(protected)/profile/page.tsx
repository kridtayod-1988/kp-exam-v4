import { requireUser } from "@/lib/auth";

export default async function ProfilePage() {
  const profile = await requireUser();
  return <section className="card stack"><h1 style={{ margin: 0 }}>โปรไฟล์</h1><p>ชื่อ: {profile.display_name}</p><p>อีเมล: {profile.email}</p><p>สิทธิ์: {profile.role}</p><p>ทำข้อสอบแล้ว: {profile.total_attempts}</p><p>EXP: {profile.total_exp}</p></section>;
}