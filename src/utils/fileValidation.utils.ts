import { promises as fs } from 'fs';
import path from 'path';

const FILE_SIZE_LIMITS = {
  image: 2 * 1024 * 1024,      // 2MB for images
  document: 3 * 1024 * 1024,    // 3MB for documents
  video: 5 * 1024 * 1024,     // 5MB for videos
  total: 25 * 1024 * 1024,    // 25MB total for all files
};

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv', 'application/rtf',
  'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm',
];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pdf', '.doc', '.docx',
  '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.rtf', '.mp4', '.mpeg', '.mov', '.webm'];

export interface FileAttachment {
  filename: string;
  path: string;
  size: number;
  mimetype: string;
}

const getFileType = (mimetype: string): 'image' | 'document' | 'video' | null => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('application/') || mimetype.startsWith('text/')) return 'document';
  if (mimetype.startsWith('video/')) return 'video';
  return null;
};

export const validateFiles = async (files: FileAttachment[]): Promise<{ isValid: boolean; errors?: string[] }> => {
  const errors: string[] = [];

  if (files.length > 5) {
    return { isValid: false, errors: ['Maximum of 5 files allowed per support request.'] };
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > FILE_SIZE_LIMITS.total) {
    errors.push(`Total file size (${(totalSize / 1024 / 1024).toFixed(1)}MB) exceeds limit (${FILE_SIZE_LIMITS.total / 1024 / 1024}MB)`);
  }

  for (const file of files) {
    // Validate extension
    if (!ALLOWED_EXTENSIONS.includes(path.extname(file.filename).toLowerCase())) {
      errors.push(`${file.filename}: Extension not allowed`);
      continue;
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      errors.push(`${file.filename}: File type not allowed`);
      continue;
    }

    // Validate size
    const fileType = getFileType(file.mimetype);
    if (!fileType) {
      errors.push(`${file.filename}: Unknown file type`);
      continue;
    }

    const maxSize = FILE_SIZE_LIMITS[fileType];
    if (file.size > maxSize) {
      errors.push(`${file.filename}: Exceeds ${maxSize / 1024 / 1024}MB limit for ${fileType} files`);
      continue;
    }

    // Validate filename
    if (file.filename.includes('..') || file.filename.includes('/') || file.filename.includes('\\')) {
      errors.push(`${file.filename}: Invalid filename`);
      continue;
    }

    if (file.filename.length > 255) {
      errors.push(`${file.filename}: Filename too long`);
      continue;
    }

    // Check file exists and accessible
    try {
      await fs.access(file.path);
    } catch {
      errors.push(`${file.filename}: File not found or inaccessible`);
      continue;
    }

    // Check file not empty
    if (file.size === 0) {
      errors.push(`${file.filename}: File is empty`);
    }
  }

  return { isValid: errors.length === 0, ...(errors.length > 0 && { errors }) };
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

