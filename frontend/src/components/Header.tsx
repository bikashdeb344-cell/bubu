import React from 'react';
import { Camera, FolderSync } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-3xl mx-auto px-4 py-3.5 sm:py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-200">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-tight">
              MMU Photo Portal
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-normal">
              Upload and organize MMU photographs.
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-500 font-medium bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200">
          <FolderSync className="w-3.5 h-3.5 text-slate-600" />
          <span>Google Drive v3</span>
        </div>
      </div>
    </header>
  );
};
