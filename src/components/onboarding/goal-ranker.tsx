"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GOAL_OPTIONS, type GoalKey } from "@/lib/onboarding/types";

interface GoalRankerProps {
  rank: GoalKey[];
  onChange: (rank: GoalKey[]) => void;
}

export function GoalRanker({ rank, onChange }: GoalRankerProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = rank.indexOf(active.id as GoalKey);
    const newIdx = rank.indexOf(over.id as GoalKey);
    if (oldIdx === -1 || newIdx === -1) return;
    onChange(arrayMove(rank, oldIdx, newIdx));
  };

  if (rank.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
        Pick a few goals above, then drag to rank them here.
      </p>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={rank} strategy={verticalListSortingStrategy}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rank.map((key, idx) => (
            <RankRow key={key} id={key} index={idx} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function RankRow({ id, index }: { id: GoalKey; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const option = GOAL_OPTIONS.find((g) => g.value === id);
  if (!option) return null;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: isDragging ? "var(--coral-soft)" : "#fff",
    border: "1.5px solid var(--line)",
    borderRadius: "var(--r-md)",
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    gap: 14,
    cursor: "grab",
    boxShadow: isDragging ? "0 8px 24px rgba(15,27,34,0.12)" : "none",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "var(--ink)",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          fontSize: 13,
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        {index + 1}
      </span>
      <span style={{ fontSize: 20 }}>{option.emoji}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", flex: 1 }}>
        {option.label}
      </span>
      <span style={{ fontSize: 16, color: "var(--muted)" }}>⋮⋮</span>
    </div>
  );
}
