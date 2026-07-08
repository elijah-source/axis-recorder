# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Capture** is a privacy-first meeting recorder that captures, transcribes, and summarizes meetings entirely on local infrastructure. Fork of Meetily with Notion and Axis integrations added.

**Key differentiator**: One-click export to Notion (Sembly DB) or Axis knowledge system.

1. **Frontend**: Tauri-based desktop application (Rust + Next.js + TypeScript)
2. **Rust Backend**: Tauri commands, audio capture, transcription, storage, and summarization orchestration
3. **Integrations**: Notion API + Axis API for sending transcripts and summaries

### Key Technology Stack
- **Desktop App**: Tauri 2.x (Rust) + Next.js 14 + React 18
- **Audio Processing**: Rust (cpal, whisper-rs, professional audio mixing)
- **Transcription**: Whisper.cpp / whisper-rs and Parakeet (local, no cloud)
- **LLM Integration**: Ollama (local), Claude, Groq, OpenRouter
- **Integrations**: Notion API, Axis `/api/meetings/ingest`

## Essential Development Commands

### Frontend Development (Tauri Desktop App)

**Location**: `/frontend`

```bash
# macOS Development
./clean_run.sh              # Clean build and run with info logging
./clean_run.sh debug        # Run with debug logging
./clean_build.sh            # Production build

# Manual Commands
pnpm install                # Install dependencies
pnpm run dev                # Next.js dev server (port 3118)
pnpm run tauri:dev          # Full Tauri development mode
pnpm run tauri:build        # Production build

# GPU-Specific Builds (for testing acceleration)
pnpm run tauri:dev:metal    # macOS Metal GPU
pnpm run tauri:dev:cuda     # NVIDIA CUDA
pnpm run tauri:dev:vulkan   # AMD/Intel Vulkan
pnpm run tauri:dev:cpu      # CPU-only (no GPU)
```

### Service Endpoints
- **Frontend Dev**: http://localhost:3118

## Integrations

### Notion Integration
- **Service**: `frontend/src/services/notionService.ts`
- **Config**: Settings → Integrations → Notion API Key + Database ID
- **Sends**: Title, Date, Summary, Action Items, Transcript (as toggle block)

### Axis Integration
- **Service**: `frontend/src/services/axisService.ts`
- **Config**: Settings → Integrations → Axis URL + API Key
- **Sends**: Title, Date, Transcript, Summary to `POST /api/meetings/ingest`
- **Options**: Toggle transcript/summary/audio inclusion

### Integration Settings
- **Component**: `frontend/src/components/IntegrationSettings.tsx`
- **Types**: `frontend/src/types/integrations.ts`
- **Storage**: Tauri store (with localStorage fallback)

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Capture Desktop App                          │
│  ┌──────────────────┐  ┌─────────────────┐  ┌────────────────┐ │
│  │   Next.js UI     │  │  Rust Backend   │  │ Whisper Engine │ │
│  │  (React/TS)      │←→│  (Audio + IPC)  │←→│  (Local STT)   │ │
│  └──────────────────┘  └─────────────────┘  └────────────────┘ │
│         ↑ Tauri Events           ↑ Audio Pipeline               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
              User clicks "Send to Notion" or "Send to Axis"
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     External Services                           │
│  ┌─────────────────────┐     ┌─────────────────────┐           │
│  │   Notion API        │     │   Axis Instance     │           │
│  │   (Sembly DB)       │     │   /api/meetings     │           │
│  └─────────────────────┘     └─────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## Key Files Reference

**Integrations**:
- [frontend/src/services/notionService.ts](frontend/src/services/notionService.ts) - Notion API client
- [frontend/src/services/axisService.ts](frontend/src/services/axisService.ts) - Axis API client
- [frontend/src/components/IntegrationSettings.tsx](frontend/src/components/IntegrationSettings.tsx) - Settings UI
- [frontend/src/types/integrations.ts](frontend/src/types/integrations.ts) - Integration types

**UI**:
- [frontend/src/components/MeetingDetails/SummaryUpdaterButtonGroup.tsx](frontend/src/components/MeetingDetails/SummaryUpdaterButtonGroup.tsx) - Send buttons
- [frontend/src/app/settings/page.tsx](frontend/src/app/settings/page.tsx) - Settings with Integrations tab

**Core (inherited from Meetily)**:
- [frontend/src-tauri/src/lib.rs](frontend/src-tauri/src/lib.rs) - Main Tauri entry point
- [frontend/src-tauri/src/audio/](frontend/src-tauri/src/audio/) - Audio capture pipeline
- [frontend/src-tauri/src/whisper_engine/](frontend/src-tauri/src/whisper_engine/) - Local transcription

## Common Development Tasks

### Adding a New Integration

1. Create service file: `frontend/src/services/{name}Service.ts`
2. Add config type in `frontend/src/types/integrations.ts`
3. Add UI to `frontend/src/components/IntegrationSettings.tsx`
4. Add send handler in `SummaryUpdaterButtonGroup.tsx`

### Testing Integrations

1. Start dev server: `pnpm run tauri:dev`
2. Go to Settings → Integrations
3. Configure API keys / URLs
4. Test Connection
5. Record a meeting, generate summary
6. Click Send button

## Platform Notes

### macOS
- **Audio Capture**: ScreenCaptureKit for system audio
- **GPU**: Metal + CoreML automatically enabled
- **Permissions**: Microphone + Screen Recording required

### Windows
- **Audio Capture**: WASAPI
- **GPU**: CUDA or Vulkan via Cargo features

## Repository Info

- **Upstream**: [Zackriya-Solutions/meetily](https://github.com/Zackriya-Solutions/meetily)
- **Fork**: [elijah-source/axis-recorder](https://github.com/elijah-source/axis-recorder)
- **License**: MIT
- **By**: Complete Context Computing
