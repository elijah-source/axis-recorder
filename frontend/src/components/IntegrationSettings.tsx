'use client';

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Check, X, ExternalLink, Database, Globe } from 'lucide-react';
import {
  NotionConfig,
  AxisConfig,
  defaultNotionConfig,
  defaultAxisConfig,
} from '@/types/integrations';
import { testNotionConnection } from '@/services/notionService';
import { testAxisConnection } from '@/services/axisService';

interface IntegrationSettingsProps {
  // Optional callbacks for when settings change
  onNotionConfigChange?: (config: NotionConfig) => void;
  onAxisConfigChange?: (config: AxisConfig) => void;
}

export function IntegrationSettings({
  onNotionConfigChange,
  onAxisConfigChange,
}: IntegrationSettingsProps) {
  // Notion state
  const [notionConfig, setNotionConfig] = useState<NotionConfig>(defaultNotionConfig);
  const [notionTesting, setNotionTesting] = useState(false);
  const [notionTestResult, setNotionTestResult] = useState<'success' | 'error' | null>(null);

  // Axis state
  const [axisConfig, setAxisConfig] = useState<AxisConfig>(defaultAxisConfig);
  const [axisTesting, setAxisTesting] = useState(false);
  const [axisTestResult, setAxisTestResult] = useState<'success' | 'error' | null>(null);

  // Loading state
  const [isLoading, setIsLoading] = useState(true);

  // Load saved configs on mount
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        // Load from Tauri store (or localStorage as fallback)
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
      } catch (error) {
        console.error('Failed to load integration configs:', error);
        // Try localStorage fallback
        try {
          const notionStr = localStorage.getItem('integration_notion');
          const axisStr = localStorage.getItem('integration_axis');
          if (notionStr) setNotionConfig({ ...defaultNotionConfig, ...JSON.parse(notionStr) });
          if (axisStr) setAxisConfig({ ...defaultAxisConfig, ...JSON.parse(axisStr) });
        } catch {
          // Ignore parse errors
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadConfigs();
  }, []);

  // Save Notion config
  const saveNotionConfig = async (config: NotionConfig) => {
    setNotionConfig(config);
    setNotionTestResult(null);

    try {
      await invoke('save_integration_config', {
        integration: 'notion',
        config: config,
      });
    } catch {
      // Fallback to localStorage
      localStorage.setItem('integration_notion', JSON.stringify(config));
    }

    onNotionConfigChange?.(config);
  };

  // Save Axis config
  const saveAxisConfig = async (config: AxisConfig) => {
    setAxisConfig(config);
    setAxisTestResult(null);

    try {
      await invoke('save_integration_config', {
        integration: 'axis',
        config: config,
      });
    } catch {
      // Fallback to localStorage
      localStorage.setItem('integration_axis', JSON.stringify(config));
    }

    onAxisConfigChange?.(config);
  };

  // Test Notion connection
  const handleTestNotion = async () => {
    setNotionTesting(true);
    setNotionTestResult(null);

    const result = await testNotionConnection(notionConfig);

    setNotionTesting(false);
    setNotionTestResult(result.success ? 'success' : 'error');

    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  // Test Axis connection
  const handleTestAxis = async () => {
    setAxisTesting(true);
    setAxisTestResult(null);

    const result = await testAxisConnection(axisConfig);

    setAxisTesting(false);
    setAxisTestResult(result.success ? 'success' : 'error');

    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Notion Integration */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Database className="w-5 h-5 text-gray-700" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">Notion</h3>
            <p className="text-sm text-gray-500">Send meetings to your Notion database</p>
          </div>
          <Switch
            checked={notionConfig.enabled}
            onCheckedChange={(enabled) => saveNotionConfig({ ...notionConfig, enabled })}
          />
        </div>

        {notionConfig.enabled && (
          <div className="space-y-4 mt-4 pt-4 border-t border-gray-100">
            <div className="space-y-2">
              <Label htmlFor="notion-api-key">Integration Token</Label>
              <Input
                id="notion-api-key"
                type="password"
                placeholder="secret_..."
                value={notionConfig.apiKey}
                onChange={(e) => saveNotionConfig({ ...notionConfig, apiKey: e.target.value })}
              />
              <p className="text-xs text-gray-500">
                Create at{' '}
                <a
                  href="https://www.notion.so/my-integrations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  notion.so/my-integrations <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notion-database-id">Database ID</Label>
              <Input
                id="notion-database-id"
                placeholder="abc123..."
                value={notionConfig.databaseId}
                onChange={(e) =>
                  saveNotionConfig({ ...notionConfig, databaseId: e.target.value })
                }
              />
              <p className="text-xs text-gray-500">
                The ID from your database URL (after the workspace name, before the ?)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestNotion}
                disabled={notionTesting || !notionConfig.apiKey || !notionConfig.databaseId}
              >
                {notionTesting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>
              {notionTestResult === 'success' && (
                <span className="text-green-600 flex items-center gap-1 text-sm">
                  <Check className="w-4 h-4" /> Connected
                </span>
              )}
              {notionTestResult === 'error' && (
                <span className="text-red-600 flex items-center gap-1 text-sm">
                  <X className="w-4 h-4" /> Failed
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Axis Integration */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Globe className="w-5 h-5 text-blue-700" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">Axis</h3>
            <p className="text-sm text-gray-500">Send meetings to your Axis knowledge system</p>
          </div>
          <Switch
            checked={axisConfig.enabled}
            onCheckedChange={(enabled) => saveAxisConfig({ ...axisConfig, enabled })}
          />
        </div>

        {axisConfig.enabled && (
          <div className="space-y-4 mt-4 pt-4 border-t border-gray-100">
            <div className="space-y-2">
              <Label htmlFor="axis-url">Axis URL</Label>
              <Input
                id="axis-url"
                type="url"
                placeholder="https://your-instance.axis.app"
                value={axisConfig.url}
                onChange={(e) => saveAxisConfig({ ...axisConfig, url: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="axis-api-key">API Key</Label>
              <Input
                id="axis-api-key"
                type="password"
                placeholder="Your Axis API key"
                value={axisConfig.apiKey}
                onChange={(e) => saveAxisConfig({ ...axisConfig, apiKey: e.target.value })}
              />
              <p className="text-xs text-gray-500">
                Find this in Axis Settings → API Keys
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <Label className="text-sm font-medium">Send Options</Label>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Include transcript</span>
                <Switch
                  checked={axisConfig.sendTranscript}
                  onCheckedChange={(checked) =>
                    saveAxisConfig({ ...axisConfig, sendTranscript: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Include summary</span>
                <Switch
                  checked={axisConfig.sendSummary}
                  onCheckedChange={(checked) =>
                    saveAxisConfig({ ...axisConfig, sendSummary: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Include audio file</span>
                <Switch
                  checked={axisConfig.sendAudio}
                  onCheckedChange={(checked) =>
                    saveAxisConfig({ ...axisConfig, sendAudio: checked })
                  }
                  disabled // Not implemented yet
                />
                <span className="text-xs text-gray-400 ml-2">(coming soon)</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestAxis}
                disabled={axisTesting || !axisConfig.url || !axisConfig.apiKey}
              >
                {axisTesting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>
              {axisTestResult === 'success' && (
                <span className="text-green-600 flex items-center gap-1 text-sm">
                  <Check className="w-4 h-4" /> Connected
                </span>
              )}
              {axisTestResult === 'error' && (
                <span className="text-red-600 flex items-center gap-1 text-sm">
                  <X className="w-4 h-4" /> Failed
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
