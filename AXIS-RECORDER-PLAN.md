# Axis Recorder — Integration Plan

**Fork of:** [Meetily](https://github.com/Zackriya-Solutions/meetily) (MIT License)
**Purpose:** Desktop meeting recorder with local transcription + "Send to Notion/Axis" integrations

---

## Overview

Axis Recorder captures system audio + microphone during meetings, transcribes locally via Whisper, and allows users to send recordings/transcripts/summaries to:

1. **Notion** (Sembly DB) — for immediate use with existing workflows
2. **Axis** — for long-term knowledge system integration

The app runs 100% locally. No audio or transcripts leave the device unless the user explicitly clicks "Send to...".

---

## Integration Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                      AXIS RECORDER (Desktop)                   │
├────────────────────────────────────────────────────────────────┤
│  Recording → Local Whisper → Transcript → Summary (local LLM) │
│                                                                │
│  Meeting Details View:                                         │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ [Save] [Copy] [Send to Notion ▾] [Send to Axis ▾]       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  Settings → Integrations Tab:                                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Notion: [API Key] [Database ID] [Test Connection]       │  │
│  │ Axis:   [URL] [API Key] [Test Connection]               │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                              ↓
              User clicks "Send to Notion" or "Send to Axis"
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         NOTION API                              │
│  POST /v1/pages → Creates entry in Sembly DB                   │
│  Properties: Title, Date, Transcript, Summary, Action Items     │
└─────────────────────────────────────────────────────────────────┘
                              OR
┌─────────────────────────────────────────────────────────────────┐
│                         AXIS API                                │
│  POST /api/meetings/ingest                                      │
│  Body: { title, date, transcript, summary, audio_url? }        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Notion Integration (Sembly DB)

### Data Model (Sembly DB in Notion)

Based on typical Sembly structure:

| Property | Type | Mapping |
|----------|------|---------|
| Name | Title | `meeting.title` |
| Date | Date | `meeting.created_at` |
| Transcript | Text (or relation) | Full transcript text |
| Summary | Text | Summary markdown |
| Action Items | Text | Extracted from summary |
| Participants | Multi-select | From transcript diarization |
| Source | Select | "Axis Recorder" |
| Duration | Number | Recording duration |

### Implementation

1. **Settings Storage** (Tauri store)
   - `notion_api_key: string`
   - `notion_database_id: string`
   - `notion_enabled: boolean`

2. **Notion Service** (`frontend/src/services/notionService.ts`)
   ```typescript
   export async function sendToNotion(meeting: Meeting, config: NotionConfig): Promise<void> {
     const response = await fetch('https://api.notion.com/v1/pages', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${config.apiKey}`,
         'Notion-Version': '2022-06-28',
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({
         parent: { database_id: config.databaseId },
         properties: {
           Name: { title: [{ text: { content: meeting.title } }] },
           Date: { date: { start: meeting.created_at } },
           // ... map other properties
         },
         children: [
           // Transcript as page content
           { object: 'block', type: 'paragraph', paragraph: { rich_text: [...] } }
         ]
       })
     });
   }
   ```

3. **UI Changes**
   - Add "Integrations" tab to Settings (`/settings`)
   - Add "Send to Notion" button in `SummaryUpdaterButtonGroup`
   - Dropdown for options: "Send Transcript", "Send Summary", "Send Both"

---

## Phase 2: Axis Integration

### Axis Ingest Endpoint

New endpoint in Axis codebase:

```go
// POST /api/meetings/ingest
// Receives meeting data from desktop app
type MeetingIngestRequest struct {
    Title       string              `json:"title"`
    Date        time.Time           `json:"date"`
    Transcript  string              `json:"transcript"`
    Summary     string              `json:"summary,omitempty"`
    AudioURL    string              `json:"audio_url,omitempty"`
    Speakers    []string            `json:"speakers,omitempty"`
    ActionItems []string            `json:"action_items,omitempty"`
    Source      string              `json:"source"` // "axis-recorder"
    SourceID    string              `json:"source_id,omitempty"` // local meeting ID for dedup
}
```

### Implementation

1. **Settings Storage** (Tauri store)
   - `axis_url: string` (e.g., "https://elijah.axis.app")
   - `axis_api_key: string`
   - `axis_enabled: boolean`

2. **Axis Service** (`frontend/src/services/axisService.ts`)
   ```typescript
   export async function sendToAxis(meeting: Meeting, config: AxisConfig): Promise<void> {
     const response = await fetch(`${config.url}/api/meetings/ingest`, {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${config.apiKey}`,
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({
         title: meeting.title,
         date: meeting.created_at,
         transcript: meeting.transcript,
         summary: meeting.summary?.markdown,
         source: 'axis-recorder',
         source_id: meeting.id,
       })
     });
   }
   ```

3. **UI Changes**
   - Add Axis config to "Integrations" settings tab
   - Add "Send to Axis" button in `SummaryUpdaterButtonGroup`

---

## Phase 3: Rebranding

### Files to Update

| File | Changes |
|------|---------|
| `frontend/src-tauri/tauri.conf.json` | `productName`, `identifier`, window title |
| `frontend/src-tauri/Cargo.toml` | Package name |
| `frontend/package.json` | Name, description |
| `frontend/src/components/Logo.tsx` | Logo component |
| `frontend/src/app/layout.tsx` | App title, favicon |
| `frontend/public/` | Favicon, icons |
| Various components | "Meetily" → "Axis Recorder" text |

### Color Scheme

TBD — match Axis theme or keep distinct?

---

## File Changes Summary

### New Files

```
frontend/src/services/notionService.ts     # Notion API client
frontend/src/services/axisService.ts       # Axis API client
frontend/src/services/integrationService.ts # Shared integration logic
frontend/src/components/IntegrationSettings.tsx # Settings UI
frontend/src/types/integrations.ts         # Integration types
```

### Modified Files

```
frontend/src/app/settings/page.tsx         # Add "Integrations" tab
frontend/src/components/MeetingDetails/SummaryUpdaterButtonGroup.tsx # Add send buttons
frontend/src/components/MeetingDetails/SummaryPanel.tsx # Wire up send handlers
frontend/src-tauri/tauri.conf.json         # Rebrand
```

---

## Testing Plan

1. **Notion Integration**
   - Create test Notion database matching Sembly schema
   - Record short meeting, send to Notion
   - Verify all fields populated correctly

2. **Axis Integration**
   - Implement `/api/meetings/ingest` in Axis
   - Test from desktop app
   - Verify meeting appears in Axis `/meetings` list
   - Verify BAML analysis runs

3. **End-to-End**
   - Record real meeting
   - Generate summary
   - Send to both Notion and Axis
   - Verify data consistency

---

## Open Questions

1. **Audio Upload:** Should we support uploading audio files to Axis for re-transcription?
2. **Bidirectional Sync:** Should changes in Axis sync back to desktop app?
3. **Auto-Send:** Option to automatically send after recording ends?
4. **Retention:** Honor Axis retention policies on desktop?
