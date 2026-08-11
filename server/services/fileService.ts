const ALLOWED_EXTENSIONS = [
  ".pdf", ".doc", ".docx", ".txt", ".md",
  ".png", ".jpg", ".jpeg", ".gif", ".svg",
  ".zip", ".csv", ".xlsx", ".pptx",
];

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  sanitizedName?: string;
  extension?: string;
}

export function validateFile(filename: string, sizeBytes?: number): FileValidationResult {
  if (!filename || typeof filename !== "string") {
    return { valid: false, error: "Filename is required" };
  }

  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
  const ext = sanitized.substring(sanitized.lastIndexOf("."));

  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `File type "${ext || "unknown"}" not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
    };
  }

  if (sizeBytes && sizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit`,
    };
  }

  return {
    valid: true,
    sanitizedName: sanitized,
    extension: ext,
  };
}

export function generateUploadPath(userId: string, filename: string): string {
  const timestamp = Date.now();
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
  return `uploads/${userId}/${timestamp}_${sanitized}`;
}

export function getAllowedExtensions(): string[] {
  return [...ALLOWED_EXTENSIONS];
}

export function getMaxFileSizeMB(): number {
  return MAX_FILE_SIZE_MB;
}
