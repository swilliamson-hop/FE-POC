import type { FileUploadResponse, DocumentType } from '../types/application';

const uploadEndpoint = process.env.NEXT_PUBLIC_FILE_UPLOAD_ENDPOINT!;
const uploadToken = process.env.NEXT_PUBLIC_FILE_UPLOAD_TOKEN!;

export type FileType = 'IMG' | 'PDF';

function getFileType(file: File): FileType {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
    return 'IMG';
  }
  return 'PDF';
}

export async function uploadFile(
  file: File,
  documentType: DocumentType
): Promise<FileUploadResponse> {
  const formData = new FormData();
  formData.append('files', file);
  formData.append('filesType', getFileType(file));
  formData.append('rotations', '[]');

  const response = await fetch(uploadEndpoint, {
    method: 'POST',
    headers: {
      Authorization: uploadToken,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  const results: FileUploadResponse[] = await response.json();

  if (results.length === 0) {
    throw new Error('No file uploaded');
  }

  // Add document type info to the response
  const result = results[0];
  return {
    ...result,
    type: documentType,
    documentType: documentType === 'IMG' ? null : documentType,
  };
}

export async function uploadMultipleFiles(
  files: File[],
  documentType: DocumentType
): Promise<FileUploadResponse[]> {
  const results = await Promise.all(
    files.map((file) => uploadFile(file, documentType))
  );
  return results;
}
