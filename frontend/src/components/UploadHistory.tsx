import React, { useState } from 'react';
import { History, ChevronDown, ChevronUp, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { HistoryItem } from '../types';

interface UploadHistoryProps {
  history: HistoryItem[];
  onClearHistory: () => void;
}

export const UploadHistory: React.FC<UploadHistoryProps> = ({
  history,
  onClearHistory,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (history.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-2 text-sm font-semibold text-slate-800 hover:text-slate-900"
          data-testid="toggle-history-btn"
        >
          <History className="w-4 h-4 text-blue-600" />
          <span>Upload History ({history.length})</span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {isExpanded && (
          <button
            type="button"
            onClick={onClearHistory}
            className="text-xs text-slate-500 hover:text-rose-600 inline-flex items-center space-x-1 font-medium transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
          {history.map((item) => (
            <div
              key={item.id}
              className="py-2 px-1 flex items-center justify-between text-xs"
            >
              <div className="flex items-center space-x-2 truncate mr-2">
                {item.status === 'success' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                )}
                <div className="truncate">
                  <div className="font-medium text-slate-800 truncate" title={item.filename}>
                    {item.filename}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {item.mmu} · {item.session} · {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0">
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    item.status === 'success'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
