import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Wrench,
} from 'lucide-react';
import { DriveStatusResponse } from '../types';

interface DriveStatusBadgeProps {
  status: DriveStatusResponse | null;
  loading: boolean;
  error: string | null;
  onRecheck: () => void;
}

export const DriveStatusBadge: React.FC<DriveStatusBadgeProps> = ({
  status,
  loading,
  error,
  onRecheck,
}) => {
  // Determine state display
  let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-300';
  let icon = <Loader2 className="w-4 h-4 animate-spin text-slate-600" />;
  let label = 'Checking Google Drive...';
  let detail = 'Connecting to Google Drive and scanning directory structure...';
  let isReady = false;

  if (loading) {
    badgeStyle = 'bg-blue-50 text-blue-800 border-blue-200';
    icon = <Loader2 className="w-4 h-4 animate-spin text-blue-600" />;
    label = 'Checking Google Drive...';
    detail = 'Verifying storage directory and MMU folders...';
  } else if (error) {
    badgeStyle = 'bg-rose-50 text-rose-800 border-rose-200';
    icon = <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />;
    label = 'Google Drive Connection Failed';
    detail = error;
  } else if (status) {
    if (status.totalVerified === 18) {
      isReady = true;
      if (status.repairedCount > 0) {
        badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
        icon = <Wrench className="w-4 h-4 text-emerald-600 flex-shrink-0" />;
        label = 'Missing directories repaired';
        detail = `${status.repairedCount} folders created. 18/18 Directories Verified. Ready for upload.`;
      } else {
        badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
        icon = <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />;
        label = '18/18 Directories Verified';
        detail = 'Google Drive Connected. All MMU-001 through MMU-009 (AM & PM) validated.';
      }
    } else if (status.status === 'not_configured') {
      badgeStyle = 'bg-amber-50 text-amber-800 border-amber-200';
      icon = <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />;
      label = 'Google Drive Connection Failed';
      detail = status.message;
    } else {
      badgeStyle = 'bg-amber-50 text-amber-800 border-amber-200';
      icon = <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />;
      label = 'Google Drive Connected';
      detail = `${status.totalVerified}/18 directories verified. Click Recheck to automatically repair missing folders.`;
    }
  }

  return (
    <div
      className={`rounded-xl border p-3.5 sm:p-4 transition-all duration-200 ${badgeStyle}`}
      data-testid="drive-status-card"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start space-x-3">
          <div className="mt-0.5">{icon}</div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-sm sm:text-base tracking-tight" data-testid="drive-status-label">
                {label}
              </span>
              {isReady && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Ready
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm mt-0.5 opacity-90 leading-snug">
              {detail}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRecheck}
          disabled={loading}
          className="self-start sm:self-center inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300 shadow-2xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="recheck-drive-btn"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Recheck Google Drive</span>
        </button>
      </div>
    </div>
  );
};
