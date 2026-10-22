import type { CenterStatus, RequestStatus } from "@/generated/prisma/enums";
import { Badge, type BadgeTone } from "@/components/ui";
import { CENTER_STATUS_LABEL, STATUS_LABEL } from "@/lib/status";

const REQUEST_TONE: Record<RequestStatus, BadgeTone> = {
  CREATED: "sky",
  SENT: "amber",
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

export function CenterStatusBadge({ status }: { status: CenterStatus }) {
  return <Badge tone={CENTER_TONE[status]}>{CENTER_STATUS_LABEL[status]}</Badge>;
}
