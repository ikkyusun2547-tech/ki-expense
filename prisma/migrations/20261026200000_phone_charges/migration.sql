-- ใบเบิกค่าโทรศัพท์เก็บยอดแยกตามบิล (ก่อน VAT): แพ็กเกจหลัก / แพ็กเกจเสริมและค่าบริการส่วนเกิน
ALTER TABLE "Request" ADD COLUMN "packageAmount" DECIMAL(12,2),
ADD COLUMN "extraAmount" DECIMAL(12,2);

-- มีคู่กันเสมอ และไม่ติดลบ
ALTER TABLE "Request" ADD CONSTRAINT "Request_phone_charges" CHECK (
  ("packageAmount" IS NULL) = ("extraAmount" IS NULL)
  AND ("packageAmount" IS NULL OR ("packageAmount" >= 0 AND "extraAmount" >= 0))
);
