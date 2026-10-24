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
     - ผู้ขออนุมัติ/ผู้อนุมัติ = ตามที่เลือกในใบ (ดู "อนุมัติในระบบ" ด้านล่าง); ยังไม่เลือกผู้อนุมัติ → พิมพ์จุดไข่ปลาให้เขียนมือ
     - อนุมัติแล้ว → ใต้ชื่อผู้อนุมัติพิมพ์ "อนุมัติในระบบ 24 ต.ค. 2569 10:30 น." (ยังพิมพ์เซ็นกระดาษได้ — ผู้ใช้เลือก)
     - ใช้คำว่า "อินเตอร์เน็ต" ตามฟอร์ม (หน้าจอใช้ "อินเทอร์เน็ต")
   - **ค่าตั้ง** (หน้า /settings — **เฉพาะผู้จัดทำ** (admin ไม่เห็น/แก้ไม่ได้), ย้ายจาก /admin/settings 2026-10-24 ตามที่ผู้ใช้เลือก; ฟอร์มเดียว 5 ช่อง): ตาราง `ReportSetting` แถวเดียว id=1 — จาก/เรียน/เพื่อ/ตำแหน่งผู้ขออนุมัติ (สำรอง เมื่อบัญชีผู้จัดทำไม่มีตำแหน่ง)/รหัสฟอร์ม
     ไม่มีแถว → `DEFAULT_MEMO_SETTINGS` (ฝ่าย/ตำแหน่งตามสเปก, เรียน/เพื่อ/รหัสฟอร์มตามฟอร์มจริง) — **ห้ามใส่ชื่อบุคคลจริงในโค้ด**
   - **โลโก้**: `src/pdf/assets/logo.png` = ตัดเฉพาะส่วนโลโก้ (พระอาทิตย์+KI) จากไฟล์ผู้ใช้ `logo-original.jpg` (1000×1000 มีขอบขาว+ชื่อบริษัทซ้ำ)
     ส่งให้ react-pdf เป็น buffer เท่านั้น — **path แบบ Windows (C:...) ใน Image src ใช้ไม่ได้ และไม่แจ้ง error**
   - 1 ใบเบิก = 1 ศูนย์ = 1 แถวในตาราง (ผู้ใช้ยืนยัน) แม้ฟอร์มรองรับหลายแถว
   - **อนุมัติในระบบ + ผู้ลงนาม = บัญชีผู้ใช้** (2026-10-24, ผู้ใช้เลือกทุกข้อ — แทนตาราง Signer ที่ทำไปก่อนหน้าแล้วเลิกใช้)
     - migration `20261024100000_approval_flow` เขียนเอง: `RENAME VALUE 'SENT' TO 'APPROVED'` + `ADD VALUE 'PENDING'` (ไม่ให้ Prisma สร้าง enum ใหม่ — ข้อมูลเดิมพัง)
       ค่า enum ที่เพิ่มใหม่ใช้ใน CHECK ใน transaction เดียวกันไม่ได้ → "รออนุมัติต้องมีผู้อนุมัติ" บังคับในแอป
       ⚠️ `migrate deploy` ที่ล้มกลางทาง **ไม่ rollback** (DB พัฒนาเคยค้าง → รัน SQL ที่เหลือเอง + `migrate resolve --applied`)
     - Request: `requesterId`/`approverId` (FK User) + **สำเนา** name/title ณ ตอนเลือก + `approvedAt`;
       CHECK `Request_requester_snapshot`/`Request_approver_snapshot` (id กับชื่อมีคู่กัน) และ `*_pair` (ชื่อกับตำแหน่ง)
     - admin แก้ชื่อผู้ใช้ (username) ของบัญชีเดิมได้ในหน้าแก้ไขผู้ใช้ (ห้ามซ้ำ; session ผูก id จึงไม่หลุด)
     - User.`title` (ตำแหน่ง) **บังคับสำหรับ CREATOR/APPROVER** (`SIGNER_ROLES`, `requireTitleForSigner` ใน validation)
     - เลือกผู้ลงนาม: `changeRequestSigners` → `setRequestSigners`; ช่องเลือก = User.id, "" = ค่าเริ่มต้น (ผู้ขอ = ผู้จัดทำ, ผู้อนุมัติ = ยังไม่เลือก)
       เลือกได้เฉพาะบัญชี active + บทบาทตรง; เลือกคนเดิมซ้ำ = คงสำเนา (แม้ถูกปิดบัญชี); `checkSignerChange`: CREATOR + ADMIN เฉพาะ CREATED
     - `resolveSigners`/`chosenSignersOf` ใน memoData.ts ใช้ทั้ง PDF และหน้าจอ
   - render: `src/server/pdf.tsx` (`renderInternalMemo`), route `/api/requests/[id]/pdf` (ทุกบทบาทที่ล็อกอิน, ใบที่ลบ → 404)
   - react-pdf ตัดคำกลางคำจะใส่ "-" เสมอ → ปิดการตัดคำ, ข้อความคงที่ต้องมีช่องว่างตามจุดที่ควรขึ้นบรรทัด
   - ฟอนต์ **Sarabun** (Google Fonts, OFL) ฝังจาก `src/pdf/fonts/*.ttf` (ไม่ใช้ TH Sarabun New — Sarabun มี GPOS ครบ)
   - **บั๊ก react-pdf กับสระอำ**: ฟอนต์แตก ำ เป็น 2 glyph → react-pdf ตัดท้ายข้อความหาย (จำกัด → จำก)
     แก้ด้วย `thaiPdfText()` แยก ำ เป็น ํ + (วรรณยุกต์) + า — **ข้อความทุกจุดใน PDF ต้องผ่าน component `T`**
   - ข้อจำกัด: copy ข้อความจาก PDF อาจได้อักขระเพี้ยน (ToUnicode ของ react-pdf) — ไม่กระทบการพิมพ์
   - ตรวจด้วยตา: ใช้ pdfjs-dist + @napi-rs/canvas ในโฟลเดอร์ชั่วคราว (`disableFontFace: true`) — tsx รัน react-pdf ไม่ได้ (ERR_PACKAGE_PATH_NOT_EXPORTED) ให้ใช้ vitest (`PDF_SAMPLE=<path> npx vitest run tests/pdfRender.test.ts`)
   - ☐ วาดเป็นกรอบ (Sarabun ไม่มีอักขระ ☐); ช่องลงชื่อเว้นว่างให้เขียนมือ
5. ✅ (รอผู้ใช้ยืนยัน) หน้าฝ่ายบัญชี + ตารางสรุปรายศูนย์
   - /accounting (ACCOUNTING + ADMIN ดู): แท็บรอจ่าย (APPROVED เรียง dueDate) / จ่ายแล้ว; บันทึกจ่ายเฉพาะ ACCOUNTING
   - /approvals (APPROVER เห็นเฉพาะใบที่เลือกตนเป็นผู้อนุมัติ, ADMIN เห็นทุกใบแบบดูอย่างเดียว): แท็บรออนุมัติ / อนุมัติแล้ว;
     อนุมัติ/ไม่อนุมัติทำที่หน้ารายละเอียดใบเบิก
   - บันทึกจ่าย: `payRequest` + `checkPayment` — **วันที่จ่าย + เลขอ้างอิง บังคับทั้งคู่** (ผู้ใช้เลือก), วันที่ห้ามเกินวันนี้ (เวลาไทย)
   - /summary (**ทุกบทบาท** — ผู้ใช้เลือก): เฉพาะศูนย์ ACTIVE, `summarizeCenter` ใน `lib/rules/centerSummary.ts`
     - "เบิกแล้ว" ของเดือน = มีใบเบิก (ไม่ถูกลบ) ที่ **dueDate อยู่เดือนเดียวกัน** (ผู้ใช้เลือก)
     - ใกล้ครบกำหนด = เหลือ ≤ **7 วัน** (ผู้ใช้เลือก); dueDay เกินวันสุดท้ายของเดือน → ใช้วันสุดท้าย
     - เดือนนี้เบิกแล้วแต่เดือนหน้าใกล้ครบและยังไม่เบิก → เตือนเดือนหน้า
   - หน้ารายละเอียดใบเบิกเปิดได้ทุกบทบาท (ACCOUNTING มีฟอร์มบันทึกจ่าย); หน้า /requests (รายการ) ยังเฉพาะ CREATOR + ADMIN
   - ลิงก์ "+ สร้างใบเบิก" ในหน้าสรุป → `/requests/new?code=<รหัสลูกค้า>` ค้นศูนย์ให้อัตโนมัติ
   - test fixtures ใบเบิกใช้ร่วมกันที่ `tests/db/requestFixtures.ts`
   - **ลดขั้นตอน** (2026-10-24, ผู้ใช้เลือก — "ใช้ง่ายที่สุด ไม่ต้องกดเยอะ"):
     - ผู้จัดทำเข้าระบบแล้วไปหน้า /summary (HOME_PATH) + แถบแจ้ง "ส่งแล้ว" (`?sent=<id>`) และ "ยังไม่ส่งขออนุมัติ N ใบ"
     - ฟอร์มใบเบิกกรอกให้ล่วงหน้า: `suggestRequest` (`lib/rules/requestDefaults.ts`) — ยอดปกติ, รอบถัดจากใบล่าสุด, ครบกำหนดเดือนถัดไป
       (ยังไม่เคยเบิก → รอบว่าง, ครบกำหนดเดือนนี้); `findCenterByCode` คืน `suggestion`; เคอร์เซอร์ไปช่องเลขที่ใบแจ้งหนี้
     - ช่องผู้อนุมัติในฟอร์ม (ค่าเริ่มต้น = คนที่ผู้จัดทำเลือกครั้งล่าสุด, `server/services/approvers.ts`)
       FormData: ไม่มี approverId = ไม่เปลี่ยน, "" = ไม่เลือก; ปุ่ม `intent=submit` "สร้างและส่งขออนุมัติ" / `save` "บันทึกไว้ก่อน"
     - ผู้อนุมัติกด "อนุมัติ" ในแถวของ /approvals ได้เลย (`ApproveButton`); ไม่อนุมัติต้องเปิดหน้าใบเบิกใส่เหตุผล
     - ฝ่ายบัญชี: วันที่จ่ายค่าเริ่มต้น = วันนี้ (มีอยู่แล้ว)
     - **ตัวเลขงานค้างบนเมนู** (แทนการแจ้งเตือน): `getNavCounts` (`server/services/navCounts.ts`) ผ่าน `/api/nav-counts`
       Sidebar ดึงเองทุกครั้งที่ pathname/search เปลี่ยน + focus + ทุก 1 นาที (layout ไม่ render ใหม่ตอนเปลี่ยนหน้า จึงคำนวณใน layout ไม่ได้)
       ผู้จัดทำ: สรุปรายศูนย์ = เลยกำหนด+ใกล้ครบ (แดงถ้าเลยกำหนด), ใบเบิก = ยังไม่ส่ง; ผู้อนุมัติ: คิวของตน; บัญชี: รอจ่าย; admin: ภาพรวมสีเทา
       จอเล็ก: จุดแดงบนปุ่ม ☰
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

## สถานะล่าสุด (2026-10-24)
- commit แล้ว: `a2156ba` (เฟส 1–3), `e649ac8` (เฟส 4–6, ใบเบิกบันทึกภายใน, ตั้งค่า, โลโก้, ปรับโฉม UI) — 2026-10-24; commit ครั้งต่อไปถามผู้ใช้ก่อนเสมอ
- **ยังไม่ commit**: แถบเมนูซ้าย, อนุมัติในระบบ + บทบาทผู้อนุมัติ + หน้าสร้างผู้ใช้ใหม่ (admin ตั้งรหัสเอง),
  แก้ชื่อผู้ใช้, ลดขั้นตอน (กรอกล่วงหน้า/สร้างและส่ง/อนุมัติในแถว), หน้าตั้งค่าย้ายไปผู้จัดทำ (/settings), ตัวเลขงานค้างบนเมนู
- **รายการปรับปรุงที่ผู้ใช้ตกลงให้ทำ "ทีละอัน"** (2026-10-24, พักเพราะ token ใกล้หมด) — ทำแล้ว: ข้อ 1 ตัวเลขงานค้างบนเมนู
  ที่เหลือ (ทำทีละข้อ แล้วหยุดให้ผู้ใช้ดู):
  4. เหตุผลที่ไม่อนุมัติแสดงเป็นแถบแดงบนสุดของหน้าใบเบิกที่ถูกตีกลับ (ตอนนี้อยู่แค่ในประวัติ)
  2. ช่องวันที่แบบไทย วัน/เดือน/พ.ศ. (ช่อง date ของเบราว์เซอร์แสดง mm/dd/ค.ศ. ตามภาษาเครื่อง)
  3. แสดงไฟล์ใบแจ้งหนี้ (PDF/รูป) ในหน้าใบเบิกเลย
  5. หน้ารออนุมัติบนมือถือเป็นการ์ดแทนตาราง
  6. ส่งออก Excel สรุปการจ่ายรายเดือน
  7. อนุมัติ/บันทึกจ่ายทีละหลายใบ
- DB พัฒนามี**ข้อมูลทดลอง**: ศูนย์ 11 (รหัส 6001977xx), ใบเบิก 8 ใบพร้อม ApprovalLog, ผู้ใช้ `user1` (ผู้จัดทำ) / `user2` (ผู้อนุมัติ) / `user3` (บัญชี) รหัส `demo1234` (เปลี่ยนชื่อจาก somsri/prasert/wilai ตามที่ผู้ใช้ขอ 2026-10-24)
  ล้างได้ด้วยการ reset DB พัฒนาทั้งก้อน (ApprovalLog ลบรายแถวไม่ได้) แล้ว seed admin ใหม่ — ทำเมื่อผู้ใช้สั่งเท่านั้น
  ใบที่ "ส่งบัญชีแล้ว" เดิมกลายเป็น "อนุมัติแล้ว" (ไม่มี approvedAt/ผู้อนุมัติ)
  ห้ามกดอนุมัติ/ส่งขออนุมัติทดลองใน DB พัฒนาเอง (สร้าง log ลบไม่ได้)
- รหัส admin ใน DB พัฒนา**ไม่ตรง** `SEED_ADMIN_PASSWORD` แล้ว (ผู้ใช้น่าจะเปลี่ยนเอง) — อย่าลองล็อกอินซ้ำ (ล็อก 5 ครั้ง)
  ตรวจหน้า admin/ผู้อนุมัติด้วยตาให้สร้าง `zz-demo-admin`/`zz-demo-approver` ชั่วคราว (ไม่ผูกใบเบิก) แล้วลบหลังจับภาพ
  playwright: ปุ่ม submit แรกของหน้าคือ "ออกจากระบบ" ในแถบเมนู — ใช้ selector `main button[type=submit]`
- ใบเบิก PDF ผู้ใช้พอใจระดับหนึ่ง ("ประมาณนี้ก่อน"): ตัวอักษร 11pt, เส้นตารางใช้ความกว้าง pt, ลายเซ็นกึ่งกลางหน้า
- รอผู้ใช้: ไฟล์ทะเบียนศูนย์ CSV, บัญชีผู้ใช้จริง (ผู้จัดทำ/ผู้อนุมัติพร้อมตำแหน่ง), ยืนยันค่าที่ตั้งเอง, ติดตั้งระบบจริง
- `npm audit` ล่าสุดเชื่อมต่อ registry ไม่ได้ — ยังไม่ได้ตรวจ dependency ใหม่ (@react-pdf/renderer, lucide-react)

## บทบาท
- **CREATOR (ผู้จัดทำ)**: สร้างใบเบิก แนบใบแจ้งหนี้ เลือกผู้ลงนาม พิมพ์ กด "ส่งขออนุมัติ"; แก้/ลบได้เฉพาะสถานะ "สร้างแล้ว"; บันทึกวันที่จ่ายไม่ได้
- **APPROVER (ผู้อนุมัติ)** (2026-10-24): อนุมัติ / ไม่อนุมัติ (ต้องมีเหตุผล) **เฉพาะใบที่ผู้จัดทำเลือกตนเป็นผู้อนุมัติ** (`isAssignedApprover`); หน้าแรก /approvals
- **ACCOUNTING (ฝ่ายบัญชี)**: ดูรายการที่อนุมัติแล้ว (เรียงวันครบกำหนดใกล้สุด) บันทึกวันที่จ่ายจริง + เลขอ้างอิง (แก้ได้เฉพาะ 2 ช่องนี้)
- **ADMIN**: จัดการผู้ใช้ (สร้างบัญชีพร้อม**ตั้งรหัสผ่านเริ่มต้นเอง** + บังคับเปลี่ยนตอนล็อกอินแรก, ตั้งรหัสใหม่, ปิดบัญชี) และทะเบียนศูนย์
  ดูได้ทุกหน้า ย้อนสถานะใบเบิกได้ (มี log) แต่ไม่อนุมัติ/บันทึกวันจ่ายแทน
- ผู้ใช้ 1 คน = 1 บทบาท

## Flow และสถานะใบเบิก
CREATED (สร้างแล้ว) → PENDING (รออนุมัติ) → APPROVED (อนุมัติแล้ว = อยู่ในคิวบัญชี) → PAID (จ่ายแล้ว, ล็อก)
1. กรอกรหัสลูกค้า → แสดงชื่อศูนย์ + ยอดปกติ
2. กรอกเลขที่ใบแจ้งหนี้ ยอด รอบบริการเริ่ม/สิ้นสุด วันครบกำหนด แนบ PDF/รูป
3. ตรวจกฎ → สร้างใบเบิก (1 ใบ = 1 ศูนย์)
4. เลือกผู้อนุมัติ (บังคับ) → กด "ส่งขออนุมัติ" (SUBMIT)
5. ผู้อนุมัติกด "อนุมัติ" (APPROVE, บันทึก approvedAt) → เข้าคิวบัญชีทันที | "ไม่อนุมัติ" (REJECT + เหตุผล) → กลับเป็น CREATED
6. บัญชีบันทึกวันที่จ่าย → PAID ล็อกไม่ให้แก้
- หลังส่งขออนุมัติ ผู้จัดทำแก้ไม่ได้ ต้องให้ผู้อนุมัติไม่อนุมัติ หรือ admin ย้อนสถานะ (REVERT จาก PENDING/APPROVED, ล้าง approvedAt)
- LogAction `SEND` เลิกใช้แล้ว แต่คงไว้ใน enum เพราะ log เก่าลบไม่ได้
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
ลายเซ็นดิจิทัล, อนุมัติหลายขั้น, OCR ใบแจ้งหนี้, เชื่อมระบบบัญชี, เลขที่เอกสารใบเบิก

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
  - **แถบเมนูซ้าย (sidebar)** `(app)/Sidebar.tsx` (2026-10-24 แทนหัวหน้าจอแนวนอน): กลุ่ม งานประจำ / จัดการระบบ (`NavItem.group`), การ์ดผู้ใช้ด้านล่าง;
    จอ < lg พับเป็นลิ้นชัก เปิดด้วยปุ่ม ☰ (ปิดเมื่อกดลิงก์ — ห้าม setState ใน useEffect ตาม lint)
  - ไอคอน `lucide-react` 1.52 (ไม่มี Building2/Trash2/History — ใช้ Building/Trash/Clock); ไอคอนเมนูผูกใน `Sidebar.tsx` ไม่ใส่ใน `routes.ts` (proxy ใช้)
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
