-- ทะเบียนศูนย์มีช่อง "ระบบ" (ค่ายอินเทอร์เน็ต) แล้ว — ศูนย์เดิมทั้งหมดเป็น 3BB
UPDATE "Center" SET "provider" = '3BB' WHERE "kind" = 'INTERNET' AND "provider" = '';
