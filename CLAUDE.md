# Enput VPS Manager - Claude Code DNA

## Project Overview
Electron + React + TypeScript desktop application for managing VPS servers via SSH/SFTP with Claude AI integration.

## Architecture
- **Main Process** (electron/): SSH, SFTP, credential management, resource monitoring
- **Preload** (electron/preload.ts): Secure IPC bridge via contextBridge
- **Renderer** (src/): React UI with Zustand state management

## Key Patterns
- All SSH/SFTP operations happen in the main process via ssh2 library
- IPC channels defined in `electron/types/index.ts` (IPC_CHANNELS constant)
- State managed via Zustand stores in `src/context/`
- Credentials encrypted via Electron's safeStorage API

## Commands
- `npm run dev` — Start in development mode
- `npm run build` — Production build
- `npm run dist:win` — Build Windows installer

## Critical Rules
- NEVER expose ipcRenderer directly to renderer
- ALWAYS validate IPC arguments in main process handlers
- NEVER store plaintext credentials
- SSH connections must use connection pooling via SSHConnectionManager
