# ระบบเบิกค่าอินเทอร์เน็ต

ระบบเบิกค่าอินเทอร์เน็ต 3BB ของศูนย์ — บริษัท น้ำตาลสุรินทร์ จำกัด (ฝ่ายจัดหาวัตถุดิบ)

เอกสารนี้สำหรับ**ผู้ดูแลระบบ/ฝ่าย IT** — คู่มือการใช้งานสำหรับพนักงานอยู่ที่ [docs/คู่มือผู้ใช้.md](docs/คู่มือผู้ใช้.md)

## ภาพรวม

- เว็บแอปภายใน รันบนเครื่อง Windows ของบริษัท ข้อมูลทั้งหมดอยู่ในเครื่องนี้ ไม่ใช้บริการภายนอก
- Next.js 16 + PostgreSQL 17 (ติดตั้งบนเครื่องเดียวกัน) + Prisma 7
- ล็อกอินด้วยชื่อผู้ใช้/รหัสผ่านของระบบเอง — admin สร้างบัญชีและรีเซ็ตรหัสให้พนักงาน
- ไฟล์ใบแจ้งหนี้เก็บบนดิสก์ (`UPLOAD_DIR`) ไม่ได้อยู่ในฐานข้อมูล
- ใช้งานเฉพาะ**ในวงแลนของบริษัท ผ่าน http** — ไม่เปิดให้เข้าจากนอกบริษัท

| ตำแหน่ง | ใช้ทำอะไร |
|---|---|
| `C:\Users\IT\KI internat` | โค้ด + เครื่องพัฒนา (ฐานข้อมูล `internet_expense`) |
| `C:\InternetExpense\app` | ระบบใช้งานจริง (ฐานข้อมูล `internet_expense_prod`, ค่าตั้งใน `app\.env`) |
| `C:\InternetExpense\data\invoices` | ไฟล์ใบแจ้งหนี้ของระบบจริง |
| `C:\InternetExpense\logs` | log ของระบบจริง (`app-YYYYMMDD.log`) |
| `D:\InternetExpenseBackup` | ไฟล์สำรอง (`db\*.dump` + `invoices\`) |

## ติดตั้งระบบใช้งานจริง (ครั้งแรก)

ทำบนเครื่องเซิร์ฟเวอร์ ต้องมี Node.js 24+ และ PostgreSQL 17 (มีอยู่แล้วบนเครื่องนี้)

1. ถ้ามีไฟล์ทะเบียนศูนย์ วางไว้ที่ `data\centers.csv` ในโฟลเดอร์โค้ดก่อน (ไม่มีก็ได้ — admin นำเข้าทีหลังได้ที่หน้าทะเบียนศูนย์ → "นำเข้าจากไฟล์")
2. เปิด PowerShell ที่โฟลเดอร์โค้ด แล้วรัน
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
   ```
   สคริปต์จะคัดลอกโค้ดไปที่ `C:\InternetExpense\app` สร้างฐานข้อมูลจริง สร้างไฟล์ `.env` ของระบบจริง และสร้างบัญชี `admin`
   (รหัสเริ่มต้นอยู่ใน `C:\InternetExpense\app\.env` บรรทัด `SEED_ADMIN_PASSWORD` — ต้องเปลี่ยนตอนล็อกอินครั้งแรก)
3. เปิด PowerShell แบบ **Run as administrator** แล้วรัน
   ```powershell
   powershell -ExecutionPolicy Bypass -File C:\InternetExpense\app\scripts\install-service.ps1
   ```
   จะตั้งค่า:
   - ระบบเปิดเองตอนเปิดเครื่อง (Task Scheduler: `InternetExpense-App`) และเปิดใหม่อัตโนมัติถ้าล้ม
   - สำรองข้อมูลทุกวัน 02:00 ไปที่ `D:\InternetExpenseBackup` (Task: `InternetExpense-Backup`)
   - firewall เปิด TCP 8080 เฉพาะเครือข่าย Domain/Private
4. เครื่องอื่นในวงแลนเข้าใช้ที่ `http://<ชื่อเครื่อง>:8080` เช่น `http://IT5:8080`

> เครื่องเซิร์ฟเวอร์ต้องเปิดทิ้งไว้ตลอดเวลาทำงาน และควรตั้ง Power Options ไม่ให้ Sleep

## อัปเดตระบบ (หลังแก้โค้ด)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
```

คัดลอกโค้ดใหม่ อัปเดตโครงสร้างฐานข้อมูล build แล้วรีสตาร์ทระบบ — ไม่แตะ `.env` ข้อมูล และไฟล์ใบแจ้งหนี้ของระบบจริง
(ถ้ารีสตาร์ทไม่ได้เพราะสิทธิ์ ให้เปิด Task Scheduler แล้ว End/Run task `InternetExpense-App`)

## สำรองข้อมูลและกู้คืน

- สำรองอัตโนมัติทุกคืน เก็บฐานข้อมูลย้อนหลัง 30 วัน ดูผลใน `D:\InternetExpenseBackup\backup.log`
- สำรองเองทันที:
  ```powershell
  powershell -ExecutionPolicy Bypass -File C:\InternetExpense\app\scripts\backup.ps1 -EnvFile C:\InternetExpense\app\.env
  ```
- **D: อยู่บนฮาร์ดดิสก์ลูกเดียวกับ C:** ถ้าดิสก์เสียไฟล์สำรองจะหายด้วย → **คัดลอกโฟลเดอร์ `D:\InternetExpenseBackup` ไปเก็บในฮาร์ดดิสก์ภายนอกสัปดาห์ละครั้ง**
- กู้คืน (แทนที่ข้อมูลปัจจุบันทั้งหมด — หยุดระบบก่อน):
  ```powershell
  Stop-ScheduledTask -TaskName "InternetExpense-App"
  powershell -ExecutionPolicy Bypass -File C:\InternetExpense\app\scripts\restore.ps1 `
    -EnvFile C:\InternetExpense\app\.env `
    -DumpFile D:\InternetExpenseBackup\db\<ไฟล์>.dump `
    -InvoicesBackup D:\InternetExpenseBackup\invoices -Force
  Start-ScheduledTask -TaskName "InternetExpense-App"
  ```

## งานที่ผู้ดูแลระบบอาจต้องทำ

| เรื่อง | วิธี |
|---|---|
| เปลี่ยนชื่อฝ่าย/ข้อความบนใบเบิก | ผู้จัดทำแก้ในฟอร์มใบเบิกแต่ละใบ (ส่วน "ข้อความบนใบเบิก") — รหัสฟอร์มอยู่ในโค้ด `FORM_CODE` (`src/lib/pdf/memoData.ts`) |
| เพิ่มผู้อนุมัติ/ผู้จัดทำ | admin → เมนู "ผู้ใช้" → เพิ่มผู้ใช้ (ต้องใส่ตำแหน่ง — พิมพ์ในใบเบิก) |
| เปลี่ยนโลโก้บนใบเบิก | วางไฟล์ `src/pdf/assets/logo.png` (PNG/JPG ที่ตัดขอบขาวแล้ว สัดส่วนประมาณ 2:1) ในโฟลเดอร์โค้ด แล้วรัน `deploy.ps1` |
| พนักงานลืมรหัสผ่าน | admin → เมนู "ผู้ใช้" → แก้ไข → ตั้งรหัสผ่านใหม่ (พนักงานต้องเปลี่ยนเองตอนล็อกอิน) |
| พนักงานลาออก | admin → ผู้ใช้ → แก้ไข → สถานะบัญชี "ปิดใช้งาน" (ออกจากระบบทันที) |
| ศูนย์ย้าย/ปิด | admin → ทะเบียนศูนย์ → แก้ไข → เปลี่ยนสถานะ (ศูนย์ที่เคยเบิกลบไม่ได้) |
| ส่งขออนุมัติ/อนุมัติผิด | admin → เปิดใบเบิก → "ย้อนสถานะ" (ต้องใส่เหตุผล) — ใบที่จ่ายแล้วย้อนไม่ได้ |
| admin ลืมรหัสเอง | ถ้ามี admin อีกคนให้ตั้งรหัสใหม่ให้; ถ้าไม่มี ติดต่อผู้พัฒนา |
| ระบบเข้าไม่ได้ | ดู log ใน `C:\InternetExpense\logs`, ตรวจ service `postgresql-17` และ task `InternetExpense-App` |

## ความปลอดภัย

- ไฟล์ `.env` มีรหัสฐานข้อมูล — อย่าส่งต่อหรือ commit ลง git (`.gitignore` กันไว้แล้ว)
- PostgreSQL รับการเชื่อมต่อจากเครื่องตัวเอง (localhost) เท่านั้น
- ใช้ http ในวงแลน (`COOKIE_SECURE="false"` ใน `app\.env`) รหัสผ่านวิ่งในเครือข่ายภายในแบบไม่เข้ารหัส
  **ห้ามเปิดพอร์ต 8080 ออกอินเทอร์เน็ต** (เช่น port forward ที่เราเตอร์) — ระบบออกแบบให้ใช้ภายในบริษัทเท่านั้น
- ใส่รหัสผิด 5 ครั้งใน 15 นาที บัญชีถูกล็อกชั่วคราว 15 นาที

## สำหรับนักพัฒนา

ตั้งค่าเครื่องพัฒนา:

1. Node.js 24+, `npm install`
2. PostgreSQL 17 (`winget install PostgreSQL.PostgreSQL.17`) สร้าง role และ database `internet_expense` (role ต้องมีสิทธิ์ CREATEDB)
3. คัดลอก `.env.example` เป็น `.env` แล้วใส่ค่า
4. `npm run db:migrate` แล้ว `npm run db:seed`
5. `npm run dev` → http://localhost:3000

| คำสั่ง | |
|---|---|
| `npm run test` | unit test (ไม่ใช้ฐานข้อมูล) |
| `npm run test:db` | integration test กับฐานข้อมูลแยก `internet_expense_test` (ล้างใหม่ทุกครั้ง) |
| `npm run lint` / `npm run build` | ตรวจโค้ด / build |
| `npm run db:studio` | ดูข้อมูลในฐานข้อมูลพัฒนา |

รายละเอียดการออกแบบ กฎของระบบ และข้อตกลงต่าง ๆ อยู่ใน [CLAUDE.md](CLAUDE.md)
