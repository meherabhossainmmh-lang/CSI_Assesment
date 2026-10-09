import { Loader2, AlertTriangle, Inbox } from 'lucide-react';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <AlertTriangle className="h-8 w-8 text-danger" />
      <p className="text-sm text-slate-600">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Inbox className="h-8 w-8 text-slate-400" />
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
