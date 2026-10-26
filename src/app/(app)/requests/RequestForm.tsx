"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Check, CircleAlert, Paperclip, Search, Send, Sparkles, TriangleAlert } from "lucide-react";
import { CenterStatusBadge } from "@/components/StatusBadge";
import { ThaiDateInput } from "@/components/ThaiDateInput";
import type { ApproverOption } from "@/server/services/approvers";
import { Alert, Button, ButtonLink, cx, Field, inputClass, StepTitle } from "@/components/ui";
import { ACCEPT_ATTR, MAX_UPLOAD_LABEL } from "@/lib/files";
import { formatAmount, parseAmount, toSatang } from "@/lib/money";
import type { MemoTexts } from "@/lib/pdf/memoData";
import type { RequestSuggestion } from "@/lib/rules/requestDefaults";
import { daysInclusive, formatThaiDate, isISODate } from "@/lib/thai/date";
import { findCenterByCode, saveRequest, type CenterSummary, type RequestFormState } from "@/server/actions/requests";

export type RequestFormValues = {
  invoiceNo: string;
  amount: string;
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
  texts: MemoTexts; // จาก / เรียน / เพื่อ ของใบนี้ (สร้างใหม่: ตามใบล่าสุดของผู้จัดทำ)
};

type Props = SignerProps & (
  | { mode: "create"; initialCode?: string }
  | { mode: "edit"; id: string; center: CenterSummary; values: RequestFormValues; existingFileName: string | null }
);

type Intent = "submit" | "save";

const EMPTY: RequestFormValues = { invoiceNo: "", amount: "", periodStart: "", periodEnd: "", dueDate: "" };

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

  const typedAmount = center ? parseAmount(values.amount) : null;
  const amountDiffers = !!center && typedAmount !== null && toSatang(typedAmount) !== toSatang(center.normalAmount);

  const showResult = !resultStale && !saving;
  const blocks = showResult ? (state.blocks ?? []) : [];
  const warnings = showResult ? (state.warnings ?? []) : [];
  const needsConfirm = blocks.length === 0 && warnings.length > 0;
  const periodDays =
    isISODate(values.periodStart) && isISODate(values.periodEnd) && values.periodEnd >= values.periodStart
      ? daysInclusive(values.periodStart, values.periodEnd)
      : null;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <StepTitle
          step={1}
          title="เลือกศูนย์"
          hint={props.mode === "create" ? "ค้นหาจากรหัสลูกค้า 3BB ตามใบแจ้งหนี้" : "เปลี่ยนศูนย์ไม่ได้ ถ้าเลือกศูนย์ผิดให้ลบใบเบิกแล้วสร้างใหม่"}
        />
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
      </section>

      {center ? (
        <form ref={formRef} onSubmit={handleSubmit} className="grid gap-x-4 gap-y-5 border-t border-slate-100 pt-8 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <StepTitle step={2} title="ข้อมูลตามใบแจ้งหนี้" hint="ใต้ช่องวันที่จะแสดงเป็น พ.ศ. ให้ตรวจอีกครั้ง" />
            {suggested && (
              <p className="-mt-2 flex items-start gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
                <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {suggested.periodStart
                  ? "กรอกยอดปกติ รอบบริการถัดจากใบล่าสุด และวันครบกำหนดให้แล้ว — ตรวจให้ตรงใบแจ้งหนี้ แล้วกรอกเลขที่ใบแจ้งหนี้ + แนบไฟล์"
                  : "กรอกยอดปกติและวันครบกำหนดให้แล้ว (ศูนย์นี้ยังไม่เคยเบิก จึงต้องกรอกรอบบริการเอง)"}
              </p>
            )}
          </div>
          {props.mode === "edit" && <input type="hidden" name="id" value={props.id} />}
          <input type="hidden" name="centerId" value={center.id} />

          <Field label="เลขที่ใบแจ้งหนี้" htmlFor="invoiceNo">
            <input id="invoiceNo" name="invoiceNo" value={values.invoiceNo} onChange={update("invoiceNo")} required maxLength={50} className={`${inputClass} tabular-nums`} />
          </Field>
          <Field label="ยอดตามใบแจ้งหนี้ (บาท)" htmlFor="amount" hint={amountDiffers ? undefined : `ยอดปกติ ${formatAmount(center.normalAmount)} บาท`}>
            <input id="amount" name="amount" inputMode="decimal" value={values.amount} onChange={update("amount")} required placeholder="0.00" className={`${inputClass} tabular-nums`} />
            {/* ยอดต่างจากปกติ: แจ้งทันทีตอนพิมพ์ ไม่ต้องกดยืนยันซ้ำตอนบันทึก */}
            {amountDiffers && (
              <p className="text-xs font-medium text-amber-700">ต่างจากยอดปกติ {formatAmount(center.normalAmount)} บาท — ตรวจให้ตรงใบแจ้งหนี้</p>
            )}
          </Field>
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
          <Field label="วันครบกำหนดชำระ" htmlFor="dueDate" hint={thaiHint(values.dueDate) ?? `ศูนย์นี้ครบกำหนดทุกวันที่ ${center.dueDay}`}>
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
                "flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 text-sm transition hover:border-emerald-500 hover:bg-emerald-50/50 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-emerald-600/10",
                fileName ? "border-emerald-400 bg-emerald-50/50 text-emerald-800" : "border-slate-300 bg-slate-50 text-slate-500",
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

          <div className="border-t border-slate-100 pt-8 sm:col-span-2">
            <StepTitle step={3} title="ผู้ลงนาม" hint="ระบบจำผู้อนุมัติที่เลือกครั้งล่าสุดไว้ให้ · ตำแหน่งเปลี่ยนตามคนที่เลือกเอง" />
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
            <details className="group mt-5 rounded-lg border border-slate-200">
              <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50">
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-slate-800">ข้อความบนใบเบิก</span> — จาก: {props.texts.department} · เรียน:{" "}
                  {props.texts.recipient} · เพื่อ: {props.texts.purpose}
                </span>
                <span className="shrink-0 font-medium text-emerald-700 group-open:hidden">แก้ไข ▾</span>
              </summary>
              <div className="grid gap-4 border-t border-slate-100 p-4 sm:grid-cols-2">
                <Field label="จาก (ชื่อฝ่าย)" htmlFor="department" hint="ใช้ในย่อหน้า “... ขอเบิกค่าใช้บริการ” ด้วย">
                  <input id="department" name="department" defaultValue={props.texts.department} maxLength={150} className={inputClass} />
                </Field>
                <Field label="เพื่อ" htmlFor="purpose">
                  <input id="purpose" name="purpose" defaultValue={props.texts.purpose} maxLength={150} className={inputClass} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="เรียน" htmlFor="recipient" hint="เว้นว่างช่องไหน = ใช้ข้อความตามฟอร์มจริง">
                    <input id="recipient" name="recipient" defaultValue={props.texts.recipient} maxLength={150} className={inputClass} />
                  </Field>
                </div>
              </div>
            </details>
            {props.approvers.length === 0 && (
              <p className="mt-2 text-xs text-amber-700">ยังไม่มีบัญชีผู้อนุมัติในระบบ — แจ้งผู้ดูแลระบบให้สร้าง (บันทึกไว้ก่อนได้)</p>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:col-span-2">
            {showResult && state.error && <Alert tone="error">{state.error}</Alert>}
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

          <div className="flex flex-wrap gap-2 sm:col-span-2">
            {needsConfirm ? (
              <Button type="button" icon={intent === "submit" ? Send : Check} onClick={confirmAndSubmit} disabled={saving}>
                {saving ? "กำลังบันทึก…" : intent === "submit" ? "ตรวจแล้ว ยืนยันส่งขออนุมัติ" : "ตรวจแล้ว ยืนยันบันทึก"}
              </Button>
            ) : (
              <>
                <Button type="submit" name="intent" value="submit" icon={Send} disabled={saving || !approverId}>
                  {saving ? "กำลังบันทึก…" : props.mode === "create" ? "สร้างและส่งขออนุมัติ" : "บันทึกและส่งขออนุมัติ"}
                </Button>
                <Button type="submit" name="intent" value="save" variant="secondary" icon={Check} disabled={saving}>
                  {props.mode === "create" ? "บันทึกไว้ก่อน" : "บันทึกการแก้ไข"}
                </Button>
              </>
            )}
            <ButtonLink href={props.mode === "edit" ? `/requests/${props.id}` : "/summary"} variant="ghost">
              ยกเลิก
            </ButtonLink>
          </div>
        </form>
      ) : (
        <div className="border-t border-slate-100 pt-8 opacity-50">
          <StepTitle step={2} title="ข้อมูลตามใบแจ้งหนี้" hint="ค้นหาศูนย์ให้เจอก่อน" />
        </div>
      )}
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

  // มาจากลิงก์ "สร้างใบเบิก" ในหน้าสรุปรายศูนย์ → ค้นให้เลย
  useEffect(() => {
    if (initialCode) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <Field label="รหัสลูกค้า 3BB" htmlFor="customerCode" hint="พิมพ์แล้วกด Enter หรือปุ่มค้นหา">
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

function CenterCard({ center }: { center: CenterSummary }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-medium text-slate-900">{center.name}</span>
        <CenterStatusBadge status={center.status} />
      </div>
      <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-slate-600">
        <div>
          รหัสลูกค้า <span className="tabular-nums text-slate-900">{center.customerCode}</span>
        </div>
        {center.serviceNumber && (
          <div>
            หมายเลขบริการ <span className="tabular-nums text-slate-900">{center.serviceNumber}</span>
          </div>
        )}
        <div>
          ยอดปกติ <span className="tabular-nums text-slate-900">{formatAmount(center.normalAmount)}</span> บาท
        </div>
        <div>ครบกำหนดทุกวันที่ {center.dueDay}</div>
      </dl>
      {center.status !== "ACTIVE" && <p className="mt-2 text-red-700">ศูนย์นี้ไม่ได้อยู่ในสถานะใช้งาน จึงเบิกไม่ได้</p>}
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
        <select
          id={name}
          name={name}
          value={current}
          onChange={(e) => {
            setOwn(e.target.value);
            onChange?.(e.target.value);
          }}
          className={inputClass}
        >
          <option value="">{empty.label}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
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
