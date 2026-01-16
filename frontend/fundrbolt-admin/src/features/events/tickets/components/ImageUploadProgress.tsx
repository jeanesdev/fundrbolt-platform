/**
 * Image Upload Progress Component
 * Shows upload progress bar and status
 */

import { AlertCircle, CheckCircle2, Loader } from 'lucide-react';

interface ImageUploadProgressProps {
  progress: number; // 0-100
  status: 'uploading' | 'success' | 'error';
  error?: string;
  fileName?: string;
}

export function ImageUploadProgress({
  progress,
  status,
  error,
  fileName,
}: ImageUploadProgressProps) {
  if (status === 'success') {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-green-900">Upload successful</p>
          {fileName && <p className="text-xs text-green-700">{fileName}</p>}
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-900">Upload failed</p>
          {error && <p className="text-xs text-red-700">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Loader className="h-4 w-4 animate-spin text-blue-600" />
        <p className="text-sm font-medium text-gray-900">Uploading...</p>
        <span className="text-xs text-muted-foreground ml-auto">{progress}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className="bg-blue-600 h-full rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      {fileName && <p className="text-xs text-muted-foreground">{fileName}</p>}
    </div>
  );
}
