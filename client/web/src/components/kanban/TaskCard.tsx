import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, SubTask } from '../../types';
import { useStore } from '../../store/useStore';
import { ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const { selectTask } = useStore();
  const [expanded, setExpanded] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const subTasks: SubTask[] = [
    { id: 1, taskId: task.id, title: 'Research and planning', isCompleted: true, order: 1 },
    { id: 2, taskId: task.id, title: 'Implementation', isCompleted: false, order: 2 },
    { id: 3, taskId: task.id, title: 'Testing', isCompleted: false, order: 3 },
  ];

  const completedCount = subTasks.filter(st => st.isCompleted).length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => selectTask(task)}
      className={`bg-[var(--bg-card)] rounded-lg p-3 cursor-pointer 
        hover:bg-[var(--bg-tertiary)] transition-colors border-l-4
        ${task.isBlocked ? 'border-[var(--danger)]' : ''}`}
      onMouseDown={(e) => {
        // Only enable drag on left edge or title area
        if ((e.target as HTMLElement).closest('button')) {
          e.preventDefault();
        }
      }}
    >
      {/* Color indicator and ID */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: task.color }}
          />
          <span className="text-xs text-[var(--text-muted)]">#{task.id}</span>
        </div>
        {task.isBlocked && (
          <AlertCircle className="w-4 h-4 text-[var(--danger)]" />
        )}
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium mb-2 line-clamp-2">{task.title}</h4>

      {/* Subtasks preview */}
      {subTasks.length > 0 && (
        <div className="mb-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span>Subtasks ({completedCount}/{subTasks.length})</span>
          </button>
          
          {expanded && (
            <div className="mt-1 space-y-1 ml-4">
              {subTasks.map((st) => (
                <div key={st.id} className="flex items-center gap-2 text-xs">
                  <div 
                    className={`w-3 h-3 rounded border ${
                      st.isCompleted 
                        ? 'bg-[var(--success)] border-[var(--success)]' 
                        : 'border-[var(--border)]'
                    }`}
                    style={{ backgroundColor: task.color + '40', borderColor: task.color }}
                  >
                    {st.isCompleted && (
                      <span className="text-[var(--bg-primary)] text-[8px] flex items-center justify-center">✓</span>
                    )}
                  </div>
                  <span className={st.isCompleted ? 'line-through text-[var(--text-muted)]' : ''}>
                    {st.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tags and time */}
      <div className="flex items-center gap-2 flex-wrap">
        {task.tags.map((tag) => (
          <span 
            key={tag} 
            className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
          >
            {tag}
          </span>
        ))}
        {task.estimatedTime && (
          <span className="text-[10px] text-[var(--text-muted)]">
            ⏱️ {task.estimatedTime}
          </span>
        )}
      </div>

      {/* Status indicator */}
      {task.status === 'doing' && (
        <div className="mt-2 text-xs text-[var(--accent)] animate-pulse">
          🤖 AI processing...
        </div>
      )}
    </div>
  );
}
