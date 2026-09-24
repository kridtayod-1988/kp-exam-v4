-- ============================================
-- ปิดช่องโหว่: ป้องกันไม่ให้เรียก is_admin() และ handle_new_user()
-- ตรงผ่าน REST API (/rpc/...) — ฟังก์ชันทั้งสองควรถูกเรียกจากภายใน
-- RLS policy / trigger เท่านั้น ไม่ใช่ endpoint สาธารณะ
-- (Migration 3/5)
-- ============================================
revoke execute on function public.is_admin() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
