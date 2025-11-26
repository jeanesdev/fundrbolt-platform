/**
 * MediaUploadZone
 * Drag-and-drop file upload zone for auction item media (images and videos)
 */

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { FileImage, FileVideo, Upload, X } from 'lucide-react';
import { useCallback, useState } from 'react';

interface MediaUploadZoneProps {
  onUpload: (file: File, mediaType: 'image' | 'video') => Promise<void>;
  disabled?: boolean;
  maxImageSize?: number; // in bytes
  maxVideoSize?: number; // in bytes
}

// File type constants
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

const DEFAULT_MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

export function MediaUploadZone({
  onUpload,
  disabled = false,
  maxImageSize = DEFAULT_MAX_IMAGE_SIZE,
  maxVideoSize = DEFAULT_MAX_VIDEO_SIZE,
}: MediaUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validate file type and size
  const validateFile = (file: File): { valid: boolean; error?: string; mediaType?: 'image' | 'video' } => {
    // Check if it's an image
    if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
      if (file.size > maxImageSize) {
        return {
          valid: false,
          error: `Image size exceeds ${maxImageSize / (1024 * 1024)}MB limit`,
        };
      }
      return { valid: true, mediaType: 'image' };
    }

    // Check if it's a video
    if (ALLOWED_VIDEO_TYPES.includes(file.type)) {
      if (file.size > maxVideoSize) {
        return {
          valid: false,
          error: `Video size exceeds ${maxVideoSize / (1024 * 1024)}MB limit`,
        };
      }
      return { valid: true, mediaType: 'video' };
    }

    return {
      valid: false,
      error: 'Invalid file type. Allowed: JPEG, PNG, WebP, MP4, WebM, MOV',
    };
  };

  // Handle file selection
  const handleFileSelect = useCallback(
    (file: File) => {
      setError(null);

      // Inline validation to avoid stale closure
      let isValid = false;
      let errorMsg: string | undefined;

      // Check if it's an image
      if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
        if (file.size > maxImageSize) {
          errorMsg = `Image size exceeds ${maxImageSize / (1024 * 1024)}MB limit`;
        } else {
          isValid = true;
        }
      }
      // Check if it's a video
      else if (ALLOWED_VIDEO_TYPES.includes(file.type)) {
        if (file.size > maxVideoSize) {
          errorMsg = `Video size exceeds ${maxVideoSize / (1024 * 1024)}MB limit`;
        } else {
          isValid = true;
        }
      } else {
        errorMsg = 'Invalid file type. Allowed: JPEG, PNG, WebP, MP4, WebM, MOV';
      }

      if (!isValid) {
        setError(errorMsg || 'Invalid file');
        return;
      }

      // Create preview URL for images
      if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      }

      setSelectedFile(file);
    },
    [maxImageSize, maxVideoSize]
  );

  // Handle drag events
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // Handle file input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // Upload the selected file
  const handleUpload = async () => {
    if (!selectedFile) return;

    const validation = validateFile(selectedFile);
    if (!validation.valid || !validation.mediaType) {
      setError(validation.error || 'Invalid file');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Simulate progress (the actual upload to Azure is direct and doesn't provide progress)
      setUploadProgress(30);

      await onUpload(selectedFile, validation.mediaType);

      setUploadProgress(100);

      // Clear state after successful upload
      setTimeout(() => {
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
        setSelectedFile(null);
        setUploadProgress(0);
        setIsUploading(false);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Clear selected file
  const handleClear = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setSelectedFile(null);
    setError(null);
    setUploadProgress(0);
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImage = selectedFile && ALLOWED_IMAGE_TYPES.includes(selectedFile.type);
  const isVideo = selectedFile && ALLOWED_VIDEO_TYPES.includes(selectedFile.type);

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <Card
        className={cn(
          'border-2 border-dashed transition-colors',
          isDragging && !disabled && 'border-primary bg-primary/5',
          disabled && 'opacity-50 cursor-not-allowed',
          !isDragging && !disabled && 'border-muted-foreground/25 hover:border-muted-foreground/50'
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-muted">
              <Upload className="w-8 h-8 text-muted-foreground" />
            </div>
          </div>

          <h3 className="text-lg font-semibold mb-2">
            {isDragging ? 'Drop file here' : 'Upload Media'}
          </h3>

          <p className="text-sm text-muted-foreground mb-4">
            Drag and drop or click to browse
          </p>

          <input
            type="file"
            id="media-upload"
            className="hidden"
            accept={[...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES].join(',')}
            onChange={handleInputChange}
            disabled={disabled || isUploading}
          />

          <Button
            type="button"
            variant="outline"
            disabled={disabled || isUploading}
            onClick={() => document.getElementById('media-upload')?.click()}
          >
            Choose File
          </Button>

          <p className="text-xs text-muted-foreground mt-4">
            Images: JPEG, PNG, WebP (max {maxImageSize / (1024 * 1024)}MB)
            <br />
            Videos: MP4, WebM, MOV (max {maxVideoSize / (1024 * 1024)}MB)
          </p>
        </div>
      </Card>

      {/* Selected File Preview */}
      {selectedFile && (
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              {isImage && previewUrl ? (
                <div className="w-16 h-16 rounded overflow-hidden bg-muted">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : isImage ? (
                <div className="w-16 h-16 rounded bg-muted flex items-center justify-center">
                  <FileImage className="w-8 h-8 text-muted-foreground" />
                </div>
              ) : isVideo ? (
                <div className="w-16 h-16 rounded bg-muted flex items-center justify-center">
                  <FileVideo className="w-8 h-8 text-muted-foreground" />
                </div>
              ) : null}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(selectedFile.size)} • {isImage ? 'Image' : 'Video'}
              </p>

              {isUploading && (
                <div className="mt-2">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}
            </div>

            {!isUploading && (
              <div className="flex gap-2">
                <Button onClick={handleUpload} size="sm" disabled={disabled}>
                  Upload
                </Button>
                <Button
                  onClick={handleClear}
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <Card className="p-4 border-destructive bg-destructive/10">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}
    </div>
  );
}
