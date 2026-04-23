import { Settings, User } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { COLUMNS } from '../../types';

export function Header() {
  const { tasks } = useStore();

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <span className="text-2xl">🔮</span>
          <span>Rubick</span>
        </h1>
        <div className="flex items-center gap-4 ml-8">
          {COLUMNS.map((col) => {
            const count = tasks.filter((t) => t.status === col.id).length;
            return (
              <div key={col.id} className="flex items-center gap-1 text-sm text-[var(--text-secondary)]">
                <span>{col.icon}</span>
                <span>{col.title}</span>
                <span className="bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded text-xs">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors">
          <Settings className="w-5 h-5" />
        </button>
        <button className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors">
          <User className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
