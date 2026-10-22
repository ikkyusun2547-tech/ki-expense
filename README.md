# ระบบเบิกค่าอินเทอร์เน็ต

ระบบเบิกค่าอินเทอร์เน็ต 3BB ของศูนย์ — บริษัท น้ำตาลสุรินทร์ จำกัด (ฝ่ายจัดหาวัตถุดิบ)

> README ฉบับเต็ม (deploy, คู่มือผู้ใช้) จะเขียนในเฟส 6

## ตั้งค่าเครื่องพัฒนา

1. ติดตั้ง Node.js 24 ขึ้นไป
2. `npm install`
3. ติดตั้ง PostgreSQL 17 (`winget install PostgreSQL.PostgreSQL.17`) สร้าง role และ database `internet_expense`
4. คัดลอก `.env.example` เป็น `.env` แล้วใส่ `DATABASE_URL` และ `SEED_ADMIN_PASSWORD`
5. `npm run db:migrate` สร้างตาราง
6. `npm run db:seed` สร้าง admin คนแรก และนำเข้าทะเบียนศูนย์จาก `data/centers.csv`
7. `npm run dev` แล้วเปิด http://localhost:3000
