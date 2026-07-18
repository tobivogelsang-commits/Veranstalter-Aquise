"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { updateStatus } from "@/lib/actions";
import { ALLE_BANDS_PARAM, STATUS_LABELS, STATUS_ORDER } from "@/lib/constants";
import type { Status } from "@/lib/database.types";
import type { PipelineEntry } from "@/lib/types";

export function KanbanBoard({
  entries,
  bandFilter,
}: {
  entries: PipelineEntry[];
  bandFilter: string;
}) {
  const [items, setItems] = useState(entries);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );
  const zeigeBand = bandFilter === ALLE_BANDS_PARAM;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const neuerStatus = over.id as Status;
    const entry = items.find((e) => e.relation.id === active.id);
    if (!entry || entry.relation.status === neuerStatus) return;

    setItems((prev) =>
      prev.map((e) =>
        e.relation.id === entry.relation.id
          ? { ...e, relation: { ...e.relation, status: neuerStatus } }
          : e
      )
    );

    updateStatus(entry.venue.id, entry.band.id, neuerStatus).catch((err) => {
      console.error("Status-Update fehlgeschlagen", err);
    });
  }

  return (
    <DndContext id="pipeline-kanban" sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-3">
        {STATUS_ORDER.map((status) => (
          <KanbanRow
            key={status}
            status={status}
            entries={items.filter((e) => e.relation.status === status)}
            zeigeBand={zeigeBand}
          />
        ))}
      </div>
    </DndContext>
  );
}

function KanbanRow({
  status,
  entries,
  zeigeBand,
}: {
  status: Status;
  entries: PipelineEntry[];
  zeigeBand: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "flex flex-col gap-2 rounded-lg border p-3 transition-colors",
        isOver ? "border-slate-400 bg-slate-100" : "border-slate-200 bg-slate-50"
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          {STATUS_LABELS[status]}
        </h3>
        <span className="text-xs text-slate-400">{entries.length}</span>
      </div>
      <div className="flex min-h-[64px] flex-wrap gap-2">
        {entries.length === 0 && (
          <p className="py-4 text-xs text-slate-400">Keine Einträge</p>
        )}
        {entries.map((entry) => (
          <KanbanCard key={entry.relation.id} entry={entry} zeigeBand={zeigeBand} />
        ))}
      </div>
    </div>
  );
}

function KanbanCard({
  entry,
  zeigeBand,
}: {
  entry: PipelineEntry;
  zeigeBand: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: entry.relation.id });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={clsx(
        "w-56 shrink-0 cursor-grab touch-none rounded-md border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing",
        isDragging && "z-10 opacity-50"
      )}
    >
      <Link
        href={`/venues/${entry.venue.id}`}
        className="text-sm font-medium text-slate-900 hover:underline"
      >
        {entry.venue.name}
      </Link>
      {zeigeBand && <p className="text-xs text-slate-400">{entry.band.name}</p>}
      {entry.venue.ort && (
        <p className="text-xs text-slate-500">{entry.venue.ort}</p>
      )}
      {entry.venue.veranstaltungsdatum && (
        <p className="text-xs font-medium text-indigo-700">
          📅 {entry.venue.veranstaltungsdatum.split("-").reverse().join(".")}
        </p>
      )}
    </div>
  );
}
