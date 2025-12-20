/**
 * GridLens RestoreIQ - Storage Adapter
 * 
 * Provides a unified interface for PDF storage across multiple backends.
 * Switchable via STORAGE_PROVIDER env var:
 *   - 'local' (default): Local filesystem
 *   - 'azure': Azure Blob Storage
 * 
 * Falls back to local storage if Azure configuration is incomplete.
 */

import * as localStore from "./stores/local.js";
import * as azureStore from "./stores/azureBlob.js";

let activeStore = null;
let providerName = 'local';
let initialized = false;

export async function init() {
  if (initialized) {
    return { provider: providerName, store: activeStore };
  }
  
  const requestedProvider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();
  
  console.log('[StorageAdapter] Requested provider:', requestedProvider);
  
  if (requestedProvider === 'azure') {
    const azureReady = await azureStore.init();
    
    if (azureReady) {
      activeStore = azureStore;
      providerName = 'azure';
      console.log('[StorageAdapter] Using Azure Blob storage');
    } else {
      console.warn('[StorageAdapter] Azure config incomplete, falling back to local storage');
      await localStore.init();
      activeStore = localStore;
      providerName = 'local';
    }
  } else {
    await localStore.init();
    activeStore = localStore;
    providerName = 'local';
    console.log('[StorageAdapter] Using local filesystem storage');
  }
  
  initialized = true;
  return { provider: providerName, store: activeStore };
}

export async function putPdf(bufferOrPath, fileName, contentType = 'application/pdf') {
  if (!initialized) {
    await init();
  }
  
  const result = await activeStore.putPdf(bufferOrPath, fileName, contentType);
  
  result.blobRef.pdf_generated_at = new Date().toISOString();
  
  return result;
}

export async function getPdf(blobRef) {
  if (!initialized) {
    await init();
  }
  
  const refProvider = blobRef?.provider || 'local';
  
  if (refProvider === 'azure' && providerName === 'azure') {
    return azureStore.getPdf(blobRef);
  } else if (refProvider === 'azure' && providerName !== 'azure') {
    console.warn('[StorageAdapter] blobRef is azure but azure not configured, attempting anyway');
    const azureReady = await azureStore.init();
    if (azureReady) {
      return azureStore.getPdf(blobRef);
    }
    throw new Error('Cannot retrieve Azure blob: Azure storage not configured');
  } else {
    return localStore.getPdf(blobRef);
  }
}

export function getProviderName() {
  return providerName;
}

export function isInitialized() {
  return initialized;
}

export async function getProviderInfo() {
  if (!initialized) {
    await init();
  }
  
  return {
    provider: providerName,
    azure_configured: !!(process.env.AZURE_STORAGE_CONNECTION_STRING && process.env.AZURE_BLOB_CONTAINER),
    container: providerName === 'azure' ? process.env.AZURE_BLOB_CONTAINER : null,
    prefix: providerName === 'azure' ? (process.env.AZURE_BLOB_PREFIX || 'restoreiq') : null
  };
}
