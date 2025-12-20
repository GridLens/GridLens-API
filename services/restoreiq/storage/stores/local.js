/**
 * GridLens RestoreIQ - Local Filesystem Storage Store
 * 
 * Stores PDFs on local filesystem (default behavior).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPORTS_DIR = path.join(__dirname, '../../../../reports');

export async function init() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
  console.log('[StorageAdapter] Local storage initialized at:', REPORTS_DIR);
  return true;
}

export async function putPdf(bufferOrPath, fileName, contentType = 'application/pdf') {
  const targetPath = path.join(REPORTS_DIR, fileName);
  
  if (typeof bufferOrPath === 'string') {
    if (bufferOrPath !== targetPath) {
      fs.copyFileSync(bufferOrPath, targetPath);
    }
  } else if (Buffer.isBuffer(bufferOrPath)) {
    fs.writeFileSync(targetPath, bufferOrPath);
  } else {
    throw new Error('Invalid input: expected file path string or Buffer');
  }
  
  const blobRef = {
    provider: 'local',
    pdf_path: `/reports/${fileName}`,
    file_name: fileName,
    content_type: contentType,
    size_bytes: fs.statSync(targetPath).size
  };
  
  console.log('[StorageAdapter] Local: PDF stored at', blobRef.pdf_path);
  
  return { blobRef, publicUrl: null };
}

export async function getPdf(blobRef) {
  if (!blobRef || !blobRef.pdf_path) {
    throw new Error('Invalid blobRef: missing pdf_path');
  }
  
  const relativePath = blobRef.pdf_path.startsWith('/') 
    ? blobRef.pdf_path.slice(1) 
    : blobRef.pdf_path;
  
  const fullPath = path.join(__dirname, '../../../../', relativePath);
  
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }
  
  return fs.createReadStream(fullPath);
}

export function getProviderName() {
  return 'local';
}
