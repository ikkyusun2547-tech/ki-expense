"use server";

import type { FormState } from "@/lib/formState";
import { fieldErrorsOf, formValues, reportSettingsSchema } from "@/lib/validation";
import { requireRole } from "@/server/auth";
import { saveReportSettings } from "@/server/services/reportSettings";

const FIELDS = ["department", "recipient", "purpose", "requesterTitle", "formCode"] as const;

export async function updateReportSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("CREATOR");

  const values = formValues(formData, FIELDS);
  const parsed = reportSettingsSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  await saveReportSettings(parsed.data);
  return { message: "บันทึกแล้ว ใบเบิกที่พิมพ์ต่อจากนี้จะใช้ข้อความใหม่", values: parsed.data };
}
