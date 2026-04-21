import { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import ConversationSettings from './ConversationSettings';
import { getVersionString } from '@/lib/version';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
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

export default function SettingsDialog({
  open,
  onClose,
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
}: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    // Handle escape key to close
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  // Don't render if not open
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30 dark:bg-white/10 overflow-y-auto">
      <div 
        ref={dialogRef}
        className="bg-card rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto transform transition-all animate-fade-in-up border border-border"
      >
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-xl font-medium text-foreground">Settings</h2>
            <div className="text-xs text-muted-foreground mt-1">
              SiLynkr {getVersionString()} by <a href="https://si4k.me" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Si4k</a>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-muted-foreground hover:text-foreground focus:outline-none"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-5">
          <ConversationSettings
            systemPrompt={systemPrompt}
            setSystemPrompt={setSystemPrompt}
            temperature={temperature}
            setTemperature={setTemperature}
            useConversationHistory={useConversationHistory}
            setUseConversationHistory={setUseConversationHistory}
            historyLength={historyLength}
            setHistoryLength={setHistoryLength}
            mongodbUri={mongodbUri}
            setMongodbUri={setMongodbUri}
            saveMongoDbUri={saveMongoDbUri}
            usingLocalStorage={usingLocalStorage}
            autoSave={autoSave}
            setAutoSave={setAutoSave}
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
            ollamaConnectionMode={ollamaConnectionMode}
            setOllamaConnectionMode={setOllamaConnectionMode}
            ollamaBaseUrl={ollamaBaseUrl}
            setOllamaBaseUrl={setOllamaBaseUrl}
            saveOllamaConnection={saveOllamaConnection}
          />
        </div>
        
        <div className="p-4 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-md shadow-sm text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
} 