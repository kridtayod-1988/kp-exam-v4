-- ============================================
-- Postgres ให้สิทธิ์ EXECUTE กับ role PUBLIC เป็นค่าเริ่มต้นเสมอ
-- แม้ revoke จาก anon/authenticated ตรง ๆ แล้ว (migration ก่อนหน้า) ก็ยังรับสิทธิ์
-- ทางอ้อมผ่าน PUBLIC อยู่ดี ต้อง revoke จาก PUBLIC โดยตรงด้วย
-- (Migration 4/5 — พบจาก Security Advisor หลัง apply migration ก่อนหน้า)
-- ============================================
revoke execute on function public.is_admin() from public;
revoke execute on function public.handle_new_user() from public;

-- คง grant ให้เฉพาะ postgres/service role (ที่ trigger และ RLS policy ใช้เรียกภายใน) เท่านั้น
grant execute on function public.is_admin() to postgres;
grant execute on function public.handle_new_user() to postgres;
