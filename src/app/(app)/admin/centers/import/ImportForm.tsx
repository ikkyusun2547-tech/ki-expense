"use client";

import { Download, FileSearch, Paperclip, Upload } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, useTransition, type FormEvent } from "react";
import { CenterStatusBadge } from "@/components/StatusBadge";
import { Alert, Badge, Button, cx, tableClass, tdClass, thClass } from "@/components/ui";
import type { ServiceKind } from "@/generated/prisma/enums";
import { formatPhone } from "@/lib/centers/phone";
import { formatAmount } from "@/lib/money";
import { importCenters, type CenterImportState } from "@/server/actions/centerImport";

// ข้อความตามประเภททะเบียน — ไฟล์ตัวอย่าง = หัวคอลัมน์ที่ระบบรู้จัก + 1 แถวตัวอย่าง (BOM ให้ Excel เปิดภาษาไทยถูก)
const KIND = {
  INTERNET: {
    noun: "ศูนย์",
    registry: "ทะเบียนศูนย์",
    href: "/admin/centers",
    template: "﻿รหัสลูกค้า,หมายเลขบริการ,ระบบ,ชื่อศูนย์,ยอดปกติ,วันครบกำหนด,สถานะ\r\n600000001,044000001,3BB,ศูนย์ตัวอย่าง,749.00,15,ใช้งาน\r\n",
    required: "รหัสลูกค้า, ชื่อศูนย์, ยอดปกติ, วันครบกำหนด",
    optional: "หมายเลขบริการ, ระบบ (ว่าง = 3BB), สถานะ ได้ — สถานะว่าง = ใช้งาน",
    upsert: "รหัสลูกค้าที่มีอยู่แล้วจะถูกอัปเดต ที่ยังไม่มีจะเพิ่มใหม่",
    codeHeader: "รหัสลูกค้า",
    nameHeader: "ชื่อศูนย์",
  },
  PHONE: {
    noun: "เบอร์",
    registry: "ทะเบียนเบอร์โทรศัพท์",
    href: "/admin/phones",
    template:
      "﻿หมายเลขโทรศัพท์,ระบบ,ผู้ใช้บริการ,ยอดปกติ,วันครบกำหนด,รหัสลูกค้า,สถานะ\r\n097-3378822,TRUE,รัฐกิจสัมพันธ์,374.50,9,24391360,ใช้งาน\r\n",
    required: "หมายเลขโทรศัพท์, ผู้ใช้บริการ, ยอดปกติ, วันครบกำหนด",
    optional: "ระบบ (ว่าง = TRUE), รหัสลูกค้า, สถานะ ได้ — สถานะว่าง = ใช้งาน",
    upsert: "เบอร์ที่มีอยู่แล้วจะถูกอัปเดต ที่ยังไม่มีจะเพิ่มใหม่",
    codeHeader: "หมายเลขโทรศัพท์",
    nameHeader: "ผู้ใช้บริการ",
  },
} as const;

const ACTION_BADGE = {
  new: <Badge tone="green">เพิ่มใหม่</Badge>,
  update: <Badge tone="amber">อัปเดต</Badge>,
  same: <Badge tone="zinc">ไม่เปลี่ยน</Badge>,
} as const;

const PREVIEW_LIMIT = 50;

export function ImportForm({ kind = "INTERNET" }: { kind?: ServiceKind }) {
  const k = KIND[kind];
  const [state, formAction, pending] = useActionState<CenterImportState, FormData>(importCenters, {});
  const [, startTransition] = useTransition();
  const [fileName, setFileName] = useState<string | null>(null);

  // ส่งเองแทน <form action> — React ล้างช่องไฟล์หลังส่ง ทำให้กด "นำเข้า" ต่อจาก "ตรวจไฟล์" ไม่ได้
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const data = new FormData(e.currentTarget);
    data.set("mode", submitter?.value === "import" ? "import" : "preview");
    data.set("kind", kind);
    startTransition(() => formAction(data));
  }

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([k.template], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${k.registry}-ตัวอย่าง.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const preview = state.preview;
  const changes = preview ? preview.newCount + preview.updateCount : 0;

  if (state.imported) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">
          นำเข้า{k.registry}แล้ว {state.imported} {k.noun}
        </Alert>
        <div>
          <Link href={k.href} className="font-medium text-emerald-700 hover:underline">
            ไปหน้า{k.registry} →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <p>
          ไฟล์ต้องมีหัวคอลัมน์: <b>{k.required}</b> (มี {k.optional})
        </p>
        <p className="mt-1">
          จาก Excel: <b>ไฟล์ → บันทึกเป็น → CSV UTF-8</b> · {k.upsert}
        </p>
        <button
          type="button"
          onClick={downloadTemplate}
          className="mt-2 inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline"
        >
          <Download className="size-4" aria-hidden /> ดาวน์โหลดไฟล์ตัวอย่าง
        </button>
      </div>

      <label
        htmlFor="file"
        className={cx(
          "flex h-12 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-4 text-sm transition hover:border-emerald-500 hover:bg-emerald-50/50",
          fileName ? "border-emerald-400 bg-emerald-50/50 text-emerald-800" : "border-slate-300 bg-white text-slate-500",
        )}
      >
        <Paperclip className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{fileName ?? "คลิกเพื่อเลือกไฟล์ CSV"}</span>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          className="sr-only"
        />
      </label>

      {state.encodingNote && <Alert tone="warning">{state.encodingNote}</Alert>}
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.errors && (
        <Alert tone="error">
          <p className="mb-1 font-medium">ไฟล์มีปัญหา {state.errors.length} จุด — แก้ในไฟล์แล้วเลือกใหม่ (ยังไม่ได้นำเข้าอะไร)</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {state.errors.slice(0, 30).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          {state.errors.length > 30 && <p className="mt-1">…และอีก {state.errors.length - 30} จุด</p>}
        </Alert>
      )}

      {preview && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-700">
            พบ <b>{preview.rows.length}</b> {k.noun} — เพิ่มใหม่ <b className="text-emerald-700">{preview.newCount}</b> · อัปเดต{" "}
            <b className="text-amber-700">{preview.updateCount}</b> · ไม่เปลี่ยน {preview.sameCount}
          </p>
          <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
            <table className={tableClass}>
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className={thClass}>{k.codeHeader}</th>
                  <th className={thClass}>{k.nameHeader}</th>
                  <th className={`${thClass} text-right`}>ยอดปกติ</th>
                  <th className={`${thClass} text-center`}>ครบกำหนดวันที่</th>
                  <th className={thClass}>สถานะ</th>
                  <th className={thClass} />
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, PREVIEW_LIMIT).map((r) => (
                  <tr key={r.customerCode} className="border-t border-slate-100">
                    <td className={`${tdClass} tabular-nums`}>
                      {kind === "PHONE" ? formatPhone(r.customerCode) : r.customerCode}
                      {r.provider && <span className="ml-1.5 text-xs text-slate-500">{r.provider}</span>}
                    </td>
                    <td className={tdClass}>{r.name}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{formatAmount(r.normalAmount)}</td>
                    <td className={`${tdClass} text-center tabular-nums`}>{r.dueDay}</td>
                    <td className={tdClass}>
                      <CenterStatusBadge status={r.status} kind={kind} />
                    </td>
                    <td className={tdClass}>{ACTION_BADGE[r.action]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.length > PREVIEW_LIMIT && <p className="text-xs text-slate-500">แสดง {PREVIEW_LIMIT} แถวแรก</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {preview && changes > 0 ? (
          <Button type="submit" name="mode" value="import" icon={Upload} disabled={pending}>
            {pending ? "กำลังนำเข้า…" : `นำเข้า ${changes} ${k.noun}`}
          </Button>
        ) : null}
        <Button
          type="submit"
          name="mode"
          value="preview"
          variant={preview && changes > 0 ? "secondary" : "primary"}
          icon={FileSearch}
          disabled={pending}
        >
          {pending ? "กำลังตรวจ…" : preview ? "ตรวจไฟล์อีกครั้ง" : "ตรวจไฟล์"}
        </Button>
      </div>
      {preview && changes === 0 && <p className="text-sm text-slate-500">ข้อมูลในไฟล์ตรงกับทะเบียนอยู่แล้ว ไม่มีอะไรต้องนำเข้า</p>}
    </form>
  );
}
