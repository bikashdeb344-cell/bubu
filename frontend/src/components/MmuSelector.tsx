import React from 'react';
import { Truck } from 'lucide-react';
import { MMUId, MMU_LIST } from '../types';

interface MmuSelectorProps {
  value: MMUId | '';
  onChange: (value: MMUId | '') => void;
  disabled?: boolean;
}

export const MmuSelector: React.FC<MmuSelectorProps> = ({ value, onChange, disabled }) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor="mmu-select"
          className="flex items-center space-x-2 text-sm font-semibold text-slate-800"
        >
          <Truck className="w-4 h-4 text-blue-600" />
          <span>A. Select MMU</span>
        </label>
        {value && (
          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
            {value} selected
          </span>
        )}
      </div>

      <div className="relative">
        <select
          id="mmu-select"
          data-testid="mmu-select"
          value={value}
          onChange={(e) => onChange(e.target.value as MMUId | '')}
          disabled={disabled}
          className="w-full h-12 px-3.5 text-base bg-white border border-slate-300 rounded-xl shadow-2xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed transition-all font-medium appearance-none cursor-pointer"
        >
          <option value="" disabled>
            -- Choose MMU Unit --
          </option>
          {MMU_LIST.map((mmu) => (
            <option key={mmu} value={mmu}>
              {mmu}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-500">
          <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>
    </div>
  );
};
