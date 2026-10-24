import { Badge } from "@/components/ui";
import { DUE_SOON_DAYS } from "@/lib/rules/centerSummary";

// ป้ายบอกระยะถึงวันครบกำหนด: เลยกำหนด (แดง) / ภายใน 7 วัน (เหลือง) / ยังอีกนาน (เทา)
export function DueBadge({ daysLeft }: { daysLeft: number }) {
  if (daysLeft < 0) return <Badge tone="red">เลยกำหนด {-daysLeft} วัน</Badge>;
  if (daysLeft === 0) return <Badge tone="amber">ครบกำหนดวันนี้</Badge>;
  return <Badge tone={daysLeft <= DUE_SOON_DAYS ? "amber" : "zinc"}>อีก {daysLeft} วัน</Badge>;
}
