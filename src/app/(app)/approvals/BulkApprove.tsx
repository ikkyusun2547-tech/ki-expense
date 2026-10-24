"use client";

import { Stamp } from "lucide-react";
import { BulkBar } from "@/components/BulkBar";
import { approveMany } from "@/server/actions/requests";

// ผู้อนุมัติติ๊กหลายใบแล้วอนุมัติครั้งเดียว
export function BulkApprove({ formId }: { formId: string }) {
  return (
    <BulkBar
      formId={formId}
      action={approveMany}
      submitLabel="อนุมัติที่เลือก"
      icon={Stamp}
      confirmText={(n) => `อนุมัติ ${n} ใบ? ใบเบิกจะส่งต่อให้ฝ่ายบัญชีทันที`}
    />
  );
}
