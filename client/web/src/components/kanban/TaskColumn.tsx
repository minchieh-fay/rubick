import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Column, Task } from '../../types';
import { TaskCard } from './TaskCard';

interface TaskColumnProps {
  column: Column;
  tasks: Task[];
}

export function TaskColumn({ column, tasks }: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div 
      className={`flex-shrink-0 w-72 flex flex-col rounded-xl transition-colors duration-200 ${
        isOver ? 'bg-white/5' : 'bg-[var(--bg-secondary)]'
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span className="text-lg">{column.icon}</span>
          <span className="font-medium text-sm">{column.title}</span>
        </div>
        <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>

      {/* Task List */}
      <div 
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[100px]"
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </SortableContext>
        
        {tasks.length === 0 && (
          <div className="h-24 flex items-center justify-center text-[var(--text-muted)] text-xs">
            Empty
          </div>
        )}
      </div>
    </div>
  );
}
