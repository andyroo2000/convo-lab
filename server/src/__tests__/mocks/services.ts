import { vi } from 'vitest';

// Mock Gemini client
export const mockGeminiClient = {
  generateContent: vi.fn(),
  generateDialogue: vi.fn(),
  extractCourseItems: vi.fn(),
};

vi.mock('../../services/geminiClient.js', () => ({
  geminiClient: mockGeminiClient,
  generateContent: mockGeminiClient.generateContent,
}));

// Mock TTS client
export const mockTTSClient = {
  synthesize: vi.fn(),
  getVoiceForSpeaker: vi.fn(),
};

vi.mock('../../services/ttsClient.js', () => ({
  ttsClient: mockTTSClient,
  synthesizeSpeech: mockTTSClient.synthesize,
}));

// Mock Storage client
export const mockStorageClient = {
  uploadFile: vi.fn(),
  uploadBuffer: vi.fn(),
  getPublicUrl: vi.fn(),
  deleteFile: vi.fn(),
};

vi.mock('../../services/storageClient.js', () => ({
  storageClient: mockStorageClient,
  uploadToGCS: mockStorageClient.uploadFile,
  getPublicUrl: mockStorageClient.getPublicUrl,
}));
