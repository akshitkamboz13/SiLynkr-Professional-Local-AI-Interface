'use client';

import { useState, useEffect, FormEvent, useRef, DragEvent, useLayoutEffect, useCallback } from 'react';
import { ModelInfo } from '../../services/ollamaService';
import ChatMessage from './ChatMessage';
import { useRouter } from 'next/navigation';
import { Menu, X, Plus, Settings, Folder as FolderIcon, Tag as TagIcon, Share, Moon, Sun, Database, MessageSquare, AlertCircle, Info, Edit, FolderPlus, Palette, Pause } from 'lucide-react';
import { Message, truncateConversationHistory, createPromptWithHistory, createPromptWithHistoryAndFeedback } from '@/lib/conversationUtils';
import ShareDialog from './ShareDialog';
import SettingsDialog from './SettingsDialog';
import { getVersionString, getVersionInfo } from '@/lib/version';
import Image from 'next/image';
import PortIndicator from './PortIndicator';
import { ThemeType, CustomThemeColors } from './ThemeManager';
import ThemeManager from './ThemeManager';
import { applyTheme, getStoredTheme, getStoredCustomColors } from '../lib/ThemeService';
import { exportTheme as exportThemeToFile, importTheme as importThemeFromFile } from '@/lib/ThemeService';
import { ThemeExport } from './ThemeManager';

interface Folder {
  _id: string;
  name: string;
  color?: string;
  parentId?: string | null;
  path?: string;
  level?: number;
}

interface Tag {
  _id: string;
  name: string;
  color?: string;
}

interface SavedConversation {
  _id: string;
  title: string;
  messages: Message[];
  model: string;
  folderId?: string | { _id: string } | null;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface ChatInterfaceProps {
  conversationId?: string;
}

type OllamaConnectionMode = 'server-proxy' | 'browser-local';

const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434/api';

interface DragItem {
  type: 'conversation' | 'folder';
  id: string;
  folderId?: string | null;
}

// Update the folder context menu interface to include renaming
interface FolderContextMenu {
  show: boolean;
  x: number;
  y: number;
  folder: Folder | null;
  isRenaming?: boolean;
}

// Update the conversation context menu to include renaming
interface ConversationContextMenu {
  show: boolean;
  x: number;
  y: number;
  conversation: SavedConversation | null;
  isRenaming?: boolean;
}

export default function ChatInterface({ conversationId }: ChatInterfaceProps = {}) {
  // Remove the CSS effect setup, we'll use direct inline styles instead
  
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [streamingMessageIndex, setStreamingMessageIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [temperature, setTemperature] = useState<number>(0.7);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [theme, setTheme] = useState<ThemeType>('light');
  const [customThemeColors, setCustomThemeColors] = useState<CustomThemeColors>(getStoredCustomColors());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(256); // Default width of 256px (64 in rem units)
  const [isResizing, setIsResizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // Add this missing state variable
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsView, setSettingsView] = useState<'general' | 'advanced' | 'appearance' | 'updates'>('general');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [shareSettings, setShareSettings] = useState({
    isPublic: false,
    allowComments: false,
    expiresAt: null
  });
  const [mongodbUri, setMongodbUri] = useState<string>('');
  const [ollamaConnectionMode, setOllamaConnectionMode] = useState<OllamaConnectionMode>('server-proxy');
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState<string>(DEFAULT_OLLAMA_BASE_URL);
  const [usingLocalStorage, setUsingLocalStorage] = useState<boolean>(true);
  const [clientId, setClientId] = useState<string>('');
  const [settingsLoaded, setSettingsLoaded] = useState<boolean>(false);
  const [historyLength, setHistoryLength] = useState<number>(10);
  const [useConversationHistory, setUseConversationHistory] = useState<boolean>(true);
  const [promptTokens, setPromptTokens] = useState<number>(0);
  const [completionTokens, setCompletionTokens] = useState<number>(0);
  const [totalTokens, setTotalTokens] = useState<number>(0);
  const [showTokenUsage, setShowTokenUsage] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [toastFading, setToastFading] = useState<boolean>(false);
  const [autoSave, setAutoSave] = useState<boolean>(false);
  const [lastConversationSaved, setLastConversationSaved] = useState<boolean>(true);
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState<boolean>(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [showNewFolderInput, setShowNewFolderInput] = useState<boolean>(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<ConversationContextMenu>({
    show: false,
    x: 0,
    y: 0,
    conversation: null,
    isRenaming: false
  });
  const [showMoveDialog, setShowMoveDialog] = useState<boolean>(false);
  const [conversationToMove, setConversationToMove] = useState<SavedConversation | null>(null);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  const [folderToMove, setFolderToMove] = useState<Folder | null>(null);
  const [isFolderMove, setIsFolderMove] = useState<boolean>(false);
  const [showShareDialog, setShowShareDialog] = useState<boolean>(false);
  const [formatOption, setFormatOption] = useState<string>('');
  const [thinkingEnabled, setThinkingEnabled] = useState<boolean>(false);
  const [keepAliveOption, setKeepAliveOption] = useState<string>('5m');
  const [rawModeEnabled, setRawModeEnabled] = useState<boolean>(false);
  const [advancedOptionsOpen, setAdvancedOptionsOpen] = useState<boolean>(false);
  const [topP, setTopP] = useState<number>(0.9);
  const [topK, setTopK] = useState<number>(40);
  const [suffixText, setSuffixText] = useState<string>('');
  const [customTemplate, setCustomTemplate] = useState<string>('');
  const [showSettingsDialog, setShowSettingsDialog] = useState<boolean>(false);
  const [folderContextMenu, setFolderContextMenu] = useState<FolderContextMenu>({
    show: false,
    x: 0,
    y: 0,
    folder: null,
    isRenaming: false
  });
  
  // Add new state variables for message versions and editing
  const [messageVersions, setMessageVersions] = useState<Record<number, string[]>>({});
  const [currentMessageVersions, setCurrentMessageVersions] = useState<Record<number, number>>({});
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [feedbackMessages, setFeedbackMessages] = useState<Record<number, 'liked' | 'disliked' | null>>({});
  
  // Add new state for version notification
  const [showVersionNotification, setShowVersionNotification] = useState(true);
  
  // Add additional useRef hooks at the component level
  const newFolderInputRef = useRef<HTMLDivElement>(null);
  
  // Add state for delete target
  const [showDeleteTarget, setShowDeleteTarget] = useState<boolean>(false);
  const [deleteTargetActive, setDeleteTargetActive] = useState<boolean>(false);
  // Add state for custom confirmation dialog
  const [confirmDelete, setConfirmDelete] = useState<{
    show: boolean;
    type: 'conversation' | 'folder' | null;
    item: SavedConversation | Folder | null;
    title: string;
  }>({
    show: false,
    type: null,
    item: null,
    title: ''
  });
  
  const router = useRouter();

  const normalizeOllamaBaseUrl = (url: string) => {
    const trimmed = (url || '').trim();
    if (!trimmed) return DEFAULT_OLLAMA_BASE_URL;
    return trimmed.replace(/\/+$/, '');
  };

  const getUsingBrowserLocalOllama = () => ollamaConnectionMode === 'browser-local';

  const getOllamaModelsEndpoint = () => {
    if (getUsingBrowserLocalOllama()) {
      return `${normalizeOllamaBaseUrl(ollamaBaseUrl)}/tags`;
    }
    return '/api/models';
  };

  const getOllamaGenerateEndpoint = () => {
    if (getUsingBrowserLocalOllama()) {
      return `${normalizeOllamaBaseUrl(ollamaBaseUrl)}/generate`;
    }
    return '/api/generate';
  };

  const createGenerateRequestBody = (
    model: string,
    promptWithHistory: string,
    rawPrompt: string,
    conversationHistory: Message[]
  ) => {
    const commonPayload = {
      model,
      prompt: promptWithHistory,
      system: systemPrompt,
      stream: true,
      options: {
        temperature,
        top_p: topP,
        top_k: topK
      },
      suffix: suffixText || undefined,
      format: formatOption || undefined,
      template: customTemplate || undefined,
      think: thinkingEnabled,
      raw: rawModeEnabled,
      keep_alive: keepAliveOption,
    };

    if (getUsingBrowserLocalOllama()) {
      return commonPayload;
    }

    return {
      ...commonPayload,
      rawPrompt,
      conversationHistory: useConversationHistory
        ? conversationHistory.map(msg => ({
            role: msg.role,
            content: msg.content,
            feedback: msg.feedback,
            comments: msg.comments
          }))
        : []
    };
  };

  // Abort controller to allow pausing/stopping a streaming generation.
  const generationAbortControllerRef = useRef<AbortController | null>(null);

  const pauseGeneration = () => {
    if (generationAbortControllerRef.current) {
      generationAbortControllerRef.current.abort();
      generationAbortControllerRef.current = null;
    }
    setLoading(false);
    setStreamingMessageIndex(null);
    showToast('Paused generation', 'info');
  };
  
  // Handle URL parameters
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const modelParam = params.get('model');
    const tempParam = params.get('temperature');
    const systemPromptParam = params.get('systemPrompt');
    
    if (modelParam && models.some(m => m.name === modelParam)) {
      setSelectedModel(modelParam);
    }
    
    if (tempParam) {
      const temp = parseFloat(tempParam);
      if (!isNaN(temp) && temp >= 0 && temp <= 2) {
        setTemperature(temp);
      }
    }
    
    if (systemPromptParam) {
      setSystemPrompt(systemPromptParam);
    }
  }, [models]);
  
  // Fetch folders and tags
  useEffect(() => {
    async function fetchFoldersAndTags() {
      try {
        // Get MongoDB URI from localStorage if available
        const storedMongoUri = typeof window !== 'undefined'
          ? localStorage.getItem('MONGODB_URI') || ''
          : '';

        console.log('Fetching folders and tags with MongoDB URI:', storedMongoUri ? 'URI provided' : 'No URI');

        const [foldersRes, tagsRes] = await Promise.all([
          fetch('/api/folders', {
            headers: {
              'X-MongoDB-URI': storedMongoUri
            }
          }),
          fetch('/api/tags', {
            headers: {
              'X-MongoDB-URI': storedMongoUri
            }
          })
        ]);
        
        const foldersData = await foldersRes.json();
        const tagsData = await tagsRes.json();
        
        if (foldersData.success && foldersData.folders) {
          console.log(`Successfully fetched ${foldersData.folders.length} folders`);
          setFolders(foldersData.folders);
        } else {
          console.error('Failed to fetch folders:', foldersData.error || 'No error message provided');
        }

        if (tagsData.success && tagsData.tags) {
          console.log(`Successfully fetched ${tagsData.tags.length} tags`);
          setTags(tagsData.tags);
        } else {
          console.error('Failed to fetch tags:', tagsData.error || 'No error message provided');
        }
      } catch (err) {
        console.error('Error fetching folders and tags:', err);
        showToast('Error loading folders. Check console for details.', 'error');
      }
    }
    
    fetchFoldersAndTags();
  }, []);
  
  // Initialize MongoDB URI from localStorage if available
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUri = localStorage.getItem('MONGODB_URI') || '';
      setMongodbUri(savedUri);
      setUsingLocalStorage(!savedUri);

      const savedOllamaMode = localStorage.getItem('SILYNKR_OLLAMA_CONNECTION_MODE');
      const savedOllamaBaseUrl = localStorage.getItem('SILYNKR_OLLAMA_BASE_URL');

      if (savedOllamaMode === 'browser-local' || savedOllamaMode === 'server-proxy') {
        setOllamaConnectionMode(savedOllamaMode);
      }

      if (savedOllamaBaseUrl) {
        setOllamaBaseUrl(savedOllamaBaseUrl);
      }
    }
  }, []);

  // Stable per-install identifier (used to persist settings in MongoDB)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let id = localStorage.getItem('SILYNKR_CLIENT_ID') || '';

    if (!id) {
      // Prefer the built-in UUID generator when available
      const cryptoObj = (typeof globalThis !== 'undefined' && 'crypto' in globalThis)
        ? (globalThis.crypto as Crypto | undefined)
        : undefined;
      id = typeof cryptoObj?.randomUUID === 'function'
        ? cryptoObj.randomUUID()
        : `silynkr_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      localStorage.setItem('SILYNKR_CLIENT_ID', id);
    }

    setClientId(id);
  }, []);

  const fetchUserSettings = async () => {
    if (typeof window === 'undefined') return;
    if (!clientId) return;

    try {
      const storedMongoUri = localStorage.getItem('MONGODB_URI') || '';
      const headers: Record<string, string> = {
        'X-Client-Id': clientId,
        'Cache-Control': 'no-cache'
      };

      if (storedMongoUri) {
        headers['X-MongoDB-URI'] = storedMongoUri;
      }

      const response = await fetch(`/api/settings?t=${Date.now()}`, { headers });
      const data = await response.json();

      if (!data?.success) {
        console.error('Failed to load settings:', data?.error);
        setSettingsLoaded(true);
        return;
      }

      const s = data.settings || {};

      const isThemeType = (value: unknown): value is ThemeType =>
        value === 'light' || value === 'dark' || value === 'custom';

      // Core settings
      if (typeof s.systemPrompt === 'string') setSystemPrompt(s.systemPrompt);
      if (typeof s.temperature === 'number') setTemperature(s.temperature);
      if (typeof s.useConversationHistory === 'boolean') setUseConversationHistory(s.useConversationHistory);
      if (typeof s.historyLength === 'number') setHistoryLength(s.historyLength);
      if (typeof s.autoSave === 'boolean') setAutoSave(s.autoSave);

      // Advanced generation settings
      if (typeof s.formatOption === 'string') setFormatOption(s.formatOption);
      if (typeof s.topP === 'number') setTopP(s.topP);
      if (typeof s.topK === 'number') setTopK(s.topK);
      if (typeof s.suffixText === 'string') setSuffixText(s.suffixText);
      if (typeof s.customTemplate === 'string') setCustomTemplate(s.customTemplate);
      if (typeof s.keepAliveOption === 'string') setKeepAliveOption(s.keepAliveOption);
      if (typeof s.thinkingEnabled === 'boolean') setThinkingEnabled(s.thinkingEnabled);
      if (typeof s.rawModeEnabled === 'boolean') setRawModeEnabled(s.rawModeEnabled);
      if (s.ollamaConnectionMode === 'browser-local' || s.ollamaConnectionMode === 'server-proxy') {
        setOllamaConnectionMode(s.ollamaConnectionMode);
        localStorage.setItem('SILYNKR_OLLAMA_CONNECTION_MODE', s.ollamaConnectionMode);
      }
      if (typeof s.ollamaBaseUrl === 'string' && s.ollamaBaseUrl.trim()) {
        setOllamaBaseUrl(s.ollamaBaseUrl);
        localStorage.setItem('SILYNKR_OLLAMA_BASE_URL', s.ollamaBaseUrl);
      }

      // UI settings
      if (typeof s.sidebarWidth === 'number') {
        setSidebarWidth(s.sidebarWidth);
        localStorage.setItem('silynkr-sidebar-width', String(s.sidebarWidth));
      }

      if (isThemeType(s.theme)) {
        setAppTheme(s.theme);
      }

      if (s.customThemeColors && typeof s.customThemeColors === 'object') {
        handleCustomColorsChange(s.customThemeColors as CustomThemeColors);
      }

      // Source indicator (server env MongoDB works even if browser has no URI)
      if (data.source) {
        setUsingLocalStorage(data.source !== 'mongo');
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setSettingsLoaded(true);
    }
  };

  // Load persisted settings (re-run when MongoDB URI changes, e.g., user switches DB)
  useEffect(() => {
    if (!clientId) return;
    fetchUserSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, mongodbUri]);

  const persistUserSettings = async () => {
    if (typeof window === 'undefined') return;
    if (!clientId) return;

    try {
      const storedMongoUri = localStorage.getItem('MONGODB_URI') || '';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Client-Id': clientId
      };

      if (storedMongoUri) {
        headers['X-MongoDB-URI'] = storedMongoUri;
      }

      const settingsPayload = {
        systemPrompt,
        temperature,
        useConversationHistory,
        historyLength,
        autoSave,
        formatOption,
        topP,
        topK,
        suffixText,
        customTemplate,
        keepAliveOption,
        thinkingEnabled,
        rawModeEnabled,
        ollamaConnectionMode,
        ollamaBaseUrl,
        theme,
        customThemeColors,
        sidebarWidth
      };

      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ settings: settingsPayload })
      });

      const data = await response.json();
      if (data?.source) {
        setUsingLocalStorage(data.source !== 'mongo');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
    }
  };

  // Debounced auto-save for settings (includes system prompt)
  useEffect(() => {
    if (!settingsLoaded) return;
    if (!clientId) return;

    const t = setTimeout(() => {
      persistUserSettings();
    }, 800);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    settingsLoaded,
    clientId,
    systemPrompt,
    temperature,
    useConversationHistory,
    historyLength,
    autoSave,
    formatOption,
    topP,
    topK,
    suffixText,
    customTemplate,
    keepAliveOption,
    thinkingEnabled,
    rawModeEnabled,
    ollamaConnectionMode,
    ollamaBaseUrl,
    theme,
    customThemeColors,
    sidebarWidth
  ]);

  // Function to show toast with improved animation handling
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    // Clear any existing toast first
    if (toast) {
      dismissToast();
      setTimeout(() => {
        setToast({ message, type });
        setToastFading(false);
      }, 300); // Wait for fadeOut to complete
    } else {
      setToast({ message, type });
      setToastFading(false);
    }

    // Auto-hide toast after 4 seconds
    const timer = setTimeout(() => dismissToast(), 4000);
    return timer;
  };

  // Function to dismiss toast with animation
  const dismissToast = () => {
    setToastFading(true);
    setTimeout(() => setToast(null), 300); // Match animation duration
  };

  const saveOllamaConnection = async () => {
    try {
      const normalizedBaseUrl = normalizeOllamaBaseUrl(ollamaBaseUrl);

      localStorage.setItem('SILYNKR_OLLAMA_CONNECTION_MODE', ollamaConnectionMode);
      localStorage.setItem('SILYNKR_OLLAMA_BASE_URL', normalizedBaseUrl);
      setOllamaBaseUrl(normalizedBaseUrl);

      if (ollamaConnectionMode === 'browser-local') {
        const testResponse = await fetch(`${normalizedBaseUrl}/tags`);
        if (!testResponse.ok) {
          throw new Error(`Local Ollama test failed with status ${testResponse.status}`);
        }
      }

      await fetchModels();

      showToast(
        ollamaConnectionMode === 'browser-local'
          ? 'Saved. Browser Local mode enabled for this device.'
          : 'Saved. Server Proxy mode enabled.',
        'success'
      );
    } catch (err) {
      console.error('Error validating Ollama connection:', err);
      showToast(
        'Could not reach local Ollama from the browser. If this is a hosted HTTPS site, browser security may block localhost access. Use local app mode at http://localhost:49494.',
        'error'
      );
    }
  };

  // Update saveMongoDbUri to use toast and close settings panel
  const saveMongoDbUri = async () => {
    try {
      if (mongodbUri) {
        // Test the connection via API endpoint first
        const response = await fetch('/api/mongodb', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uri: mongodbUri }),
        });

        const data = await response.json();

        if (data.success) {
          localStorage.setItem('MONGODB_URI', mongodbUri);
          setUsingLocalStorage(false);
          showToast('MongoDB connection successful! URI saved.', 'success');
          setShowSettings(false); // Close settings panel

          // Fetch conversations after successful connection
          setTimeout(() => {
            fetchSavedConversations();
            fetchUserSettings();
          }, 500);
        } else {
          showToast(`MongoDB connection failed: ${data.error || data.message}`, 'error');
        }
      } else {
        localStorage.removeItem('MONGODB_URI');
        showToast('MongoDB URI cleared. Using server-side MongoDB if configured; otherwise falling back to local storage.', 'info');
        setShowSettings(false); // Close settings panel

        // Re-evaluate storage source after removing URI
        setTimeout(() => {
          fetchSavedConversations();
          fetchUserSettings();
        }, 500);
      }
    } catch (err) {
      console.error('Error testing MongoDB connection:', err);
      showToast('Error testing MongoDB connection. Check console for details.', 'error');
    }
  };
  
  // Update saveConversation function to track saved state
  const saveConversation = async () => {
    try {
      setIsSaving(true);
      let savedId = currentConversationId;

      const activeMongoUri = mongodbUri || (typeof window !== 'undefined'
        ? localStorage.getItem('MONGODB_URI') || ''
        : '');

      const baseHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (activeMongoUri) {
        baseHeaders['X-MongoDB-URI'] = activeMongoUri;
      }
      
      // Format messages to remove undefined values before sending to API
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        jsonContent: msg.jsonContent,
        editedAt: msg.editedAt,
        comments: msg.comments,
        feedback: msg.feedback
      }));

      const normalizeDate = (value: unknown) => {
        if (value instanceof Date) return value;
        if (typeof value === 'string' || typeof value === 'number') {
          const parsed = new Date(value);
          if (!Number.isNaN(parsed.getTime())) {
            return parsed;
          }
        }
        return new Date();
      };

      const existingConversation = currentConversationId
        ? savedConversations.find(c => c._id === currentConversationId)
        : null;

      const defaultTitle = messages.length > 0
        ? generateConversationTitle(messages)
        : 'New conversation';

      const conversationTitle = existingConversation?.title || defaultTitle;

      const conversationPayload = {
        title: conversationTitle,
        messages: formattedMessages,
        model: selectedModel,
        systemPrompt,
        folderId: currentFolder,
        tags: selectedTags,
        parameters: {
          temperature,
          topP,
          topK,
          formatOption,
          suffixText,
          customTemplate,
          keepAlive: keepAliveOption,
        }
      };

      let serverConversation: SavedConversation | null = null;

      if (currentConversationId) {
        // Update existing conversation
        const response = await fetch(`/api/conversations/${currentConversationId}`, {
          method: 'PUT',
          headers: baseHeaders,
          body: JSON.stringify({
            conversation: conversationPayload
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to save conversation');
        }
        
        const data = await response.json();
        if (!data.success || !data.conversation) {
          throw new Error(data.error || 'Failed to save conversation');
        }

        serverConversation = data.conversation;
        savedId = serverConversation._id;
        
        showToast('Conversation updated', 'success');
      } else {
        // Create a new conversation
        const response = await fetch('/api/conversations', {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify({
            conversation: conversationPayload
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to create conversation');
        }
        
        const data = await response.json();
        if (!data.success || !data.conversation) {
          throw new Error(data.error || 'Failed to create conversation');
        }

        serverConversation = data.conversation;
        savedId = serverConversation._id;
        
        // Update URL to include the new conversation ID
        router.push(`/${savedId}`);
        setCurrentConversationId(savedId);
        showToast('Conversation saved', 'success');
      }
      
      // Update the conversation in the savedConversations list
      setSavedConversations(prev => {
        const updated = [...prev];
        const existingIndex = updated.findIndex(c => c._id === savedId);
        const finalConversation = serverConversation || {
          ...conversationPayload,
          _id: savedId!,
          updatedAt: new Date(),
          createdAt: existingConversation?.createdAt || new Date()
        } as SavedConversation;

        if (existingIndex >= 0) {
          updated[existingIndex] = {
            ...updated[existingIndex],
            ...finalConversation,
            _id: savedId,
            updatedAt: normalizeDate(finalConversation.updatedAt)
          };
        } else if (savedId) {
          updated.unshift({
            ...finalConversation,
            _id: savedId,
            createdAt: normalizeDate(finalConversation.createdAt),
            updatedAt: normalizeDate(finalConversation.updatedAt)
          });
        }
        
        return updated;
      });
      
      setLastConversationSaved(true);
      return savedId;
    } catch (error) {
      console.error('Error saving conversation:', error);
      showToast('Failed to save conversation', 'error');
      return null;
    } finally {
      setIsSaving(false);
    }
  };
  
  // Share conversation
  const shareConversation = async () => {
    if (messages.length === 0) {
      showToast('Nothing to share. Start a conversation first.', 'info');
      return;
    }

    // If not saved yet, save first
    if (!currentConversationId) {
      showToast('Saving conversation before sharing...', 'info');
      await saveConversation();
      // Wait a moment for the save to complete
      setTimeout(() => setShowShareDialog(true), 500);
    } else {
      setShowShareDialog(true);
    }
  };
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Update theme initialization to use data-theme attribute 
  useEffect(() => {
    // Get theme from local storage or system preference
    if (typeof window !== 'undefined') {
      const storedTheme = getStoredTheme();
      console.log('Initial theme from storage:', storedTheme);
      
      setTheme(storedTheme);
      setDarkMode(storedTheme !== 'light');
      
      // Get stored custom colors if available
      const storedCustomColors = getStoredCustomColors();
      setCustomThemeColors(storedCustomColors);
      
      // Apply the theme directly with the ThemeService
      applyTheme(storedTheme, storedTheme === 'custom' ? storedCustomColors : undefined);
    }
  }, []);

  const fetchModels = useCallback(async () => {
    try {
      setError(null);
      const endpoint = getOllamaModelsEndpoint();
      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`Models request failed (${response.status})`);
      }

      const data = await response.json();
      const modelList = Array.isArray(data.models) ? data.models : [];

      if (modelList.length > 0) {
        setModels(modelList);
        setSelectedModel(prev => prev || modelList[0].name);
      } else {
        setError('No models available. Please make sure you have models installed in Ollama.');
      }
    } catch (err) {
      const usingBrowserLocal = getUsingBrowserLocalOllama();
      setError(
        usingBrowserLocal
          ? 'Failed to load models from your local Ollama. Check that Ollama is running and your browser allows localhost access from this site.'
          : 'Failed to load models. Make sure Ollama is running.'
      );
      console.error('Error fetching models:', err);
    }
  }, [ollamaConnectionMode, ollamaBaseUrl]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Function to regenerate a specific message using a selected model
  const regenerateMessage = async (messageIndex: number, modelName: string) => {
    if (messageIndex < 0 || messageIndex >= messages.length || messages[messageIndex].role !== 'assistant') {
      return;
    }
    
    // Find the user message that preceded this assistant message
    const userMessageIndex = messageIndex - 1;
    if (userMessageIndex < 0 || messages[userMessageIndex].role !== 'user') {
      showToast('Cannot find the user message to regenerate response', 'error');
      return;
    }
    
    const userMessage = messages[userMessageIndex];
    
    // If something is already generating, pause it first.
    if (generationAbortControllerRef.current) {
      generationAbortControllerRef.current.abort();
      generationAbortControllerRef.current = null;
    }

    // Show loading state
    setLoading(true);
    setError(null);
    setStreamingMessageIndex(messageIndex);

    // Clear the current assistant message so the user sees the loader immediately.
    setMessages(prev => {
      const next = [...prev];
      if (next[messageIndex] && next[messageIndex].role === 'assistant') {
        next[messageIndex] = { ...next[messageIndex], content: '', timestamp: new Date() };
      }
      return next;
    });
    
    try {
      const controller = new AbortController();
      generationAbortControllerRef.current = controller;

      // Get recent conversation history excluding the message we're regenerating
      const conversationHistory = useConversationHistory 
        ? truncateConversationHistory(
            messages.slice(0, userMessageIndex), 
            historyLength
          )
        : [];
      
      // Create prompt with conversation history and feedback if enabled
      const promptWithHistory = useConversationHistory
        ? createPromptWithHistoryAndFeedback(userMessage.content, conversationHistory)
        : userMessage.content;
      
      const response = await fetch(getOllamaGenerateEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify(
          createGenerateRequestBody(
            modelName,
            promptWithHistory,
            userMessage.content,
            conversationHistory
          )
        ),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Streaming response body missing');
      }

      const decoder = new TextDecoder();
      const reader = response.body.getReader();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex = buffer.indexOf('\n');
        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          newlineIndex = buffer.indexOf('\n');

          if (!line) continue;

          let payload: any;
          try {
            payload = JSON.parse(line);
          } catch {
            // If a partial JSON line slips through, re-buffer it.
            buffer = line + '\n' + buffer;
            break;
          }

          if (payload?.error) {
            throw new Error(payload.error);
          }

          const delta = typeof payload?.response === 'string' ? payload.response : '';
          if (delta) {
            accumulated += delta;
            setMessages(prev => {
              const next = [...prev];
              if (next[messageIndex] && next[messageIndex].role === 'assistant') {
                next[messageIndex] = { ...next[messageIndex], content: accumulated, timestamp: new Date() };
              }
              return next;
            });
          }

          if (payload?.done === true) {
            break;
          }
        }
      }

      // Store the streamed version in messageVersions
      const messageId = messageIndex;
      const existing = messageVersions[messageId] || [];
      const baseVersions = existing.length > 0 ? existing : [messages[messageIndex].content];
      const updatedVersions = [...baseVersions, accumulated];

      setMessageVersions({
        ...messageVersions,
        [messageId]: updatedVersions
      });
      setCurrentMessageVersions({
        ...currentMessageVersions,
        [messageId]: updatedVersions.length - 1
      });

      // Mark conversation as unsaved
      setLastConversationSaved(false);
    } catch (err) {
      if (err && typeof err === 'object' && 'name' in err && (err as any).name === 'AbortError') {
        // Paused by user — keep partial content.
        return;
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to regenerate response: ${errorMessage}`);
      console.error('Error regenerating response:', err);
    } finally {
      setLoading(false);
      setStreamingMessageIndex(null);
      generationAbortControllerRef.current = null;
    }
  };
  
  // Handle selecting a specific version of a message
  const selectMessageVersion = (messageIndex: number, versionIndex: number) => {
    const messageId = messageIndex;
    const versions = messageVersions[messageId];
    
    if (!versions || versionIndex < 0 || versionIndex >= versions.length) return;
    
    // Update current version index
    setCurrentMessageVersions({
      ...currentMessageVersions,
      [messageId]: versionIndex
    });
    
    // Update the message in the messages array
    const updatedMessages = [...messages];
    updatedMessages[messageIndex] = {
      ...updatedMessages[messageIndex],
      content: versions[versionIndex]
    };
    setMessages(updatedMessages);
    
    // Mark conversation as unsaved
    setLastConversationSaved(false);
  };
  
  // Handle user providing feedback on a message
  const handleMessageFeedback = (messageIndex: number, feedbackType: 'liked' | 'disliked') => {
    // Update local state for immediate UI feedback
    setFeedbackMessages({
      ...feedbackMessages,
      [messageIndex]: feedbackType
    });
    
    // Update the message in the messages array to include feedback
    const updatedMessages = [...messages];
    updatedMessages[messageIndex] = {
      ...updatedMessages[messageIndex],
      feedback: feedbackType
    };
    setMessages(updatedMessages);
    
    // Mark conversation as unsaved
    setLastConversationSaved(false);
    
    console.log(`User ${feedbackType} message at index ${messageIndex}`);
  };
  
  // Handle editing a message
  const startEditingMessage = (messageIndex: number) => {
    if (editingMessageIndex === messageIndex) {
      setEditingMessageIndex(null);
    } else {
      setEditingMessageIndex(messageIndex);
    }
  };

  // In your handleSubmit function, update to include conversation history
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedModel) return;

    // If something is already generating, pause it first.
    if (generationAbortControllerRef.current) {
      generationAbortControllerRef.current.abort();
      generationAbortControllerRef.current = null;
    }

    const promptText = input;
    const assistantIndex = messages.length + 1;

    const userMessage: Message = { 
      role: 'user', 
      content: promptText,
      timestamp: new Date() 
    };

    // Add a placeholder assistant message so we can stream into it.
    const placeholderAssistant: Message = {
      role: 'assistant',
      content: '',
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage, placeholderAssistant]);
    setInput('');
    setLoading(true);
    setStreamingMessageIndex(assistantIndex);
    setError(null);
    setLastConversationSaved(false); // Mark as unsaved when new message is added
  
    try {
      const controller = new AbortController();
      generationAbortControllerRef.current = controller;

      // Get recent conversation history based on settings
      const conversationHistory = useConversationHistory 
        ? truncateConversationHistory(messages, historyLength)
        : [];
      
      // Create prompt with conversation history and feedback if enabled
      const promptWithHistory = useConversationHistory
        ? createPromptWithHistoryAndFeedback(promptText, conversationHistory)
        : promptText;
      
      const response = await fetch(getOllamaGenerateEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify(
          createGenerateRequestBody(
            selectedModel,
            promptWithHistory,
            promptText,
            conversationHistory
          )
        ),
      });
  
      // Check if response is OK before reading the stream
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Streaming response body missing');
      }

      const decoder = new TextDecoder();
      const reader = response.body.getReader();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex = buffer.indexOf('\n');
        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          newlineIndex = buffer.indexOf('\n');

          if (!line) continue;

          let payload: any;
          try {
            payload = JSON.parse(line);
          } catch {
            // Partial JSON line; put it back and wait for the next chunk.
            buffer = line + '\n' + buffer;
            break;
          }

          if (payload?.error) {
            throw new Error(payload.error);
          }

          const delta = typeof payload?.response === 'string' ? payload.response : '';
          if (delta) {
            accumulated += delta;
            setMessages(prev => {
              const next = [...prev];
              if (next[assistantIndex] && next[assistantIndex].role === 'assistant') {
                next[assistantIndex] = { ...next[assistantIndex], content: accumulated, timestamp: new Date() };
              }
              return next;
            });
          }

          if (payload?.done === true) {
            break;
          }
        }
      }

      // Store the final streamed message as version 0
      setMessageVersions(versions => ({
        ...versions,
        [assistantIndex]: [accumulated]
      }));
      setCurrentMessageVersions(currentVersions => ({
        ...currentVersions,
        [assistantIndex]: 0
      }));

      // Token usage is approximate in streaming mode (we don't receive exact counts).
      const promptTokenEstimate = Math.ceil(promptWithHistory.length / 4);
      const completionTokenEstimate = Math.ceil(accumulated.length / 4);
      setPromptTokens(promptTokenEstimate);
      setCompletionTokens(completionTokenEstimate);
      setTotalTokens(promptTokenEstimate + completionTokenEstimate);
      setShowTokenUsage(true);
      setTimeout(() => setShowTokenUsage(false), 5000);

      // Check for auto-save after response received
      checkAutoSave();
    } catch (err) {
      if (err && typeof err === 'object' && 'name' in err && (err as any).name === 'AbortError') {
        // Paused by user — keep partial content.
        return;
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to generate response: ${errorMessage}. Make sure Ollama is running.`);
      console.error('Error generating response:', err);
    } finally {
      setLoading(false);
      setStreamingMessageIndex(null);
      generationAbortControllerRef.current = null;
    }
  };
  
  // Update clearChat function to reset saved state
  const clearChat = () => {
    setMessages([]);
    setError(null);
    setLastConversationSaved(true); // No content to save, so mark as saved
  };

  // Update the basic toggleDarkMode function too
  const toggleDarkMode = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    console.log('Toggling dark mode to:', newTheme);
    setAppTheme(newTheme);
  };

  // Enhanced function to handle multiple themes with cleaner implementation
  const setAppTheme = (newTheme: ThemeType) => {
    console.log('Setting theme to:', newTheme);
    
    // Set the new theme state
    setTheme(newTheme);

    // Update darkMode state for backward compatibility
    setDarkMode(newTheme !== 'light');

    // Apply the theme using our service - directly sets the data-theme attribute
    applyTheme(newTheme, newTheme === 'custom' ? customThemeColors : undefined);
  };

  // Add a function to handle custom theme color changes
  const handleCustomColorsChange = (colors: CustomThemeColors) => {
    setCustomThemeColors(colors);
    applyTheme('custom', colors);
  };

  // Function to auto-save after AI responses if enabled
  const checkAutoSave = () => {
    if (autoSave && messages.length > 0) {
      // Short delay before auto-saving to allow UI to update
      setTimeout(() => saveConversation(), 500);
    } else {
      // Mark conversation as not saved
      setLastConversationSaved(false);
    }
  };

  // Add a notification badge component for save indicator
  const SaveIndicator = () => {
    if (messages.length === 0) return null;

    const status = lastConversationSaved ? "Saved" : "Unsaved";
    const color = lastConversationSaved
      ? "bg-green-600 dark:bg-green-400"
      : "bg-amber-600 dark:bg-amber-400";

  return (
      <span className="relative group inline-flex items-center">
        {/* Colored status dot */}
        <span className={`w-2 h-2 rounded-full ${color} ${lastConversationSaved ? "" : "animate-pulse"}`} />

        {/* Enhanced Tooltip */}
        <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 
                      bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                      shadow-lg rounded-md py-1.5 px-3 whitespace-nowrap text-xs
                      opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="font-medium text-gray-900 dark:text-gray-100">
            {status} Conversation
          </div>
          <div className="text-gray-500 dark:text-gray-400">
            {lastConversationSaved
              ? "Changes have been saved"
              : "You have unsaved changes"}
          </div>
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 
                        rotate-45 w-2 h-2 bg-white dark:bg-gray-800 border-b border-r 
                        border-gray-200 dark:border-gray-700"></div>
        </span>
      </span>
    );
  };
  // Add function to update conversation title based on first message
  const generateConversationTitle = (messages: Array<{ role: string; content: string }>) => {
    if (!messages || messages.length === 0) return 'New Conversation';

    // Get first user message
    const firstUserMessage = messages.find((m: { role: string }) => m.role === 'user');
    if (!firstUserMessage) return 'New Conversation';

    // Truncate to reasonable length and add ellipsis if needed
    let title = firstUserMessage.content.trim();
    if (title.length > 50) {
      title = title.substring(0, 50) + '...';
    }
    return title;
  };

  // Update the useEffect that fetches saved conversations to depend on mongodbUri
  // Replace the existing useEffect for fetching conversations
  useEffect(() => {
    // Only fetch conversations when we have access to window
    if (typeof window !== 'undefined') {
      const storedMongoUri = localStorage.getItem('MONGODB_URI') || '';
      console.log('MongoDB URI changed, fetching conversations with URI:', storedMongoUri ? 'URI provided' : 'No URI');
      fetchSavedConversations();
    }
  }, [mongodbUri]); // Add dependency on mongodbUri

  // Function to fetch saved conversations
  const fetchSavedConversations = async () => {
    setLoadingConversations(true);
    try {
      // Get MongoDB URI from localStorage if available
      const storedMongoUri = typeof window !== 'undefined'
        ? localStorage.getItem('MONGODB_URI') || ''
        : '';

      console.log('Fetching conversations with MongoDB URI:', storedMongoUri ? 'URI provided' : 'No URI');

      // Add a timestamp to prevent caching
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/conversations?t=${timestamp}`, {
        headers: {
          'X-MongoDB-URI': storedMongoUri,
          'Cache-Control': 'no-cache'
        }
      });

      console.log('Conversations API response status:', response.status);

      const data = await response.json();
      console.log('Conversations API response data:', data);

      if (data.success && data.conversations) {
        console.log(`Successfully fetched ${data.conversations.length} conversations`);
        setSavedConversations(data.conversations);
        if (data.source) {
          setUsingLocalStorage(data.source !== 'mongo');
        }
      } else {
        console.error('Failed to fetch conversations:', data.error || 'No error message provided');
        showToast('Failed to load conversations: ' + (data.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      showToast('Error loading conversations. Check console for details.', 'error');
    } finally {
      setLoadingConversations(false);
    }
  };

  // Function to toggle folder expansion
  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  // Function to load a saved conversation
  const loadConversation = (conversation: SavedConversation) => {
    // Create deep copies of complex objects to avoid reference issues
    const messagesCopy = JSON.parse(JSON.stringify(conversation.messages || []));
    
    setMessages(messagesCopy);
    setSelectedModel(conversation.model);
    setSystemPrompt((conversation as any).systemPrompt || '');
    setTemperature((conversation as any).parameters?.temperature || 0.7);
    setCurrentConversationId(conversation._id);
    setLastConversationSaved(true);

    // Extract folderId correctly regardless of type
    const folderIdValue = getFolderIdString(conversation.folderId);
    setCurrentFolder(folderIdValue);

    // Set tags if available
    setSelectedTags(conversation.tags || []);

    // Reset editing state
    setEditingMessageIndex(null);

    // Clear input
    setInput('');

    closeContextMenu();
    
    // Show a brief loading toast
    showToast('Loading conversation...', 'info');
    
    // Optionally fetch the latest data from the server for this conversation
    if (conversation._id) {
      loadConversationById(conversation._id)
        .catch(err => console.error('Error refreshing conversation data:', err));
    }
  };

  // Function to create a new conversation
  const createNewConversation = async (options?: { folderId?: string | null }) => {
    // Reset UI state first
    clearChat();
    setCurrentConversationId(null);
    setInput('');
    setEditingMessageIndex(null);

    const targetFolderId = options?.folderId ?? null;
    setCurrentFolder(targetFolderId);
    setSelectedTags([]);

    // Ensure we have a model selected
    const modelToUse = selectedModel || (models.length > 0 ? models[0].name : '');
    if (!modelToUse) {
      showToast('Please wait for models to load before creating a new chat.', 'info');
      return;
    }

    try {
      const storedMongoUri = typeof window !== 'undefined'
        ? localStorage.getItem('MONGODB_URI') || ''
        : '';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (storedMongoUri) {
        headers['X-MongoDB-URI'] = storedMongoUri;
      }

      const conversationPayload = {
        title: 'New conversation',
        messages: [],
        model: modelToUse,
        systemPrompt,
        folderId: targetFolderId,
        tags: [],
        parameters: {
          temperature,
          topP,
          topK,
          formatOption,
          suffixText,
          customTemplate,
          keepAlive: keepAliveOption,
        }
      };

      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers,
        body: JSON.stringify({ conversation: conversationPayload })
      });

      const data = await response.json();
      if (!response.ok || !data?.success || !data?.conversation) {
        throw new Error(data?.error || 'Failed to create conversation');
      }

      const newConversation = data.conversation as SavedConversation;
      setCurrentConversationId(newConversation._id);
      setSavedConversations(prev => [newConversation, ...prev.filter(c => c._id !== newConversation._id)]);
      setLastConversationSaved(true);

      router.push(`/${newConversation._id}`);
    } catch (err) {
      console.error('Error creating new conversation:', err);
      showToast('Failed to start a new chat', 'error');
    }
  };

  // Function to create a new folder
  const createFolder = async (parentId: string | null = null) => {
    try {
      // Use the existing newFolderName state instead of showing a prompt
      if (!newFolderName.trim()) {
        showToast('Please enter a folder name', 'info');
        return;
      }
      
      const storedMongoUri = typeof window !== 'undefined'
        ? localStorage.getItem('MONGODB_URI') || ''
        : '';
      
      // Calculate path if there's a parent folder
      let path = '';
      let level = 0;
      
      if (parentId) {
        const parentFolder = folders.find(f => f._id === parentId);
        if (parentFolder) {
          path = parentFolder.path ? `${parentFolder.path},${parentId}` : parentId;
          level = parentFolder.level ? parentFolder.level + 1 : 1;
        }
      }
      
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MongoDB-URI': storedMongoUri
        },
        body: JSON.stringify({
          name: newFolderName,
          color: 'rgb(var(--primary))', // Use theme variable
          parentId,
          path,
          level
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.folder) {
        setFolders([...folders, data.folder]);
        showToast(`Folder "${newFolderName}" created`, 'success');
        
        // Clear the input and hide it after successful creation
        setNewFolderName('');
        setShowNewSubfolderInput(false);
        setShowNewFolderInput(false);
        
        // Auto-expand the parent folder
        if (parentId) {
          setExpandedFolders(prev => ({
            ...prev,
            [parentId]: true
          }));
        }
      } else {
        throw new Error(data.error || 'Failed to create folder');
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      showToast('Failed to create folder', 'error');
    }
  };

  // Function to handle context menu
  const handleContextMenu = (e: React.MouseEvent, conversation: SavedConversation) => {
    e.preventDefault();
    setContextMenuPosition({
      show: true,
      x: e.clientX,
      y: e.clientY,
      conversation,
      isRenaming: false
    });
  };

  // Function to close context menu
  const closeContextMenu = () => {
    setContextMenuPosition({
      show: false,
      x: 0,
      y: 0,
      conversation: null,
      isRenaming: false
    });
  };

  // Function to delete a conversation
  const deleteConversation = async (conversation: SavedConversation) => {
    try {
      // Get MongoDB URI from localStorage if available
      const storedMongoUri = typeof window !== 'undefined'
        ? localStorage.getItem('MONGODB_URI') || ''
        : '';

      const response = await fetch(`/api/conversations/${conversation._id}`, {
        method: 'DELETE',
        headers: {
          'X-MongoDB-URI': storedMongoUri
        }
      });

      const data = await response.json();

      if (data.success) {
        // Remove conversation from state
        setSavedConversations(savedConversations.filter(c => c._id !== conversation._id));

        // If this was the current conversation, clear it
        if (currentConversationId === conversation._id) {
          clearChat();
          setCurrentConversationId(null);
        }

        showToast('Conversation deleted successfully', 'success');
      } else {
        throw new Error(data.error || 'Failed to delete conversation');
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      showToast('Failed to delete conversation', 'error');
    } finally {
      closeContextMenu();
    }
  };

  // Function to show move folder dialog for a folder
  const showMoveFolderToFolderDialog = (folder: Folder) => {
    setFolderToMove(folder);
    setIsFolderMove(true);
    // Set current parent as default target, or null if it's a root folder
    setTargetFolderId(folder.parentId || null);
    setShowMoveDialog(true);
    closeFolderContextMenu();
  };

  // Function to show move dialog
  const showMoveFolderDialog = (conversation: SavedConversation) => {
    setConversationToMove(conversation);
    setIsFolderMove(false);
    // Use the helper function to extract a valid folder ID string
    const folderIdValue = getFolderIdString(conversation.folderId);
    setTargetFolderId(folderIdValue);
    setShowMoveDialog(true);
    console.log('Available folders for moving:', folders);
    closeContextMenu();
  };

  // Helper function to safely extract folder ID regardless of format
  const getFolderIdString = (folderId: string | { _id: string } | null | undefined): string | null => {
    if (!folderId) return null;
    if (typeof folderId === 'string') return folderId;
    if (typeof folderId === 'object' && '_id' in folderId) return folderId._id;
    return null;
  };

  // Function to move conversation to folder
  const moveConversation = async () => {
    if (!conversationToMove) return;

    try {
      // Get MongoDB URI from localStorage if available
      const storedMongoUri = typeof window !== 'undefined'
        ? localStorage.getItem('MONGODB_URI') || ''
        : '';

      // Prepare the updated conversation
      const updatedConversation = {
        ...conversationToMove,
        folderId: targetFolderId
      };

      console.log('Moving conversation to folder:', targetFolderId);

      const response = await fetch(`/api/conversations/${conversationToMove._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-MongoDB-URI': storedMongoUri
        },
        body: JSON.stringify({ conversation: updatedConversation }),
      });

      console.log('Move conversation API response status:', response.status);
      const data = await response.json();
      console.log('Move conversation API response data:', data);

      if (data.success) {
        // Update conversation in state
        setSavedConversations(savedConversations.map(c =>
          c._id === conversationToMove._id
            ? { ...c, folderId: targetFolderId }
            : c
        ));

        // Auto-expand the target folder if it's not already expanded
        if (targetFolderId) {
          setExpandedFolders(prev => ({
            ...prev,
            [targetFolderId]: true
          }));
        }

        setShowMoveDialog(false);
        setConversationToMove(null);
        showToast('Conversation moved successfully', 'success');

        // If this is the current conversation, update its folder
        if (currentConversationId === conversationToMove._id) {
          setCurrentFolder(targetFolderId);
        }

        // Refresh conversations list to ensure UI is up to date
        setTimeout(() => {
          // Get MongoDB URI from localStorage if available
          const storedMongoUri = typeof window !== 'undefined'
            ? localStorage.getItem('MONGODB_URI') || ''
            : '';
          
          // Fetch folders from API
          fetch('/api/folders', {
            headers: {
              'X-MongoDB-URI': storedMongoUri
            }
          })
          .then(res => res.json())
          .then(data => {
            if (data.success && data.folders) {
              setFolders(data.folders);
            }
          })
          .catch(err => {
            console.error('Error fetching folders:', err);
          });
        }, 500);
      } else {
        throw new Error(data.error || 'Failed to move conversation');
      }
    } catch (error) {
      console.error('Error moving conversation:', error);
      showToast('Failed to move conversation', 'error');
    }
  };

  // Add specific effect for loading conversation from conversationId prop
  useEffect(() => {
    if (conversationId) {
      console.log('Loading conversation from URL param:', conversationId);
      loadConversationById(conversationId)
        .catch(err => console.error('Error loading conversation from URL param:', err));
    }
  }, [conversationId]);

  // Function to load conversation by ID
  const loadConversationById = async (id: string) => {
    console.log('Attempting to load conversation ID:', id);
    setLoadingConversations(true);

    try {
      // Get MongoDB URI from localStorage if available
      const storedMongoUri = typeof window !== 'undefined'
        ? localStorage.getItem('MONGODB_URI') || ''
        : '';

      // Add a timestamp to prevent caching
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/conversations/${id}?t=${timestamp}`, {
        headers: {
          'X-MongoDB-URI': storedMongoUri,
          'Cache-Control': 'no-cache'
        }
      });

      console.log('Single conversation API response status:', response.status);

      if (!response.ok) {
        throw new Error(`Failed to fetch conversation: ${response.status}`);
      }

      const data = await response.json();
      console.log('Single conversation API response data:', data);

      if (data.success && data.conversation) {
        // Load the conversation with deep-copied messages to prevent reference issues
        const conversationMessages = JSON.parse(JSON.stringify(data.conversation.messages));
        setMessages(conversationMessages);
        setSelectedModel(data.conversation.model);
        setCurrentConversationId(data.conversation._id);
        setLastConversationSaved(true);

        // Set folder if applicable
        if (data.conversation.folderId) {
          // Use helper to extract folder ID string
          const folderIdString = getFolderIdString(data.conversation.folderId);
          setCurrentFolder(folderIdString);

          // Auto-expand folder
          if (folderIdString) {
            setExpandedFolders(prev => ({
              ...prev,
              [folderIdString]: true
            }));
          }
        }

        // Make sure this conversation is also in savedConversations list with synchronized data
        const exists = savedConversations.some(c => c._id === data.conversation._id);
        if (exists) {
          // Update existing conversation in the list
          setSavedConversations(prev => 
            prev.map(c => c._id === data.conversation._id ? data.conversation : c)
          );
        } else {
          // Add new conversation to the list
          setSavedConversations(prev => [data.conversation, ...prev]);
        }

        // Also fetch all conversations to update sidebar
        fetchSavedConversations();

      } else {
        throw new Error(data.error || 'Failed to load conversation');
      }
    } catch (error) {
      console.error('Error loading conversation by ID:', error);
      showToast(`Error loading conversation: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoadingConversations(false);
    }
  };

  // Helper function to get folders organized in a hierarchical structure
  const getFolderHierarchy = (allFolders: Folder[]) => {
    // First, separate root folders and child folders
    const rootFolders: Folder[] = [];
    const childFolders: Record<string, Folder[]> = {};

    allFolders.forEach(folder => {
      if (!folder.parentId) {
        rootFolders.push(folder);
      } else {
        const parentId = folder.parentId;
        if (!childFolders[parentId]) {
          childFolders[parentId] = [];
        }
        childFolders[parentId].push(folder);
      }
    });

    return { rootFolders, childFolders };
  };

  // Show folder context menu
  const showFolderContextMenu = (e: React.MouseEvent, folder: Folder) => {
    console.log('Right-click event detected', { x: e.clientX, y: e.clientY, folder });
    e.preventDefault();
    e.stopPropagation();
    setFolderContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      folder,
      isRenaming: false
    });
  };

  // Close folder context menu
  const closeFolderContextMenu = () => {
    setFolderContextMenu({
      show: false,
      x: 0,
      y: 0,
      folder: null,
      isRenaming: false
    });
  };

  // Delete folder
  const deleteFolder = async (folderId: string) => {
    try {
      const storedMongoUri = typeof window !== 'undefined'
        ? localStorage.getItem('MONGODB_URI') || ''
        : '';

      const response = await fetch(`/api/folders/${folderId}`, {
        method: 'DELETE',
        headers: {
          'X-MongoDB-URI': storedMongoUri
        }
      });

      const data = await response.json();

      if (data.success) {
        // Remove folder from state
        setFolders(folders.filter(f => f._id !== folderId));

        // If this was the current folder, clear it
        if (currentFolder === folderId) {
          setCurrentFolder(null);
        }

        showToast('Folder deleted successfully', 'success');
      } else {
        throw new Error(data.error || 'Failed to delete folder');
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
      showToast('Failed to delete folder', 'error');
    } finally {
      closeFolderContextMenu();
    }
  };

  // Function to add a new subfolder
  const [newSubfolderParentId, setNewSubfolderParentId] = useState<string | null>(null);
  const [showNewSubfolderInput, setShowNewSubfolderInput] = useState<boolean>(false);

  // Add effect for handling clicks outside the main folder input
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (newFolderInputRef.current && !newFolderInputRef.current.contains(event.target as Node)) {
        setShowNewFolderInput(false);
        setNewFolderName('');
      }
    }

    if (showNewFolderInput) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNewFolderInput]);
  
  // Add effect for handling clicks outside the subfolder input
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (showNewSubfolderInput && !event.target) {
        return;
      }
      
      const subfolderInputs = document.querySelectorAll('.subfolder-input-container');
      let clickedInside = false;
      
      subfolderInputs.forEach(container => {
        if (container.contains(event.target as Node)) {
          clickedInside = true;
        }
      });
      
      if (!clickedInside && showNewSubfolderInput) {
        setShowNewSubfolderInput(false);
        setNewSubfolderParentId(null);
        setNewFolderName('');
      }
    }

    if (showNewSubfolderInput) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNewSubfolderInput]);

  const startCreateSubfolder = (parentId: string) => {
    setNewSubfolderParentId(parentId);
    setNewFolderName('');
    setShowNewSubfolderInput(true);
    closeFolderContextMenu();
  };

  // Update the RenderFolder component with simpler drag and drop handling
  const RenderFolder = ({ folder, childFolders }: { folder: Folder, childFolders: Record<string, Folder[]> }) => {
    const hasChildren = childFolders[folder._id] && childFolders[folder._id].length > 0;
    const isExpanded = expandedFolders[folder._id];
    const [showFolderDropdown, setShowFolderDropdown] = useState<boolean>(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Handle clicks outside the dropdown
    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setShowFolderDropdown(false);
        }
      }

      if (showFolderDropdown) {
        document.addEventListener('mousedown', handleClickOutside);
      }
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [showFolderDropdown]);

    // Create a new chat in this folder
    const createNewChatInFolder = () => {
      createNewConversation({ folderId: folder._id });
      setShowFolderDropdown(false);
    };

    return (
      <div className="mb-1">
        <div 
          className="relative group flex items-center justify-between rounded-md hover:bg-muted"
          onDragOver={(e) => handleDragOver(e, folder._id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, folder._id)}
        >
          <button
            onClick={() => toggleFolder(folder._id)}
            onContextMenu={(e) => {
              e.preventDefault();
              showFolderContextMenu(e, folder);
            }}
            className="flex-grow flex items-center justify-between px-2 py-1.5 rounded-md text-muted-foreground cursor-grab"
            draggable
            onDragStart={(e) => handleDragStart(e, 'folder', folder._id, folder.parentId || null)}
            onDragEnd={handleDragEnd}
          >
            <div className="flex items-center gap-2 text-sm">
              <div style={{ paddingLeft: `${(folder.level || 0) * 12}px` }} className="flex items-center gap-2">
                <FolderIcon size={14} style={{ color: folder.color || 'rgb(var(--primary))' }} />
                <span className="truncate">{folder.name}</span>
              </div>
            </div>

            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Folder dropdown menu */}
          {showFolderDropdown && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-card rounded-md shadow-lg z-50 border border-border" ref={dropdownRef}>
            <button
                onClick={createNewChatInFolder}
                className="w-full text-left px-4 py-2 text-sm hover:bg-muted text-card-foreground"
              >
                New Chat in Folder
            </button>
                    <button
                      onClick={() => {
                        setShowFolderDropdown(false);
                  showMoveFolderToFolderDialog(folder);
                      }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-muted text-card-foreground"
                    >
                Move Folder
                    </button>
                  </div>
            )}
        </div>

        {isExpanded && (
          <div className="ml-4 pl-2 border-l border-border space-y-0.5">
            {/* Child folders */}
            {hasChildren && childFolders[folder._id].map(childFolder => (
              <RenderFolder
                key={childFolder._id}
                folder={childFolder}
                childFolders={childFolders}
              />
            ))}

            {/* Conversations in this folder */}
            {(() => {
              const folderConversations = savedConversations.filter(conv => {
                if (typeof conv.folderId === 'string') {
                  return conv.folderId === folder._id;
                } else if (conv.folderId && typeof conv.folderId === 'object') {
                  return (conv.folderId as any)._id === folder._id;
                }
                return false;
              });

              return folderConversations.length > 0 ? (
                folderConversations.map(conv => (
                  <button
                    key={conv._id}
                    onClick={() => loadConversation(conv)}
                    onContextMenu={(e) => handleContextMenu(e, conv)}
                    className={`w-full text-left px-2 py-1 rounded-md hover:bg-muted text-xs truncate cursor-grab
                      ${currentConversationId === conv._id ? 'bg-primary/10 text-primary' : 'text-card-foreground'}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'conversation', conv._id, folder._id)}
                    onDragEnd={handleDragEnd}
                  >
                    {conv.title}
                  </button>
                ))
              ) : (
                <div className="text-xs text-muted-foreground px-2 py-1">
                  No conversations
                </div>
              );
            })()}
          </div>
        )}
      </div>
    );
  };

  // Add function to change folder color
  const changeFolderColor = async (folderId: string, color: string) => {
    try {
      console.log('Changing folder color:', { folderId, color });
      
      const storedMongoUri = typeof window !== 'undefined'
        ? localStorage.getItem('MONGODB_URI') || ''
        : '';

      console.log('Using MongoDB URI:', storedMongoUri ? 'URI provided' : 'No URI');
      
      const response = await fetch(`/api/folders/${folderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-MongoDB-URI': storedMongoUri
        },
        body: JSON.stringify({
          color: color
        }),
      });

      console.log('Color update API response status:', response.status);
      
      const data = await response.json();
      console.log('Color update API response data:', data);

      if (data.success) {
        // Update folder in state
        setFolders(folders.map(f => 
          f._id === folderId ? { ...f, color: color } : f
        ));
        showToast('Folder color updated successfully', 'success');
      } else {
        throw new Error(data.error || 'Failed to update folder color');
      }
    } catch (error) {
      console.error('Error updating folder color:', error);
      showToast('Failed to update folder color', 'error');
    } finally {
      // setShowColorPicker(false);
      // setFolderToChangeColor(null);
    }
  };

  // Function to show color picker
  const showFolderColorPicker = (folder: Folder, x: number, y: number) => {
    console.log('Showing color picker for folder:', { folder, x, y });
    
    // Create a temporary input element of type color
    const input = document.createElement('input');
    input.type = 'color';
    input.value = folder.color || 'rgb(var(--primary))';
    
    // Track if the input has been removed
    let inputRemoved = false;
    
    // Function to safely remove the input element
    const safelyRemoveInput = () => {
      if (!inputRemoved && document.body.contains(input)) {
        document.body.removeChild(input);
        inputRemoved = true;
      }
    };
    
    // When the color is selected, update the folder
    input.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const newColor = target.value;
      console.log('Color selected:', newColor);
      changeFolderColor(folder._id, newColor);
      safelyRemoveInput();
    });
    
    // Trigger the color picker dialog
    document.body.appendChild(input);
    input.click();
    
    // Remove the input after selection
    input.addEventListener('input', () => {
      setTimeout(() => {
        safelyRemoveInput();
      }, 100);
    });
    
    // Clean up if canceled
    setTimeout(() => {
      safelyRemoveInput();
    }, 1000);
    
    // Close the context menu
    closeFolderContextMenu();
  };

  // State to track whether we're on the client side
  const [isClient, setIsClient] = useState(false);
  
  // Only enable client-side features after mount
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load saved sidebar width from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedWidth = localStorage.getItem('silynkr-sidebar-width');
      if (savedWidth) {
        setSidebarWidth(parseInt(savedWidth));
      }
    }
  }, []);
  
  // Handle sidebar resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      // Calculate new width (min 200px, max 400px)
      const newWidth = Math.max(200, Math.min(400, e.clientX));
      setSidebarWidth(newWidth);
      
      // Save to localStorage
      localStorage.setItem('silynkr-sidebar-width', newWidth.toString());
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
    
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);
  
  const startResizing = () => {
    setIsResizing(true);
  };

  // Function to move a folder to another folder
  const moveFolder = async () => {
    if (!folderToMove) return;

    try {
      const storedMongoUri = typeof window !== 'undefined'
        ? localStorage.getItem('MONGODB_URI') || ''
        : '';

      // Calculate new path and level
      let newPath = '';
      let newLevel = 0;
      
      if (targetFolderId) {
        const parentFolder = folders.find(f => f._id === targetFolderId);
        if (parentFolder) {
          newPath = parentFolder.path ? `${parentFolder.path},${targetFolderId}` : targetFolderId;
          newLevel = parentFolder.level ? parentFolder.level + 1 : 1;
        }
      }

      // Make the API request to update the folder
      const response = await fetch(`/api/folders/${folderToMove._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-MongoDB-URI': storedMongoUri
        },
        body: JSON.stringify({
          parentId: targetFolderId,
          path: newPath,
          level: newLevel
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update folder in state
        setFolders(prevFolders => 
          prevFolders.map(f => 
            f._id === folderToMove._id 
              ? { ...f, parentId: targetFolderId, path: newPath, level: newLevel }
              : f
          )
        );

        // Auto-expand the target folder if it's not already expanded
        if (targetFolderId) {
          setExpandedFolders(prev => ({
            ...prev,
            [targetFolderId]: true
          }));
        }

        setShowMoveDialog(false);
        setFolderToMove(null);
        setIsFolderMove(false);
        showToast('Folder moved successfully', 'success');

        // Refresh folders list to ensure UI is up to date
        setTimeout(() => {
          // Get MongoDB URI from localStorage if available
          const storedMongoUri = typeof window !== 'undefined'
            ? localStorage.getItem('MONGODB_URI') || ''
            : '';
          
          // Fetch folders from API
          fetch('/api/folders', {
            headers: {
              'X-MongoDB-URI': storedMongoUri
            }
          })
          .then(res => res.json())
          .then(data => {
            if (data.success && data.folders) {
              setFolders(data.folders);
            }
          })
          .catch(err => {
            console.error('Error fetching folders:', err);
          });
        }, 500);
      } else {
        throw new Error(data.error || 'Failed to move folder');
      }
    } catch (error) {
      console.error('Error moving folder:', error);
      showToast('Failed to move folder', 'error');
    }
  };

  // Recursive component to render folder options with proper indentation
  const RenderFolderOption = ({ 
    folder, 
    level = 0, 
    childFolders, 
    disabledFolders = [] 
  }: { 
    folder: Folder, 
    level?: number, 
    childFolders: Record<string, Folder[]>,
    disabledFolders?: string[]
  }) => {
    const children = childFolders[folder._id] || [];
    const isDisabled = disabledFolders.includes(folder._id);
    const padding = level * 16; // 16px indentation per level
    
    return (
      <>
        <option 
          value={folder._id} 
          disabled={isDisabled}
          style={{ paddingLeft: `${padding}px` }}
        >
          {'-'.repeat(level)} {level > 0 ? '› ' : ''}{folder.name}
        </option>
        {children.map(child => (
          <RenderFolderOption 
            key={child._id} 
            folder={child} 
            level={level + 1} 
            childFolders={childFolders}
            disabledFolders={disabledFolders}
          />
        ))}
      </>
    );
  };

  // Simple, direct implementation for drag and drop
  const handleDragStart = (e: React.DragEvent<HTMLElement>, type: 'conversation' | 'folder', id: string, currentFolderId?: string | null) => {
    // Use the simplest possible data format
    const data = JSON.stringify({
      type,
      id,
      folderId: currentFolderId
    });
    
    // Set data in the most compatible format
    e.dataTransfer.setData('text/plain', data);
    
    // Add basic styling to the dragged element
    e.currentTarget.style.opacity = '0.4';
    
    // Show the delete target
    setShowDeleteTarget(true);
    
    console.log(`Started dragging ${type} with ID ${id}`);
  };
  
  const handleDragEnd = (e: React.DragEvent<HTMLElement>) => {
    // Restore normal appearance
    e.currentTarget.style.opacity = '1';
    
    // Hide the delete target with a longer timeout to ensure it persists long enough
    setTimeout(() => {
    setShowDeleteTarget(false);
    setDeleteTargetActive(false);
    }, 300);
    
    console.log('Drag operation ended');
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLElement>, folderId: string) => {
    // The most critical part - prevent default to allow drop
    e.preventDefault();
    
    // Add visual indication that item can be dropped here
    e.currentTarget.style.backgroundColor = 'rgba(var(--primary), 0.2)';
    e.currentTarget.style.border = '2px dashed rgb(var(--primary))';
    
    console.log(`Dragging over folder ${folderId}`);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLElement>) => {
    // Restore normal appearance
    e.currentTarget.style.backgroundColor = '';
    e.currentTarget.style.border = '';
  };
  
  const handleDrop = async (e: React.DragEvent<HTMLElement>, targetFolderId: string) => {
    // Always prevent default behavior
    e.preventDefault();
    
    // Restore normal appearance
    e.currentTarget.style.backgroundColor = '';
    e.currentTarget.style.border = '';
    
    try {
      // Get the data
      const dataString = e.dataTransfer.getData('text/plain');
      if (!dataString) {
        console.error('No data found in drop event');
        return;
      }
      
      const data = JSON.parse(dataString);
      console.log('Drop data received:', data);
      
      if (data.type === 'conversation') {
        // Find the conversation
        const conversation = savedConversations.find(c => c._id === data.id);
        if (!conversation) {
          console.error('Conversation not found');
          return;
        }
        
        // Skip if already in this folder
        const currentFolderId = typeof conversation.folderId === 'string' 
          ? conversation.folderId 
          : conversation.folderId?._id;
          
        if (currentFolderId === targetFolderId) {
          console.log('Conversation is already in this folder');
          return;
        }
        
        // Move the conversation
        const updatedConversation = { ...conversation, folderId: targetFolderId };
        
        // Optimistic UI update
        setSavedConversations(prev => 
          prev.map(c => c._id === data.id ? { ...c, folderId: targetFolderId } : c)
        );
        
        // Save to server
        const response = await fetch(`/api/conversations/${data.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-mongodb-uri': mongodbUri || '',
          },
          body: JSON.stringify({ conversation: updatedConversation }),
        });
        
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }
        
        // Show success message
        showToast('Conversation moved successfully', 'success');
        
      } else if (data.type === 'folder') {
        // Cannot move folder to itself
        if (data.id === targetFolderId) {
          showToast('Cannot move a folder into itself', 'error');
          return;
        }
        
        // Find the folder
        const folder = folders.find(f => f._id === data.id);
        if (!folder) {
          console.error('Folder not found');
          return;
        }
        
        // Skip if already a child of this folder
        if (folder.parentId === targetFolderId) {
          console.log('Folder is already in this location');
          return;
        }
        
        // Check for circular reference
        if (wouldCreateCircularReference(data.id, targetFolderId)) {
          showToast('Cannot move a folder into its own subfolder', 'error');
          return;
        }
        
        // Optimistic UI update
        setFolders(prev => 
          prev.map(f => f._id === data.id ? { ...f, parentId: targetFolderId } : f)
        );
        
        // Save to server
        const response = await fetch(`/api/folders/${data.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-MongoDB-URI': mongodbUri || '',
          },
          body: JSON.stringify({ parentId: targetFolderId }),
        });
        
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }
        
        // Show success message
        showToast('Folder moved successfully', 'success');
        
        // Auto-expand the target folder
        if (targetFolderId) {
          setExpandedFolders(prev => ({
            ...prev,
            [targetFolderId]: true
          }));
        }
      }
    } catch (error) {
      console.error('Error handling drop:', error);
      showToast(`Error moving item: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };
  
  // Helper function to check if moving a folder would create a circular reference
  const wouldCreateCircularReference = (folderId: string, targetParentId: string | null): boolean => {
    if (!targetParentId) return false; // Moving to root is always safe
    if (folderId === targetParentId) return true; // Can't move a folder into itself
    
    // Check if target is a descendant of the folder
    const targetFolder = folders.find(f => f._id === targetParentId);
    if (!targetFolder || !targetFolder.parentId) return false;
    
    // Check if any ancestor of target is the folder we're moving
    let currentParentId: string | null = targetFolder.parentId;
    while (currentParentId) {
      if (currentParentId === folderId) return true;
      const parent = folders.find(f => f._id === currentParentId);
      currentParentId = parent?.parentId || null;
    }
    
    return false;
  };

  // Add handler for delete target interactions
  const handleDeleteTargetDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDeleteTargetActive(true);
  };
  
  const handleDeleteTargetDragLeave = () => {
    setDeleteTargetActive(false);
  };
  
  const handleDeleteTargetDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDeleteTargetActive(false);
    setShowDeleteTarget(false);
    
    try {
      const dataString = e.dataTransfer.getData('text/plain');
      if (!dataString) {
        console.error('No data found in drop event');
        return;
      }
      
      const data = JSON.parse(dataString);
      console.log('Item dropped for deletion:', data);
      
      if (data.type === 'conversation') {
        // Find the conversation
        const conversation = savedConversations.find(c => c._id === data.id);
        if (!conversation) {
          console.error('Conversation not found');
          return;
        }
        
        // Show custom confirmation dialog instead of window.confirm
        setConfirmDelete({
          show: true,
          type: 'conversation',
          item: conversation,
          title: conversation.title || 'Untitled'
        });
      } else if (data.type === 'folder') {
        // Find the folder
        const folder = folders.find(f => f._id === data.id);
        if (!folder) {
          console.error('Folder not found');
          return;
        }
        
        // Show custom confirmation dialog instead of window.confirm
        setConfirmDelete({
          show: true,
          type: 'folder',
          item: folder,
          title: folder.name || 'Untitled'
        });
      }
    } catch (error) {
      console.error('Error handling deletion:', error);
      showToast(`Error deleting item: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };
  
  // Add function to handle delete confirmation
  const handleConfirmDelete = async () => {
    try {
      if (confirmDelete.type === 'conversation' && confirmDelete.item) {
        await deleteConversation(confirmDelete.item as SavedConversation);
        showToast('Conversation deleted successfully', 'success');
      } else if (confirmDelete.type === 'folder' && confirmDelete.item) {
        await deleteFolder((confirmDelete.item as Folder)._id);
        showToast('Folder deleted successfully', 'success');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      showToast(`Error deleting item: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      // Reset confirmation dialog
      setConfirmDelete({
        show: false,
        type: null,
        item: null,
        title: ''
      });
    }
  };
  
  // Add function to cancel delete
  const handleCancelDelete = () => {
    setConfirmDelete({
      show: false,
      type: null,
      item: null,
      title: ''
    });
  };

  // Add version info to the component
  const versionInfo = getVersionInfo();

  // Add state for rename input
  const [renameInputValue, setRenameInputValue] = useState<string>('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Add renameFolder function
  const renameFolder = async (folderId: string, newName: string) => {
    if (!newName.trim()) {
      showToast('Folder name cannot be empty', 'error');
      return;
    }

    try {
      // Optimistic UI update
      setFolders(prev => 
        prev.map(f => f._id === folderId ? { ...f, name: newName.trim() } : f)
      );

      // Save to server
      const response = await fetch(`/api/folders/${folderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-MongoDB-URI': mongodbUri || '',
        },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      showToast('Folder renamed successfully', 'success');
      setFolderContextMenu({ ...folderContextMenu, show: false, isRenaming: false });
    } catch (error) {
      console.error('Error renaming folder:', error);
      showToast(`Error renaming folder: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  // Add renameConversation function
  const renameConversation = async (conversationId: string, newTitle: string) => {
    if (!newTitle.trim()) {
      showToast('Conversation title cannot be empty', 'error');
      return;
    }

    try {
      // Find the conversation
      const conversation = savedConversations.find(c => c._id === conversationId);
      if (!conversation) {
        console.error('Conversation not found');
        return;
      }

      // Optimistic UI update
      setSavedConversations(prev => 
        prev.map(c => c._id === conversationId ? { ...c, title: newTitle.trim() } : c)
      );

      // Save to server
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-mongodb-uri': mongodbUri || '',
        },
        body: JSON.stringify({ conversation: { ...conversation, title: newTitle.trim() } }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      showToast('Conversation renamed successfully', 'success');
      setContextMenuPosition({ ...contextMenuPosition, show: false });
    } catch (error) {
      console.error('Error renaming conversation:', error);
      showToast(`Error renaming conversation: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  // Start renaming folder
  const startRenamingFolder = (folder: Folder) => {
    setRenameInputValue(folder.name);
    setFolderContextMenu({ 
      ...folderContextMenu, 
      isRenaming: true 
    });
    
    // Focus the input after it's rendered
    setTimeout(() => {
      if (renameInputRef.current) {
        renameInputRef.current.focus();
        renameInputRef.current.select();
      }
    }, 50);
  };

  // Start renaming conversation
  const startRenamingConversation = (conversation: SavedConversation) => {
    setRenameInputValue(conversation.title);
    setContextMenuPosition({ 
      ...contextMenuPosition, 
      isRenaming: true 
    });
    
    // Focus the input after it's rendered
    setTimeout(() => {
      if (renameInputRef.current) {
        renameInputRef.current.focus();
        renameInputRef.current.select();
      }
    }, 50);
  };

  // First, add a new function to toggle between light and dark mode only
  const toggleLightDarkMode = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setAppTheme(newTheme);
  };

  // Add new state variables for theme management
  const [themeNameInput, setThemeNameInput] = useState<string>('');
  const [savedThemes, setSavedThemes] = useState<Array<{_id: string, name: string, colors: CustomThemeColors}>>([]);
  
  // Add functions for import/export and MongoDB theme operations
  const exportTheme = () => {
    exportThemeToFile('custom', customThemeColors);
  };
  
  const importTheme = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      showToast('Importing theme...', 'info');
      console.log('Attempting to import theme from file:', file.name);
      
      const theme = await importThemeFromFile(file);
      console.log('Theme successfully imported:', theme);
      
      if (theme && theme.colors) {
        // Apply the imported theme colors
        handleCustomColorsChange(theme.colors);
        showToast(`Theme "${theme.name}" imported successfully`, 'success');
      } else {
        throw new Error('Invalid theme structure');
      }
    } catch (error: any) {
      console.error('Import theme error:', error);
      showToast(`Failed to import theme: ${error.message || 'Unknown error'}`, 'error');
    } finally {
      // Reset input value to allow selecting the same file again
      event.target.value = '';
    }
  };
  
  // Function to save theme to MongoDB
  const saveThemeToMongoDB = async () => {
    if (!themeNameInput.trim()) {
      showToast('Please enter a theme name', 'info');
      return;
    }

    try {
      // Get MongoDB URI from localStorage if available
      const storedMongoUri = typeof window !== 'undefined'
        ? localStorage.getItem('MONGODB_URI') || ''
        : '';
      
      const response = await fetch('/api/themes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MongoDB-URI': storedMongoUri
        },
        body: JSON.stringify({
          name: themeNameInput,
          colors: customThemeColors
        }),
      });

      const data = await response.json();
      
      if (data.success && data.theme) {
        // Add the new theme to the list
        setSavedThemes(prevThemes => [data.theme, ...prevThemes]);
        setThemeNameInput(''); // Clear input
        showToast(`Theme "${themeNameInput}" saved successfully`, 'success');
      } else {
        throw new Error(data.error || 'Failed to save theme');
      }
    } catch (error) {
      console.error('Error saving theme:', error);
      showToast('Failed to save theme', 'error');
    }
  };
  
  // Function to load saved theme
  const loadSavedTheme = (theme: {_id: string, name: string, colors: CustomThemeColors}) => {
    handleCustomColorsChange(theme.colors);
    setAppTheme('custom');
    showToast(`Theme "${theme.name}" loaded successfully`, 'success');
  };
  
  // Function to delete saved theme
  const deleteSavedTheme = async (themeId: string) => {
    try {
      // Get MongoDB URI from localStorage if available
      const storedMongoUri = typeof window !== 'undefined'
        ? localStorage.getItem('MONGODB_URI') || ''
        : '';
      
      const response = await fetch(`/api/themes/${themeId}`, {
        method: 'DELETE',
        headers: {
          'X-MongoDB-URI': storedMongoUri
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Remove the theme from the list
        setSavedThemes(prevThemes => prevThemes.filter(theme => theme._id !== themeId));
        showToast('Theme deleted successfully', 'success');
      } else {
        throw new Error(data.error || 'Failed to delete theme');
      }
    } catch (error) {
      console.error('Error deleting theme:', error);
      showToast('Failed to delete theme', 'error');
    }
  };
  
  // Add effect to fetch saved themes
  useEffect(() => {
    const fetchSavedThemes = async () => {
      try {
        // Get MongoDB URI from localStorage if available
        const storedMongoUri = typeof window !== 'undefined'
          ? localStorage.getItem('MONGODB_URI') || ''
          : '';
        
        const response = await fetch('/api/themes', {
          headers: {
            'X-MongoDB-URI': storedMongoUri
          }
        });
        
        const data = await response.json();
        
        if (data.success && data.themes) {
          setSavedThemes(data.themes);
        }
      } catch (error) {
        console.error('Error fetching saved themes:', error);
      }
    };
    
    fetchSavedThemes();
  }, []);
  
  // Add UI density state
  const [uiDensity, setUiDensity] = useState<'comfortable' | 'compact'>('comfortable');
  // Add font size state (1-5 scale: 1=small, 3=medium, 5=large)
  const [fontSize, setFontSize] = useState<number>(3);

  // Load UI preferences from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Load UI density preference
      const savedDensity = localStorage.getItem('silynkr-ui-density');
      if (savedDensity === 'compact' || savedDensity === 'comfortable') {
        setUiDensity(savedDensity);
      }
      
      // Load font size preference
      const savedFontSize = localStorage.getItem('silynkr-font-size');
      if (savedFontSize) {
        const size = parseInt(savedFontSize, 10);
        if (!isNaN(size) && size >= 1 && size <= 5) {
          setFontSize(size);
        }
      }
    }
  }, []);

  // Save UI density preference
  const setUiDensityPreference = (density: 'comfortable' | 'compact') => {
    setUiDensity(density);
    if (typeof window !== 'undefined') {
      localStorage.setItem('silynkr-ui-density', density);
    }
  };

  // Save font size preference
  const setFontSizePreference = (size: number) => {
    setFontSize(size);
    if (typeof window !== 'undefined') {
      localStorage.setItem('silynkr-font-size', size.toString());
    }
    
    // Apply the font size to the root element
    document.documentElement.style.fontSize = getFontSizeValue(size);
  };
  
  // Helper to get CSS font-size value based on size setting
  const getFontSizeValue = (size: number): string => {
    switch (size) {
      case 1: return '14px'; // Small
      case 2: return '15px'; // Medium-small
      case 3: return '16px'; // Medium (default)
      case 4: return '18px'; // Medium-large
      case 5: return '20px'; // Large
      default: return '16px'; // Default
    }
  };
  
  // Apply font size on component mount
  useEffect(() => {
    document.documentElement.style.fontSize = getFontSizeValue(fontSize);
    
    // Add a class for UI density
    if (uiDensity === 'compact') {
      document.documentElement.classList.add('compact-ui');
    } else {
      document.documentElement.classList.remove('compact-ui');
    }
    
    return () => {
      // Clean up on unmount
      document.documentElement.style.fontSize = '';
      document.documentElement.classList.remove('compact-ui');
    };
  }, [fontSize, uiDensity]);

  // Add a new function to handle saving edited message
  const saveEditedMessage = async (messageIndex: number, newContent: string, jsonContent?: any) => {
    if (messageIndex < 0 || messageIndex >= messages.length) {
      return;
    }

    // Create a new message with the edited content
    const updatedMessage: Message = {
      ...messages[messageIndex],
      content: newContent,
      jsonContent: jsonContent || null, // Store JSON content for better LLM processing
      editedAt: new Date()
    };

    // Update the messages array in state
    const updatedMessages = [...messages];
    updatedMessages[messageIndex] = updatedMessage;
    setMessages(updatedMessages);

    // Exit editing mode
    setEditingMessageIndex(null);

    // Mark conversation as unsaved
    setLastConversationSaved(false);

    // Update the savedConversations list with the updated message for immediate UI update
    if (currentConversationId) {
      setSavedConversations(prevConversations => 
        prevConversations.map(conv => {
          if (conv._id === currentConversationId) {
            // Create a new conversation object with updated messages
            return {
              ...conv,
              messages: updatedMessages,
              updatedAt: new Date()
            };
          }
          return conv;
        })
      );
    }

    // Always save changes immediately when editing a message
    try {
      // Get MongoDB URI from localStorage if available
      const storedMongoUri = typeof window !== 'undefined'
        ? localStorage.getItem('MONGODB_URI') || ''
        : '';

      // Prepare the updated conversation with efficient message structure
      const conversation = {
        messages: updatedMessages.map(msg => ({
          role: msg.role,
          content: msg.content,
          jsonContent: msg.jsonContent || undefined,
          timestamp: msg.timestamp,
          editedAt: msg.editedAt || undefined,
          comments: msg.comments || [] // Preserve comments
        }))
      };

      // Use PATCH method to update only the messages field
      const response = await fetch(`/api/conversations/${currentConversationId}/messages`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-MongoDB-URI': storedMongoUri
        },
        body: JSON.stringify({ messages: conversation.messages }),
      });

      if (response.ok) {
        setLastConversationSaved(true);
        // Show a success toast to indicate the message was saved
        showToast('Message updated successfully', 'success');
      } else {
        throw new Error('Failed to save edited message');
      }
    } catch (error) {
      console.error('Error saving edited message:', error);
      showToast('Failed to save edited message. Changes are in memory only.', 'error');
    }
  };

  // Add effect to ensure delete target is hidden after any drag operation
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      // Make sure the delete target is hidden when drag ends anywhere
      setTimeout(() => {
        setShowDeleteTarget(false);
        setDeleteTargetActive(false);
      }, 100);
    };

    const handleGlobalDrop = (e: DragEvent) => {
      // When something is dropped anywhere in the document
      setTimeout(() => {
        setShowDeleteTarget(false);
        setDeleteTargetActive(false);
      }, 100);
    };

    // Add event listener to global document
    document.addEventListener('dragend', handleGlobalDragEnd);
    document.addEventListener('drop', handleGlobalDrop);
    
    // Clean up
    return () => {
      document.removeEventListener('dragend', handleGlobalDragEnd);
      document.removeEventListener('drop', handleGlobalDrop);
    };
  }, []);

  // Add layout effect to ensure delete target is hidden immediately when drag operations end
  useLayoutEffect(() => {
    if (!showDeleteTarget) {
      // Force-hide the delete target when showDeleteTarget is false
      const deleteTargets = document.querySelectorAll('.delete-target');
      deleteTargets.forEach(target => {
        (target as HTMLElement).style.display = 'none';
      });
    }
  }, [showDeleteTarget]);

  // Process command line arguments

  // Add a function to handle adding a comment to a message
  const addCommentToMessage = (messageIndex: number, text: string, color: string) => {
    if (messageIndex < 0 || messageIndex >= messages.length) {
      return;
    }

    const updatedMessages = [...messages];
    
    // Create a new comment
    const newComment = {
      id: crypto.randomUUID(), // Generate a unique ID
      text,
      color,
      createdAt: new Date()
    };
    
    // Add the comment to the message
    if (!updatedMessages[messageIndex].comments) {
      updatedMessages[messageIndex].comments = [];
    }
    
    updatedMessages[messageIndex].comments?.push(newComment);
    setMessages(updatedMessages);
    
    // Show a success toast
    showToast('Comment added successfully', 'success');
    
    // Force MongoDB URI from localStorage if available
    const storedMongoUri = typeof window !== 'undefined'
      ? localStorage.getItem('MONGODB_URI') || ''
      : '';
      
    // Store MongoDB URI in localStorage to ensure it's used for persistence
    if (storedMongoUri) {
      localStorage.setItem('MONGODB_URI', storedMongoUri);
    } else {
      // If no MongoDB URI is set, use a default one for local development
      localStorage.setItem('MONGODB_URI', 'mongodb://localhost:27017/silynkr');
    }
    
    // If the conversation is saved, update it
    if (currentConversationId) {
      // Mark conversation as unsaved
      setLastConversationSaved(false);
      
      // Save the conversation with the new comment
      saveConversation();
    }
  };

  // Add a function to handle deleting a comment from a message
  const deleteCommentFromMessage = (messageIndex: number, commentId: string) => {
    if (messageIndex < 0 || messageIndex >= messages.length) {
      return;
    }
    
    const updatedMessages = [...messages];
    
    // Filter out the comment to delete
    if (updatedMessages[messageIndex].comments) {
      updatedMessages[messageIndex].comments = updatedMessages[messageIndex].comments?.filter(
        comment => comment.id !== commentId
      );
    }
    
    setMessages(updatedMessages);
    
    // Show a success toast
    showToast('Comment deleted successfully', 'success');
    
    // Force MongoDB URI from localStorage if available
    const storedMongoUri = typeof window !== 'undefined'
      ? localStorage.getItem('MONGODB_URI') || ''
      : '';
      
    // Store MongoDB URI in localStorage to ensure it's used for persistence
    if (storedMongoUri) {
      localStorage.setItem('MONGODB_URI', storedMongoUri);
    } else {
      // If no MongoDB URI is set, use a default one for local development
      localStorage.setItem('MONGODB_URI', 'mongodb://localhost:27017/silynkr');
    }
    
    // If the conversation is saved, update it
    if (currentConversationId) {
      // Mark conversation as unsaved
      setLastConversationSaved(false);
      
      // Save the conversation with the deleted comment
      saveConversation();
    }
  };

  return (
    <div className="flex h-screen flex-col">
      {/* New version notification */}
      {showVersionNotification && (
        <div className="bg-primary/5 border-b border-primary/10">
          <div className="max-w-7xl mx-auto py-2 px-3 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between flex-wrap">
              <div className="flex items-center">
                <span className="flex p-1 rounded-lg bg-primary/10">
                  <AlertCircle className="h-5 w-5 text-primary" aria-hidden="true" />
                </span>
                <p className="ml-3 font-medium text-primary truncate text-sm">
                  <span>
                    New beta version 1.2.0 released! Try the resizable sidebar and improved folder organization with drag and drop.
                  </span>
                </p>
              </div>
              <div className="flex-shrink-0 ml-2">
                <button
                  type="button"
                  onClick={() => setShowVersionNotification(false)}
                  className="p-1.5 rounded-md text-primary hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  <span className="sr-only">Dismiss</span>
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Delete target */}
        {showDeleteTarget && (
          <div 
            className="fixed bottom-8 right-8 z-50 flex items-center justify-center transition-all duration-200 delete-target"
            style={{
              width: deleteTargetActive ? '60px' : '50px',
              height: deleteTargetActive ? '60px' : '50px',
              backgroundColor: deleteTargetActive ? 'rgb(239, 68, 68)' : 'rgb(220, 38, 38)',
              borderRadius: '50%',
              boxShadow: deleteTargetActive ? '0 0 15px rgba(239, 68, 68, 0.7)' : '0 0 10px rgba(220, 38, 38, 0.5)'
            }}
            onDragOver={handleDeleteTargetDragOver}
            onDragLeave={handleDeleteTargetDragLeave}
            onDrop={handleDeleteTargetDrop}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-6 w-6 text-white"
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
              />
            </svg>
          </div>
        )}
        
        {/* Custom Delete Confirmation Dialog */}
        {confirmDelete.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30 dark:bg-white/10">
            <div className="bg-card rounded-lg shadow-xl p-6 max-w-md w-full transform transition-all animate-fade-in-up border border-border">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-6 w-6 text-red-600 dark:text-red-500"
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                    />
                  </svg>
                </div>
              </div>
              
              <h3 className="text-lg font-medium text-foreground text-center mb-2">
                Confirm Deletion
              </h3>
              
              <p className="text-center text-card-foreground mb-6">
                {confirmDelete.type === 'conversation' 
                  ? `Are you sure you want to delete the conversation "${confirmDelete.title}"?`
                  : `Are you sure you want to delete the folder "${confirmDelete.title}" and move all its conversations to root?`
                }
              </p>
              
              <div className="flex justify-center space-x-4">
                <button
                  onClick={handleCancelDelete}
                  className="px-4 py-2 border border-border rounded-md text-sm font-medium text-card-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors shadow-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast notification */}
        {toast && (
          <div 
            className={`fixed top-4 right-4 z-50 p-4 rounded-md shadow-lg max-w-sm ${toastFading ? 'animate-fade-out' : 'animate-fade-in'
              } ${toast.type === 'success' ? 'bg-green-500' :
                toast.type === 'error' ? 'bg-red-500' : 
                'bg-[#6C63FF]'
              } text-white`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center mr-3">
                {toast.type === 'success' && (
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {toast.type === 'error' && (
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {toast.type === 'info' && (
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span>{toast.message}</span>
              </div>
              <button 
                onClick={dismissToast} 
                className="text-white hover:text-gray-200 focus:outline-none"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

      {/* Sidebar */}
        <div 
          ref={sidebarRef}
          className={`${sidebarOpen ? '' : 'w-0 opacity-0'} bg-card border-r border-border transition-opacity duration-300 flex flex-col relative`}
          style={{ width: sidebarOpen ? `${sidebarWidth}px` : '0px' }}
        >
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center">
              {/* Always show logo in sidebar when open */}
              {sidebarOpen && (
              <Image
                src="/Horizontal-SiLynkr-Logo.png"
                alt="SiLynkr Logo"
                  width={120}
                  height={24}
                  className="h-auto"
                />
              )}
              
              {!sidebarOpen && (
                <div className="flex items-center">
                  <button 
                    onClick={() => setSidebarOpen(true)} 
                    className="p-3 mr-3 rounded-md hover:bg-muted flex items-center justify-center min-w-[44px] min-h-[44px] touch-manipulation"
                    aria-label="Open sidebar"
                  >
                    <Menu size={22} className="text-muted-foreground" />
                  </button>
                  <Image
                    src="/Horizontal-SiLynkr-Logo.png"
                    alt="SiLynkr Logo"
                    width={120}
                    height={24}
                className="h-auto"
              />
            </div>
              )}
            </div>
            <button 
              onClick={() => setSidebarOpen(false)} 
              className="p-3 rounded-md hover:bg-muted flex items-center justify-center min-w-[44px] min-h-[44px] touch-manipulation"
              aria-label="Close sidebar"
            >
              <X size={22} className="text-muted-foreground" />
            </button>
          </div>
        
          <div className="flex-1 overflow-y-auto px-3 space-y-2">
            {/* Recent Chats Section */}
            <div className="flex justify-between items-center mb-1">
              <div className="text-sm font-medium text-muted-foreground">Recent Chats</div>
              <button
                onClick={createNewConversation}
                className="text-xs text-primary hover:underline"
              >
                + New
              </button>
            </div>
            
            {loadingConversations ? (
              <div className="py-2 flex items-center justify-center">
                <div className="animate-pulse flex space-x-2">
                  <div className="h-2 w-2 bg-muted-foreground rounded-full"></div>
                  <div className="h-2 w-2 bg-muted-foreground rounded-full"></div>
                  <div className="h-2 w-2 bg-muted-foreground rounded-full"></div>
                </div>
              </div>
            ) : savedConversations.length > 0 ? (
              <div className="space-y-0.5">
                {savedConversations
                  .filter(conv => !conv.folderId) // Only show conversations without folders here
                  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) // Most recent first
                  .slice(0, 10) // Limit to 10 recent chats
                  .map(conv => (
                    <button
                      key={conv._id}
                      onClick={() => loadConversation(conv)}
                      onContextMenu={(e) => handleContextMenu(e, conv)}
                      className={`w-full flex items-center text-left px-2 py-1.5 rounded-md hover:bg-muted cursor-grab
                        ${currentConversationId === conv._id ? 'bg-primary/10 text-primary' : 'text-card-foreground'}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, 'conversation', conv._id, null)}
                      onDragEnd={handleDragEnd}
                    >
                      <MessageSquare size={14} className="mr-2 flex-shrink-0" />
                      <span className="text-sm truncate">{conv.title}</span>
                    </button>
                  ))
                }
              </div>
            ) : (
              <div className="text-xs italic text-muted-foreground px-1 py-1">
                No saved conversations
              </div>
            )}
            {/* Folders Section */}
            <div className="flex justify-between items-center mb-1 mt-4">
              <div className="text-sm font-medium text-muted-foreground">Folders</div>
              <button
                onClick={() => setShowNewFolderInput(!showNewFolderInput)}
                className="text-xs text-primary hover:underline"
              >
                + New
              </button>
            </div>

            {showNewFolderInput && (
              <div className="mb-2 flex items-center max-w-full relative overflow-visible" ref={newFolderInputRef}>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name"
                  className="w-full text-sm border border-border rounded-l-md p-1 bg-card text-card-foreground pr-16"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createFolder();
                    if (e.key === 'Escape') {
                      setShowNewFolderInput(false);
                      setNewFolderName('');
                    }
                  }}
                  autoFocus
                />
                <button
                  onClick={() => createFolder()}
                  className="absolute right-0 top-0 bottom-0 bg-primary hover:bg-primary-hover text-primary-foreground px-2 rounded-r-md text-xs whitespace-nowrap"
                >
                  Create
                </button>
              </div>
            )}

            {loadingConversations ? (
              <div className="py-2 flex items-center justify-center">
                <div className="animate-pulse flex space-x-2">
                  <div className="h-2 w-2 bg-muted-foreground rounded-full"></div>
                  <div className="h-2 w-2 bg-muted-foreground rounded-full"></div>
                  <div className="h-2 w-2 bg-muted-foreground rounded-full"></div>
                </div>
              </div>
            ) : folders.length > 0 ? (
              <div className="space-y-1">
                {/* Use our hierarchical folder structure */}
                {(() => {
                  const { rootFolders, childFolders } = getFolderHierarchy(folders);
                  return rootFolders.map(folder => (
                    <RenderFolder
                      key={folder._id}
                      folder={folder}
                      childFolders={childFolders}
                    />
                  ));
                })()}
              </div>
            ) : (
              <div className="text-xs italic text-muted-foreground px-1 py-1">
                No folders yet
              </div>
            )}


        </div>
        
          <div className="p-3 border-t border-border">
            <button className="w-full flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted text-card-foreground" onClick={() => setShowSettings(true)}>
              <Settings size={16} />
              <span>Settings</span>
            </button>
            <button className="w-full flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted text-card-foreground" onClick={saveConversation}>
              <FolderIcon size={16} />
              <span>Save Conversation</span>
            </button>
            <button className="w-full flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted text-card-foreground" onClick={shareConversation}>
              <Share size={16} />
              <span>{isShared ? 'Unshare Conversation' : 'Share Conversation'}</span>
            </button>
            <div className="text-center text-xs text-muted-foreground">
              <div className="flex flex-col items-center justify-center gap-1">
                <div>
                  SiLynkr {versionInfo.displayVersion} by <a href="https://si4k.me" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary-hover">Si4k</a>
                </div>
              </div>
            </div>
          </div>
          
          {/* Resize handle */}
          {sidebarOpen && (
            <div
              ref={resizeRef}
              className="absolute top-0 right-0 h-full w-1 cursor-ew-resize hover:bg-primary hover:w-1 z-10 group"
              onMouseDown={startResizing}
            >
              <div className="invisible group-hover:visible absolute top-1/2 right-0 w-4 h-8 -translate-y-1/2 translate-x-1/2 flex items-center justify-center bg-[#6C63FF] rounded-full">
                <svg className="w-3 h-3 text-white" viewBox="0 0 6 10" fill="currentColor">
                  <path d="M1 1h1v8H1zM4 1h1v8H4z" />
                </svg>
              </div>
            </div>
          )}
        </div>
      
        {/* Main Content - Center properly when sidebar is closed */}
        <div className={`flex-1 flex flex-col transition-all duration-300 ${!sidebarOpen ? 'ml-0 w-full' : ''}`}>
        {/* Header */}
          <div className="bg-card shadow-sm border-b border-border py-2">
            <div className={`${!sidebarOpen ? 'container mx-auto px-4' : 'px-4'} flex items-center justify-between`}>
            {!sidebarOpen && (
                <div className="flex items-center">
              <button 
                onClick={() => setSidebarOpen(true)} 
                className="p-3 mr-3 rounded-md hover:bg-muted flex items-center justify-center min-w-[44px] min-h-[44px] touch-manipulation"
                aria-label="Open sidebar"
              >
                <Menu size={22} className="text-muted-foreground" />
              </button>
                  <Image
                    src="/Horizontal-SiLynkr-Logo.png"
                    alt="SiLynkr Logo"
                    width={120}
                    height={24}
                    className="h-auto"
                  />
                </div>
              )}
              <div className={`${!sidebarOpen ? 'flex-1 flex justify-center' : 'flex-1 flex justify-center flex-col items-center'}`}>
                {!showSettings && (
                  <div className="relative w-full max-w-2xl mx-auto">
                <select
                  id="model-select"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full p-2 themed-select focus:ring-2 focus:ring-primary"
                  disabled={loading}
                >
                  {models.length === 0 && (
                    <option value="">No models available</option>
                  )}
                  {models.map((model) => (
                    <option key={model.name} value={model.name} className="py-2 bg-card text-card-foreground">
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>
                )}
                {showSettings && (
                  <h1 className="text-xl font-medium text-foreground">SiLynkr Settings</h1>
                )}
            </div>
            
            <div>
            <button 
                onClick={toggleLightDarkMode}
                className="p-2 rounded-md hover:bg-muted transition-colors"
                aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              >
                {theme === 'light' ? (
                  <Moon size={20} className="text-foreground" />
                ) : (
                  <Sun size={20} className="text-foreground" />
                )}
            </button>
            </div>
          </div>
        </div>
        
        {/* Chat Area */}
        <div className="flex-1 overflow-hidden bg-background flex flex-col">
            {showSettings ? (
              /* Settings View */
              <div className="flex-1 overflow-y-auto">
                <div className={`${!sidebarOpen ? 'container mx-auto px-4' : ''} max-w-3xl mx-auto py-8 px-4`}>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                      <Settings size={24} />
                      Settings
                    </h2>
                    <button
                      onClick={() => setShowSettings(false)}
                      className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                    >
                      <X size={20} />
                    </button>
                </div>

                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Settings navigation */}
                    <div className="md:w-64 shrink-0">
                      <div className="bg-card rounded-lg shadow-sm border border-border">
                        {/* Settings navigation tabs */}
                        <button
                          className={`w-full text-left px-4 py-3 border-l-4 ${settingsView === 'general' ? 'border-primary bg-primary/5 text-primary' : 'border-transparent hover:bg-muted'}`}
                          onClick={() => setSettingsView('general')}
                        >
                          General
                        </button>
                        <button
                          className={`w-full text-left px-4 py-3 border-l-4 ${settingsView === 'advanced' ? 'border-primary bg-primary/5 text-primary' : 'border-transparent hover:bg-muted'}`}
                          onClick={() => setSettingsView('advanced')}
                        >
                          Advanced Options
                        </button>
                        <button
                          className={`w-full text-left px-4 py-3 border-l-4 ${settingsView === 'appearance' ? 'border-primary bg-primary/5 text-primary' : 'border-transparent hover:bg-muted'}`}
                          onClick={() => setSettingsView('appearance')}
                        >
                          Appearance
                        </button>
                        <button
                          className={`w-full text-left px-4 py-3 border-l-4 ${settingsView === 'updates' ? 'border-primary bg-primary/5 text-primary' : 'border-transparent hover:bg-muted'}`}
                          onClick={() => setSettingsView('updates')}
                        >
                          Updates
                        </button>
              </div>
          </div>
          
                    {/* Settings content */}
                    <div className="flex-1 bg-card rounded-lg shadow-sm border border-border p-5">
                      {/* General Settings */}
                      {settingsView === 'general' && (
                        <div className="space-y-6">
                          <h3 className="text-lg font-medium text-foreground">General Settings</h3>

                          {/* System Prompt */}
                <div>
                            <label htmlFor="systemPrompt" className="block text-sm font-medium text-foreground mb-1">
                    System Prompt
                  </label>
                  <textarea
                              id="systemPrompt"
                              rows={3}
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="w-full p-2 border border-border rounded-md bg-card text-card-foreground"
                              placeholder="Optional system prompt to guide the assistant's responses"
                  />
                            <p className="mt-1 text-sm text-muted-foreground">
                              System prompt provides context to the model about how it should respond.
                            </p>
                </div>
                
                          {/* MongoDB Connection */}
                <div>
                            <label htmlFor="mongodb-uri" className="block text-sm font-medium text-foreground mb-1">
                              MongoDB Connection URI
                  </label>
                            <div className="flex gap-2">
                  <input
                                id="mongodb-uri"
                                type="text"
                                value={mongodbUri}
                                onChange={(e) => setMongodbUri(e.target.value)}
                                className="flex-1 p-2 border border-border rounded-md bg-card text-card-foreground"
                                placeholder="mongodb://username:password@host:port/database"
                              />
                              <button
                                className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-md text-sm"
                                onClick={saveMongoDbUri}
                              >
                                Save
                              </button>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground flex items-center gap-2">
                              <span>{usingLocalStorage ? 'Using local storage' : 'Connected to MongoDB'}</span>
                              <span className={`w-2 h-2 rounded-full ${usingLocalStorage ? 'bg-amber-500' : 'bg-green-500'}`}></span>
                            </p>
                          </div>

                          {/* Auto-save Settings */}
                          <div>
                            <div className="flex items-center">
                              <input
                                id="autosave"
                                type="checkbox"
                                checked={autoSave}
                                onChange={(e) => setAutoSave(e.target.checked)}
                                className="h-4 w-4 text-primary focus:ring-primary border-border rounded"
                              />
                              <label htmlFor="autosave" className="ml-2 block text-sm text-foreground">
                                Auto-save conversations after each response
                              </label>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Advanced Settings */}
                      {settingsView === 'advanced' && (
                        <div className="space-y-6">
                          <h3 className="text-lg font-medium text-foreground">Advanced Options</h3>

                          {/* Temperature */}
                          <div>
                            <label htmlFor="temperature" className="flex justify-between text-sm font-medium text-foreground mb-1">
                              <span>Temperature</span>
                              <span className="text-muted-foreground">{temperature}</span>
                            </label>
                            <input
                              id="temperature"
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Precise (0)</span>
                              <span>Balanced (0.7)</span>
                              <span>Creative (2)</span>
                  </div>
                </div>

                          {/* Top-P */}
                          <div>
                            <label htmlFor="top-p" className="flex justify-between text-sm font-medium text-foreground mb-1">
                              <span>Top-P</span>
                              <span className="text-muted-foreground">{topP}</span>
                  </label>
                    <input
                              id="top-p"
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={topP}
                              onChange={(e) => setTopP(parseFloat(e.target.value))}
                              className="w-full"
                            />
                          </div>

                          {/* Top-K */}
                          <div>
                            <label htmlFor="top-k" className="flex justify-between text-sm font-medium text-foreground mb-1">
                              <span>Top-K</span>
                              <span className="text-muted-foreground">{topK}</span>
                            </label>
                            <input
                              id="top-k"
                              type="range"
                              min="0"
                              max="100"
                              step="1"
                              value={topK}
                              onChange={(e) => setTopK(parseInt(e.target.value))}
                              className="w-full"
                            />
                          </div>

                          {/* Format Option */}
                          <div>
                            <label htmlFor="format" className="block text-sm font-medium text-foreground mb-1">
                              Response Format
                            </label>
                            <select
                              id="format"
                              value={formatOption}
                              onChange={(e) => setFormatOption(e.target.value)}
                              className="w-full p-2 themed-select focus:ring-2 focus:ring-primary"
                            >
                              <option value="">Default</option>
                              <option value="json">JSON</option>
                            </select>
                          </div>

                          {/* Suffix Text */}
                          <div>
                            <label htmlFor="suffix" className="block text-sm font-medium text-foreground mb-1">
                              Suffix Text
                            </label>
                            <input
                              id="suffix"
                      type="text"
                              value={suffixText}
                              onChange={(e) => setSuffixText(e.target.value)}
                              className="w-full p-2 border border-border rounded-md bg-card text-card-foreground"
                              placeholder="Optional suffix to append to prompt"
                            />
                          </div>

                          {/* Keep-Alive */}
                          <div>
                            <label htmlFor="keep-alive" className="block text-sm font-medium text-foreground mb-1">
                              Keep-Alive Duration
                            </label>
                            <select
                              id="keep-alive"
                              value={keepAliveOption}
                              onChange={(e) => setKeepAliveOption(e.target.value)}
                              className="w-full p-2 themed-select focus:ring-2 focus:ring-primary"
                            >
                              <option value="0s">None</option>
                              <option value="30s">30 seconds</option>
                              <option value="1m">1 minute</option>
                              <option value="5m">5 minutes</option>
                              <option value="15m">15 minutes</option>
                              <option value="30m">30 minutes</option>
                              <option value="1h">1 hour</option>
                            </select>
                          </div>

                          {/* Checkboxes */}
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center">
                              <input
                                id="thinking-mode"
                                type="checkbox"
                                checked={thinkingEnabled}
                                onChange={(e) => setThinkingEnabled(e.target.checked)}
                                className="h-4 w-4 text-primary focus:ring-primary border-border rounded"
                              />
                              <label htmlFor="thinking-mode" className="ml-2 block text-sm text-foreground">
                                Enable thinking mode
                              </label>
                            </div>

                            <div className="flex items-center">
                              <input
                                id="raw-mode"
                                type="checkbox"
                                checked={rawModeEnabled}
                                onChange={(e) => setRawModeEnabled(e.target.checked)}
                                className="h-4 w-4 text-primary focus:ring-primary border-border rounded"
                              />
                              <label htmlFor="raw-mode" className="ml-2 block text-sm text-foreground">
                                Enable raw mode
                              </label>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Appearance Settings */}
                      {settingsView === 'appearance' && (
                        <div className="space-y-8">
                          <h3 className="text-lg font-medium text-foreground">Appearance</h3>

                          {/* Theme Selector - Direct approach with buttons */}
                          <div>
                            <h4 className="text-base font-medium text-foreground mb-4">Select Theme</h4>
                            <div className="grid grid-cols-3 gap-3">
                              {/* Light theme */}
                              <button
                                onClick={() => setAppTheme('light')}
                                className={`flex flex-col items-center p-3 rounded-lg border transition-all ${
                                  theme === 'light' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                                }`}
                              >
                                <Sun className="h-6 w-6 mb-2 text-foreground" />
                                <span className="text-sm font-medium">Light</span>
                              </button>
                              
                              {/* Dark theme */}
                              <button
                                onClick={() => setAppTheme('dark')}
                                className={`flex flex-col items-center p-3 rounded-lg border transition-all ${
                                  theme === 'dark' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                                }`}
                              >
                                <Moon className="h-6 w-6 mb-2 text-foreground" />
                                <span className="text-sm font-medium">Dark</span>
                              </button>
                              
                              {/* Obsidian theme */}
                              <button
                                onClick={() => setAppTheme('obsidian')}
                                className={`flex flex-col items-center p-3 rounded-lg border transition-all ${
                                  theme === 'obsidian' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                                }`}
                              >
                                <div className="h-6 w-6 mb-2 rounded-full bg-black border border-gray-700"></div>
                                <span className="text-sm font-medium">Obsidian</span>
                              </button>
                              
                              {/* Nature theme */}
                              <button
                                onClick={() => setAppTheme('nature')}
                                className={`flex flex-col items-center p-3 rounded-lg border transition-all ${
                                  theme === 'nature' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                                }`}
                              >
                                <div className="h-6 w-6 mb-2 rounded-full bg-green-800 border border-green-700"></div>
                                <span className="text-sm font-medium">Nature</span>
                              </button>
                              
                              {/* Sunset theme */}
                              <button
                                onClick={() => setAppTheme('sunset')}
                                className={`flex flex-col items-center p-3 rounded-lg border transition-all ${
                                  theme === 'sunset' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                                }`}
                              >
                                <div className="h-6 w-6 mb-2 rounded-full bg-amber-800 border border-amber-700"></div>
                                <span className="text-sm font-medium">Sunset</span>
                              </button>
                              
                              {/* Custom theme */}
                              <button
                                onClick={() => {
                                  setAppTheme('custom');
                                  // Show color customizer modal/section
                                }}
                                className={`flex flex-col items-center p-3 rounded-lg border transition-all ${
                                  theme === 'custom' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                                }`}
                              >
                                <Palette className="h-6 w-6 mb-2 text-foreground" />
                                <span className="text-sm font-medium">Custom</span>
                              </button>
                                  </div>
                                </div>
                          
                          {/* Custom theme color picker - only show when custom theme is selected */}
                          {theme === 'custom' && (
                            <div className="space-y-4 p-4 border border-border rounded-md bg-card/50">
                              <h4 className="text-base font-medium text-foreground">Custom Theme Colors</h4>
                              
                              <div className="grid grid-cols-2 gap-4">
                                {/* Primary color section */}
                                <div className="col-span-2 mb-2">
                                  <h5 className="text-sm font-medium text-muted-foreground mb-2">Primary Colors</h5>
                                </div>
                                
                                <div>
                                  <label className="block text-sm font-medium text-foreground mb-1">Primary</label>
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="color" 
                                      value={customThemeColors.primary}
                                      onChange={(e) => handleCustomColorsChange({ 
                                        ...customThemeColors, 
                                        primary: e.target.value,
                                        primaryHover: e.target.value 
                                      })}
                                      className="h-8 w-16 border-0 p-0 rounded"
                                    />
                                    <span className="text-xs text-muted-foreground">{customThemeColors.primary}</span>
                                </div>
                              </div>

                                <div>
                                  <label className="block text-sm font-medium text-foreground mb-1">Primary Hover</label>
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="color" 
                                      value={customThemeColors.primaryHover}
                                      onChange={(e) => handleCustomColorsChange({ 
                                        ...customThemeColors, 
                                        primaryHover: e.target.value 
                                      })}
                                      className="h-8 w-16 border-0 p-0 rounded"
                                    />
                                    <span className="text-xs text-muted-foreground">{customThemeColors.primaryHover}</span>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-foreground mb-1">Primary Foreground</label>
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="color" 
                                      value={customThemeColors.primaryForeground || "#FFFFFF"}
                                      onChange={(e) => handleCustomColorsChange({ 
                                        ...customThemeColors, 
                                        primaryForeground: e.target.value 
                                      })}
                                      className="h-8 w-16 border-0 p-0 rounded"
                                    />
                                    <span className="text-xs text-muted-foreground">{customThemeColors.primaryForeground || "#FFFFFF"}</span>
                                </div>
                                </div>
                                
                                {/* Background color section */}
                                <div className="col-span-2 mb-2 mt-4">
                                  <h5 className="text-sm font-medium text-muted-foreground mb-2">Background Colors</h5>
                              </div>

                                <div>
                                  <label className="block text-sm font-medium text-foreground mb-1">Background</label>
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="color" 
                                      value={customThemeColors.background}
                                      onChange={(e) => handleCustomColorsChange({ 
                                        ...customThemeColors, 
                                        background: e.target.value 
                                      })}
                                      className="h-8 w-16 border-0 p-0 rounded"
                                    />
                                    <span className="text-xs text-muted-foreground">{customThemeColors.background}</span>
                                  </div>
                                </div>
                                
                                <div>
                                  <label className="block text-sm font-medium text-foreground mb-1">Foreground</label>
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="color" 
                                      value={customThemeColors.foreground}
                                      onChange={(e) => handleCustomColorsChange({ 
                                        ...customThemeColors, 
                                        foreground: e.target.value 
                                      })}
                                      className="h-8 w-16 border-0 p-0 rounded"
                                    />
                                    <span className="text-xs text-muted-foreground">{customThemeColors.foreground}</span>
                                </div>
                                </div>
                                
                                {/* Card color section */}
                                <div className="col-span-2 mb-2 mt-4">
                                  <h5 className="text-sm font-medium text-muted-foreground mb-2">Card Colors</h5>
                              </div>

                                <div>
                                  <label className="block text-sm font-medium text-foreground mb-1">Card</label>
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="color" 
                                      value={customThemeColors.card}
                                      onChange={(e) => handleCustomColorsChange({ 
                                        ...customThemeColors, 
                                        card: e.target.value 
                                      })}
                                      className="h-8 w-16 border-0 p-0 rounded"
                                    />
                                    <span className="text-xs text-muted-foreground">{customThemeColors.card}</span>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-foreground mb-1">Card Foreground</label>
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="color" 
                                      value={customThemeColors.cardForeground || "#000000"}
                                      onChange={(e) => handleCustomColorsChange({ 
                                        ...customThemeColors, 
                                        cardForeground: e.target.value 
                                      })}
                                      className="h-8 w-16 border-0 p-0 rounded"
                                    />
                                    <span className="text-xs text-muted-foreground">{customThemeColors.cardForeground || "#000000"}</span>
                                </div>
                                </div>
                              </div>

                              {/* Theme management buttons */}
                              <div className="mt-6 border-t border-border pt-4">
                                <h4 className="text-base font-medium text-foreground mb-3">Theme Management</h4>
                                
                                {/* Save Theme Section */}
                                <div className="mb-4">
                                  <label className="block text-sm font-medium text-foreground mb-2">Save Custom Theme</label>
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={themeNameInput}
                                      onChange={(e) => setThemeNameInput(e.target.value)}
                                      placeholder="Theme name"
                                      className="flex-1 p-2 text-sm border border-border rounded-md bg-card text-card-foreground"
                                    />
                                    <button
                                      onClick={saveThemeToMongoDB}
                                      className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-md text-sm whitespace-nowrap"
                                      disabled={!themeNameInput.trim()}
                                    >
                                      Save Theme
                                    </button>
                                  </div>
                                </div>
                                
                                {/* Import/Export Section */}
                                <div className="flex gap-2 mb-4">
                                  <button
                                    onClick={exportTheme}
                                    className="flex-1 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-md text-sm"
                                  >
                                    Export Theme
                                  </button>
                                  
                                  <label
                                    className="flex-1 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-md text-sm flex items-center justify-center cursor-pointer"
                                  >
                                    Import Theme
                                    <input
                                      type="file"
                                      onChange={importTheme}
                                      className="hidden"
                                      accept=".json"
                                    />
                                  </label>
                              </div>

                                {/* Saved Themes Section */}
                                {savedThemes.length > 0 && (
                                  <div>
                                    <label className="block text-sm font-medium text-foreground mb-2">Saved Themes</label>
                                    <div className="max-h-32 overflow-y-auto border border-border rounded-md">
                                      {savedThemes.map((theme) => (
                                        <div 
                                          key={theme._id} 
                                          className="flex items-center justify-between p-2 hover:bg-muted border-b border-border last:border-b-0"
                                        >
                                          <span className="text-sm truncate flex-1">{theme.name}</span>
                                          <div className="flex space-x-1">
                                            <button
                                              onClick={() => loadSavedTheme(theme)}
                                              className="p-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded"
                                              title="Load theme"
                                            >
                                              Load
                                            </button>
                                            <button
                                              onClick={() => deleteSavedTheme(theme._id)}
                                              className="p-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded"
                                              title="Delete theme"
                                            >
                                              Delete
                                            </button>
                                  </div>
                                </div>
                                      ))}
                                </div>
                                </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* UI Density */}
                          <div className="space-y-3">
                            <h4 className="text-base font-medium text-foreground">UI Density</h4>
                            <div className="flex space-x-4">
                              <button 
                                className={`px-4 py-2 ${uiDensity === 'comfortable' ? 'bg-primary/10 text-primary' : 'bg-card border border-border text-muted-foreground'} rounded-md text-sm font-medium transition-colors`}
                                onClick={() => setUiDensityPreference('comfortable')}
                              >
                                Comfortable
                              </button>
                              <button 
                                className={`px-4 py-2 ${uiDensity === 'compact' ? 'bg-primary/10 text-primary' : 'bg-card border border-border text-muted-foreground'} rounded-md text-sm transition-colors`}
                                onClick={() => setUiDensityPreference('compact')}
                              >
                                Compact
                    </button>
                  </div>
                          </div>

                          {/* Font Size */}
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <h4 className="text-base font-medium text-foreground">Font Size</h4>
                              <span className="text-sm text-muted-foreground">
                                {fontSize === 1 ? 'Small' : 
                                 fontSize === 2 ? 'Medium-Small' : 
                                 fontSize === 3 ? 'Medium' : 
                                 fontSize === 4 ? 'Medium-Large' : 'Large'}
                              </span>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="5"
                              step="1"
                              value={fontSize}
                              onChange={(e) => setFontSizePreference(parseInt(e.target.value, 10))}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Small</span>
                              <span>Medium</span>
                              <span>Large</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Updates Tab */}
                      {settingsView === 'updates' && (
                        <div className="space-y-6">
                          <div>
                            <h3 className="text-lg font-medium text-foreground">Updates</h3>
                            <p className="text-sm text-muted-foreground">Check for updates and see what's new.</p>
                          </div>

                          <div className="bg-primary/5 p-4 rounded-md">
                            <div className="flex items-start">
                              <div className="mr-3 flex-shrink-0 text-primary">
                                <Info size={20} />
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-primary">Current Version</h4>
                                <div className="mt-1 text-sm text-primary">
                                  {versionInfo.displayVersion} ({versionInfo.versionType.charAt(0).toUpperCase() + versionInfo.versionType.slice(1)})
                                </div>
                              </div>
                            </div>
                          </div>

                              <div>
                            <div className="w-16 h-16 mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                            </div>
                            <h3 className="text-lg font-medium text-foreground mb-2">What's New in {versionInfo.displayVersion}</h3>
                            <ul className="list-disc pl-5 space-y-2 text-sm text-foreground">
                              {versionInfo.changelog.map((item, index) => (
                                <li key={index}>{item}</li>
                              ))}
                                </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Chat Messages */
              <div className="flex-1 overflow-y-auto p-4" style={{ scrollBehavior: 'smooth' }}>
                <div className={`${!sidebarOpen ? 'container mx-auto px-4' : ''}`}>
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6">
                      <div className="w-16 h-16 mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-foreground mb-1">Start a conversation</h3>
                      <p className="text-muted-foreground max-w-md">
                        Ask questions, get creative responses, or explore what your local AI model can do.
                  </p>
                </div>
                  ) : (
                    <div className="space-y-6 max-w-4xl mx-auto w-full">
                      {messages.map((message, index) => (
                        <ChatMessage 
                          key={index}
                          role={message.role}
                          content={message.content}
                          timestamp={message.timestamp}
                          isStreaming={index === streamingMessageIndex}
                          models={models}
                          onRegenerate={message.role === 'assistant' ? (modelName) => regenerateMessage(index, modelName) : undefined}
                          onLike={message.role === 'assistant' ? () => handleMessageFeedback(index, 'liked') : undefined}
                          onDislike={message.role === 'assistant' ? () => handleMessageFeedback(index, 'disliked') : undefined}
                          onEdit={message.role === 'assistant' ? () => startEditingMessage(index) : undefined}
                          onSaveEdit={message.role === 'assistant' ? (newContent, jsonContent) => saveEditedMessage(index, newContent, jsonContent) : undefined}
                          alternateVersions={message.role === 'assistant' ? (messageVersions[index] || [message.content]) : []}
                          currentVersionIndex={message.role === 'assistant' ? (currentMessageVersions[index] || 0) : 0}
                          onSelectVersion={message.role === 'assistant' ? (versionIndex) => selectMessageVersion(index, versionIndex) : undefined}
                          isEditing={editingMessageIndex === index}
                          comments={message.comments}
                          onAddComment={message.role === 'assistant' ? (text, color) => addCommentToMessage(index, text, color) : undefined}
                          onDeleteComment={message.role === 'assistant' ? (commentId) => deleteCommentFromMessage(index, commentId) : undefined}
                          feedback={message.feedback}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                  {loading && (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-pulse flex space-x-2">
                        <div className="h-2 w-2 bg-muted-foreground rounded-full"></div>
                        <div className="h-2 w-2 bg-muted-foreground rounded-full"></div>
                        <div className="h-2 w-2 bg-muted-foreground rounded-full"></div>
                        <div className="h-2 w-2 bg-muted-foreground rounded-full"></div>
                        <div className="h-2 w-2 bg-muted-foreground rounded-full"></div>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}
          
            {/* Input Area - only show when not in settings view */}
            {!showSettings && (
          <div className="border-t border-border bg-card p-4">
                <form onSubmit={handleSubmit} className={`${!sidebarOpen ? 'container mx-auto' : ''} max-w-3xl mx-auto`}>
              <div className="relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (input.trim() && !loading) handleSubmit(e);
                    }
                  }}
                      placeholder="Message SiLynkr..."
                  rows={1}
                  className="w-full p-3 pr-24 border border-border rounded-lg bg-card text-card-foreground focus:ring-2 focus:ring-primary focus:border-transparent resize-none overflow-hidden"
                  disabled={loading}
                />
                <div className="absolute right-2 bottom-2 flex items-center space-x-1">
                  {loading && streamingMessageIndex !== null && (
                    <button
                      type="button"
                      onClick={pauseGeneration}
                      className="bg-muted hover:bg-muted/80 text-foreground p-1.5 rounded-md transition-colors flex items-center justify-center"
                      title="Pause"
                      aria-label="Pause generating"
                    >
                      <Pause className="h-5 w-5" />
                    </button>
                  )}
                  <button
                    type="submit"
                    className="bg-primary hover:bg-primary-hover text-primary-foreground p-1.5 rounded-md transition-colors flex items-center justify-center disabled:bg-primary/50 disabled:cursor-not-allowed"
                    disabled={loading || !selectedModel || !input.trim()}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  </button>
                      <div>
                        <div className="flex flex-col items-center justify-center gap-1 m-2">
                          <SaveIndicator />
                          <PortIndicator />
                </div>
              </div>
              </div>
                  </div>

                  {/* Token usage display */}
                  {showTokenUsage && (
                    <div className="text-xs text-muted-foreground mt-2 flex justify-center gap-4">
                      <span>Prompt: {promptTokens} tokens</span>
                      <span>Response: {completionTokens} tokens</span>
                      <span>Total: {totalTokens} tokens</span>
                    </div>
                  )}
            </form>
          </div>
            )}
        </div>
        </div>

        {/* Context Menu */}
        {contextMenuPosition.show && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={closeContextMenu}
            />
            <div
              className="fixed z-50 bg-card rounded-md shadow-lg py-1 w-48 border border-border"
              style={{
                top: `${contextMenuPosition.y}px`,
                left: `${contextMenuPosition.x}px`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              {contextMenuPosition.isRenaming ? (
                <div className="px-3 py-2">
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameInputValue}
                    onChange={(e) => setRenameInputValue(e.target.value)}
                    className="w-full p-1 border border-border rounded bg-card text-foreground"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && contextMenuPosition.conversation) {
                        renameConversation(contextMenuPosition.conversation._id, renameInputValue);
                      } else if (e.key === 'Escape') {
                        closeContextMenu();
                      }
                    }}
                    onBlur={() => {
                      if (contextMenuPosition.conversation) {
                        renameConversation(contextMenuPosition.conversation._id, renameInputValue);
                      }
                    }}
                  />
                </div>
              ) : (
                <>
              <button
                onClick={() => loadConversation(contextMenuPosition.conversation!)}
                    className="px-4 py-2 text-sm text-card-foreground hover:bg-muted w-full text-left flex items-center"
              >
                <MessageSquare size={14} className="mr-2" />
                Open
              </button>
                  <button
                    onClick={() => {
                      if (contextMenuPosition.conversation) {
                        startRenamingConversation(contextMenuPosition.conversation);
                      }
                    }}
                    className="px-4 py-2 text-sm text-card-foreground hover:bg-muted w-full text-left flex items-center"
                  >
                    <Edit size={14} className="mr-2" />
                    Rename
                  </button>
              <button
                onClick={() => showMoveFolderDialog(contextMenuPosition.conversation!)}
                    className="px-4 py-2 text-sm text-card-foreground hover:bg-muted w-full text-left flex items-center"
              >
                <FolderIcon size={14} className="mr-2" />
                Move to Folder
              </button>
                  <hr className="my-1 border-border" />
              <button
                onClick={() => deleteConversation(contextMenuPosition.conversation!)}
                    className="px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-muted w-full text-left flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
                </>
              )}
            </div>
          </>
        )}

        {/* Move Dialog */}
        {showMoveDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30 dark:bg-white/10">
            <div className="bg-card rounded-lg shadow-xl p-6 w-96 max-w-md transform transition-all animate-fade-in-up border border-border">
              <h2 className="text-xl font-medium mb-4 text-foreground flex items-center">
                <FolderIcon size={18} className="mr-2 text-primary" />
                {isFolderMove ? 'Move Folder' : 'Move Conversation'}
              </h2>

              <div className="mb-6">
                <label htmlFor="folder-select" className="block text-sm font-medium text-card-foreground mb-2">
                  Select destination folder
                </label>
                <select
                  id="folder-select"
                  value={targetFolderId || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setTargetFolderId(value === '' ? null : value);
                  }}
                  className="w-full p-2.5 themed-select focus:ring-2 focus:ring-primary shadow-sm"
                >
                  <option value="" className="py-2 bg-card text-card-foreground">None (Root)</option>
                  {(() => {
                    // Get folder hierarchy
                    const { rootFolders, childFolders } = getFolderHierarchy(folders);
                    
                    // If moving a folder, we need to disable the folder itself and all its children
                    // to prevent circular references
                    const disabledFolders: string[] = [];
                    
                    if (isFolderMove && folderToMove) {
                      // Recursive function to collect folder and all its children
                      const collectSubfolders = (folderId: string) => {
                        disabledFolders.push(folderId);
                        const children = childFolders[folderId] || [];
                        children.forEach(child => collectSubfolders(child._id));
                      };
                      
                      collectSubfolders(folderToMove._id);
                    }
                    
                    return rootFolders.map(folder => (
                      <RenderFolderOption
                        key={folder._id}
                        folder={folder}
                        childFolders={childFolders}
                        disabledFolders={disabledFolders}
                      />
                    ));
                  })()}
                </select>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowMoveDialog(false);
                    setConversationToMove(null);
                    setFolderToMove(null);
                    setIsFolderMove(false);
                  }}
                  className="px-4 py-2 border border-border rounded-md text-sm font-medium text-card-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={isFolderMove ? moveFolder : moveConversation}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-md text-sm font-medium transition-colors shadow-sm"
                >
                  Move
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Share Dialog */}
        {showShareDialog && (
          <ShareDialog
            open={showShareDialog}
            onClose={() => setShowShareDialog(false)}
            messages={messages}
            conversationId={currentConversationId}
            title={currentConversationId ?
              savedConversations.find(c => c._id === currentConversationId)?.title || 'Conversation'
              : generateConversationTitle(messages)
            }
          />
        )}

        {/* Settings Dialog */}
        {showSettingsDialog && (
          <SettingsDialog
            open={showSettingsDialog}
            onClose={() => setShowSettingsDialog(false)}
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
        )}

        {/* Folder Context Menu */}
        {folderContextMenu.show && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={closeFolderContextMenu}
            />
            <div
              className="fixed z-50 bg-card rounded-md shadow-lg py-1 w-52 border border-border"
              style={{
                top: `${folderContextMenu.y}px`,
                left: `${folderContextMenu.x}px`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              {folderContextMenu.isRenaming ? (
                <div className="px-3 py-2">
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameInputValue}
                    onChange={(e) => setRenameInputValue(e.target.value)}
                    className="w-full p-1 border border-border rounded bg-card text-foreground"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && folderContextMenu.folder) {
                        renameFolder(folderContextMenu.folder._id, renameInputValue);
                      } else if (e.key === 'Escape') {
                        closeFolderContextMenu();
                      }
                    }}
                    onBlur={() => {
                      if (folderContextMenu.folder) {
                        renameFolder(folderContextMenu.folder._id, renameInputValue);
                      }
                    }}
                  />
                </div>
              ) : (
                <>
              <button
                onClick={() => startCreateSubfolder(folderContextMenu.folder!._id)}
                    className="px-4 py-2 text-sm text-card-foreground hover:bg-muted w-full text-left flex items-center"
              >
                    <FolderPlus size={14} className="mr-2" />
                Add Subfolder
              </button>
              <button
                    onClick={() => {
                      if (folderContextMenu.folder) {
                        startRenamingFolder(folderContextMenu.folder);
                      }
                    }}
                    className="px-4 py-2 text-sm text-card-foreground hover:bg-muted w-full text-left flex items-center"
                  >
                    <Edit size={14} className="mr-2" />
                    Rename
              </button>
              <button
                onClick={() => {
                  console.log('Change color button clicked', folderContextMenu);
                  showFolderColorPicker(folderContextMenu.folder!, folderContextMenu.x, folderContextMenu.y - 50);
                }}
                    className="px-4 py-2 text-sm text-card-foreground hover:bg-muted w-full text-left flex items-center"
              >
                    <span className="mr-2 w-3 h-3 rounded-full" style={{ backgroundColor: folderContextMenu.folder?.color || 'rgb(var(--primary))' }}></span>
                Change Color
              </button>
                  <hr className="my-1 border-border" />
              <button
                onClick={() => deleteFolder(folderContextMenu.folder!._id)}
                    className="px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-muted w-full text-left flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}