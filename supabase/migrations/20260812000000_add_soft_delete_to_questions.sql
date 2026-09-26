-- ============================================
-- Soft-delete support สำหรับ questions table
-- (Migration 6/5: เพิ่มจากมิเกรชันเดิม)
--
-- วิธีใช้:
--   supabase migration up
--
-- ============================================

-- เพิ่มคอลัมน์ deleted_at เพื่อ soft-delete
alter table public.questions
add column deleted_at timestamptz;

-- สร้าง index เพื่อให้ query "ข้อที่ยังไม่ลบ" เร็ว
-- (query จะใช้ `where is_active = true and deleted_at is null`)
create index idx_questions_not_deleted on public.questions (is_active, category_id)
where deleted_at is null;

create index idx_questions_deleted_at on public.questions (deleted_at desc)
where deleted_at is not null;

-- หมาย: deleted_at = null หมายถึง ยังไม่ลบ
-- deleted_at != null หมายถึง ลบแล้ว (เก็บเพื่อกู้คืนได้ภายหลัง)
comment on column public.questions.deleted_at is 'วันเวลาที่ลบ (soft-delete) — null = ยังไม่ลบ';
