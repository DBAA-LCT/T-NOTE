# OneDrive Sync Infrastructure Documentation

This document describes the infrastructure setup for the OneDrive cloud sync feature.

## Overview

The infrastructure provides the foundation for implementing OneDrive sync functionality, including:

1. **Type Definitions** - TypeScript types for all sync-related data structures
2. **IPC Communication** - Type-safe channels for Electron IPC
3. **Logging System** - Structured logging with rotation and categorization
4. **Testing Framework** - Jest + fast-check for unit and property-based testing

## Directory Structure

```
.
├── electron/
│   ├── ipc/
│   │   └── sync-channels.ts      # IPC channel definitions
│   ├── utils/
│   │   └── logger.ts             # Logging system
│   └── preload.ts                # Updated with OneDrive API
├── src/
│   └── types/
│       ├── onedrive-sync.ts      # Core type definitions
│       └── window.d.ts           # Window API declarations
├── tests/
│   ├── unit/                     # Unit tests
│   ├── property/                 # Property-based tests
│   ├── integration/              # Integration tests
│   ├── fixtures/                 # Test data
│   │   ├── notes.ts
│   │   └── api-responses.ts
│   ├── utils/
│   │   └── test-helpers.ts       # Test utilities
│   ├── setup.ts                  # Test configuration
│   └── README.md                 # Testing guide
├── jest.config.js                # Jest configuration
└── tsconfig.test.json            # TypeScript config for tests
```

## Type Definitions

### Core Types (`src/types/onedrive-sync.ts`)

The type definitions file contains all TypeScript interfaces and types for:

- **Authentication**: `UserInfo`, `TokenData`, `AuthError`
- **Notes**: `Note`, `SyncMetadata`, `SyncStatus`
- **Sync Operations**: `SyncOptions`, `SyncResult`, `NoteSyncResult`
- **Conflicts**: `ConflictInfo`, `ConflictResolution`
- **OneDrive API**: `DriveItem`, `FolderItem`, `StorageQuota`
- **Network**: `NetworkStatus`
- **Settings**: `SyncSettings`, `AppSettings`
- **IPC Messages**: `IPCSyncProgress`, `IPCSyncComplete`, etc.
- **Errors**: `SyncError`, `NetworkError`, `ValidationError`

### Window API (`src/types/window.d.ts`)

Extends the global `Window` interface with the `electronAPI` object, providing type-safe access to all Electron IPC methods from the renderer process.

## IPC Communication

### Channel Definitions (`electron/ipc/sync-channels.ts`)

Defines all IPC channel names as constants in the `IPC_CHANNELS` object:

**Authentication Channels:**
- `AUTH_AUTHENTICATE` - Start OAuth flow
- `AUTH_DISCONNECT` - Disconnect account
- `AUTH_GET_USER_INFO` - Get user information
- `AUTH_IS_AUTHENTICATED` - Check auth status

**Sync Operation Channels:**
- `SYNC_EXECUTE` - Execute full sync
- `SYNC_NOTE` - Sync single note
- `SYNC_UPLOAD_NOTE` - Upload note
- `SYNC_DOWNLOAD_NOTE` - Download note
- `SYNC_GET_STATUS` - Get sync status
- `SYNC_CANCEL` - Cancel sync

**Cloud Note Channels:**
- `CLOUD_GET_NOTES` - List cloud notes
- `CLOUD_BROWSE_FOLDERS` - Browse folders
- `CLOUD_GET_STORAGE_QUOTA` - Get storage info

**Settings Channels:**
- `SETTINGS_GET_SYNC_FOLDER` - Get sync folder
- `SETTINGS_SET_SYNC_FOLDER` - Set sync folder
- `SETTINGS_GET_SYNC_SETTINGS` - Get settings
- `SETTINGS_UPDATE_SYNC_SETTINGS` - Update settings

**Event Channels (Main → Renderer):**
- `EVENT_SYNC_PROGRESS` - Sync progress updates
- `EVENT_SYNC_COMPLETE` - Sync completed
- `EVENT_SYNC_ERROR` - Sync error occurred
- `EVENT_NETWORK_STATUS_CHANGE` - Network status changed
- `EVENT_CONFLICT_DETECTED` - Conflict detected

### Type Safety

The file also exports type mappings for request/response types:
- `IPCRequestMap` - Maps channel names to request types
- `IPCResponseMap` - Maps channel names to response types
- `IPCEventMap` - Maps event channels to event data types

## Logging System

### Logger (`electron/utils/logger.ts`)

A singleton logger instance that provides structured logging with:

**Log Levels:**
- `debug` - Detailed debugging information
- `info` - General informational messages
- `warn` - Warning messages
- `error` - Error messages with stack traces

**Log Categories:**
- `auth` - Authentication operations
- `sync` - Sync operations
- `network` - Network operations
- `api` - API calls
- `filesystem` - File system operations
- `validation` - Data validation
- `general` - General messages

**Features:**
- Automatic log file rotation (when > 10MB)
- Keeps last 5 archived logs
- Console output in development mode
- Structured JSON log entries
- Async batch writing for performance

**Usage:**
```typescript
import { logger } from './electron/utils/logger';

logger.info('sync', 'Sync started', { noteCount: 5 });
logger.error('api', 'API request failed', error, { endpoint: '/files' });
```

**Log Location:**
- Windows: `%APPDATA%/t-note/onedrive-sync.log`
- macOS: `~/Library/Application Support/t-note/onedrive-sync.log`
- Linux: `~/.config/t-note/onedrive-sync.log`

## Testing Framework

### Configuration

**Jest Config (`jest.config.js`):**
- Uses `ts-jest` preset for TypeScript
- Test environment: Node.js
- Coverage thresholds: 75-80%
- Test timeout: 10 seconds (30s for property tests)

**Test Setup (`tests/setup.ts`):**
- Mocks Electron APIs
- Suppresses console output
- Sets test environment variables

### Test Structure

**Unit Tests (`tests/unit/`):**
- Test individual components
- Focus on specific examples and edge cases
- Mock external dependencies

**Property-Based Tests (`tests/property/`):**
- Use fast-check for generative testing
- Run 100+ iterations per property
- Verify universal properties

**Integration Tests (`tests/integration/`):**
- Test component interactions
- Verify end-to-end workflows

**Fixtures (`tests/fixtures/`):**
- `notes.ts` - Sample note data
- `api-responses.ts` - Mock API responses

### Test Helpers (`tests/utils/test-helpers.ts`)

Provides utilities for testing:

**Fast-check Arbitraries:**
- `arbNote()` - Generate random notes
- `arbCloudNoteData()` - Generate cloud notes
- `arbTokenData()` - Generate tokens
- `arbTimestamp()` - Generate timestamps

**Mock Helpers:**
- `createMockFn()` - Create mock functions
- `delayedResolve()` - Async delays
- `delayedReject()` - Async errors

**Assertion Helpers:**
- `assertDefined()` - Type-safe assertions
- `assertThrows()` - Async error assertions

**Time Helpers:**
- `waitFor()` - Wait for conditions
- `flushPromises()` - Flush promise queue

**Comparison Helpers:**
- `deepEqualIgnoring()` - Compare objects
- `timestampsClose()` - Compare timestamps

### Running Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only property tests
npm run test:property
```

## Next Steps

With the infrastructure in place, you can now implement:

1. **Network Monitor** - Detect network status and WiFi
2. **Settings Manager** - Manage sync configuration
3. **Auth Manager** - Handle OAuth authentication
4. **OneDrive API Client** - Make API calls
5. **File Manager** - Handle local file operations
6. **Conflict Resolver** - Detect and resolve conflicts
7. **Sync Engine** - Orchestrate sync operations

Each component should:
- Use the defined types from `src/types/onedrive-sync.ts`
- Use the logger for all operations
- Have corresponding unit and property-based tests
- Register IPC handlers using the defined channels
