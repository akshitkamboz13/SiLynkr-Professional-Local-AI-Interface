import React from 'react';
import { Database } from 'lucide-react';
import AdvancedSettings from './AdvancedSettings';

interface ConversationSettingsProps {
  systemPrompt: string;
  setSystemPrompt: (value: string) => void;
  temperature: number;
  setTemperature: (value: number) => void;
  useConversationHistory: boolean;
  setUseConversationHistory: (value: boolean) => void;
  historyLength: number;
  setHistoryLength: (value: number) => void;
  mongodbUri: string;
  setMongodbUri: (value: string) => void;
  saveMongoDbUri: () => void;
  usingLocalStorage: boolean;
  autoSave: boolean;
  setAutoSave: (value: boolean) => void;
  // Advanced settings props
  formatOption: string;
  setFormatOption: (value: string) => void;
  topP: number;
  setTopP: (value: number) => void;
  topK: number;
  setTopK: (value: number) => void;
  suffixText: string;
  setSuffixText: (value: string) => void;
  customTemplate: string;
  setCustomTemplate: (value: string) => void;
  keepAliveOption: string;
  setKeepAliveOption: (value: string) => void;
  thinkingEnabled: boolean;
  setThinkingEnabled: (value: boolean) => void;
  rawModeEnabled: boolean;
  setRawModeEnabled: (value: boolean) => void;
  ollamaConnectionMode: 'server-proxy' | 'browser-local';
  setOllamaConnectionMode: (value: 'server-proxy' | 'browser-local') => void;
  ollamaBaseUrl: string;
  setOllamaBaseUrl: (value: string) => void;
  saveOllamaConnection: () => void;
}

export default function ConversationSettings({
  systemPrompt,
  setSystemPrompt,
  temperature,
  setTemperature,
  useConversationHistory,
  setUseConversationHistory,
  historyLength,
  setHistoryLength,
  mongodbUri,
  setMongodbUri,
  saveMongoDbUri,
  usingLocalStorage,
  autoSave,
  setAutoSave,
  // Advanced settings
  formatOption,
  setFormatOption,
  topP,
  setTopP,
  topK,
  setTopK,
  suffixText,
  setSuffixText,
  customTemplate,
  setCustomTemplate,
  keepAliveOption,
  setKeepAliveOption,
  thinkingEnabled,
  setThinkingEnabled,
  rawModeEnabled,
  setRawModeEnabled,
  ollamaConnectionMode,
  setOllamaConnectionMode,
  ollamaBaseUrl,
  setOllamaBaseUrl,
  saveOllamaConnection,
}: ConversationSettingsProps) {
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="system-prompt" className="block text-sm font-medium text-foreground mb-1">
          System Prompt
        </label>
        <textarea
          id="system-prompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are a helpful assistant..."
          rows={3}
          className="w-full p-2 border border-border rounded-md bg-card text-card-foreground"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Temperature: {temperature.toFixed(1)}
        </label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>Precise</span>
          <span>Balanced</span>
          <span>Creative</span>
        </div>
      </div>

      <div className="pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <label htmlFor="use-history" className="block text-sm font-medium text-foreground">
            Use conversation history
          </label>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              id="use-history"
              checked={useConversationHistory}
              onChange={() => setUseConversationHistory(!useConversationHistory)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all border-border peer-checked:bg-primary"></div>
          </label>
        </div>
        
        <div className={useConversationHistory ? "" : "opacity-50 pointer-events-none"}>
          <label className="block text-sm font-medium text-foreground mt-2 mb-1">
            History length: {historyLength} messages
          </label>
          <input
            type="range"
            min="1"
            max="20"
            step="1"
            value={historyLength}
            onChange={(e) => setHistoryLength(parseInt(e.target.value))}
            disabled={!useConversationHistory}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Short</span>
            <span>Medium</span>
            <span>Long</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Includes up to {historyLength} previous messages as context for the AI.
            Longer history helps maintain context but uses more tokens.
          </p>
        </div>
      </div>

      <div className="pt-2 border-t border-border">
        <label className="block text-sm font-medium text-foreground mb-1">
          Ollama Connection Mode
        </label>
        <div className="space-y-2">
          <select
            value={ollamaConnectionMode}
            onChange={(e) => setOllamaConnectionMode(e.target.value as 'server-proxy' | 'browser-local')}
            className="w-full p-2 themed-select focus:ring-2 focus:ring-primary"
          >
            <option value="server-proxy">Server Proxy (recommended for localhost:49494)</option>
            <option value="browser-local">Browser Local (hosted site + your local Ollama)</option>
          </select>

          {ollamaConnectionMode === 'browser-local' && (
            <div className="space-y-2">
              <input
                type="text"
                value={ollamaBaseUrl}
                onChange={(e) => setOllamaBaseUrl(e.target.value)}
                placeholder="http://127.0.0.1:11434/api"
                className="w-full p-2 border border-border rounded-md bg-card text-card-foreground"
              />
              <button
                onClick={saveOllamaConnection}
                className="bg-primary hover:bg-primary-hover text-primary-foreground px-3 py-2 rounded-md text-sm"
              >
                Save Ollama Connection
              </button>
              <p className="text-xs text-muted-foreground">
                Use this when running from a hosted website but want to use Ollama on your current device.
                If your browser blocks localhost access from HTTPS, run the full local app at http://localhost:49494.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="pt-2 border-t border-border">
        <label htmlFor="mongodb-uri" className="flex items-center gap-1 text-sm font-medium text-foreground mb-1">
          <Database size={16} />
          MongoDB Connection URI
        </label>
        <div className="flex items-center gap-2">
          <input
            id="mongodb-uri"
            type="text"
            value={mongodbUri}
            onChange={(e) => setMongodbUri(e.target.value)}
            placeholder="mongodb://username:password@host:port/database or mongodb://localhost:27017/mydatabase or leave empty for local storage"
            className="flex-1 p-2 border border-border rounded-md bg-card text-card-foreground"
          />
          <button
            onClick={saveMongoDbUri}
            className="whitespace-nowrap bg-primary hover:bg-primary-hover text-primary-foreground px-3 py-2 rounded-md text-sm"
          >
            Save
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {usingLocalStorage 
            ? "Currently using local storage fallback. Add a MongoDB URI (or set server-side MONGODB_URI) to enable persistent storage."
            : (mongodbUri
                ? "Using MongoDB for conversation storage. Clear the field and save to use server-side MongoDB (if configured) or local storage fallback."
                : "Using server-side MongoDB (MONGODB_URI). You can paste a URI above to override it from this browser.")}
        </p>
      </div>

      <div className="pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <label htmlFor="auto-save" className="block text-sm font-medium text-foreground">
            Auto-save conversations
          </label>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              id="auto-save"
              checked={autoSave}
              onChange={() => setAutoSave(!autoSave)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all border-border peer-checked:bg-primary"></div>
          </label>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          When enabled, conversations will be automatically saved after each AI response.
        </p>
      </div>

      {/* Advanced Ollama Parameters */}
      <AdvancedSettings
        formatOption={formatOption}
        setFormatOption={setFormatOption}
        topP={topP}
        setTopP={setTopP}
        topK={topK}
        setTopK={setTopK}
        suffixText={suffixText}
        setSuffixText={setSuffixText}
        customTemplate={customTemplate}
        setCustomTemplate={setCustomTemplate}
        keepAliveOption={keepAliveOption}
        setKeepAliveOption={setKeepAliveOption}
        thinkingEnabled={thinkingEnabled}
        setThinkingEnabled={setThinkingEnabled}
        rawModeEnabled={rawModeEnabled}
        setRawModeEnabled={setRawModeEnabled}
      />
    </div>
  );
} 