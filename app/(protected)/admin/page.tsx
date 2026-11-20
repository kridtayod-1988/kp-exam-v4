import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

const links = [
  ["/admin/questions","คลังข้อสอบ","เพิ่ม แก้ไข และปิดใช้งานข้อสอบ"],
  ["/admin/blueprints","Exam Blueprints","จัดสัดส่วนข้อสอบและเวลาสอบ"],
  ["/admin/ai-generator","AI Question Generator","สร้าง Draft และอนุมัติก่อนเข้าคลัง"],
  ["/admin/taxonomy","หมวดหมู่และปีข้อสอบ","จัดการหมวดหมู่หลักและปีข้อสอบ"],
  ["/admin/import","นำเข้าข้อสอบ CSV","นำเข้าข้อสอบเป็นชุด"],
  ["/admin/users","จัดการสมาชิก","ตรวจสอบสถิติและระงับบัญชี"],
];

export default async function AdminPage() {
  await requireAdmin();
  return <section className="stack"><div><p className="gold">ADMIN CONTROL CENTER</p><h1>จัดการระบบสอบ</h1><p className="muted">ทุกหน้าตรวจสิทธิ์ Admin ฝั่ง Server และใช้ RLS ควบคุมการเข้าถึงข้อมูล</p></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
      {links.map(([href,title,desc])=><Link href={href} key={href} className="card"><h2 style={{marginTop:0}}>{title}</h2><p className="muted">{desc}</p><span className="gold">เปิดหน้าจัดการ →</span></Link>)}
    </div>
  </section>;
}
