/**
 * GridLens RestoreIQ - Azure Blob Storage Store
 * 
 * Stores PDFs in Azure Blob Storage container.
 * Requires:
 *   - AZURE_STORAGE_CONNECTION_STRING
 *   - AZURE_BLOB_CONTAINER
 * Optional:
 *   - AZURE_BLOB_PREFIX (default: 'restoreiq')
 */

import { BlobServiceClient } from "@azure/storage-blob";
import fs from "fs";

let containerClient = null;
let blobPrefix = 'restoreiq';

export async function init() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_BLOB_CONTAINER;
  blobPrefix = process.env.AZURE_BLOB_PREFIX || 'restoreiq';
  
  if (!connectionString) {
    console.warn('[StorageAdapter] Azure: AZURE_STORAGE_CONNECTION_STRING not set');
    return false;
  }
  
  if (!containerName) {
    console.warn('[StorageAdapter] Azure: AZURE_BLOB_CONTAINER not set');
    return false;
  }
  
  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    containerClient = blobServiceClient.getContainerClient(containerName);
    
    const exists = await containerClient.exists();
    if (!exists) {
      console.log('[StorageAdapter] Azure: Creating container:', containerName);
      await containerClient.create();
    }
    
    console.log('[StorageAdapter] Azure Blob storage initialized');
    console.log('[StorageAdapter] Azure: Container:', containerName);
    console.log('[StorageAdapter] Azure: Prefix:', blobPrefix);
    return true;
  } catch (err) {
    console.error('[StorageAdapter] Azure initialization failed:', err.message);
    return false;
  }
}

export async function putPdf(bufferOrPath, fileName, contentType = 'application/pdf') {
  if (!containerClient) {
    throw new Error('Azure Blob storage not initialized');
  }
  
  const blobName = `${blobPrefix}/${fileName}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  
  let buffer;
  if (typeof bufferOrPath === 'string') {
    buffer = fs.readFileSync(bufferOrPath);
  } else if (Buffer.isBuffer(bufferOrPath)) {
    buffer = bufferOrPath;
  } else {
    throw new Error('Invalid input: expected file path string or Buffer');
  }
  
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType }
  });
  
  const blobRef = {
    provider: 'azure',
    blob_name: blobName,
    container: process.env.AZURE_BLOB_CONTAINER,
    file_name: fileName,
    content_type: contentType,
    size_bytes: buffer.length,
    uploaded_at: new Date().toISOString()
  };
  
  console.log('[StorageAdapter] Azure: PDF uploaded to', blobName);
  
  return { blobRef, publicUrl: blockBlobClient.url };
}

export async function getPdf(blobRef) {
  if (!containerClient) {
    throw new Error('Azure Blob storage not initialized');
  }
  
  if (!blobRef || !blobRef.blob_name) {
    throw new Error('Invalid blobRef: missing blob_name');
  }
  
  const blockBlobClient = containerClient.getBlockBlobClient(blobRef.blob_name);
  
  const exists = await blockBlobClient.exists();
  if (!exists) {
    throw new Error(`Blob not found: ${blobRef.blob_name}`);
  }
  
  const downloadResponse = await blockBlobClient.download(0);
  return downloadResponse.readableStreamBody;
}

export function getProviderName() {
  return 'azure';
}
