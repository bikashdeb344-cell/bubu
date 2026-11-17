import React from 'react';
import { Sun, Moon, Clock } from 'lucide-react';
import { SessionType } from '../types';

interface SessionSelectorProps {
  value: SessionType | null;
  onChange: (value: SessionType) => void;
  disabled?: boolean;
}

export const SessionSelector: React.FC<SessionSelectorProps> = ({
  value,
  onChange,
  disabled,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center space-x-2 text-sm font-semibold text-slate-800">
          <Clock className="w-4 h-4 text-blue-600" />
          <span>B. Select Session</span>
        </label>
        {value && (
          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
            {value} Session
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Session Selection">
        <button
          type="button"
          role="radio"
          aria-checked={value === 'AM'}
          data-testid="session-btn-am"
          onClick={() => onChange('AM')}
          disabled={disabled}
          className={`h-14 sm:h-16 rounded-xl border font-bold text-lg sm:text-xl flex items-center justify-center space-x-2.5 transition-all shadow-2xs active:scale-[0.98] ${
            value === 'AM'
              ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-500/30 shadow-md shadow-blue-100'
              : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Sun className={`w-5 h-5 ${value === 'AM' ? 'text-amber-300' : 'text-amber-500'}`} />
          <span>AM</span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={value === 'PM'}
          data-testid="session-btn-pm"
          onClick={() => onChange('PM')}
          disabled={disabled}
          className={`h-14 sm:h-16 rounded-xl border font-bold text-lg sm:text-xl flex items-center justify-center space-x-2.5 transition-all shadow-2xs active:scale-[0.98] ${
            value === 'PM'
              ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-500/30 shadow-md shadow-blue-100'
              : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Moon className={`w-5 h-5 ${value === 'PM' ? 'text-indigo-200' : 'text-indigo-500'}`} />
          <span>PM</span>
        </button>
      </div>
    </div>
  );
};
