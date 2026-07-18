import clsx from "clsx";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import type { Status } from "@/lib/database.types";

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STATUS_COLORS[status]
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
