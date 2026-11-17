import React, { useEffect, useState, useCallback } from 'react';
import {
  Header,
} from './components/Header';
import {
  DriveStatusBadge,
} from './components/DriveStatusBadge';
import {
  MmuSelector,
} from './components/MmuSelector';
import {
  SessionSelector,
} from './components/SessionSelector';
import {
  PhotoDropzone,
} from './components/PhotoDropzone';
import {
  UploadSummary,
} from './components/UploadSummary';
import {
  UploadHistory,
} from './components/UploadHistory';
import {
  fetchDriveStatus,
  initializeDriveStructure,
  uploadPhotographs,
} from './api';
import {
  DriveStatusResponse,
  HistoryItem,
  MMUId,
  SelectedFile,
  SessionType,
  UploadResponse,
} from './types';
import { Upload, Loader2, AlertCircle } from 'lucide-react';

const STORAGE_KEY = 'mmu_photo_upload_history_v1';

export const App: React.FC = () => {
  // Drive status state
  const [driveStatus, setDriveStatus] = useState<DriveStatusResponse | null>(null);
  const [driveLoading, setDriveLoading] = useState<boolean>(true);
  const [driveError, setDriveError] = useState<string | null>(null);

  // Form state
  const [selectedMmu, setSelectedMmu] = useState<MMUId | ''>('');
  const [selectedSession, setSelectedSession] = useState<SessionType | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);

  // Upload execution state
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastUploadSummary, setLastUploadSummary] = useState<UploadResponse | null>(null);

  // History state
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save history to localStorage
  const recordHistory = useCallback((items: HistoryItem[]) => {
    setHistory((prev) => {
      const updated = [...items, ...prev].slice(0, 50); // keep recent 50
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore storage error
      }
      return updated;
    });
  }, []);

  const handleClearHistory = () => {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  };

  // Check or initialize Drive status
  const checkDrive = useCallback(async (autoRepair = false) => {
    setDriveLoading(true);
    setDriveError(null);
    try {
      const status = autoRepair
        ? await initializeDriveStructure()
        : await fetchDriveStatus();
      setDriveStatus(status);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to Google Drive';
      setDriveError(msg);
      setDriveStatus(null);
    } finally {
      setDriveLoading(false);
    }
  }, []);

  // Initial check on mount: run initialize so any missing folders are repaired automatically
  useEffect(() => {
    checkDrive(true);
  }, [checkDrive]);

  // Handle files addition
  const handleAddFiles = (newFiles: File[]) => {
    const wrapped: SelectedFile[] = newFiles.map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      file: f,
      previewUrl: URL.createObjectURL(f),
      name: f.name,
      size: f.size,
      type: f.type,
    }));

    setSelectedFiles((prev) => [...prev, ...wrapped]);
    setUploadError(null);
  };

  // Handle file removal
  const handleRemoveFile = (id: string) => {
    setSelectedFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  // Clear all files
  const handleClearAllFiles = () => {
    for (const f of selectedFiles) {
      if (f.previewUrl) {
        URL.revokeObjectURL(f.previewUrl);
      }
    }
    setSelectedFiles([]);
  };

  // Form validity
  const isDriveVerified = driveStatus?.totalVerified === 18;
  const isFormValid =
    Boolean(selectedMmu) &&
    Boolean(selectedSession) &&
    selectedFiles.length > 0 &&
    isDriveVerified &&
    !isUploading;

  // Handle upload submission
  const handleUploadSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isFormValid || !selectedMmu || !selectedSession) return;

    setIsUploading(true);
    setUploadError(null);
    setLastUploadSummary(null);

    try {
      const filesToUpload = selectedFiles.map((s) => s.file);
      const summary = await uploadPhotographs(selectedMmu, selectedSession, filesToUpload);

      setLastUploadSummary(summary);

      // Record to history
      const nowIso = new Date().toISOString();
      const historyEntries: HistoryItem[] = summary.results.map((r) => ({
        id: `${r.filename}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: nowIso,
        mmu: selectedMmu,
        session: selectedSession,
        filename: r.filename,
        status: r.success ? 'success' : 'failed',
        drivePath: r.drivePath,
        error: r.error,
      }));
      recordHistory(historyEntries);

      // If all successful, clean up selected files
      if (summary.failed === 0) {
        handleClearAllFiles();
      } else {
        // Keep only failed files in selection for easy retry
        const successfulNames = new Set(
          summary.results.filter((r) => r.success).map((r) => r.filename)
        );
        setSelectedFiles((prev) => prev.filter((f) => !successfulNames.has(f.name)));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Photo upload failed';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-5 sm:py-7 space-y-5">
        {/* Google Drive Status Section */}
        <DriveStatusBadge
          status={driveStatus}
          loading={driveLoading}
          error={driveError}
          onRecheck={() => checkDrive(true)}
        />

        {/* Upload Form Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-6">
          <form onSubmit={handleUploadSubmit} className="space-y-6">
            {/* Step A: Select MMU */}
            <MmuSelector
              value={selectedMmu}
              onChange={setSelectedMmu}
              disabled={isUploading}
            />

            {/* Step B: Select Session */}
            <SessionSelector
              value={selectedSession}
              onChange={setSelectedSession}
              disabled={isUploading}
            />

            {/* Step C: Select Photographs */}
            <PhotoDropzone
              files={selectedFiles}
              onAddFiles={handleAddFiles}
              onRemoveFile={handleRemoveFile}
              onClearAll={handleClearAllFiles}
              disabled={isUploading}
              maxFiles={20}
              maxSizeMB={15}
            />

            {/* Error banner */}
            {uploadError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-rose-800 text-xs sm:text-sm flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold block">Upload Failed</span>
                  {uploadError}
                </div>
              </div>
            )}

            {/* Step D: Prominent Upload Button */}
            <div>
              <button
                type="submit"
                disabled={!isFormValid}
                data-testid="upload-button"
                className={`w-full h-14 rounded-xl font-bold text-base sm:text-lg flex items-center justify-center space-x-2.5 transition-all shadow-sm active:scale-[0.99] ${
                  isFormValid
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 hover:shadow-md cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                }`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>
                      Uploading {selectedFiles.length} photo{selectedFiles.length > 1 ? 's' : ''}...
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    <span>
                      {selectedFiles.length > 0
                        ? `Upload ${selectedFiles.length} Photo${selectedFiles.length > 1 ? 's' : ''} to Drive`
                        : 'Upload Photographs'}
                    </span>
                  </>
                )}
              </button>

              {!isDriveVerified && !driveLoading && (
                <p className="text-center text-xs text-amber-700 mt-2 font-medium">
                  Upload is disabled until Google Drive directory validation succeeds.
                </p>
              )}
            </div>
          </form>
        </div>

        {/* Upload Summary Feedback */}
        {lastUploadSummary && (
          <UploadSummary
            summary={lastUploadSummary}
            onDismiss={() => setLastUploadSummary(null)}
            onRetryFailed={
              lastUploadSummary.failed > 0 && selectedFiles.length > 0
                ? () => handleUploadSubmit()
                : undefined
            }
          />
        )}

        {/* Upload History */}
        <UploadHistory history={history} onClearHistory={handleClearHistory} />
      </main>

      <footer className="py-4 text-center text-xs text-slate-500 border-t border-slate-200 bg-white">
        MMU Photo Portal &bull; Google Drive API v3 &bull; Production Ready
      </footer>
    </div>
  );
};

export default App;
