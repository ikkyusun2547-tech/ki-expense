"use client";

import { useActionState, useRef, useState, useTransition, type FormEvent } from "react";
import { CenterStatusBadge } from "@/components/StatusBadge";
import { Alert, Button, ButtonLink, Field, inputClass } from "@/components/ui";
import { ACCEPT_ATTR, MAX_UPLOAD_LABEL } from "@/lib/files";
import { formatAmount } from "@/lib/money";
import { daysInclusive, formatThaiDate, isISODate } from "@/lib/thai/date";
import { findCenterByCode, saveRequest, type CenterSummary, type RequestFormState } from "@/server/actions/requests";

export type RequestFormValues = {
  invoiceNo: string;
  amount: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
};

type Props =
  | { mode: "create" }
  | { mode: "edit"; id: string; center: CenterSummary; values: RequestFormValues; existingFileName: string | null };

const EMPTY: RequestFormValues = { invoiceNo: "", amount: "", periodStart: "", periodEnd: "", dueDate: "" };

export function RequestForm(props: Props) {
  const [state, formAction, saving] = useActionState<RequestFormState, FormData>(saveRequest, {});
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const confirmRef = useRef(false);

  const [center, setCenter] = useState<CenterSummary | null>(props.mode === "edit" ? props.center : null);
  const [values, setValues] = useState<RequestFormValues>(props.mode === "edit" ? props.values : EMPTY);
  // ผลตรวจล่าสุดใช้ได้เฉพาะกับค่าที่ส่งไป — แก้ช่องใดก็ตามแล้วซ่อนผลเดิม
  const [resultStale, setResultStale] = useState(false);

  const update = (key: keyof RequestFormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setResultStale(true);
  };

  // ส่งเองแทน <form action> เพราะ React จะล้างฟอร์ม (รวมไฟล์ที่เลือก) หลังส่งทุกครั้ง
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    data.set("confirmWarnings", confirmRef.current ? "1" : "0");
    confirmRef.current = false;
    setResultStale(false);
    startTransition(() => formAction(data));
  }

  function confirmAndSubmit() {
    confirmRef.current = true;
    formRef.current?.requestSubmit();
  }

  const showResult = !resultStale && !saving;
  const blocks = showResult ? (state.blocks ?? []) : [];
  const warnings = showResult ? (state.warnings ?? []) : [];
  const needsConfirm = blocks.length === 0 && warnings.length > 0;
  const periodDays =
    isISODate(values.periodStart) && isISODate(values.periodEnd) && values.periodEnd >= values.periodStart
      ? daysInclusive(values.periodStart, values.periodEnd)
      : null;

  return (
    <div className="flex flex-col gap-6">
      {props.mode === "create" ? (
        <CenterLookup
          center={center}
          onFound={(c) => {
            setCenter(c);
            setResultStale(true);
          }}
        />
      ) : (
        center && <CenterCard center={center} />
      )}

      {center && (
        <form ref={formRef} onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          {props.mode === "edit" && <input type="hidden" name="id" value={props.id} />}
          <input type="hidden" name="centerId" value={center.id} />

          <Field label="เลขที่ใบแจ้งหนี้" htmlFor="invoiceNo">
            <input id="invoiceNo" name="invoiceNo" value={values.invoiceNo} onChange={update("invoiceNo")} required maxLength={50} className={`${inputClass} font-mono`} />
          </Field>
          <Field label="ยอดตามใบแจ้งหนี้ (บาท)" htmlFor="amount" hint={`ยอดปกติ ${formatAmount(center.normalAmount)} บาท`}>
            <input id="amount" name="amount" inputMode="decimal" value={values.amount} onChange={update("amount")} required placeholder="0.00" className={`${inputClass} tabular-nums`} />
          </Field>
          <Field label="รอบบริการ เริ่ม" htmlFor="periodStart" hint={thaiHint(values.periodStart)}>
            <input id="periodStart" name="periodStart" type="date" value={values.periodStart} onChange={update("periodStart")} required className={inputClass} />
          </Field>
          <Field
            label="รอบบริการ สิ้นสุด"
            htmlFor="periodEnd"
            hint={[thaiHint(values.periodEnd), periodDays && `รวม ${periodDays} วัน`].filter(Boolean).join(" · ") || undefined}
          >
            <input id="periodEnd" name="periodEnd" type="date" value={values.periodEnd} onChange={update("periodEnd")} required className={inputClass} />
          </Field>
          <Field label="วันครบกำหนดชำระ" htmlFor="dueDate" hint={thaiHint(values.dueDate) ?? `ศูนย์นี้ครบกำหนดทุกวันที่ ${center.dueDay}`}>
            <input id="dueDate" name="dueDate" type="date" value={values.dueDate} onChange={update("dueDate")} required className={inputClass} />
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
            <input
              id="invoiceFile"
              name="invoiceFile"
              type="file"
              accept={ACCEPT_ATTR}
              onChange={() => setResultStale(true)}
              className="text-sm file:mr-3 file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-sm hover:file:bg-zinc-50"
            />
          </Field>

          <div className="flex flex-col gap-3 sm:col-span-2">
            {showResult && state.error && <Alert tone="error">{state.error}</Alert>}
            {blocks.length > 0 && (
              <Alert tone="error">
                <p className="mb-1 font-medium">บันทึกไม่ได้</p>
                <ul className="list-disc pl-5">
                  {blocks.map((i) => (
                    <li key={i.code + i.message}>{i.message}</li>
                  ))}
                </ul>
              </Alert>
            )}
            {warnings.length > 0 && (
              <Alert tone="warning">
                <p className="mb-1 font-medium">โปรดตรวจสอบก่อนบันทึก</p>
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
              <Button type="button" onClick={confirmAndSubmit} disabled={saving}>
                {saving ? "กำลังบันทึก…" : "ตรวจแล้ว ยืนยันบันทึก"}
              </Button>
            ) : (
              <Button type="submit" disabled={saving}>
                {saving ? "กำลังบันทึก…" : props.mode === "create" ? "สร้างใบเบิก" : "บันทึกการแก้ไข"}
              </Button>
            )}
            <ButtonLink href={props.mode === "edit" ? `/requests/${props.id}` : "/requests"} variant="secondary">
              ยกเลิก
            </ButtonLink>
          </div>
        </form>
      )}
    </div>
  );
}

// ช่อง date ของเบราว์เซอร์แสดงตามภาษาเครื่อง จึงแสดง พ.ศ. ใต้ช่องให้ตรวจอีกที
function thaiHint(iso: string): string | undefined {
  return isISODate(iso) ? formatThaiDate(iso, "long") : undefined;
}

function CenterLookup({ center, onFound }: { center: CenterSummary | null; onFound: (c: CenterSummary) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();

  function search() {
    startSearch(async () => {
      const result = await findCenterByCode(code);
      if (result.ok) {
        setError(null);
        onFound(result.center);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="รหัสลูกค้า 3BB" htmlFor="customerCode" hint="พิมพ์รหัสลูกค้าตามใบแจ้งหนี้ แล้วกดค้นหา">
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
            className={`${inputClass} max-w-xs font-mono`}
          />
          <Button type="button" variant="secondary" onClick={search} disabled={searching || !code.trim()}>
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
    <div className="rounded-md border border-emerald-200 bg-emerald-50/50 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-medium text-zinc-900">{center.name}</span>
        <CenterStatusBadge status={center.status} />
      </div>
      <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-zinc-600">
        <div>
          รหัสลูกค้า <span className="font-mono text-zinc-900">{center.customerCode}</span>
        </div>
        {center.serviceNumber && (
          <div>
            หมายเลขบริการ <span className="font-mono text-zinc-900">{center.serviceNumber}</span>
          </div>
        )}
        <div>
          ยอดปกติ <span className="tabular-nums text-zinc-900">{formatAmount(center.normalAmount)}</span> บาท
        </div>
        <div>ครบกำหนดทุกวันที่ {center.dueDay}</div>
      </dl>
      {center.status !== "ACTIVE" && <p className="mt-2 text-red-700">ศูนย์นี้ไม่ได้อยู่ในสถานะใช้งาน จึงเบิกไม่ได้</p>}
    </div>
  );
}
