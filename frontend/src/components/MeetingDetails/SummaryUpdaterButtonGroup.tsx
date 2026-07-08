"use client";

import { useState, useEffect, useCallback, RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Copy, Save, Loader2, Send, ChevronDown, Database, Globe, Check } from 'lucide-react';
import { toast } from 'sonner';
import Analytics from '@/lib/analytics';
import { MeetingExportData, NotionConfig, AxisConfig, defaultNotionConfig, defaultAxisConfig } from '@/types/integrations';
import { sendToNotion } from '@/services/notionService';
import { sendToAxis } from '@/services/axisService';
import { invoke } from '@tauri-apps/api/core';
import { Transcript, Summary } from '@/types';
import { BlockNoteSummaryViewRef } from '@/components/AISummary/BlockNoteSummaryView';

interface SummaryUpdaterButtonGroupProps {
  isSaving: boolean;
  isDirty: boolean;
  onSave: () => Promise<void>;
  onCopy: () => Promise<void>;
  onFind?: () => void;
  onOpenFolder: () => Promise<void>;
  hasSummary: boolean;
  // Meeting data for sending to integrations
  meeting?: {
    id: string;
    title: string;
    created_at: string;
  };
  // For fetching transcript text
  transcripts?: Transcript[];
  // For getting summary markdown
  aiSummary?: Summary | null;
  summaryRef?: RefObject<BlockNoteSummaryViewRef | null>;
}

export function SummaryUpdaterButtonGroup({
  isSaving,
  isDirty,
  onSave,
  onCopy,
  onFind,
  onOpenFolder,
  hasSummary,
  meeting,
  transcripts,
  aiSummary,
  summaryRef,
}: SummaryUpdaterButtonGroupProps) {
  // Integration configs
  const [notionConfig, setNotionConfig] = useState<NotionConfig>(defaultNotionConfig);
  const [axisConfig, setAxisConfig] = useState<AxisConfig>(defaultAxisConfig);
  const [isSending, setIsSending] = useState(false);
  const [sentTo, setSentTo] = useState<{ notion?: boolean; axis?: boolean }>({});

  // Load integration configs
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const savedNotionConfig = await invoke<NotionConfig | null>('get_integration_config', {
          integration: 'notion',
        }).catch(() => null);

        const savedAxisConfig = await invoke<AxisConfig | null>('get_integration_config', {
          integration: 'axis',
        }).catch(() => null);

        if (savedNotionConfig) {
          setNotionConfig({ ...defaultNotionConfig, ...savedNotionConfig });
        }
        if (savedAxisConfig) {
          setAxisConfig({ ...defaultAxisConfig, ...savedAxisConfig });
        }
      } catch {
        // Try localStorage fallback
        try {
          const notionStr = localStorage.getItem('integration_notion');
          const axisStr = localStorage.getItem('integration_axis');
          if (notionStr) setNotionConfig({ ...defaultNotionConfig, ...JSON.parse(notionStr) });
          if (axisStr) setAxisConfig({ ...defaultAxisConfig, ...JSON.parse(axisStr) });
        } catch {
          // Ignore parse errors
        }
      }
    };

    loadConfigs();
  }, []);

  // Fetch all transcripts from database (same pattern as useCopyOperations)
  const fetchAllTranscripts = useCallback(async (meetingId: string): Promise<Transcript[]> => {
    try {
      const firstPage = await invoke('api_get_meeting_transcripts', {
        meetingId,
        limit: 1,
        offset: 0,
      }) as { transcripts: Transcript[]; total_count: number; has_more: boolean };

      const totalCount = firstPage.total_count;
      if (totalCount === 0) return [];

      const allData = await invoke('api_get_meeting_transcripts', {
        meetingId,
        limit: totalCount,
        offset: 0,
      }) as { transcripts: Transcript[]; total_count: number; has_more: boolean };

      return allData.transcripts;
    } catch (error) {
      console.error('Failed to fetch transcripts:', error);
      return transcripts || [];
    }
  }, [transcripts]);

  // Get summary markdown (same pattern as useCopyOperations)
  const getSummaryMarkdown = useCallback(async (): Promise<string> => {
    let markdown = '';

    // Try to get from BlockNote ref first
    if (summaryRef?.current?.getMarkdown) {
      try {
        markdown = await summaryRef.current.getMarkdown();
        if (markdown) return markdown;
      } catch {
        // Fall through to other methods
      }
    }

    // Check aiSummary for markdown
    if (aiSummary && 'markdown' in aiSummary) {
      markdown = (aiSummary as any).markdown || '';
      if (markdown) return markdown;
    }

    // Convert legacy format
    if (aiSummary) {
      const sections = Object.entries(aiSummary)
        .filter(([key]) => key !== 'markdown' && key !== 'summary_json' && key !== '_section_order' && key !== 'MeetingName')
        .map(([, section]) => {
          if (section && typeof section === 'object' && 'title' in section && 'blocks' in section) {
            const sectionTitle = `## ${section.title}\n\n`;
            const sectionContent = (section.blocks as any[])
              .map((block: any) => `- ${block.content}`)
              .join('\n');
            return sectionTitle + sectionContent;
          }
          return '';
        })
        .filter(s => s.trim())
        .join('\n\n');
      return sections;
    }

    return '';
  }, [aiSummary, summaryRef]);

  // Build meeting export data
  const getMeetingExportData = useCallback(async (): Promise<MeetingExportData | null> => {
    if (!meeting) return null;

    // Fetch transcripts and summary in parallel
    const [allTranscripts, summaryMarkdown] = await Promise.all([
      fetchAllTranscripts(meeting.id),
      getSummaryMarkdown(),
    ]);

    // Format transcript text
    const transcriptText = allTranscripts
      .map(t => {
        const time = t.audio_start_time !== undefined
          ? `[${Math.floor(t.audio_start_time / 60).toString().padStart(2, '0')}:${Math.floor(t.audio_start_time % 60).toString().padStart(2, '0')}]`
          : t.timestamp;
        return `${time} ${t.text}`;
      })
      .join('\n');

    return {
      id: meeting.id,
      title: meeting.title,
      createdAt: meeting.created_at,
      transcript: transcriptText,
      summaryMarkdown: summaryMarkdown,
    };
  }, [meeting, fetchAllTranscripts, getSummaryMarkdown]);

  // Send to Notion
  const handleSendToNotion = async () => {
    setIsSending(true);
    Analytics.trackButtonClick('send_to_notion', 'meeting_details');

    try {
      const exportData = await getMeetingExportData();
      if (!exportData) {
        toast.error('No meeting data to send');
        setIsSending(false);
        return;
      }

      const result = await sendToNotion(exportData, notionConfig);

      if (result.success) {
        toast.success(result.message);
        setSentTo((prev) => ({ ...prev, notion: true }));
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to send to Notion');
      console.error('Send to Notion error:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Send to Axis
  const handleSendToAxis = async () => {
    setIsSending(true);
    Analytics.trackButtonClick('send_to_axis', 'meeting_details');

    try {
      const exportData = await getMeetingExportData();
      if (!exportData) {
        toast.error('No meeting data to send');
        setIsSending(false);
        return;
      }

      const result = await sendToAxis(exportData, axisConfig);

      if (result.success) {
        toast.success(result.message);
        setSentTo((prev) => ({ ...prev, axis: true }));
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to send to Axis');
      console.error('Send to Axis error:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Check if any integrations are enabled
  const hasEnabledIntegrations = notionConfig.enabled || axisConfig.enabled;

  return (
    <ButtonGroup>
      {/* Save button */}
      <Button
        variant="outline"
        size="sm"
        className={`${isDirty ? 'bg-green-200' : ""}`}
        title={isSaving ? "Saving" : "Save Changes"}
        onClick={() => {
          Analytics.trackButtonClick('save_changes', 'meeting_details');
          onSave();
        }}
        disabled={isSaving}
      >
        {isSaving ? (
          <>
            <Loader2 className="animate-spin" />
            <span className="hidden lg:inline">Saving...</span>
          </>
        ) : (
          <>
            <Save />
            <span className="hidden lg:inline">Save</span>
          </>
        )}
      </Button>

      {/* Copy button */}
      <Button
        variant="outline"
        size="sm"
        title="Copy Summary"
        onClick={() => {
          Analytics.trackButtonClick('copy_summary', 'meeting_details');
          onCopy();
        }}
        disabled={!hasSummary}
        className="cursor-pointer"
      >
        <Copy />
        <span className="hidden lg:inline">Copy</span>
      </Button>

      {/* Send button with dropdown */}
      {hasEnabledIntegrations && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasSummary || isSending}
              className="cursor-pointer"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden lg:inline">Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span className="hidden lg:inline">Send</span>
                  <ChevronDown className="w-3 h-3 ml-1" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {notionConfig.enabled && (
              <DropdownMenuItem
                onClick={handleSendToNotion}
                disabled={isSending}
                className="cursor-pointer"
              >
                <Database className="w-4 h-4 mr-2" />
                Send to Notion
                {sentTo.notion && <Check className="w-4 h-4 ml-auto text-green-600" />}
              </DropdownMenuItem>
            )}
            {axisConfig.enabled && (
              <DropdownMenuItem
                onClick={handleSendToAxis}
                disabled={isSending}
                className="cursor-pointer"
              >
                <Globe className="w-4 h-4 mr-2" />
                Send to Axis
                {sentTo.axis && <Check className="w-4 h-4 ml-auto text-green-600" />}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </ButtonGroup>
  );
}
