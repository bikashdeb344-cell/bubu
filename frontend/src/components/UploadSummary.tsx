import React from 'react';
import { CheckCircle2, XCircle, Folder, FileCheck, RotateCcw } from 'lucide-react';
import { UploadResponse } from '../types';

interface UploadSummaryProps {
  summary: UploadResponse;
  onDismiss: () => void;
  onRetryFailed?: () => void;
}

export const UploadSummary: React.FC<UploadSummaryProps> = ({
  summary,
  onDismiss,
  onRetryFailed,
}) => {
  const isAllSuccess = summary.failed === 0;

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 shadow-sm transition-all ${
        isAllSuccess
          ? 'bg-emerald-50/70 border-emerald-200 text-slate-800'
          : 'bg-amber-50/70 border-amber-200 text-slate-800'
      }`}
      data-testid="upload-summary-card"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-2.5">
          {isAllSuccess ? (
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
              <XCircle className="w-5 h-5" />
            </div>
          )}
          <div>
            <h3 className="font-bold text-base text-slate-900">Upload Summary</h3>
            <p className="text-xs text-slate-600 font-medium">
              Total: {summary.successful}/{summary.total} successful
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white border border-slate-300 text-slate-700 transition-colors shadow-2xs"
        >
          Dismiss
        </button>
      </div>

      <div className="mt-3.5 space-y-2 text-xs sm:text-sm">
        <div className="grid grid-cols-2 gap-2 bg-white/80 rounded-xl p-3 border border-slate-200/80">
          <div>
            <span className="text-slate-500 block text-xs">Selected MMU & Session</span>
            <span className="font-bold text-slate-900">
              {summary.mmu} — {summary.session}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-xs">Google Drive Destination</span>
            <span className="font-mono text-[11px] sm:text-xs font-semibold text-blue-700 flex items-center space-x-1 truncate" title={summary.destination}>
              <Folder className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{summary.destination}</span>
            </span>
          </div>
        </div>

        {/* Uploaded items list */}
        <div className="space-y-1.5 pt-1">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Uploaded Files
          </div>
          <div className="divide-y divide-slate-200/60 bg-white rounded-xl border border-slate-200 overflow-hidden max-h-56 overflow-y-auto">
            {summary.results.map((file, idx) => (
              <div
                key={`${file.filename}-${idx}`}
                className="px-3 py-2 flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-2 truncate mr-2">
                  {file.success ? (
                    <FileCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  )}
                  <span className="font-medium text-slate-800 truncate" title={file.filename}>
                    {file.filename}
                  </span>
                </div>

                <div className="flex-shrink-0 flex items-center space-x-2">
                  {file.success ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                      Success
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800"
                      title={file.error}
                    >
                      Failed: {file.error || 'Upload error'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {!isAllSuccess && onRetryFailed && (
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onRetryFailed}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-2xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Failed Uploads ({summary.failed})</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
