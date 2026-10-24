import "server-only";
import { DEFAULT_MEMO_SETTINGS, type MemoSettings } from "@/lib/pdf/memoData";
import { db } from "@/server/db";

// ค่าตั้งของใบเบิกมีแถวเดียว (id = 1); ยังไม่เคยบันทึก → ใช้ค่าเริ่มต้น
const ID = 1;

export async function getReportSettings(): Promise<MemoSettings> {
  const row = await db.reportSetting.findUnique({ where: { id: ID } });
  if (!row) return DEFAULT_MEMO_SETTINGS;
  const { department, recipient, purpose, requesterTitle, formCode } = row;
  return { department, recipient, purpose, requesterTitle, formCode };
}

export async function saveReportSettings(settings: MemoSettings): Promise<void> {
  await db.reportSetting.upsert({ where: { id: ID }, create: { id: ID, ...settings }, update: settings });
}
