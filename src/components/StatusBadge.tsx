import type { CenterStatus, RequestStatus, ServiceKind } from "@/generated/prisma/enums";
import { Badge, type BadgeTone } from "@/components/ui";
import { centerStatusLabel, STATUS_LABEL } from "@/lib/status";

// สีประจำสถานะใบเบิก — ใช้ทั้งป้ายและพื้นการ์ด (TONE_SURFACE)
export const REQUEST_TONE: Record<RequestStatus, BadgeTone> = {
  CREATED: "zinc",
  PENDING: "amber",
  APPROVED: "sky",
  RECEIVED: "violet",
  PAID: "green",
};

const CENTER_TONE: Record<CenterStatus, BadgeTone> = {
  ACTIVE: "green",
  MOVED: "amber",
  CLOSED: "zinc",
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <Badge tone={REQUEST_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function CenterStatusBadge({ status, kind }: { status: CenterStatus; kind?: ServiceKind }) {
  return <Badge tone={CENTER_TONE[status]}>{centerStatusLabel(status, kind)}</Badge>;
}
