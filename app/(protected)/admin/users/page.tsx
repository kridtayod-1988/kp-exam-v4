import Link from "next/link";
import {requireAdmin} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
import {UserManager} from "@/components/admin/user-manager";
export default async function AdminUsersPage(){await requireAdmin();const supabase=await createClient();const {data,error}=await supabase.from("profiles").select("id,display_name,email,role,status,total_attempts,total_exp").order("created_at",{ascending:false}).limit(200);return <section className="stack"><div><Link href="/admin" className="gold">← Admin</Link><h1>จัดการสมาชิก</h1><p className="muted">ระงับหรือปลดระงับบัญชี โดยไม่เปลี่ยน role และไม่ลบประวัติสอบ</p></div>{error&&<p role="alert">{error.message}</p>}<UserManager initial={(data??[]) as never[]}/></section>;}
