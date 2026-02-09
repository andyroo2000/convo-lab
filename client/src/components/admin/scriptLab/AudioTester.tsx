import { useState } from 'react';
import { Play } from 'lucide-react';

import { API_URL } from '../../../config';

interface TestResult {
  format?: string;
  allFormats?: unknown[];
  [key: string]: unknown;
}

interface AudioTesterProps {
  onResultsChange: (results: TestResult | null) => void;
}

type AudioFormat = 'kanji' | 'kana' | 'mixed' | 'furigana_brackets';

const AudioTester = ({ onResultsChange }: AudioTesterProps) => {
  const [text, setText] = useState('');
  const [format, setFormat] = useState<AudioFormat>('kanji');
  const [voiceId, setVoiceId] = useState('fishaudio:0dff3f6860294829b98f8c4501b2cf25');
  const [speed, setSpeed] = useState(1.0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleGenerateAudio = async () => {
    if (!text.trim()) {
      setError('Please enter Japanese text');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/admin/script-lab/test-pronunciation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          text,
          format,
          voiceId,
          speed,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to generate audio');
      }

      const result = await response.json();
      onResultsChange(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate audio');
      onResultsChange(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAll = async () => {
    if (!text.trim()) {
      setError('Please enter Japanese text');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const formats: AudioFormat[] = ['kanji', 'kana', 'mixed', 'furigana_brackets'];
      const results = await Promise.all(
        formats.map(async (fmt) => {
          const response = await fetch(`${API_URL}/api/admin/script-lab/test-pronunciation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              text,
              format: fmt,
              voiceId,
              speed,
            }),
          });

          if (!response.ok) {
            throw new Error(`Failed to generate audio for format: ${fmt}`);
          }

          return response.json();
        })
      );

      onResultsChange({ allFormats: results });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate all formats');
      onResultsChange(null);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Japanese Text Input */}
      <div>
        <label htmlFor="japanese-text-input" className="block text-sm font-medium text-gray-700 mb-1">
          Japanese Text <span className="text-red-500">*</span>
        </label>
        <textarea
          id="japanese-text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full border border-gray-200 rounded-md px-3 py-2"
          rows={3}
          placeholder="北海道に行きました。"
        />
        <p className="text-xs text-gray-500 mt-1">
          Enter Japanese text to test with different preprocessing formats
        </p>
      </div>

      {/* Format Selector */}
      <div>
        <div className="block text-sm font-medium text-gray-700 mb-1">Text Format</div>
        <div role="group" aria-label="Text format selection" className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setFormat('kanji')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              format === 'kanji'
                ? 'bg-indigo text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Kanji (as-is)
          </button>
          <button
            type="button"
            onClick={() => setFormat('kana')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              format === 'kana'
                ? 'bg-indigo text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Kana (strip kanji)
          </button>
          <button
            type="button"
            onClick={() => setFormat('mixed')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              format === 'mixed'
                ? 'bg-indigo text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Mixed (no preprocessing)
          </button>
          <button
            type="button"
            onClick={() => setFormat('furigana_brackets')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              format === 'furigana_brackets'
                ? 'bg-indigo text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Furigana Brackets
          </button>
        </div>
      </div>

      {/* Voice Selector */}
      <div>
        <label htmlFor="voice-selector" className="block text-sm font-medium text-gray-700 mb-1">Voice</label>
        <select
          id="voice-selector"
          value={voiceId}
          onChange={(e) => setVoiceId(e.target.value)}
          className="w-full border border-gray-200 rounded-md px-3 py-2"
        >
          <option value="fishaudio:0dff3f6860294829b98f8c4501b2cf25">
            Fish Audio - Japanese Female 01
          </option>
          <option value="fishaudio:a005bc9db1f94a3581f1e2f4eb91e303">
            Fish Audio - Japanese Female 02
          </option>
          <option value="fishaudio:8f8a0a0e9daa40cfb4c9b0c4cf84c73f">
            Fish Audio - Japanese Male 01
          </option>
          <option value="fishaudio:0e4e8f3cc8004dc795f1a5e7e8e9fae0">
            Fish Audio - Japanese Male 02
          </option>
        </select>
      </div>

      {/* Speed Slider */}
      <div>
        <label htmlFor="speed-slider" className="block text-sm font-medium text-gray-700 mb-1">
          Speed: {speed.toFixed(2)}x
        </label>
        <input
          id="speed-slider"
          type="range"
          min="0.7"
          max="1.0"
          step="0.05"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>Slow (0.7x)</span>
          <span>Normal (1.0x)</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleGenerateAudio}
          className="btn-primary flex items-center gap-2"
          disabled={isGenerating}
        >
          <Play className="w-4 h-4" />
          {isGenerating ? 'Generating...' : 'Generate Audio'}
        </button>

        <button
          type="button"
          onClick={handleGenerateAll}
          className="btn-secondary flex items-center gap-2"
          disabled={isGenerating}
        >
          {isGenerating ? 'Generating All...' : 'Generate All 4 Formats'}
        </button>
      </div>
    </div>
  );
};

export default AudioTester;
