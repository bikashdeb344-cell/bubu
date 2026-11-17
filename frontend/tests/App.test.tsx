import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../src/App';
import * as api from '../src/api';
import { DriveStatusResponse, UploadResponse } from '../src/types';

// Mock API module
vi.mock('../src/api');

const mockVerifiedStatus: DriveStatusResponse = {
  status: 'verified',
  authenticated: true,
  rootFolderFound: true,
  rootFolderId: 'root-id',
  totalExpected: 18,
  totalVerified: 18,
  repairedCount: 0,
  repairedPaths: [],
  message: '18/18 Directories Verified',
};

describe('Frontend MMU Photo Portal Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Default mock URL.createObjectURL and revokeObjectURL
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-image-preview');
    globalThis.URL.revokeObjectURL = vi.fn();

    vi.mocked(api.fetchDriveStatus).mockResolvedValue(mockVerifiedStatus);
    vi.mocked(api.initializeDriveStructure).mockResolvedValue(mockVerifiedStatus);
  });

  it('1. MMU dropdown contains exactly nine options (MMU-001 to MMU-009)', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('mmu-select')).toBeInTheDocument();
    });

    const select = screen.getByTestId('mmu-select') as HTMLSelectElement;
    // Options: 1 placeholder + 9 MMUs = 10 total option tags
    const options = Array.from(select.options).filter((o) => o.value !== '');
    expect(options).toHaveLength(9);

    const expectedMmus = [
      'MMU-001',
      'MMU-002',
      'MMU-003',
      'MMU-004',
      'MMU-005',
      'MMU-006',
      'MMU-007',
      'MMU-008',
      'MMU-009',
    ];

    options.forEach((opt, idx) => {
      expect(opt.value).toBe(expectedMmus[idx]);
      expect(opt.textContent).toBe(expectedMmus[idx]);
    });
  });

  it('2. AM and PM session selection works', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('18/18 Directories Verified')).toBeInTheDocument();
    });

    const amBtn = screen.getByTestId('session-btn-am');
    const pmBtn = screen.getByTestId('session-btn-pm');

    expect(amBtn).toBeInTheDocument();
    expect(pmBtn).toBeInTheDocument();

    // Select AM
    fireEvent.click(amBtn);
    expect(amBtn.getAttribute('aria-checked')).toBe('true');
    expect(pmBtn.getAttribute('aria-checked')).toBe('false');

    // Select PM
    fireEvent.click(pmBtn);
    expect(pmBtn.getAttribute('aria-checked')).toBe('true');
    expect(amBtn.getAttribute('aria-checked')).toBe('false');
  });

  it('3. Multiple image selection works and displays count and previews', async () => {
    render(<App />);

    const fileInput = screen.getByTestId('file-input') as HTMLInputElement;

    const file1 = new File(['content-1'], 'photo1.jpg', { type: 'image/jpeg' });
    const file2 = new File(['content-2'], 'photo2.png', { type: 'image/png' });

    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    await waitFor(() => {
      expect(screen.getByText('2 / 20 selected')).toBeInTheDocument();
      expect(screen.getByText('photo1.jpg')).toBeInTheDocument();
      expect(screen.getByText('photo2.png')).toBeInTheDocument();
    });
  });

  it('4. Individual image removal works', async () => {
    render(<App />);

    const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
    const file1 = new File(['c1'], 'remove_me.jpg', { type: 'image/jpeg' });
    const file2 = new File(['c2'], 'keep_me.jpg', { type: 'image/jpeg' });

    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    await waitFor(() => {
      expect(screen.getByText('remove_me.jpg')).toBeInTheDocument();
    });

    const removeBtn = screen.getByTestId('remove-file-remove_me.jpg');
    fireEvent.click(removeBtn);

    expect(screen.queryByText('remove_me.jpg')).not.toBeInTheDocument();
    expect(screen.getByText('keep_me.jpg')).toBeInTheDocument();
    expect(screen.getByText('1 / 20 selected')).toBeInTheDocument();
  });

  it('5. Invalid formats are rejected with an understandable error', async () => {
    render(<App />);

    const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
    const invalidFile = new File(['pdf-data'], 'report.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(screen.getByText(/only JPG, JPEG, PNG, and WEBP formats are allowed/i)).toBeInTheDocument();
    });
  });

  it('6. Empty form submission is blocked and upload button is disabled', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('18/18 Directories Verified')).toBeInTheDocument();
    });

    const uploadButton = screen.getByTestId('upload-button');
    expect(uploadButton).toBeDisabled();

    // Select MMU only
    const select = screen.getByTestId('mmu-select');
    fireEvent.change(select, { target: { value: 'MMU-001' } });
    expect(uploadButton).toBeDisabled();

    // Select Session only
    const amBtn = screen.getByTestId('session-btn-am');
    fireEvent.click(amBtn);
    expect(uploadButton).toBeDisabled();

    // Form button is still disabled because 0 photos selected
    expect(uploadButton).toBeDisabled();
  });

  it('7. Successful upload flow displays summary and resets files', async () => {
    const mockUploadResponse: UploadResponse = {
      mmu: 'MMU-003',
      session: 'PM',
      destination: 'MMU-PHOTO-STORAGE/MMU-003/PM/',
      total: 2,
      successful: 2,
      failed: 0,
      results: [
        { filename: 'photo1.jpg', success: true, fileId: 'id1' },
        { filename: 'photo2.jpg', success: true, fileId: 'id2' },
      ],
    };

    vi.mocked(api.uploadPhotographs).mockResolvedValue(mockUploadResponse);

    render(<App />);

    // Wait for drive verification
    await waitFor(() => {
      expect(screen.getByText('18/18 Directories Verified')).toBeInTheDocument();
    });

    // 1. Select MMU
    fireEvent.change(screen.getByTestId('mmu-select'), { target: { value: 'MMU-003' } });

    // 2. Select PM
    fireEvent.click(screen.getByTestId('session-btn-pm'));

    // 3. Add Photos
    const file1 = new File(['1'], 'photo1.jpg', { type: 'image/jpeg' });
    const file2 = new File(['2'], 'photo2.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [file1, file2] } });

    // 4. Click Upload
    const uploadBtn = screen.getByTestId('upload-button');
    expect(uploadBtn).not.toBeDisabled();
    fireEvent.click(uploadBtn);

    // 5. Verify Summary
    await waitFor(() => {
      expect(screen.getByTestId('upload-summary-card')).toBeInTheDocument();
      expect(screen.getByText('MMU-003 — PM')).toBeInTheDocument();
      expect(screen.getByText('MMU-PHOTO-STORAGE/MMU-003/PM/')).toBeInTheDocument();
      expect(screen.getByText('Total: 2/2 successful')).toBeInTheDocument();
    });

    // Verify localStorage history
    const savedHistory = JSON.parse(localStorage.getItem('mmu_photo_upload_history_v1') || '[]');
    expect(savedHistory).toHaveLength(2);
    expect(savedHistory[0].filename).toBe('photo1.jpg');
  });

  it('8. Recheck Google Drive button triggers directory re-initialization', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('recheck-drive-btn')).toBeInTheDocument();
    });

    const recheckBtn = screen.getByTestId('recheck-drive-btn');
    fireEvent.click(recheckBtn);

    await waitFor(() => {
      expect(api.initializeDriveStructure).toHaveBeenCalledTimes(2); // once on mount, once on click
    });
  });
});
