@AGENTS.md

# ระบบเบิกค่าอินเทอร์เน็ต — บริษัท น้ำตาลสุรินทร์ จำกัด

เว็บแอปภายใน แทนการเบิกค่าอินเทอร์เน็ต 3BB ของแต่ละศูนย์ (เดิมใช้กระดาษ + ตารางสรุปเขียนมือ)
ผู้ใช้พิมพ์รหัสลูกค้า → ระบบแสดงศูนย์ → แนบใบแจ้งหนี้ → สร้าง "รายงานการขอเบิกค่าใช้จ่าย" เป็น PDF ตามฟอร์มเดิม

แผนเต็ม: `C:\Users\IT\.claude\plans\pasted-content-id-ad6c-composed-ocean.md`
ต้นแบบหน้าจอ: `prototype/expense-prototype.html` (ใช้เป็นแนวทาง UI และ flow)

## วิธีทำงานกับผู้ใช้
- ทำทีละเฟส **จบเฟสแล้วหยุดรอผู้ใช้ยืนยัน** ก่อนเริ่มเฟสถัดไป
- ข้อมูลหรือความต้องการไม่ชัด → ถามก่อน อย่าเดา
- โค้ดอ่านง่าย มี test สำหรับกฎตรวจและฟังก์ชันภาษาไทย
- ห้าม commit ความลับ ทุกค่าลับอยู่ใน `.env` (gitignored)

## ข้อกำหนดสำคัญ: ข้อมูลอยู่ในบริษัท ไม่สมัครบริการภายนอก (ตัดสินใจ 2026-10-21)
ผู้ใช้ไม่ต้องการให้ข้อมูลออกนอกบริษัท และไม่อยากสมัครหลายบริการ → **ห้ามเสนอ SaaS/cloud** (Neon, Vercel, Blob, Resend, Google login ฯลฯ)
- **เซิร์ฟเวอร์ = เครื่อง Windows 11 เครื่องนี้** (รันทั้ง PostgreSQL และแอป)
- **ใช้เฉพาะในวงแลนของบริษัท ผ่าน http — ไม่ทำ HTTPS และไม่เปิดให้เข้าจากนอกบริษัท** (ผู้ใช้ตัดสินใจ 2026-10-22 — ไม่ต้องเสนออีก)
  ระบบจริงจึงตั้ง `COOKIE_SECURE="false"` ถาวร; firewall เปิดเฉพาะ Domain/Private
- ล็อกอินด้วย**ชื่อผู้ใช้ + รหัสผ่านของระบบเอง** (admin สร้างบัญชี/รีเซ็ตรหัส)
- ไฟล์ใบแจ้งหนี้เก็บบนดิสก์เครื่องนี้ (โฟลเดอร์นอกโค้ด) ดาวน์โหลดผ่าน route ที่เช็กสิทธิ์
- อีเมลแจ้งเตือน: ยังไม่ตัดสินใจ (SMTP บริษัท หรือแจ้งเตือนในระบบแทน) — ถามตอนเฟส 6
- ต้องมีการสำรองข้อมูล (pg_dump + โฟลเดอร์ไฟล์) — ทำตอนเฟส 6

## สถานะเฟส
1. ⏳ ตั้งโปรเจกต์ + Prisma schema + seed ทะเบียนศูนย์
   - เสร็จ: โปรเจกต์, schema, migration รันแล้วบน PostgreSQL ในเครื่อง, ทดสอบกฎใน DB ด้วย SQL ตรงผ่านครบ
     (overlap/period/paid/FK/append-only/dueDay), seed admin แล้ว (`admin`, รหัสใน `.env` `SEED_ADMIN_PASSWORD`)
   - รอผู้ใช้: `data/centers.csv` (ปรับ `HEADER_ALIASES` ให้ตรงหัวคอลัมน์จริง)
   - เหลือ: seed ทะเบียนศูนย์ (commit แรก `a2156ba` ทำแล้ว 2026-10-22 — git ยังไม่ได้ตั้ง user.name/email,
     commit ใช้ `-c user.name="IT" -c user.email=<อีเมลผู้ใช้>`)
   - ทำล่วงหน้าตามที่ผู้ใช้อนุญาต (pure function + test, ยังไม่ผูก UI/DB):
     `lib/money.ts`, `lib/thai/bahtText.ts`, `lib/thai/date.ts`, `lib/status.ts`, `lib/rules/requestRules.ts`
   - ค่าที่ตั้งเองรอผู้ใช้ยืนยัน: สถานะว่างใน CSV = ใช้งาน; EDIT/DELETE ได้ทุกผู้จัดทำ (ยังไม่จำกัดเฉพาะเจ้าของใบ);
     REVERT ได้เฉพาะ SENT→CREATED (PAID ล็อกถาวร); 1,000,001 อ่าน "หนึ่งล้านเอ็ด"; รอบบริการนับรวมวันแรก-วันสุดท้าย;
     วันที่ใน PDF รูปแบบ dd/mm/yyyy (ตรวจกับฟอร์มในเฟส 4)
2. ✅ (รอผู้ใช้ยืนยัน) ล็อกอิน + บทบาท + หน้าจัดการทะเบียนศูนย์/ผู้ใช้ (admin)
   - session ใน DB (`Session`, cookie `ie_session` 12 ชม., เก็บ sha256 ของ token), ล็อกผิด 5 ครั้ง/15 นาที (`LoginAttempt`)
   - บังคับเปลี่ยนรหัสครั้งแรก/หลังรีเซ็ต; ปิดบัญชี/รีเซ็ตรหัส/เปลี่ยนรหัส → ลบ session ทุกเครื่อง
   - admin เปลี่ยนบทบาท/ปิดบัญชีตัวเองไม่ได้ (รับประกันมี admin อย่างน้อย 1)
   - `npm run test:db` = integration test เรียก Server Action จริงกับ DB จริง (ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์)
3. ✅ (รอผู้ใช้ยืนยัน) หน้าสร้างใบเบิก + กฎตรวจ + อัปโหลดไฟล์ (ลงดิสก์)
   - service: `src/server/services/requests.ts` (createRequest / updateRequest / transitionRequest: SEND, DELETE, REVERT)
     ทุกการเปลี่ยนแปลงเขียน ApprovalLog ใน transaction เดียวกัน; updateMany where status เดิม กันชนกัน (StaleRequestError)
   - ชน `Request_no_overlap` → Prisma P2039 + meta.driverAdapterError.cause.originalCode 23P01 → `isOverlapViolation()`
   - REVERT ต้องมีเหตุผล (note); PAY ยังไม่ทำ (เฟส 5)
   - ไฟล์: ตรวจ magic bytes (`src/lib/files.ts`), เก็บ `UPLOAD_DIR/YYYY/MM/<uuid>.<ext>`, ไฟล์เดิมไม่ลบเมื่อเปลี่ยน,
     ดาวน์โหลดที่ `/api/requests/[id]/invoice` (ทุกบทบาทที่ล็อกอิน)
   - ฟอร์มใบเบิกส่งผ่าน onSubmit + startTransition (ไม่ใช้ `<form action>` เพราะ React ล้างฟอร์ม/ไฟล์หลังส่ง)
   - หน้า /requests: CREATOR + ADMIN ดู; สร้าง/แก้ไขเฉพาะ CREATOR; ACCOUNTING ใช้หน้า /accounting (เฟส 5)
4. ✅ (รอผู้ใช้ยืนยัน) PDF ใบเบิก = **"บันทึกภายใน" FM-50000-02 Rev.02 ตามฟอร์มจริงที่ผู้ใช้ส่งภาพมา (2026-10-22)** — แทนแบบตามสเปกเดิม
   - **วันที่ทุกจุดเป็น พ.ศ.** (ผู้ใช้ยืนยัน — ขัดกับสเปกเดิมที่บอก ค.ศ.): วันที่บันทึก "16 ตุลาคม 2569", กำหนดชำระ "12/11/2569"
   - ข้อความ: `buildMemo` (`src/lib/pdf/memoData.ts`, มี test ตามตัวอย่างฟอร์มจริง); หน้าตา: `src/pdf/InternalMemo.tsx`
     - วันที่บันทึก = วันที่สร้างใบเบิก (เวลาไทย); ผู้ใช้บริการ = ชื่อศูนย์; รอบค่าใช้บริการ/หัวคอลัมน์เดือน/ปีตาราง = เดือนของ dueDate
     - ผู้ขออนุมัติ = ชื่อผู้จัดทำ (User.name) + ตำแหน่งจากค่าตั้ง; ชื่อผู้อนุมัติว่าง → พิมพ์จุดไข่ปลาให้เขียนมือ
     - ใช้คำว่า "อินเตอร์เน็ต" ตามฟอร์ม (หน้าจอใช้ "อินเทอร์เน็ต")
   - **ค่าตั้ง** (admin, หน้า /admin/settings): ตาราง `ReportSetting` แถวเดียว id=1 — จาก/เรียน/เพื่อ/ตำแหน่งผู้ขออนุมัติ/ชื่อ+ตำแหน่งผู้อนุมัติ/รหัสฟอร์ม
     ไม่มีแถว → `DEFAULT_MEMO_SETTINGS` (ฝ่าย/ตำแหน่งตามสเปก, เรียน/เพื่อ/รหัสฟอร์มตามฟอร์มจริง) — **ห้ามใส่ชื่อบุคคลจริงในโค้ด**
   - **โลโก้**: `src/pdf/assets/logo.png` = ตัดเฉพาะส่วนโลโก้ (พระอาทิตย์+KI) จากไฟล์ผู้ใช้ `logo-original.jpg` (1000×1000 มีขอบขาว+ชื่อบริษัทซ้ำ)
     ส่งให้ react-pdf เป็น buffer เท่านั้น — **path แบบ Windows (C:...) ใน Image src ใช้ไม่ได้ และไม่แจ้ง error**
   - 1 ใบเบิก = 1 ศูนย์ = 1 แถวในตาราง (ผู้ใช้ยืนยัน) แม้ฟอร์มรองรับหลายแถว
   - render: `src/server/pdf.tsx` (`renderInternalMemo`), route `/api/requests/[id]/pdf` (ทุกบทบาทที่ล็อกอิน, ใบที่ลบ → 404)
   - react-pdf ตัดคำกลางคำจะใส่ "-" เสมอ → ปิดการตัดคำ, ข้อความคงที่ต้องมีช่องว่างตามจุดที่ควรขึ้นบรรทัด
   - ฟอนต์ **Sarabun** (Google Fonts, OFL) ฝังจาก `src/pdf/fonts/*.ttf` (ไม่ใช้ TH Sarabun New — Sarabun มี GPOS ครบ)
   - **บั๊ก react-pdf กับสระอำ**: ฟอนต์แตก ำ เป็น 2 glyph → react-pdf ตัดท้ายข้อความหาย (จำกัด → จำก)
     แก้ด้วย `thaiPdfText()` แยก ำ เป็น ํ + (วรรณยุกต์) + า — **ข้อความทุกจุดใน PDF ต้องผ่าน component `T`**
   - ข้อจำกัด: copy ข้อความจาก PDF อาจได้อักขระเพี้ยน (ToUnicode ของ react-pdf) — ไม่กระทบการพิมพ์
   - ตรวจด้วยตา: ใช้ pdfjs-dist + @napi-rs/canvas ในโฟลเดอร์ชั่วคราว (`disableFontFace: true`) — tsx รัน react-pdf ไม่ได้ (ERR_PACKAGE_PATH_NOT_EXPORTED) ให้ใช้ vitest (`PDF_SAMPLE=<path> npx vitest run tests/pdfRender.test.ts`)
   - ☐ วาดเป็นกรอบ (Sarabun ไม่มีอักขระ ☐); ช่องลงชื่อเว้นว่างให้เขียนมือ
5. ✅ (รอผู้ใช้ยืนยัน) หน้าฝ่ายบัญชี + ตารางสรุปรายศูนย์
   - /accounting (ACCOUNTING + ADMIN ดู): แท็บรอจ่าย (SENT เรียง dueDate) / จ่ายแล้ว; บันทึกจ่ายเฉพาะ ACCOUNTING
   - บันทึกจ่าย: `payRequest` + `checkPayment` — **วันที่จ่าย + เลขอ้างอิง บังคับทั้งคู่** (ผู้ใช้เลือก), วันที่ห้ามเกินวันนี้ (เวลาไทย)
   - /summary (**ทุกบทบาท** — ผู้ใช้เลือก): เฉพาะศูนย์ ACTIVE, `summarizeCenter` ใน `lib/rules/centerSummary.ts`
     - "เบิกแล้ว" ของเดือน = มีใบเบิก (ไม่ถูกลบ) ที่ **dueDate อยู่เดือนเดียวกัน** (ผู้ใช้เลือก)
     - ใกล้ครบกำหนด = เหลือ ≤ **7 วัน** (ผู้ใช้เลือก); dueDay เกินวันสุดท้ายของเดือน → ใช้วันสุดท้าย
     - เดือนนี้เบิกแล้วแต่เดือนหน้าใกล้ครบและยังไม่เบิก → เตือนเดือนหน้า
   - หน้ารายละเอียดใบเบิกเปิดได้ทุกบทบาท (ACCOUNTING มีฟอร์มบันทึกจ่าย); หน้า /requests (รายการ) ยังเฉพาะ CREATOR + ADMIN
   - ลิงก์ "+ สร้างใบเบิก" ในหน้าสรุป → `/requests/new?code=<รหัสลูกค้า>` ค้นศูนย์ให้อัตโนมัติ
   - test fixtures ใบเบิกใช้ร่วมกันที่ `tests/db/requestFixtures.ts`
6. ✅ (รอผู้ใช้ยืนยัน) เตรียมติดตั้งจริง + สำรองข้อมูล + เอกสาร — **ยังไม่ได้ติดตั้งจริง** (ผู้ใช้เลือก "เตรียมไว้ก่อน" 2026-10-22)
   - ผู้ใช้เลือก: **ไม่มีการแจ้งเตือนใน v1**; ใช้ในวงแลนผ่าน **http** เท่านั้น (ไม่ทำ HTTPS/เข้าจากภายนอก)
   - `scripts/` (PowerShell 5.1, **ต้องเซฟ UTF-8 with BOM** ไม่งั้นภาษาไทยเพี้ยน — codepage เครื่อง 1252):
     - `deploy.ps1` → `C:\InternetExpense\app` (DB `internet_expense_prod`, ไฟล์ `C:\InternetExpense\data\invoices`, port 8080,
       `.env` ของระบบจริงสร้างครั้งแรกเท่านั้น, robocopy /MIR แต่ exclude .env/node_modules/.next/generated/tests/.git)
     - `install-service.ps1` (admin): Task `InternetExpense-App` (AtStartup, SYSTEM, restart), `InternetExpense-Backup` (02:00), firewall 8080 Domain/Private
     - `start-app.ps1` (next start, log `C:\InternetExpense\logs`), `backup.ps1` (pg_dump + robocopy, เก็บ 30 วัน), `restore.ps1` (-Force)
     - ทดสอบแล้ว: deploy → start → probe → redeploy (.env คงเดิม) บนโฟลเดอร์/DB ชั่วคราว; backup → restore (จำนวนแถวตรง, trigger/constraint อยู่ครบ)
     - install-service.ps1 ยังไม่เคยรันจริง (ต้องสิทธิ์ admin) — ตรวจแค่ parse
   - สำรองไป `D:\InternetExpenseBackup` — **D: อยู่ดิสก์ลูกเดียวกับ C:** แนะนำผู้ใช้คัดลอกไป HDD ภายนอกสัปดาห์ละครั้ง
   - seed: ไม่มี `data/centers.csv` → เตือนแล้วข้าม (ไม่ error)
   - เอกสาร: `README.md` (ผู้ดูแลระบบ/IT), `docs/คู่มือผู้ใช้.md` (พนักงาน)

## สถานะล่าสุด (สิ้นวัน 2026-10-22)
- งานหลัง commit `a2156ba` ทั้งหมด (เฟส 4–6, ปรับโฉม UI, ฟอร์มบันทึกภายใน, ตั้งค่าใบเบิก, โลโก้) **ยังไม่ได้ commit** — ถามผู้ใช้ก่อน commit
- DB พัฒนามี**ข้อมูลทดลอง**: ศูนย์ 11 (รหัส 6001977xx), ใบเบิก 8 ใบพร้อม ApprovalLog, ผู้ใช้ `somsri` (ผู้จัดทำ) / `wilai` (บัญชี) รหัส `demo1234`
  ล้างได้ด้วยการ reset DB พัฒนาทั้งก้อน (ApprovalLog ลบรายแถวไม่ได้) แล้ว seed admin ใหม่ — ทำเมื่อผู้ใช้สั่งเท่านั้น
- ใบเบิก PDF ผู้ใช้พอใจระดับหนึ่ง ("ประมาณนี้ก่อน"): ตัวอักษร 11pt, เส้นตารางใช้ความกว้าง pt, ลายเซ็นกึ่งกลางหน้า
- รอผู้ใช้: ไฟล์ทะเบียนศูนย์ CSV, ค่าตั้งใบเบิกจริง (ชื่อผู้อนุมัติ ฯลฯ), ยืนยันค่าที่ตั้งเอง, ติดตั้งระบบจริง
- `npm audit` ล่าสุดเชื่อมต่อ registry ไม่ได้ — ยังไม่ได้ตรวจ dependency ใหม่ (@react-pdf/renderer, lucide-react)

## บทบาท
- **CREATOR (ผู้จัดทำ)**: สร้างใบเบิก แนบใบแจ้งหนี้ พิมพ์ กด "ส่งบัญชีแล้ว"; แก้/ลบได้เฉพาะสถานะ "สร้างแล้ว"; บันทึกวันที่จ่ายไม่ได้
- **ACCOUNTING (ฝ่ายบัญชี)**: ดูรายการที่ส่งมา (เรียงวันครบกำหนดใกล้สุด) บันทึกวันที่จ่ายจริง + เลขอ้างอิง (แก้ได้เฉพาะ 2 ช่องนี้) เฉพาะใบสถานะ "ส่งบัญชีแล้ว"
- **ADMIN**: จัดการผู้ใช้ (สร้างบัญชี รีเซ็ตรหัสผ่าน ปิดบัญชี) และทะเบียนศูนย์ ดูได้ทุกหน้า ย้อนสถานะใบเบิกได้ (มี log) แต่ไม่บันทึกวันจ่ายแทนบัญชี
- ผู้ใช้ 1 คน = 1 บทบาท; ผู้อนุมัติเซ็นบนกระดาษ ไม่ใช่ผู้ใช้ในระบบ (v1)

## Flow และสถานะใบเบิก
CREATED (สร้างแล้ว) → SENT (ส่งบัญชีแล้ว) → PAID (จ่ายแล้ว, ล็อก)
1. กรอกรหัสลูกค้า → แสดงชื่อศูนย์ + ยอดปกติ
2. กรอกเลขที่ใบแจ้งหนี้ ยอด รอบบริการเริ่ม/สิ้นสุด วันครบกำหนด แนบ PDF/รูป
3. ตรวจกฎ → สร้างใบเบิก (1 ใบ = 1 ศูนย์)
4. พิมพ์ไปเซ็นนอกระบบ → ผู้จัดทำกด "ส่งบัญชีแล้ว"
5. บัญชีบันทึกวันที่จ่าย → PAID ล็อกไม่ให้แก้
- หลัง SENT ผู้จัดทำแก้ไม่ได้ ต้องให้ admin ย้อนสถานะ (log action REVERT)
- "ลบ" = soft delete (`deletedAt`) เพื่อให้ ApprovalLog ครบ; ใบที่ลบแล้วไม่นับในกฎกันซ้ำ

## กฎของระบบ
- **บล็อก**: ศูนย์เดียวกัน + รอบบริการ**ทับซ้อน**กับใบเดิม (แม้ 1 วัน, รวมวันขอบ); ศูนย์สถานะ ย้าย/ปิด; ข้อมูลจำเป็นไม่ครบ; วันสิ้นสุดก่อนวันเริ่ม
- **เตือน (ไม่บล็อก ต้องกดยืนยันซ้ำ)**: ยอดต่างจากยอดปกติ; รอบบริการยาวนอกช่วง 25–35 วัน; ไม่แนบไฟล์
- ห้ามลบศูนย์ที่เคยมีใบเบิก ให้เปลี่ยนสถานะแทน (FK `onDelete: Restrict`)
- รหัสลูกค้า unique ใช้เป็นตัวค้นหา; หมายเลขบริการเป็นข้อมูลประกอบ
- **เช็กสิทธิ์ฝั่งเซิร์ฟเวอร์ทุก Server Action / API route** (`requireRole()` บรรทัดแรก) ไม่ใช่แค่ซ่อนปุ่ม
- ApprovalLog: บันทึกทุกการเปลี่ยนสถานะ (ใคร ทำอะไร เมื่อไร) แบบเพิ่มอย่างเดียว
- เปลี่ยนสถานะผ่าน `transition()` ที่เดียว ใน DB transaction (เช็ก state machine + สิทธิ์ + เขียน log)

### กฎที่บังคับใน DB (migration `20261021000000_init`, ส่วน SQL เขียนเอง)
- `Request_no_overlap`: EXCLUDE gist (centerId =, daterange(periodStart, periodEnd, '[]') &&) WHERE deletedAt IS NULL (ใช้ `btree_gist`)
  แอปต้องเช็กก่อนเองด้วยเพื่อแสดงข้อความไทย; constraint นี้กันกรณีกดพร้อมกัน
- CHECK: dueDay 1–31, normalAmount ≥ 0, amount > 0, periodEnd ≥ periodStart, PAID ต้องมี paidDate
- trigger ปฏิเสธ UPDATE/DELETE/TRUNCATE บน ApprovalLog
- ถ้าแก้ schema แล้วสร้าง migration ใหม่ ตรวจว่า Prisma ไม่ไปลบ constraint/trigger พวกนี้

## ภาษาและวันที่
- UI ภาษาไทยทั้งหมด (ฟอนต์หน้าจอ Sarabun จาก next/font)
- DB เก็บวันที่เป็น ค.ศ. (`@db.Date`) — เขตเวลา Asia/Bangkok
- หน้าจอแสดง **พ.ศ.**; ใบเบิก PDF ก็ **พ.ศ.** (ฟอร์มจริง FM-50000-02 — แก้จากสเปกเดิมที่บอก ค.ศ.)
- เงินใช้ `Decimal(12,2)` ห้ามคำนวณด้วย float

## PDF ใบเบิก = "บันทึกภายใน" FM-50000-02 (@react-pdf/renderer)
- แทนแบบ "รายงานการขอเบิกค่าใช้จ่าย" ในสเปกเดิม — รายละเอียดดูสถานะเฟส 4
- ฝังฟอนต์ Sarabun (`src/pdf/fonts/`, OFL) — มีบั๊กสระอำ ต้องใช้ component `T`/`thaiPdfText`
- ตรวจคำ: น้ำตาล, ผู้จัดการ, ที่, สตางค์ (ตรวจด้วยตาแล้ว ถูกต้อง)
- bahtText: 749 → เจ็ดร้อยสี่สิบเก้าบาทถ้วน; 631.30 → หกร้อยสามสิบเอ็ดบาทสามสิบสตางค์; 1068.93 → หนึ่งพันหกสิบแปดบาทเก้าสิบสามสตางค์

## นอกขอบเขต v1
อนุมัติผ่านระบบ, ลายเซ็นดิจิทัล, OCR ใบแจ้งหนี้, เชื่อมระบบบัญชี, เลขที่เอกสารใบเบิก

## Tech stack และข้อควรรู้
- **Next.js 16.4** (App Router, `src/`) + TypeScript + Tailwind v4 — เวอร์ชันใหม่กว่าความรู้เดิม อ่าน `node_modules/next/dist/docs/` ก่อนใช้ API
  - `next.config.ts` เปิด `cacheComponents: true` (ค่าเริ่มต้นของ template) — หน้าที่อ่านข้อมูลสด/ต่อผู้ใช้ต้องจัดการ dynamic/Suspense ตาม docs
    - อ่าน cookies/DB ต้องอยู่ใน `<Suspense>`: `(app)/layout.tsx` ห่อ AppFrame, `(app)/loading.tsx` ห่อทุกหน้า
    - ใช้ `new Date()`/ค่าสุ่มระหว่าง render ต้อง `await connection()` ก่อน (ดู `readSession`)
    - ปิด instant-navigation validation อัตโนมัติ (`experimental.instantInsights.validationLevel: "manual-warning"`) เพราะตั้งใจไม่ cache ข้อมูลผู้ใช้
    - **ไม่ใช้ `"use cache"` กับข้อมูลผู้ใช้/สิทธิ์** — ต้องอ่าน DB สดทุก request
  - `middleware` เปลี่ยนชื่อเป็น `src/proxy.ts` (ด่านแรก: ไม่มี cookie → /login; ตรวจจริงใน `requireUser/requireRole`)
  - `forbidden()` ยัง experimental — ไม่ใช้; บทบาทไม่ตรง → `requireRole` redirect("/")
  - ไฟล์ page ห้าม export อย่างอื่นนอกจาก default/config ของ Next
- **Prisma 7.10** (pin 7.x — npm tag `latest` ตอนนี้ชี้ไป 8.0 RC)
  - generator `prisma-client` → `src/generated/prisma` (gitignored, สร้างใน `postinstall`)
  - import: `import { PrismaClient } from "@/generated/prisma/client"`; ใช้ `db` จาก `src/server/db.ts`
  - URL อยู่ใน `prisma.config.ts` ไม่ใช่ schema; ใช้ driver adapter `@prisma/adapter-pg`
  - `DATABASE_URL` ตัวเดียว (ใช้ทั้งแอปและ migrate)
  - Prisma 7 `migrate dev` **ไม่** generate client ให้ — `npm run db:migrate` สั่ง `prisma generate` ต่อท้ายแล้ว
  - unique ชน → `isUniqueViolation()` ใน `src/server/dbErrors.ts`
- **DB**: PostgreSQL 17 ติดตั้งบนเครื่องนี้ (winget, service `postgresql-17` เริ่มอัตโนมัติ, port 5432)
  - DB `internet_expense`, role `internet_expense` (LOGIN CREATEDB — CREATEDB จำเป็นสำหรับ shadow DB ของ migrate dev)
  - superuser `postgres` รหัสอยู่ใน `.env` `POSTGRES_SUPERUSER_PASSWORD`; psql: `C:\Program Files\PostgreSQL\17\bin\psql.exe`
- **Auth** (เฟส 2): ชื่อผู้ใช้ + รหัสผ่าน, hash ด้วย scrypt ใน `src/server/password.ts` (Node crypto, ไม่มี dependency)
  - User: `username` unique (ตัวพิมพ์เล็ก), `passwordHash`, `mustChangePassword`, `email` optional
  - `requireRole()` อ่าน role/active จาก DB ทุกครั้ง; ออกแบบ session + rate limit ตอนเฟส 2
- **ไฟล์** (เฟส 3): ดิสก์เครื่องนี้ (`UPLOAD_DIR` = `C:/Users/IT/InternetExpenseData/invoices` ใช้ `/` ใน .env), PDF/JPG/PNG ≤ 10MB
  - `next.config.ts`: `serverActions.bodySizeLimit` และ `proxyClientMaxBodySize` = 11mb (ค่าเริ่มต้น 1MB / 10MB)
- **แจ้งเตือน** (เฟส 6): ยังไม่ตัดสินใจ — ห้ามใช้บริการภายนอก
- **Test**: Vitest (`tests/**/*.test.ts`, TZ=Asia/Bangkok) — unit ไม่ต้องใช้ DB
  - `tests/db/*.db.test.ts` (config `vitest.db.config.mts`) ใช้ **DB แยก `internet_expense_test`** ที่ globalSetup ล้าง schema + migrate deploy ใหม่ทุกครั้ง
    (ApprovalLog ลบไม่ได้ จึงล้างทั้ง schema); UPLOAD_DIR ชี้ไปโฟลเดอร์ชั่วคราว; mock `next/headers` (cookie jar), `server-only`, `connection`
  - auth test ใช้ prefix `zz-test-` (ลบหลังแต่ละ test), request test ใช้ `zz-req-<เวลา>-` (ไม่ลบ)
  - ห้ามรันสคริปต์ทดลองที่สร้าง ApprovalLog กับ DB พัฒนา (ลบไม่ได้)
- **UI** (ปรับโฉม 2026-10-22): ชิ้นส่วนกลางอยู่ที่ `src/components/ui.tsx` — ใช้ซ้ำแทนการเขียน class เอง
  - Button/ButtonLink/ButtonAnchor (`icon`, `variant`: primary/secondary/danger(เส้นขอบ)/ghost), PageHeader (`icon`), Card (`flush`), CardTitle,
    StepTitle, StatCard (การ์ดตัวเลข กดกรองได้), TableCard + tableClass/thClass/tdClass/rowClass, RowLink, EmptyRow, NameCell, Badge (มีจุดสี)
  - โทน: emerald = หลัก, slate = เทา (ไม่ใช้ zinc), ไม่ใช้ font-mono (ใช้ tabular-nums)
  - ไอคอน `lucide-react` 1.52 (ไม่มี Building2/Trash2/History — ใช้ Building/Trash/Clock); ไอคอนเมนูผูกใน `NavLinks.tsx` ไม่ใส่ใน `routes.ts` (proxy ใช้)
  - ตรวจด้วยตา: playwright-core + Edge ในเครื่อง (`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`) ติดตั้งในโฟลเดอร์ชั่วคราว
    สร้างข้อมูลตัวอย่าง prefix `zz-demo-` ที่ไม่มี ApprovalLog แล้วลบหลังจับภาพ
- **ฟอร์ม**: Server Action + `useActionState` คืน `FormState` (`src/lib/formState.ts`); ตรวจข้อมูลด้วย zod ใน `src/lib/validation.ts` (zod v4: `{ error }`, `z.flattenError`, `ctx.addIssue({ message })`)
- npm 11 มี `allowScripts` — install scripts ของ prisma/esbuild ไม่ได้รัน แต่ generate/tsx ใช้งานได้ปกติ
- Windows + PowerShell; ชื่อโฟลเดอร์มีช่องว่าง (`KI internat`) ต้อง quote path เสมอ

## คำสั่ง
```
npm run dev            # dev server
npm run test           # vitest (unit)
npm run test:db        # vitest integration กับ DB จริง
npm run lint
npm run build
npm run db:migrate     # prisma migrate dev
npm run db:deploy      # prisma migrate deploy (production)
npm run db:seed        # admin คนแรก (ถ้ายังไม่มี) + ทะเบียนศูนย์จาก data/centers.csv
npm run db:studio
```

## โครงสร้าง
```
prisma/            schema.prisma, migrations/, seed.ts
data/centers.csv   ทะเบียนศูนย์ (จากผู้ใช้)
src/app/           หน้า + api routes
src/server/        db.ts, auth.ts, actions/, services/   (โค้ดฝั่งเซิร์ฟเวอร์เท่านั้น)
src/lib/           rules/ (กฎตรวจ pure function), thai/ (bahtText, date), status.ts
src/pdf/           เทมเพลต PDF
tests/             vitest
```
