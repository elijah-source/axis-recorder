/**
 * Axis Integration Service
 *
 * Sends meeting data to an Axis instance for analysis and knowledge extraction.
 */

import { AxisConfig, MeetingExportData, IntegrationResult } from '@/types/integrations';

/**
 * Test the Axis connection by hitting the health endpoint
 */
export async function testAxisConnection(config: AxisConfig): Promise<IntegrationResult> {
  if (!config.url || !config.apiKey) {
    return {
      success: false,
      message: 'Missing Axis URL or API key',
      error: 'Configuration incomplete',
    };
  }

  try {
    // Normalize URL (remove trailing slash)
    const baseUrl = config.url.replace(/\/$/, '');

    // Try the ingest endpoint with a HEAD request or a simple auth check
    const response = await fetch(`${baseUrl}/api/meetings/ingest`, {
      method: 'OPTIONS',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
      },
    });

    // If OPTIONS isn't supported, try a GET to the health endpoint
    if (!response.ok) {
      const healthResponse = await fetch(`${baseUrl}/api/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
        },
      });

      if (healthResponse.ok) {
        return {
          success: true,
          message: `Connected to Axis at ${baseUrl}`,
        };
      }

      // Try one more approach: just verify the URL is reachable
      const pingResponse = await fetch(baseUrl, { method: 'HEAD' });
      if (pingResponse.ok || pingResponse.status === 401 || pingResponse.status === 403) {
        // Server is reachable, auth might be the issue if 401/403
        return {
          success: pingResponse.status !== 401 && pingResponse.status !== 403,
          message: pingResponse.ok
            ? `Connected to Axis at ${baseUrl}`
            : 'Axis server reachable but authentication failed. Check your API key.',
          error: pingResponse.ok ? undefined : 'auth_error',
        };
      }
    }

    return {
      success: true,
      message: `Connected to Axis at ${baseUrl}`,
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
 * Send meeting data to Axis
 */
export async function sendToAxis(
  meeting: MeetingExportData,
  config: AxisConfig
): Promise<IntegrationResult> {
  if (!config.enabled) {
    return {
      success: false,
      message: 'Axis integration is disabled',
      error: 'disabled',
    };
  }

  if (!config.url || !config.apiKey) {
    return {
      success: false,
      message: 'Missing Axis URL or API key',
      error: 'configuration_incomplete',
    };
  }

  try {
    const baseUrl = config.url.replace(/\/$/, '');

    // Build the request payload
    const payload: Record<string, any> = {
      title: meeting.title || 'Untitled Meeting',
      date: meeting.createdAt,
      source: 'axis-recorder',
      source_id: meeting.id,
    };

    // Add transcript if enabled
    if (config.sendTranscript && meeting.transcript) {
      payload.transcript = meeting.transcript;
    }

    // Add summary if enabled
    if (config.sendSummary && (meeting.summaryMarkdown || meeting.summary)) {
      payload.summary = meeting.summaryMarkdown || meeting.summary;
    }

    // Add speakers if available
    if (meeting.speakers && meeting.speakers.length > 0) {
      payload.speakers = meeting.speakers;
    }

    // Add action items if available
    if (meeting.actionItems && meeting.actionItems.length > 0) {
      payload.action_items = meeting.actionItems;
    }

    // Add duration if available
    if (meeting.duration) {
      payload.duration_seconds = meeting.duration;
    }

    // Send to Axis
    const response = await fetch(`${baseUrl}/api/meetings/ingest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const error = await response.json();
        errorMessage = error.message || error.error || response.statusText;
      } catch {
        // Response wasn't JSON, use status text
      }

      return {
        success: false,
        message: `Failed to send to Axis: ${errorMessage}`,
        error: response.status === 401 ? 'auth_error' : 'api_error',
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: 'Meeting sent to Axis successfully',
      externalId: data.id || data.meeting_id,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to send to Axis: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: 'network_error',
    };
  }
}

/**
 * Upload audio file to Axis (if supported)
 */
export async function uploadAudioToAxis(
  audioPath: string,
  meetingId: string,
  config: AxisConfig
): Promise<IntegrationResult> {
  if (!config.sendAudio) {
    return {
      success: true,
      message: 'Audio upload skipped (disabled in settings)',
    };
  }

  // TODO: Implement audio upload
  // This would require reading the file via Tauri and sending as multipart/form-data
  return {
    success: false,
    message: 'Audio upload not yet implemented',
    error: 'not_implemented',
  };
}
