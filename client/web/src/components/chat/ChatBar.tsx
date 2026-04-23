import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface ChatBarProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function ChatBar({ onSend, isLoading }: ChatBarProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div className="border-t border-[var(--border)] bg-[var(--bg-secondary)] p-4">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell me what you want to do..."
              className="w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] 
                placeholder-[var(--text-muted)] rounded-xl px-4 py-3 pr-12
                border border-[var(--border)] focus:border-[var(--accent)] 
                focus:outline-none focus:ring-1 focus:ring-[var(--accent)]
                transition-colors"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span className="text-xs">⌘K</span>
              )}
            </div>
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] 
              disabled:opacity-50 disabled:cursor-not-allowed
              text-white rounded-xl px-4 py-3 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
