"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { ArrowLeftRight, Check, ChevronUp, CircleAlert, Eye, Paperclip, Pencil, Search, Send, Sparkles, TriangleAlert, X } from "lucide-react";
import { CenterStatusBadge } from "@/components/StatusBadge";
import { ThaiDateInput } from "@/components/ThaiDateInput";
import type { ApproverOption, MemoTextsByKind } from "@/server/services/approvers";
import { Alert, Badge, Button, ButtonLink, cx, Field, inputClass, Select, StepCard } from "@/components/ui";
import { formatPhone } from "@/lib/centers/phone";
import { ACCEPT_ATTR, MAX_UPLOAD_LABEL } from "@/lib/files";
import { formatAmount, parseAmount, toSatang } from "@/lib/money";
import { phoneCharges, VAT_PERCENT, type PhoneCharges } from "@/lib/rules/phoneCharges";
import type { RequestSuggestion } from "@/lib/rules/requestDefaults";
import { daysInclusive, formatThaiDate, isISODate } from "@/lib/thai/date";
import { findCenterByCode, saveRequest, type CenterSummary, type RequestFormState } from "@/server/actions/requests";

export type RequestFormValues = {
  invoiceNo: string;
  amount: string;
  packageAmount: string; // ค่าโทรศัพท์ (ก่อน VAT) — ค่าอินเทอร์เน็ตไม่ใช้
  extraAmount: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
};

// ผู้ลงนามเลือกในฟอร์มนี้ที่เดียว (หน้าใบเบิกแสดงอย่างเดียว)
// approverId = ผู้อนุมัติที่เลือกไว้ (สร้างใหม่: คนที่ผู้จัดทำเลือกครั้งล่าสุด)
// requesterId "" = ผู้จัดทำเป็นผู้ขออนุมัติเอง (defaultRequester = ชื่อ/ตำแหน่งที่จะพิมพ์)
type SignerProps = {
  approvers: ApproverOption[];
  approverId: string;
  requesters: ApproverOption[];
  requesterId: string;
  defaultRequester: { id: string; name: string; title: string };
  texts: MemoTextsByKind; // จาก / เรียน / เพื่อ ของใบนี้ แยกตามประเภท (สร้างใหม่: ตามใบล่าสุดประเภทเดียวกันของผู้จัดทำ)
};

type Props = SignerProps & (
  | { mode: "create"; initialCode?: string }
  | { mode: "edit"; id: string; center: CenterSummary; values: RequestFormValues; existingFileName: string | null }
);

type Intent = "submit" | "save";

const EMPTY: RequestFormValues = { invoiceNo: "", amount: "", packageAmount: "", extraAmount: "", periodStart: "", periodEnd: "", dueDate: "" };

export function RequestForm(props: Props) {
  const [state, formAction, saving] = useActionState<RequestFormState, FormData>(saveRequest, {});
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const confirmRef = useRef(false);
  const [intent, setIntent] = useState<Intent>("submit");

  const [center, setCenter] = useState<CenterSummary | null>(props.mode === "edit" ? props.center : null);
  const [values, setValues] = useState<RequestFormValues>(props.mode === "edit" ? props.values : EMPTY);
  // ผลตรวจล่าสุดใช้ได้เฉพาะกับค่าที่ส่งไป — แก้ช่องใดก็ตามแล้วซ่อนผลเดิม
  const [resultStale, setResultStale] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [approverId, setApproverId] = useState(props.approverId);
  const [suggested, setSuggested] = useState<RequestSuggestion | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // ดูตัวอย่าง PDF จากค่าที่กรอกอยู่ (ยังไม่บันทึก) — เปิดแท็บใหม่ทันทีตอนกด (กันเบราว์เซอร์บล็อกป๊อปอัป) แล้วค่อยใส่ไฟล์
  async function previewPdf() {
    if (!formRef.current) return;
    const tab = window.open("", "_blank");
    const data = new FormData(formRef.current);
    data.delete("invoiceFile"); // ไม่ต้องส่งไฟล์ใบแจ้งหนี้
    setPreviewing(true);
    try {
      const res = await fetch("/api/requests/preview", { method: "POST", body: data });
      if (!res.ok) {
        tab?.close();
        setPreviewError(res.status === 400 ? await res.text() : "สร้างตัวอย่างไม่สำเร็จ ลองใหม่อีกครั้ง");
        return;
      }
      setPreviewError(null);
      const url = URL.createObjectURL(await res.blob());
      if (tab) tab.location.href = url;
      else window.open(url, "_blank");
    } catch {
      tab?.close();
      setPreviewError("สร้างตัวอย่างไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setPreviewing(false);
    }
  }

  const set = (key: keyof RequestFormValues, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setResultStale(true);
  };
  const update = (key: keyof RequestFormValues) => (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.target.value);
  const updateDate = (key: keyof RequestFormValues) => (iso: string) => set(key, iso);

  // ส่งเองแทน <form action> เพราะ React จะล้างฟอร์ม (รวมไฟล์ที่เลือก) หลังส่งทุกครั้ง
  // ปุ่มที่กด (ส่งขออนุมัติ / บันทึกไว้ก่อน) จำไว้ใช้ตอนกด "ตรวจแล้ว ยืนยัน" รอบถัดไป
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const chosen: Intent = submitter?.value === "submit" || submitter?.value === "save" ? submitter.value : intent;
    setIntent(chosen);
    const data = new FormData(e.currentTarget);
    data.set("intent", chosen);
    data.set("confirmWarnings", confirmRef.current ? "1" : "0");
    confirmRef.current = false;
    setResultStale(false);
    startTransition(() => formAction(data));
  }

  function confirmAndSubmit() {
    confirmRef.current = true;
    formRef.current?.requestSubmit();
  }

  // ค่าโทรศัพท์: ยอดเบิก = แพ็กเกจหลัก + เสริม/ส่วนเกิน + VAT 7% (เซิร์ฟเวอร์คิดซ้ำเอง)
  const isPhone = center?.kind === "PHONE";
  const charges = isPhone ? phoneCharges(values.packageAmount, values.extraAmount) : null;
  const typedAmount = !center ? null : isPhone ? (charges?.total ?? null) : parseAmount(values.amount);
  const amountDiffers = !!center && typedAmount !== null && toSatang(typedAmount) !== toSatang(center.normalAmount);

  // ประเภทใบเบิกตามที่ค้นเจอ (ศูนย์ = ค่าอินเทอร์เน็ต / เบอร์ = ค่าโทรศัพท์)
  const noun = center?.kind === "PHONE" ? "เบอร์" : "ศูนย์";
  const texts = props.texts[center?.kind ?? "INTERNET"];

  const showResult = !resultStale && !saving;
  const blocks = showResult ? (state.blocks ?? []) : [];
  const warnings = showResult ? (state.warnings ?? []) : [];
  const needsConfirm = blocks.length === 0 && warnings.length > 0;
  const periodDays =
    isISODate(values.periodStart) && isISODate(values.periodEnd) && values.periodEnd >= values.periodStart
      ? daysInclusive(values.periodStart, values.periodEnd)
      : null;

  return (
    <div className="flex flex-col gap-5">
      <StepCard
        step={1}
        title="เลือกศูนย์ / เบอร์โทรศัพท์"
        hint={
          props.mode === "create"
            ? props.initialCode
              ? `เลือกจากการ์ดแล้ว — ผิด${noun}กด “เปลี่ยน${noun}”`
              : "ค้นหาจากรหัสลูกค้า (อินเทอร์เน็ต) หรือเบอร์โทรศัพท์ ตามใบแจ้งหนี้"
            : `เปลี่ยน${noun}ไม่ได้ ถ้าเลือก${noun}ผิดให้ลบใบเบิกแล้วสร้างใหม่`
        }
      >
          {props.mode === "create" ? (
            <CenterLookup
              initialCode={props.initialCode}
              center={center}
              onFound={(c, suggestion) => {
                setCenter(c);
                // กรอกให้ล่วงหน้า (ยอดปกติ / รอบถัดไป / วันครบกำหนด) — เลขที่ใบแจ้งหนี้ที่พิมพ์ไว้แล้วคงเดิม
                setValues((v) => ({ ...v, ...suggestion }));
                setSuggested(suggestion);
                setResultStale(true);
                // ช่องที่ต้องพิมพ์เองทุกครั้ง → วางเคอร์เซอร์ให้เลย
                requestAnimationFrame(() => document.getElementById("invoiceNo")?.focus());
              }}
            />
          ) : (
            center && <CenterCard center={center} />
          )}
      </StepCard>

      {center ? (
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
          <StepCard step={2} title="ข้อมูลตามใบแจ้งหนี้" hint="ใต้ช่องวันที่จะแสดงเป็น พ.ศ. ให้ตรวจอีกครั้ง">
            <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
              {suggested && (
                <div className="sm:col-span-2">
                  <p className="flex items-start gap-1.5 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800">
                    <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {suggested.periodStart
                      ? "กรอกยอดปกติ รอบบริการถัดจากใบล่าสุด และวันครบกำหนดให้แล้ว — ตรวจให้ตรงใบแจ้งหนี้ แล้วกรอกเลขที่ใบแจ้งหนี้ + แนบไฟล์"
                      : `กรอกยอดปกติและวันครบกำหนดให้แล้ว (${noun}นี้ยังไม่เคยเบิก จึงต้องกรอกรอบบริการเอง)`}
                  </p>
                </div>
              )}
              {props.mode === "edit" && <input type="hidden" name="id" value={props.id} />}
              <input type="hidden" name="centerId" value={center.id} />

              <Field label="เลขที่ใบแจ้งหนี้" htmlFor="invoiceNo">
                <input id="invoiceNo" name="invoiceNo" value={values.invoiceNo} onChange={update("invoiceNo")} required maxLength={50} className={`${inputClass} tabular-nums`} />
              </Field>
              {isPhone ? (
                <>
                  <Field label="ค่าบริการแพ็กเกจหลัก (บาท)" htmlFor="packageAmount" hint="ก่อนภาษีมูลค่าเพิ่ม ตามบิล">
                    <input
                      id="packageAmount"
                      name="packageAmount"
                      inputMode="decimal"
                      value={values.packageAmount}
                      onChange={update("packageAmount")}
                      required
                      placeholder="0.00"
                      className={`${inputClass} tabular-nums`}
                    />
                  </Field>
                  <Field label="ค่าแพ็กเกจเสริมและค่าบริการส่วนเกิน (บาท)" htmlFor="extraAmount" hint="ก่อนภาษีมูลค่าเพิ่ม · ไม่มี = 0">
                    <input
                      id="extraAmount"
                      name="extraAmount"
                      inputMode="decimal"
                      value={values.extraAmount}
                      onChange={update("extraAmount")}
                      placeholder="0.00"
                      className={`${inputClass} tabular-nums`}
                    />
                  </Field>
                  <PhoneChargesBox charges={charges} normalAmount={center.normalAmount} differs={amountDiffers} />
                </>
              ) : (
                <Field label="ยอดตามใบแจ้งหนี้ (บาท)" htmlFor="amount" hint={amountDiffers ? undefined : `ยอดปกติ ${formatAmount(center.normalAmount)} บาท`}>
                  <input id="amount" name="amount" inputMode="decimal" value={values.amount} onChange={update("amount")} required placeholder="0.00" className={`${inputClass} tabular-nums`} />
                  {/* ยอดต่างจากปกติ: แจ้งทันทีตอนพิมพ์ ไม่ต้องกดยืนยันซ้ำตอนบันทึก */}
                  {amountDiffers && (
                    <p className="text-xs font-medium text-amber-700">ต่างจากยอดปกติ {formatAmount(center.normalAmount)} บาท — ตรวจให้ตรงใบแจ้งหนี้</p>
                  )}
                </Field>
              )}
              <Field label="รอบบริการ เริ่ม" htmlFor="periodStart" hint={thaiHint(values.periodStart)}>
                <ThaiDateInput id="periodStart" name="periodStart" value={values.periodStart} onChange={updateDate("periodStart")} required />
              </Field>
              <Field
                label="รอบบริการ สิ้นสุด"
                htmlFor="periodEnd"
                hint={[thaiHint(values.periodEnd), periodDays && `รวม ${periodDays} วัน`].filter(Boolean).join(" · ") || undefined}
              >
                <ThaiDateInput id="periodEnd" name="periodEnd" value={values.periodEnd} onChange={updateDate("periodEnd")} required />
              </Field>
              <Field label="วันครบกำหนดชำระ" htmlFor="dueDate" hint={thaiHint(values.dueDate) ?? `${noun}นี้ครบกำหนดทุกวันที่ ${center.dueDay}`}>
                <ThaiDateInput id="dueDate" name="dueDate" value={values.dueDate} onChange={updateDate("dueDate")} required />
              </Field>
              <Field
                label="ไฟล์ใบแจ้งหนี้"
                htmlFor="invoiceFile"
                hint={
                  props.mode === "edit" && props.existingFileName
                    ? `ไฟล์เดิม: ${props.existingFileName} — เลือกไฟล์ใหม่เฉพาะเมื่อต้องการเปลี่ยน`
                    : `PDF, JPG หรือ PNG ไม่เกิน ${MAX_UPLOAD_LABEL}`
                }
              >
                <label
                  htmlFor="invoiceFile"
                  className={cx(
                    "flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 text-sm transition hover:border-brand-500 hover:bg-brand-50/50 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-600/10",
                    fileName ? "border-brand-400 bg-brand-50/50 text-brand-800" : "border-slate-300 bg-slate-50 text-slate-500",
                  )}
                >
                  <Paperclip className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{fileName ?? "คลิกเพื่อเลือกไฟล์ใบแจ้งหนี้"}</span>
                  <input
                    id="invoiceFile"
                    name="invoiceFile"
                    type="file"
                    accept={ACCEPT_ATTR}
                    onChange={(e) => {
                      setFileName(e.target.files?.[0]?.name ?? null);
                      setResultStale(true);
                    }}
                    className="sr-only"
                  />
                </label>
              </Field>
            </div>
          </StepCard>

          <StepCard step={3} title="ผู้ลงนาม" hint="ระบบจำผู้อนุมัติที่เลือกครั้งล่าสุดไว้ให้ · ตำแหน่งเปลี่ยนตามคนที่เลือกเอง">
            <div className="flex flex-col gap-4">
              <SignerSelect
                name="approverId"
                label="ผู้อนุมัติ"
                value={approverId}
                onChange={(v) => {
                  setApproverId(v);
                  setResultStale(true);
                }}
                options={props.approvers}
                empty={{ label: "— เลือกผู้อนุมัติ —", title: "" }}
              />
              <SignerSelect
                name="requesterId"
                label="ผู้ขออนุมัติ"
                defaultValue={props.requesterId}
                options={props.requesters.filter((r) => r.id !== props.defaultRequester.id)}
                empty={{ label: `ผู้จัดทำ: ${props.defaultRequester.name}`, title: props.defaultRequester.title }}
              />
            </div>
            {/* ข้อความหัวบันทึกของใบนี้ — ปกติเหมือนใบก่อน จึงพับไว้ */}
            <details key={center.kind} className="group mt-5 rounded-xl border border-slate-200 bg-slate-50/60">
              {/* หัวข้อ + ปุ่มแก้ไข/ซ่อน อยู่บรรทัดบน · ข้อความปัจจุบันบรรทัดละข้อ (ซ่อนเมื่อเปิดแก้ — ช่องกรอกแสดงค่าเดียวกัน) */}
              <summary className="flex cursor-pointer list-none flex-col gap-2 px-4 py-3 text-sm">
                <span className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-800">ข้อความบนใบเบิก</span>
                  <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 font-medium text-slate-700 shadow-sm group-hover:border-brand-200 group-hover:text-brand-800">
                    <Pencil className="size-4 group-open:hidden" aria-hidden />
                    <ChevronUp className="hidden size-4 group-open:block" aria-hidden />
                    <span className="group-open:hidden">แก้ไข</span>
                    <span className="hidden group-open:inline">ซ่อน</span>
                  </span>
                </span>
                {/* ตารางหัวข้อ-ค่า แบบเดียวกับหน้ารายละเอียดใบเบิก (InfoTable) — span เพราะอยู่ใน <summary> */}
                <span className="block divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/70 bg-white group-open:hidden">
                  {[
                    ["จาก", texts.department],
                    ["เรียน", texts.recipient],
                    ["เพื่อ", texts.purpose],
                  ].map(([label, value]) => (
                    <span key={label} className="flex gap-4 px-3 py-2">
                      <span className="w-12 shrink-0 text-slate-500">{label}</span>
                      <span className="min-w-0 flex-1 text-slate-900">{value}</span>
                    </span>
                  ))}
                </span>
              </summary>
              <div className="grid gap-4 border-t border-slate-100 p-4 sm:grid-cols-2">
                <Field label="จาก (ชื่อฝ่าย)" htmlFor="department" hint="ใช้ในย่อหน้า “... ขอเบิกค่าใช้บริการ” ด้วย">
                  <input id="department" name="department" defaultValue={texts.department} maxLength={150} className={inputClass} />
                </Field>
                <Field label="เพื่อ" htmlFor="purpose">
                  <input id="purpose" name="purpose" defaultValue={texts.purpose} maxLength={150} className={inputClass} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="เรียน" htmlFor="recipient" hint="เว้นว่างช่องไหน = ใช้ข้อความตามฟอร์มจริง">
                    <input id="recipient" name="recipient" defaultValue={texts.recipient} maxLength={150} className={inputClass} />
                  </Field>
                </div>
              </div>
            </details>
            {props.approvers.length === 0 && (
              <p className="mt-2 text-xs text-amber-700">ยังไม่มีบัญชีผู้อนุมัติในระบบ — แจ้งผู้ดูแลระบบให้สร้าง (บันทึกไว้ก่อนได้)</p>
            )}
          </StepCard>

          <div className="flex flex-col gap-3 empty:hidden">
            {showResult && state.error && <Alert tone="error">{state.error}</Alert>}
            {previewError && <Alert tone="warning">ดูตัวอย่างไม่ได้: {previewError}</Alert>}
            {blocks.length > 0 && (
              <Alert tone="error">
                <p className="mb-1 flex items-center gap-1.5 font-medium">
                  <CircleAlert className="size-4" aria-hidden /> บันทึกไม่ได้
                </p>
                <ul className="list-disc pl-5">
                  {blocks.map((i) => (
                    <li key={i.code + i.message}>{i.message}</li>
                  ))}
                </ul>
              </Alert>
            )}
            {warnings.length > 0 && (
              <Alert tone="warning">
                <p className="mb-1 flex items-center gap-1.5 font-medium">
                  <TriangleAlert className="size-4" aria-hidden /> โปรดตรวจสอบก่อนบันทึก
                </p>
                <ul className="list-disc pl-5">
                  {warnings.map((i) => (
                    <li key={i.code}>{i.message}</li>
                  ))}
                </ul>
              </Alert>
            )}
          </div>

          {/* แถบปุ่ม: จอคอมติดขอบล่างจอขณะเลื่อน (กดส่งได้ไม่ต้องเลื่อนลงสุด) · มือถืออยู่ท้ายฟอร์ม (ไม่บังช่องกรอก) */}
          <div className="z-10 flex flex-wrap gap-2 rounded-2xl border border-slate-200/70 bg-white/95 p-3 shadow-lg shadow-slate-900/5 backdrop-blur md:sticky md:bottom-4">
            {needsConfirm ? (
              <Button type="button" icon={intent === "submit" ? Send : Check} onClick={confirmAndSubmit} disabled={saving}>
                {saving ? "กำลังบันทึก…" : intent === "submit" ? "ตรวจแล้ว ยืนยันส่งขออนุมัติ" : "ตรวจแล้ว ยืนยันบันทึก"}
              </Button>
            ) : (
              <>
                <Button type="submit" name="intent" value="submit" icon={Send} disabled={saving || !approverId}>
                  {saving ? "กำลังบันทึก…" : props.mode === "create" ? "สร้างและส่งขออนุมัติ" : "บันทึกและส่งขออนุมัติ"}
                </Button>
                <Button type="submit" name="intent" value="save" variant="soft" icon={Check} disabled={saving}>
                  {props.mode === "create" ? "บันทึกไว้ก่อน" : "บันทึกการแก้ไข"}
                </Button>
              </>
            )}
            <Button type="button" variant="info" icon={Eye} onClick={previewPdf} disabled={previewing}>
              {previewing ? "กำลังสร้างตัวอย่าง…" : "ดูตัวอย่าง PDF"}
            </Button>
            <ButtonLink href={props.mode === "edit" ? `/requests/${props.id}` : `/summary?kind=${center.kind}`} variant="ghost" icon={X}>
              ยกเลิก
            </ButtonLink>
          </div>
        </form>
      ) : (
        <StepCard step={2} title="ข้อมูลตามใบแจ้งหนี้" hint="ค้นหาศูนย์หรือเบอร์ให้เจอก่อน" disabled />
      )}
    </div>
  );
}

// ยอดแยกแบบในบิล (รวมก่อน VAT / VAT 7% / รวมทั้งสิ้น) — ให้เทียบกับบิลได้ทันทีตอนกรอก
function PhoneChargesBox({ charges, normalAmount, differs }: { charges: PhoneCharges | null; normalAmount: string; differs: boolean }) {
  const row = (label: string, value: string | undefined, strong = false) => (
    <div className={cx("flex justify-between gap-4", strong && "border-t border-slate-200 pt-1.5 font-semibold text-slate-900")}>
      <span>{label}</span>
      <span className="tabular-nums">{value ? formatAmount(value) : "–"}</span>
    </div>
  );
  return (
    <div className="flex flex-col gap-1 self-start rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
      {row("รวมค่าบริการก่อนภาษีมูลค่าเพิ่ม", charges?.subtotal)}
      {row(`ภาษีมูลค่าเพิ่ม ${VAT_PERCENT}%`, charges?.vat)}
      {row("รวมทั้งสิ้น (ยอดเบิก)", charges?.total, true)}
      {!charges && <p className="text-xs text-red-700">กรอกยอดเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง</p>}
      {differs && <p className="text-xs font-medium text-amber-700">ต่างจากยอดปกติ {formatAmount(normalAmount)} บาท — ตรวจให้ตรงบิล</p>}
    </div>
  );
}

// ช่อง date ของเบราว์เซอร์แสดงตามภาษาเครื่อง จึงแสดง พ.ศ. ใต้ช่องให้ตรวจอีกที
function thaiHint(iso: string): string | undefined {
  return isISODate(iso) ? formatThaiDate(iso, "long") : undefined;
}

function CenterLookup({
  initialCode = "",
  center,
  onFound,
}: {
  initialCode?: string;
  center: CenterSummary | null;
  onFound: (c: CenterSummary, suggestion: RequestSuggestion) => void;
}) {
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();

  function search() {
    startSearch(async () => {
      const result = await findCenterByCode(code);
      if (result.ok) {
        setError(null);
        onFound(result.center, result.suggestion);
      } else {
        setError(result.error);
      }
    });
  }

  // มาจากการ์ดศูนย์ (หน้าศูนย์ & เบอร์) → ค้นให้เลย
  useEffect(() => {
    if (initialCode) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // เลือกจากการ์ดในหน้าสรุปแล้ว (มี initialCode และค้นเจอ) → ไม่ต้องแสดงช่องพิมพ์รหัส มีปุ่มกลับไปเลือกใหม่แทน
  const picked = !!initialCode && !!center && code === initialCode;
  if (picked) {
    return (
      <CenterCard
        center={center}
        action={
          <ButtonLink href={`/summary?kind=${center.kind}`} variant="secondary" size="sm" icon={ArrowLeftRight}>
            เปลี่ยน{center.kind === "PHONE" ? "เบอร์" : "ศูนย์"}
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="รหัสลูกค้า / เบอร์โทรศัพท์" htmlFor="customerCode" hint="พิมพ์แล้วกด Enter หรือปุ่มค้นหา">
        <div className="flex gap-2">
          <input
            id="customerCode"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                search();
              }
            }}
            autoFocus
            className={`${inputClass} max-w-xs tabular-nums`}
          />
          <Button type="button" variant="secondary" icon={Search} onClick={search} disabled={searching || !code.trim()}>
            {searching ? "กำลังค้นหา…" : "ค้นหา"}
          </Button>
        </div>
      </Field>
      {error && <Alert tone="error">{error}</Alert>}
      {center && <CenterCard center={center} />}
    </div>
  );
}

function CenterCard({ center, action }: { center: CenterSummary; action?: ReactNode }) {
  const phone = center.kind === "PHONE";
  return (
    // สีประจำประเภท (เหมือนปุ่มใหญ่หน้าแรก): อินเทอร์เน็ต = ฟ้า, โทรศัพท์ = ส้ม
    <div className={cx("rounded-2xl border border-l-4 px-4 py-3 text-sm", phone ? "border-orange-200 border-l-orange-400 bg-orange-50" : "border-sky-200 border-l-sky-400 bg-sky-50")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold text-slate-900">{phone ? `${formatPhone(center.customerCode)} · ${center.name}` : center.name}</span>
        <Badge tone={phone ? "sky" : "zinc"}>{phone ? "ค่าโทรศัพท์" : "ค่าอินเทอร์เน็ต"}</Badge>
        <CenterStatusBadge status={center.status} kind={center.kind} />
        {action && <span className="ml-auto">{action}</span>}
      </div>
      <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-slate-600">
        {!phone && (
          <div>
            รหัสลูกค้า <span className="tabular-nums text-slate-900">{center.customerCode}</span>
          </div>
        )}
        <div>
          ระบบ <span className="text-slate-900">{center.provider || "–"}</span>
        </div>
        {center.serviceNumber && (
          <div>
            {phone ? "รหัสลูกค้า" : "หมายเลขบริการ"} <span className="tabular-nums text-slate-900">{center.serviceNumber}</span>
          </div>
        )}
        <div>
          ยอดปกติ <span className="tabular-nums text-slate-900">{formatAmount(center.normalAmount)}</span> บาท
        </div>
        <div>ครบกำหนดทุกวันที่ {center.dueDay}</div>
      </dl>
      {center.status !== "ACTIVE" && <p className="mt-2 text-red-700">{phone ? "เบอร์" : "ศูนย์"}นี้ไม่ได้อยู่ในสถานะใช้งาน จึงเบิกไม่ได้</p>}
    </div>
  );
}

// ช่องเลือกผู้ลงนาม + ตำแหน่งของคนที่เลือก (แสดงอย่างเดียว — ตำแหน่งแก้ที่บัญชีผู้ใช้)
function SignerSelect({
  name,
  label,
  value,
  defaultValue,
  onChange,
  options,
  empty,
}: {
  name: string;
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: ApproverOption[];
  empty: { label: string; title: string };
}) {
  const [own, setOwn] = useState(defaultValue ?? "");
  const current = value ?? own;
  const title = current ? options.find((o) => o.id === current)?.title : empty.title;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={label} htmlFor={name}>
        <Select
          id={name}
          name={name}
          value={current}
          onChange={(e) => {
            setOwn(e.target.value);
            onChange?.(e.target.value);
          }}
        >
          <option value="">{empty.label}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
      </Field>
      <div>
        <div className="text-sm font-medium text-slate-700">ตำแหน่ง</div>
        <div className="mt-1.5 flex h-10 items-center rounded-lg bg-slate-100 px-3 text-sm text-slate-800">
          {title || <span className="text-slate-400">–</span>}
        </div>
      </div>
    </div>
  );
}
