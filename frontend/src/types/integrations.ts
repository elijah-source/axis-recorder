// Integration configuration types

export interface NotionConfig {
  enabled: boolean;
  apiKey: string;
  databaseId: string;
  // Property mappings for the Sembly DB schema
  propertyMappings?: {
    title?: string;      // Default: "Name"
    date?: string;       // Default: "Date"
    transcript?: string; // Default: "Transcript"
    summary?: string;    // Default: "Summary"
    actionItems?: string; // Default: "Action Items"
    source?: string;     // Default: "Source"
  };
}

export interface AxisConfig {
  enabled: boolean;
  url: string;          // e.g., "https://elijah.axis.app"
  apiKey: string;
  // Options for what to send
  sendTranscript: boolean;
  sendSummary: boolean;
  sendAudio: boolean;
}

export interface IntegrationConfigs {
  notion: NotionConfig;
  axis: AxisConfig;
}

// Default configurations
export const defaultNotionConfig: NotionConfig = {
  enabled: false,
  apiKey: '',
  databaseId: '',
  propertyMappings: {
    title: 'Name',
    date: 'Date',
    transcript: 'Transcript',
    summary: 'Summary',
    actionItems: 'Action Items',
    source: 'Source',
  },
};

export const defaultAxisConfig: AxisConfig = {
  enabled: false,
  url: '',
  apiKey: '',
  sendTranscript: true,
  sendSummary: true,
  sendAudio: false,
};

// Meeting data structure for sending
export interface MeetingExportData {
  id: string;
  title: string;
  createdAt: string;
  transcript: string;
  summary?: string;
  summaryMarkdown?: string;
  actionItems?: string[];
  speakers?: string[];
  duration?: number;
  audioPath?: string;
}

// Response types
export interface IntegrationResult {
  success: boolean;
  message: string;
  externalId?: string; // ID in the external system (Notion page ID, Axis meeting ID)
  error?: string;
}
