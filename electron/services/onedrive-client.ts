/**
 * OneDrive API Client - HTTP Request Wrapper
 * 
 * Provides HTTP request functionality with authentication, retry logic, and error handling.
 * Requirement 12.2: Implements request retry logic for network errors and rate limiting.
 */

import { AuthManager } from './auth-manager';
import { logger } from '../utils/logger';
import type { DriveItem } from '../../src/types/onedrive-sync';

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelays: [1000, 3000, 5000], // milliseconds
  retryableStatusCodes: [401, 408, 429, 500, 502, 503, 504],
  retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED'],
};

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  skipAuth?: boolean;
}

export interface ApiError extends Error {
  statusCode?: number;
  response?: any;
  headers?: Record<string, string>;
}

export class OneDriveClient {
  private authManager: AuthManager;
  private baseUrl = 'https://graph.microsoft.com/v1.0';

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
  }

  /**
   * Make an HTTP request to OneDrive API with authentication and retry logic
   * @param endpoint API endpoint (relative to base URL)
   * @param options Request options
   * @returns Response data
   */
  async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    
    logger.debug('api', `Making request to ${options.method || 'GET'} ${endpoint}`);

    return this.withRetry(async () => {
      // Get access token (unless explicitly skipped)
      let accessToken: string | undefined;
      if (!options.skipAuth) {
        try {
          accessToken = await this.authManager.getAccessToken();
        } catch (error) {
          logger.error('api', 'Failed to get access token', error as Error);
          throw error;
        }
      }

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      // Build request options
      const fetchOptions: RequestInit = {
        method: options.method || 'GET',
        headers,
      };

      // Add body if present
      if (options.body) {
        if (typeof options.body === 'string') {
          fetchOptions.body = options.body;
        } else {
          fetchOptions.body = JSON.stringify(options.body);
        }
      }

      // Add timeout if specified
      const controller = new AbortController();
      fetchOptions.signal = controller.signal;
      
      let timeoutId: NodeJS.Timeout | undefined;
      if (options.timeout) {
        timeoutId = setTimeout(() => controller.abort(), options.timeout);
      }

      try {
        // Make the request
        const response = await fetch(url, fetchOptions);

        // Clear timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Handle response
        return await this.handleResponse<T>(response);
      } catch (error: any) {
        // Clear timeout on error
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Handle abort as timeout error
        if (error.name === 'AbortError') {
          const timeoutError = new Error('Request timeout') as ApiError;
          timeoutError.name = 'ETIMEDOUT';
          throw timeoutError;
        }

        throw error;
      }
    }, endpoint);
  }

  /**
   * Handle API response and errors
   * @param response Fetch response
   * @returns Parsed response data
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    // Handle successful responses
    if (response.ok) {
      // No content
      if (response.status === 204) {
        return undefined as T;
      }

      // Parse JSON response
      if (isJson) {
        return await response.json();
      }

      // Return text for non-JSON responses
      return (await response.text()) as T;
    }

    // Handle error responses
    let errorData: any;
    try {
      errorData = isJson ? await response.json() : await response.text();
    } catch {
      errorData = { message: 'Unknown error' };
    }

    const error = new Error(
      errorData.error?.message || errorData.error_description || errorData.message || 'API request failed'
    ) as ApiError;
    error.statusCode = response.status;
    error.response = errorData;
    error.headers = Object.fromEntries(response.headers.entries());

    // Handle specific error codes
    await this.handleApiError(error);

    throw error;
  }

  /**
   * Handle specific API errors
   * @param error API error
   */
  private async handleApiError(error: ApiError): Promise<void> {
    const statusCode = error.statusCode;

    switch (statusCode) {
      case 401:
        // Unauthorized - try to refresh token
        logger.warn('api', '401 Unauthorized, attempting token refresh');
        try {
          await this.authManager.refreshAccessToken();
          // Token refreshed, throw error so retry logic will retry the request
          // The error is retryable (401 is in retryableStatusCodes)
        } catch (refreshError) {
          logger.error('api', 'Token refresh failed', refreshError as Error);
          // Clear authentication and require re-login
          await this.authManager.disconnect();
          const authError = new Error('Authentication failed. Please reconnect your OneDrive account.') as ApiError;
          authError.statusCode = 401;
          throw authError;
        }
        break;

      case 429:
        // Rate limited - extract retry-after header
        const retryAfter = error.headers?.['retry-after'];
        if (retryAfter) {
          const delaySeconds = parseInt(retryAfter, 10);
          logger.warn('api', `Rate limited, retry after ${delaySeconds} seconds`);
          // The retry logic will handle the delay
        }
        break;

      case 507:
        // Insufficient storage
        logger.error('api', 'OneDrive storage quota exceeded');
        throw new Error('OneDrive storage space is full. Please free up space and try again.');

      case 404:
        // Not found - log but don't throw (might be expected)
        logger.warn('api', 'Resource not found', undefined, { statusCode });
        break;

      default:
        logger.error('api', `API error ${statusCode}`, undefined, { 
          statusCode, 
          message: error.message 
        });
    }
  }

  /**
   * Execute operation with retry logic
   * @param operation Operation to execute
   * @param context Context for logging
   * @returns Operation result
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Don't retry on last attempt
        if (attempt === RETRY_CONFIG.maxRetries) {
          logger.error('api', `Request failed after ${attempt} retries: ${context}`, error);
          break;
        }

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          logger.debug('api', `Non-retryable error, not retrying: ${context}`);
          throw error;
        }

        // Calculate delay
        let delay = RETRY_CONFIG.retryDelays[attempt];

        // For 429 errors, use retry-after header if available
        if (error.statusCode === 429 && error.headers?.['retry-after']) {
          const retryAfter = parseInt(error.headers['retry-after'], 10);
          delay = retryAfter * 1000;
        }

        logger.info('api', `Retrying request (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries}) after ${delay}ms: ${context}`);

        // Wait before retry
        await this.delay(delay);
      }
    }

    throw lastError;
  }

  /**
   * Check if error is retryable
   * @param error Error to check
   * @returns True if error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Check status code
    if (error.statusCode && RETRY_CONFIG.retryableStatusCodes.includes(error.statusCode)) {
      return true;
    }

    // Check error name/code
    if (error.name && RETRY_CONFIG.retryableErrors.includes(error.name)) {
      return true;
    }

    if (error.code && RETRY_CONFIG.retryableErrors.includes(error.code)) {
      return true;
    }

    // Network errors
    if (error.message?.includes('network') || error.message?.includes('fetch')) {
      return true;
    }

    return false;
  }

  /**
   * Delay execution
   * @param ms Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Convenience method for GET requests
   * @param endpoint API endpoint
   * @param options Request options
   * @returns Response data
   */
  async get<T = any>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * Convenience method for POST requests
   * @param endpoint API endpoint
   * @param body Request body
   * @param options Request options
   * @returns Response data
   */
  async post<T = any>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  /**
   * Convenience method for PUT requests
   * @param endpoint API endpoint
   * @param body Request body
   * @param options Request options
   * @returns Response data
   */
  async put<T = any>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  /**
   * Convenience method for PATCH requests
   * @param endpoint API endpoint
   * @param body Request body
   * @param options Request options
   * @returns Response data
   */
  async patch<T = any>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  /**
   * Convenience method for DELETE requests
   * @param endpoint API endpoint
   * @param options Request options
   * @returns Response data
   */
  async delete<T = any>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  // ============================================================================
  // OneDrive API Methods
  // ============================================================================

  /**
   * List files in a folder
   * Requirement 4.1: Check Sync_Folder for all notes
   * Requirement 8.2: Display cloud notes list
   * @param folderPath Folder path (e.g., "/Notes" or empty string for root)
   * @returns Array of DriveItem objects
   */
  async listFiles(folderPath: string = ''): Promise<DriveItem[]> {
    try {
      // Build the endpoint
      // If folderPath is empty or "/", use root
      // Otherwise use the path format: /me/drive/root:/{path}:/children
      let endpoint: string;
      
      if (!folderPath || folderPath === '/' || folderPath === '') {
        endpoint = '/me/drive/root/children';
      } else {
        // Remove leading/trailing slashes and encode the path
        const cleanPath = folderPath.replace(/^\/+|\/+$/g, '');
        endpoint = `/me/drive/root:/${cleanPath}:/children`;
      }

      logger.debug('api', `Listing files in folder: ${folderPath || 'root'}`);

      // Make the API request
      const response = await this.get<{ value: DriveItem[] }>(endpoint);

      // Extract the items array from the response
      const items = response.value || [];

      logger.info('api', `Found ${items.length} items in folder: ${folderPath || 'root'}`);

      return items;
    } catch (error: any) {
      logger.error('api', `Failed to list files in folder: ${folderPath}`, error);
      throw error;
    }
  }

  /**
   * Upload a file to OneDrive
   * Requirement 4.3: Upload local notes to cloud
   * Uses simple upload for files < 4MB, chunked upload for larger files
   * @param localFilePath Local file path to upload
   * @param remotePath Remote path in OneDrive (e.g., "/Notes/mynote.note")
   * @returns DriveItem of the uploaded file
   */
  async uploadFile(localFilePath: string, remotePath: string): Promise<DriveItem> {
    try {
      const fs = await import('fs/promises');
      
      // Read file to get size
      const stats = await fs.stat(localFilePath);
      const fileSize = stats.size;

      logger.debug('api', `Uploading file: ${localFilePath} (${fileSize} bytes) to ${remotePath}`);

      // Use simple upload for files < 4MB (4 * 1024 * 1024 bytes)
      const SIMPLE_UPLOAD_LIMIT = 4 * 1024 * 1024;

      if (fileSize < SIMPLE_UPLOAD_LIMIT) {
        return await this.simpleUpload(localFilePath, remotePath);
      } else {
        return await this.chunkedUpload(localFilePath, remotePath, fileSize);
      }
    } catch (error: any) {
      logger.error('api', `Failed to upload file: ${localFilePath}`, error);
      throw error;
    }
  }

  /**
   * Simple upload for files < 4MB
   * @param localFilePath Local file path
   * @param remotePath Remote path in OneDrive
   * @returns DriveItem of the uploaded file
   */
  private async simpleUpload(localFilePath: string, remotePath: string): Promise<DriveItem> {
    const fs = await import('fs/promises');
    
    // Read file content
    const fileContent = await fs.readFile(localFilePath);

    // Build the endpoint
    // Remove leading slash if present
    const cleanPath = remotePath.replace(/^\/+/, '');
    const endpoint = `/me/drive/root:/${cleanPath}:/content`;

    logger.debug('api', `Simple upload to: ${endpoint}`);

    // Upload using PUT request
    const response = await this.request<DriveItem>(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: fileContent as any,
    });

    logger.info('api', `Successfully uploaded file: ${remotePath}`);

    return response;
  }

  /**
   * Chunked upload for files >= 4MB
   * @param localFilePath Local file path
   * @param remotePath Remote path in OneDrive
   * @param fileSize File size in bytes
   * @returns DriveItem of the uploaded file
   */
  private async chunkedUpload(
    localFilePath: string,
    remotePath: string,
    fileSize: number
  ): Promise<DriveItem> {
    const fs = await import('fs/promises');
    
    // Step 1: Create upload session
    const cleanPath = remotePath.replace(/^\/+/, '');
    const sessionEndpoint = `/me/drive/root:/${cleanPath}:/createUploadSession`;

    logger.debug('api', `Creating upload session for: ${remotePath}`);

    interface UploadSession {
      uploadUrl: string;
      expirationDateTime: string;
    }

    const session = await this.post<UploadSession>(sessionEndpoint, {
      item: {
        '@microsoft.graph.conflictBehavior': 'replace',
      },
    });

    const uploadUrl = session.uploadUrl;

    logger.debug('api', `Upload session created, URL: ${uploadUrl}`);

    // Step 2: Upload file in chunks
    const CHUNK_SIZE = 320 * 1024; // 320 KB chunks (must be multiple of 320 KB)
    const fileHandle = await fs.open(localFilePath, 'r');

    try {
      let uploadedBytes = 0;
      let driveItem: DriveItem | undefined;

      while (uploadedBytes < fileSize) {
        const chunkSize = Math.min(CHUNK_SIZE, fileSize - uploadedBytes);
        const buffer = Buffer.alloc(chunkSize);

        // Read chunk from file
        const { bytesRead } = await fileHandle.read(buffer, 0, chunkSize, uploadedBytes);

        if (bytesRead === 0) {
          break;
        }

        // Upload chunk
        const rangeStart = uploadedBytes;
        const rangeEnd = uploadedBytes + bytesRead - 1;

        logger.debug('api', `Uploading chunk: bytes ${rangeStart}-${rangeEnd}/${fileSize}`);

        const chunkResponse = await this.uploadChunk(
          uploadUrl,
          buffer.slice(0, bytesRead),
          rangeStart,
          rangeEnd,
          fileSize
        );

        uploadedBytes += bytesRead;

        // If this is the last chunk, the response will contain the DriveItem
        if (chunkResponse && 'id' in chunkResponse) {
          driveItem = chunkResponse as DriveItem;
        }
      }

      if (!driveItem) {
        throw new Error('Upload completed but no DriveItem returned');
      }

      logger.info('api', `Successfully uploaded file in chunks: ${remotePath}`);

      return driveItem;
    } finally {
      await fileHandle.close();
    }
  }

  /**
   * Upload a single chunk
   * @param uploadUrl Upload session URL
   * @param chunk Chunk data
   * @param rangeStart Start byte position
   * @param rangeEnd End byte position (inclusive)
   * @param totalSize Total file size
   * @returns Upload response (DriveItem on last chunk, or status on intermediate chunks)
   */
  private async uploadChunk(
    uploadUrl: string,
    chunk: Buffer,
    rangeStart: number,
    rangeEnd: number,
    totalSize: number
  ): Promise<any> {
    const contentRange = `bytes ${rangeStart}-${rangeEnd}/${totalSize}`;

    logger.debug('api', `Uploading chunk with range: ${contentRange}`);

    // Use the upload URL directly (it already contains auth)
    const response = await this.request(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': chunk.length.toString(),
        'Content-Range': contentRange,
      },
      body: chunk as any,
      skipAuth: true, // Upload URL already has auth token
    });

    return response;
  }

  /**
   * Download a file from OneDrive
   * Requirement 4.2: Download cloud notes to local
   * @param remoteId Remote file ID in OneDrive
   * @param localPath Local path to save the downloaded file
   */
  async downloadFile(remoteId: string, localPath: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      logger.debug('api', `Downloading file: ${remoteId} to ${localPath}`);

      // Step 1: Get the download URL
      // The @microsoft.graph.downloadUrl property provides a pre-authenticated URL
      const endpoint = `/me/drive/items/${remoteId}`;
      const metadata = await this.get<DriveItem & { '@microsoft.graph.downloadUrl'?: string }>(endpoint);

      const downloadUrl = metadata['@microsoft.graph.downloadUrl'];
      if (!downloadUrl) {
        throw new Error('Download URL not available for this file');
      }

      logger.debug('api', `Got download URL for file: ${remoteId}`);

      // Step 2: Download the file content
      // The download URL is pre-authenticated, so we don't need to add auth headers
      const response = await fetch(downloadUrl);

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
      }

      // Step 3: Get the file content as a buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      logger.debug('api', `Downloaded ${buffer.length} bytes`);

      // Step 4: Ensure the directory exists
      const directory = path.dirname(localPath);
      await fs.mkdir(directory, { recursive: true });

      // Step 5: Write the file to disk
      await fs.writeFile(localPath, buffer);

      logger.info('api', `Successfully downloaded file to: ${localPath}`);
    } catch (error: any) {
      logger.error('api', `Failed to download file: ${remoteId}`, error);
      throw error;
    }
  }

  /**
   * Browse folder structure in OneDrive
   * Requirement 2.3: Allow users to browse OneDrive folder structure
   * Recursively retrieves folder structure
   * @param parentPath Parent folder path (e.g., "/Documents" or empty string for root)
   * @returns Array of FolderItem objects (folders only, no files)
   */
  async browseFolders(parentPath?: string): Promise<import('../../src/types/onedrive-sync').FolderItem[]> {
    try {
      logger.debug('api', `Browsing folders in: ${parentPath || 'root'}`);

      // Get all items in the parent folder
      const items = await this.listFiles(parentPath || '');

      // Filter to only include folders
      const folders = items.filter(item => item.folder !== undefined);

      // Map DriveItems to FolderItems
      const folderItems: import('../../src/types/onedrive-sync').FolderItem[] = folders.map(folder => {
        // Build the full path
        let fullPath: string;
        if (!parentPath || parentPath === '/' || parentPath === '') {
          fullPath = `/${folder.name}`;
        } else {
          // Remove trailing slash from parent path if present
          const cleanParent = parentPath.replace(/\/+$/, '');
          fullPath = `${cleanParent}/${folder.name}`;
        }

        return {
          id: folder.id,
          name: folder.name,
          path: fullPath,
          childCount: folder.folder?.childCount || 0,
        };
      });

      logger.info('api', `Found ${folderItems.length} folders in: ${parentPath || 'root'}`);

      return folderItems;
    } catch (error: any) {
      logger.error('api', `Failed to browse folders in: ${parentPath}`, error);
      throw error;
    }
  }

  /**
   * Get storage quota information from OneDrive
   * Requirement 9.4: Display OneDrive storage space usage
   * @returns Storage quota information (total, used, remaining in bytes)
   */
  async getStorageQuota(): Promise<import('../../src/types/onedrive-sync').StorageQuota> {
    try {
      logger.debug('api', 'Fetching storage quota information');

      // Call the /me/drive API to get drive information including quota
      const endpoint = '/me/drive';
      
      interface DriveResponse {
        id: string;
        driveType: string;
        quota: {
          total: number;
          used: number;
          remaining: number;
          deleted?: number;
          state?: string;
        };
      }

      const response = await this.get<DriveResponse>(endpoint);

      // Extract quota information
      const quota = response.quota;

      if (!quota) {
        throw new Error('Quota information not available in drive response');
      }

      const storageQuota: import('../../src/types/onedrive-sync').StorageQuota = {
        total: quota.total,
        used: quota.used,
        remaining: quota.remaining,
      };

      logger.info('api', `Storage quota: ${storageQuota.used}/${storageQuota.total} bytes used (${storageQuota.remaining} remaining)`);

      return storageQuota;
    } catch (error: any) {
      logger.error('api', 'Failed to fetch storage quota', error);
      throw error;
    }
  }

  /**
   * Create a new folder in OneDrive
   * @param folderName - Name of the folder to create
   * @param parentPath - Parent folder path (optional, defaults to root)
   * @returns Created folder information
   */
  async createFolder(folderName: string, parentPath?: string): Promise<import('../../src/types/onedrive-sync').FolderItem> {
    try {
      logger.info('api', 'Creating folder', { folderName, parentPath });

      // Validate folder name
      if (!folderName || folderName.trim().length === 0) {
        throw new Error('Folder name cannot be empty');
      }

      // Check for invalid characters
      const invalidChars = /[<>:"|?*\/\\]/;
      if (invalidChars.test(folderName)) {
        throw new Error('Folder name contains invalid characters');
      }

      // Build endpoint
      let endpoint: string;
      if (parentPath) {
        // Create in specific folder
        const encodedPath = encodeURIComponent(parentPath);
        endpoint = `/me/drive/root:/${encodedPath}:/children`;
      } else {
        // Create in root
        endpoint = '/me/drive/root/children';
      }

      // Create folder
      const response = await this.post<DriveItem>(endpoint, {
        name: folderName.trim(),
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail' // Fail if folder already exists
      });

      logger.info('api', 'Folder created successfully', { folderId: response.id, folderName });

      // Return folder information
      const folderPath = parentPath ? `${parentPath}/${response.name}` : response.name;
      
      return {
        id: response.id,
        name: response.name,
        path: folderPath,
        childCount: 0
      };
    } catch (error: any) {
      // Check if folder already exists
      if (error.statusCode === 409 || error.message?.includes('already exists')) {
        throw new Error(`文件夹 "${folderName}" 已存在`);
      }
      
      logger.error('api', 'Failed to create folder', error);
      throw error;
    }
  }
}

// Singleton instance
let oneDriveClientInstance: OneDriveClient | null = null;

/**
 * Get the singleton OneDrive Client instance
 */
export function getOneDriveClient(): OneDriveClient {
  if (!oneDriveClientInstance) {
    const { getAuthManager } = require('./auth-manager');
    oneDriveClientInstance = new OneDriveClient(getAuthManager());
  }
  return oneDriveClientInstance;
}
