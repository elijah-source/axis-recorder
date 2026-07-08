/**
 * Notion Integration Service
 *
 * Sends meeting data to a Notion database (e.g., Sembly DB).
 * Uses the Notion API v2022-06-28.
 */

import { NotionConfig, MeetingExportData, IntegrationResult } from '@/types/integrations';

const NOTION_API_VERSION = '2022-06-28';
const NOTION_API_BASE = 'https://api.notion.com/v1';

/**
 * Test the Notion connection by fetching database info
 */
export async function testNotionConnection(config: NotionConfig): Promise<IntegrationResult> {
  if (!config.apiKey || !config.databaseId) {
    return {
      success: false,
      message: 'Missing API key or database ID',
      error: 'Configuration incomplete',
    };
  }

  try {
    const response = await fetch(`${NOTION_API_BASE}/databases/${config.databaseId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Notion-Version': NOTION_API_VERSION,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        message: `Notion API error: ${error.message || response.statusText}`,
        error: error.code || 'api_error',
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: `Connected to database: ${data.title?.[0]?.plain_text || config.databaseId}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: 'network_error',
    };
  }
}

/**
 * Send meeting data to Notion
 */
export async function sendToNotion(
  meeting: MeetingExportData,
  config: NotionConfig
): Promise<IntegrationResult> {
  if (!config.enabled) {
    return {
      success: false,
      message: 'Notion integration is disabled',
      error: 'disabled',
    };
  }

  if (!config.apiKey || !config.databaseId) {
    return {
      success: false,
      message: 'Missing API key or database ID',
      error: 'configuration_incomplete',
    };
  }

  const mappings = config.propertyMappings || {
    title: 'Name',
    date: 'Date',
    transcript: 'Transcript',
    summary: 'Summary',
    actionItems: 'Action Items',
    source: 'Source',
  };

  try {
    // Build properties object
    const properties: Record<string, any> = {};

    // Title (required)
    if (mappings.title) {
      properties[mappings.title] = {
        title: [{ text: { content: meeting.title || 'Untitled Meeting' } }],
      };
    }

    // Date
    if (mappings.date && meeting.createdAt) {
      properties[mappings.date] = {
        date: { start: meeting.createdAt.split('T')[0] }, // Just the date part
      };
    }

    // Source tag
    if (mappings.source) {
      properties[mappings.source] = {
        select: { name: 'Axis Recorder' },
      };
    }

    // Build page content (children blocks)
    const children: any[] = [];

    // Summary section
    if (meeting.summaryMarkdown || meeting.summary) {
      children.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Summary' } }],
        },
      });

      // Split summary into paragraphs (Notion has 2000 char limit per block)
      const summaryText = meeting.summaryMarkdown || meeting.summary || '';
      const chunks = splitTextIntoChunks(summaryText, 1900);
      for (const chunk of chunks) {
        children.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: chunk } }],
          },
        });
      }
    }

    // Action items section
    if (meeting.actionItems && meeting.actionItems.length > 0) {
      children.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Action Items' } }],
        },
      });

      for (const item of meeting.actionItems) {
        children.push({
          object: 'block',
          type: 'to_do',
          to_do: {
            rich_text: [{ type: 'text', text: { content: item } }],
            checked: false,
          },
        });
      }
    }

    // Transcript section
    if (meeting.transcript) {
      children.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Transcript' } }],
        },
      });

      children.push({
        object: 'block',
        type: 'toggle',
        toggle: {
          rich_text: [{ type: 'text', text: { content: 'Click to expand transcript' } }],
          children: splitTextIntoChunks(meeting.transcript, 1900).map(chunk => ({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: chunk } }],
            },
          })),
        },
      });
    }

    // Create the page
    const response = await fetch(`${NOTION_API_BASE}/pages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Notion-Version': NOTION_API_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { database_id: config.databaseId },
        properties,
        children: children.slice(0, 100), // Notion limit: 100 blocks per request
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        message: `Failed to create Notion page: ${error.message || response.statusText}`,
        error: error.code || 'api_error',
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: 'Meeting sent to Notion successfully',
      externalId: data.id,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to send to Notion: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: 'network_error',
    };
  }
}

/**
 * Split text into chunks of max length, breaking at word boundaries
 */
function splitTextIntoChunks(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find last space before maxLength
    let splitIndex = remaining.lastIndexOf(' ', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      // No good split point, just cut at maxLength
      splitIndex = maxLength;
    }

    chunks.push(remaining.substring(0, splitIndex));
    remaining = remaining.substring(splitIndex).trimStart();
  }

  return chunks;
}
