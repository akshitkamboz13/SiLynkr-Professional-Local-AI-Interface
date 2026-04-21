import mongoose, { Schema } from 'mongoose';

// NOTE: This project has no auth/user accounts. We persist settings per-install
// using a stable `clientId` stored in the browser.

const UserSettingsSchema = new Schema({
  clientId: { type: String, required: true, unique: true, index: true },

  // Core chat settings
  systemPrompt: { type: String, default: '' },
  temperature: { type: Number, default: 0.7 },
  useConversationHistory: { type: Boolean, default: true },
  historyLength: { type: Number, default: 10 },
  autoSave: { type: Boolean, default: false },

  // Advanced Ollama parameters / generation settings
  formatOption: { type: String, default: '' },
  topP: { type: Number, default: 0.9 },
  topK: { type: Number, default: 40 },
  suffixText: { type: String, default: '' },
  customTemplate: { type: String, default: '' },
  keepAliveOption: { type: String, default: '5m' },
  thinkingEnabled: { type: Boolean, default: false },
  rawModeEnabled: { type: Boolean, default: false },
  ollamaConnectionMode: { type: String, default: 'server-proxy' },
  ollamaBaseUrl: { type: String, default: 'http://127.0.0.1:11434/api' },

  // UI settings
  theme: { type: String, default: 'light' },
  customThemeColors: { type: Schema.Types.Mixed },
  sidebarWidth: { type: Number, default: 256 },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

UserSettingsSchema.pre('save', function (next) {
  (this as unknown as { updatedAt: Date }).updatedAt = new Date();
  next();
});

// Prevent model overwrite in dev hot-reload
const UserSettings = mongoose.models.UserSettings || mongoose.model('UserSettings', UserSettingsSchema);

export default UserSettings;
