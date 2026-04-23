import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useStore } from '../../store/useStore';
import { Column, type TaskStatus } from '../../types';
import { TaskColumn } from './TaskColumn';
import { TaskCard } from './TaskCard';
import { taskApi } from '../../api/client';

interface KanbanBoardProps {
  columns: Column[];
  tasks: Task[];
}

export function KanbanBoard({ columns, tasks }: KanbanBoardProps) {
  const { moveTask } = useStore();
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as number;
    const newStatus = over.id as TaskStatus;

    // Only allow dropping on column drop zones
    if (['inbox', 'todo', 'doing', 'done'].includes(newStatus)) {
      // Optimistic UI update
      moveTask(taskId, newStatus);
      
      // Sync with backend
      try {
        await taskApi.moveTask(taskId, newStatus);
      } catch (err) {
        console.error('Failed to sync task status:', err);
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 h-full p-4 overflow-x-auto">
        {columns.map((column) => {
          const columnTasks = tasks.filter((t) => t.status === column.id);
          return (
            <TaskColumn
              key={column.id}
              column={column}
              tasks={columnTasks}
            />
          );
        })}
      </div>
    </DndContext>
  );
}
