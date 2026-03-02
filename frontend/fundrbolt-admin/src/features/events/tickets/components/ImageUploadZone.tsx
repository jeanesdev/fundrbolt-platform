/**
 * Image Upload Zone Component
 * Drag-and-drop area for uploading package images
 */

import { Button } from '@/components/ui/button';
import { Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';

interface ImageUploadZoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  preview?: string | null;
  onRemovePreview?: () => void;
}

const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function ImageUploadZone({
  onFileSelected,
  disabled = false,
  preview,
  onRemovePreview,
}: ImageUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_FORMATS.includes(ext)) {
      return `Invalid file format. Allowed: ${ALLOWED_FORMATS.join(', ').toUpperCase()}`;
    }

    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds 5 MB (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
    }

    return null;
  };

  const handleFileSelect = (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onFileSelected(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  if (preview) {
    return (
      <div className="space-y-2">
        <div className="relative w-full max-w-sm mx-auto">
          <img
            src={preview}
            alt="Package preview"
            className="w-full h-auto rounded-lg border border-gray-200 object-cover"
          />
          {!disabled && onRemovePreview && (
            <button
              onClick={onRemovePreview}
              className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Replace Image
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`relative rounded-lg border-2 border-dashed transition-colors ${isDragActive
          ? 'border-blue-400 bg-blue-50'
          : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex flex-col items-center justify-center py-8 px-4">
          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-gray-900">
            Drag image here or click to browse
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            JPG, PNG or WebP (max 5 MB)
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={`.${ALLOWED_FORMATS.join(',.')}`}
          onChange={handleInputChange}
          disabled={disabled}
          className="hidden"
        />
      </div>

      {error && (
        <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded px-2 py-1">
          {error}
        </div>
      )}
    </div>
  );
}
