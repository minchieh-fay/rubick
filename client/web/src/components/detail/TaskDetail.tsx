import { X, Check, Clock, Tag, Calendar } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Activity } from '../../types';

export function TaskDetail() {
  const { selectedTask, showDetail, selectTask, toggleDetail, subTasks } = useStore();

  if (!selectedTask || !showDetail) return null;

  const taskSubTasks = subTasks.get(selectedTask.id) || [];
  const activities: Activity[] = [
    { id: 1, taskId: selectedTask.id, type: 'ai_message', content: 'I\'ve analyzed this task and created the subtasks below.', createdAt: new Date().toISOString() },
    { id: 2, taskId: selectedTask.id, type: 'user_message', content: 'Looks good, proceed.', createdAt: new Date().toISOString() },
    { id: 3, taskId: selectedTask.id, type: 'ai_message', content: 'Starting implementation of the first subtask...', createdAt: new Date().toISOString() },
  ];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => selectTask(null)}
      />
      
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[480px] bg-[var(--bg-secondary)] 
        border-l border-[var(--border)] z-50 flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div 
              className="w-4 h-4 rounded-full" 
              style={{ backgroundColor: selectedTask.color }}
            />
            <span className="text-sm text-[var(--text-muted)]">#{selectedTask.id}</span>
          </div>
          <button 
            onClick={() => selectTask(null)}
            className="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Title */}
            <div>
              <h3 className="text-lg font-medium mb-2">{selectedTask.title}</h3>
              <p className="text-sm text-[var(--text-secondary)]">{selectedTask.description}</p>
            </div>

            {/* Subtasks */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Check className="w-4 h-4" />
                Subtasks
              </h4>
              <div className="space-y-2">
                {taskSubTasks.length > 0 ? taskSubTasks.map((st) => (
                  <div key={st.id} className="flex items-center gap-3 p-2 rounded bg-[var(--bg-tertiary)]">
                    <div 
                      className={`w-4 h-4 rounded border cursor-pointer flex items-center justify-center`}
                      style={{ 
                        backgroundColor: st.isCompleted ? selectedTask.color : 'transparent',
                        borderColor: selectedTask.color 
                      }}
                    >
                      {st.isCompleted && <span className="text-[10px] text-white">✓</span>}
                    </div>
                    <span className={`text-sm ${st.isCompleted ? 'line-through text-[var(--text-muted)]' : ''}`}>
                      {st.title}
                    </span>
                  </div>
                )) : (
                  <p className="text-sm text-[var(--text-muted)]">No subtasks yet</p>
                )}
              </div>
            </div>

            {/* AI Chat History */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                💬 AI Conversation
              </h4>
              <div className="space-y-3">
                {activities.map((a) => (
                  <div key={a.id} className={`flex ${a.type === 'user_message' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      a.type === 'user_message' 
                        ? 'bg-[var(--accent)] text-white' 
                        : 'bg-[var(--bg-tertiary)]'
                    }`}>
                      {a.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Metadata */}
        <div className="border-t border-[var(--border)] p-4 space-y-2 text-xs text-[var(--text-secondary)]">
          <div className="flex items-center gap-2">
            <Calendar className="w-3 h-3" />
            <span>Created: {new Date(selectedTask.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3" />
            <span>Est: {selectedTask.estimatedTime || '-'} | Actual: {selectedTask.actualTime || '-'}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="w-3 h-3" />
            {selectedTask.tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded bg-[var(--bg-tertiary)]">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
