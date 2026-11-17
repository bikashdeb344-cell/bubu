import React, { useRef, useState } from 'react';
import { UploadCloud, Image as ImageIcon, X, AlertTriangle, Trash2 } from 'lucide-react';
import { SelectedFile } from '../types';

interface PhotoDropzoneProps {
  files: SelectedFile[];
  onAddFiles: (newFiles: File[]) => void;
  onRemoveFile: (id: string) => void;
  onClearAll: () => void;
  disabled?: boolean;
  maxFiles?: number;
  maxSizeMB?: number;
}

export const PhotoDropzone: React.FC<PhotoDropzoneProps> = ({
  files,
  onAddFiles,
  onRemoveFile,
  onClearAll,
  disabled,
  maxFiles = 20,
  maxSizeMB = 15,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const processIncomingFiles = (incomingList: FileList | null) => {
    setValidationError(null);
    if (!incomingList || incomingList.length === 0) return;

    const fileArray = Array.from(incomingList);

    // Check count limit
    if (files.length + fileArray.length > maxFiles) {
      setValidationError(
        `Cannot add ${fileArray.length} photos. Maximum limit is ${maxFiles} photos per upload (currently have ${files.length}).`
      );
      return;
    }

    // Filter and validate files
    const validFiles: File[] = [];
    const errors: string[] = [];

    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    for (const file of fileArray) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      if (!allowedExtensions.includes(ext)) {
        errors.push(`"${file.name}" rejected: only JPG, JPEG, PNG, and WEBP formats are allowed.`);
        continue;
      }

      if (file.size > maxSizeBytes) {
        errors.push(
          `"${file.name}" rejected: size (${formatFileSize(file.size)}) exceeds ${maxSizeMB} MB limit.`
        );
        continue;
      }

      validFiles.push(file);
    }

    if (errors.length > 0) {
      setValidationError(errors.join(' '));
    }

    if (validFiles.length > 0) {
      onAddFiles(validFiles);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    processIncomingFiles(e.dataTransfer.files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processIncomingFiles(e.target.files);
    // Reset file input so selecting the same file again triggers change
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center space-x-2 text-sm font-semibold text-slate-800">
          <ImageIcon className="w-4 h-4 text-blue-600" />
          <span>C. Select Photographs</span>
        </label>
        <div className="flex items-center space-x-2">
          {files.length > 0 && (
            <>
              <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                {files.length} / {maxFiles} selected
              </span>
              <button
                type="button"
                onClick={onClearAll}
                disabled={disabled}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium inline-flex items-center space-x-1"
                title="Clear all selected photos"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        data-testid="file-input"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        multiple
        disabled={disabled}
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Drag & Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        data-testid="dropzone-area"
        className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-blue-500 bg-blue-50/80 scale-[1.005]'
            : 'border-slate-300 hover:border-slate-400 bg-slate-50/60 hover:bg-slate-50'
        } ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shadow-2xs">
            <UploadCloud className="w-7 h-7" />
          </div>

          <div>
            <p className="text-base font-semibold text-slate-800">
              Drag & drop photos here, or{' '}
              <span className="text-blue-600 hover:underline">browse files</span>
            </p>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Supports JPG, JPEG, PNG, WEBP (up to {maxSizeMB} MB each, max {maxFiles} photos)
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            disabled={disabled}
            className="mt-1 px-4 py-2 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl shadow-2xs transition-colors"
          >
            Browse files
          </button>
        </div>
      </div>

      {/* Validation Error Alert */}
      {validationError && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-rose-800 text-xs sm:text-sm flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
          <div>{validationError}</div>
        </div>
      )}

      {/* Image Preview Grid */}
      {files.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Selected Photos ({files.length})
          </div>

          <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
            data-testid="preview-grid"
          >
            {files.map((item) => (
              <div
                key={item.id}
                className="group relative bg-white border border-slate-200 rounded-xl p-2 shadow-2xs flex flex-col transition-all hover:border-slate-300"
                data-testid={`preview-item-${item.id}`}
              >
                {/* Thumbnail */}
                <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-slate-100">
                  <img
                    src={item.previewUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => onRemoveFile(item.id)}
                    disabled={disabled}
                    aria-label={`Remove ${item.name}`}
                    data-testid={`remove-file-${item.name}`}
                    className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-900/70 hover:bg-rose-600 text-white transition-colors shadow-sm"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Filename & size */}
                <div className="mt-2 text-left">
                  <p
                    className="text-xs font-medium text-slate-800 truncate"
                    title={item.name}
                  >
                    {item.name}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {formatFileSize(item.size)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
