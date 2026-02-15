import { useRef, useState } from 'react';
import { Play } from 'lucide-react';

// eslint-disable-next-line import/no-extraneous-dependencies
import { TTS_VOICES } from '@languageflow/shared/src/constants-new';

import { API_URL } from '../../../config';
import VoicePreview from '../../common/VoicePreview';
import type { FormatResult, TestResults } from './ResultsViewer';

interface AudioTesterProps {
  onResultsChange: (results: TestResults | null) => void;
}

type AudioFormat = 'kanji' | 'kana' | 'mixed' | 'furigana_brackets';

const EMOTION_TAGS = [
  { label: 'Happy', tag: '(happy)' },
  { label: 'Sad', tag: '(sad)' },
  { label: 'Angry', tag: '(angry)' },
  { label: 'Excited', tag: '(excited)' },
  { label: 'Calm', tag: '(calm)' },
  { label: 'Nervous', tag: '(nervous)' },
  { label: 'Confident', tag: '(confident)' },
  { label: 'Surprised', tag: '(surprised)' },
  { label: 'Empathetic', tag: '(empathetic)' },
  { label: 'Grateful', tag: '(grateful)' },
  { label: 'Curious', tag: '(curious)' },
  { label: 'Sarcastic', tag: '(sarcastic)' },
];

const TONE_TAGS = [
  { label: 'Shouting', tag: '(shouting)' },
  { label: 'Screaming', tag: '(screaming)' },
  { label: 'Whispering', tag: '(whispering)' },
  { label: 'Soft Tone', tag: '(soft tone)' },
];

const AUDIO_EFFECT_TAGS = [
  { label: 'Laughing', tag: '(laughing)' },
  { label: 'Chuckling', tag: '(chuckling)' },
  { label: 'Sobbing', tag: '(sobbing)' },
  { label: 'Crying Loudly', tag: '(crying loudly)' },
  { label: 'Sighing', tag: '(sighing)' },
  { label: 'Groaning', tag: '(groaning)' },
  { label: 'Panting', tag: '(panting)' },
  { label: 'Gasping', tag: '(gasping)' },
  { label: 'Yawning', tag: '(yawning)' },
  { label: 'Snoring', tag: '(snoring)' },
];

const SPECIAL_EFFECT_TAGS = [
  { label: 'Break', tag: '(break)' },
  { label: 'Long Break', tag: '(long-break)' },
  { label: 'Breath', tag: '(breath)' },
  { label: 'Laugh (fx)', tag: '(laugh)' },
  { label: 'Cough', tag: '(cough)' },
  { label: 'Lip Smacking', tag: '(lip-smacking)' },
  { label: 'Sigh (fx)', tag: '(sigh)' },
  { label: 'Audience Laughing', tag: '(audience laughing)' },
  { label: 'Background Laughter', tag: '(background laughter)' },
  { label: 'Crowd Laughing', tag: '(crowd laughing)' },
];

const AudioTester = ({ onResultsChange }: AudioTesterProps) => {
  const [text, setText] = useState('');
  const [format, setFormat] = useState<AudioFormat>('kanji');
  const [voiceId, setVoiceId] = useState('fishaudio:0dff3f6860294829b98f8c4501b2cf25');
  const [speed, setSpeed] = useState(1.0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

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

      const result = (await response.json()) as TestResults;
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

      onResultsChange({ allFormats: results as FormatResult[] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate all formats');
      onResultsChange(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const insertTagAtCursor = (tag: string) => {
    const input = textAreaRef.current;
    if (!input) {
      setText((prev) => (prev ? `${prev} ${tag}` : tag));
      return;
    }

    const start = input.selectionStart ?? text.length;
    const end = input.selectionEnd ?? text.length;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const needsSpaceBefore = before.length > 0 && !/\s$/.test(before);
    const needsSpaceAfter = after.length > 0 && !/^\s/.test(after);
    const insertion = `${needsSpaceBefore ? ' ' : ''}${tag}${needsSpaceAfter ? ' ' : ''}`;
    const nextValue = `${before}${insertion}${after}`;
    setText(nextValue);

    requestAnimationFrame(() => {
      const nextCursor = before.length + insertion.length;
      input.focus();
      input.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const japaneseVoiceOptions = TTS_VOICES.ja.voices.filter(
    (voice) => voice.provider === 'fishaudio'
  );

  return (
    <div className="space-y-4 retro-admin-v3-module">
      {/* Error Message */}
      {error && <div className="retro-admin-v3-alert is-error">{error}</div>}

      {/* Japanese Text Input */}
      <div>
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label
          htmlFor="japanese-text-input"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Japanese Text <span className="text-red-500">*</span>
        </label>
        <textarea
          id="japanese-text-input"
          ref={textAreaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="retro-admin-v3-input w-full px-3 py-2"
          rows={3}
          placeholder="北海道に行きました。"
        />
        <p className="text-xs text-gray-500 mt-1">
          Enter Japanese text to test with different preprocessing formats
        </p>
      </div>

      {/* Speech Control Tags */}
      <div className="retro-admin-v3-subpanel border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-3">
        <div>
          <div className="text-xs font-semibold text-gray-600 uppercase mb-2">Emotions</div>
          <div className="flex flex-wrap gap-2">
            {EMOTION_TAGS.map((item) => (
              <button
                key={item.tag}
                type="button"
                onClick={() => insertTagAtCursor(item.tag)}
                className="retro-admin-v3-pill px-2.5 py-1 text-xs font-medium rounded-full bg-white border border-gray-200 text-gray-700 hover:border-indigo hover:text-indigo transition-colors"
                title={item.tag}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-gray-600 uppercase mb-2">Tone</div>
          <div className="flex flex-wrap gap-2">
            {TONE_TAGS.map((item) => (
              <button
                key={item.tag}
                type="button"
                onClick={() => insertTagAtCursor(item.tag)}
                className="retro-admin-v3-pill px-2.5 py-1 text-xs font-medium rounded-full bg-white border border-gray-200 text-gray-700 hover:border-indigo hover:text-indigo transition-colors"
                title={item.tag}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-gray-600 uppercase mb-2">Audio Effects</div>
          <div className="flex flex-wrap gap-2">
            {AUDIO_EFFECT_TAGS.map((item) => (
              <button
                key={item.tag}
                type="button"
                onClick={() => insertTagAtCursor(item.tag)}
                className="retro-admin-v3-pill px-2.5 py-1 text-xs font-medium rounded-full bg-white border border-gray-200 text-gray-700 hover:border-indigo hover:text-indigo transition-colors"
                title={item.tag}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-gray-600 uppercase mb-2">
            Breaks & Special Effects
          </div>
          <div className="flex flex-wrap gap-2">
            {SPECIAL_EFFECT_TAGS.map((item) => (
              <button
                key={item.tag}
                type="button"
                onClick={() => insertTagAtCursor(item.tag)}
                className="retro-admin-v3-pill px-2.5 py-1 text-xs font-medium rounded-full bg-white border border-gray-200 text-gray-700 hover:border-indigo hover:text-indigo transition-colors"
                title={item.tag}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Click a tag to insert it at the cursor. Emotion tags should go at the beginning of a
          sentence when possible.
        </p>
      </div>

      {/* Format Selector */}
      <div>
        <div className="block text-sm font-medium text-gray-700 mb-1">Text Format</div>
        <div role="group" aria-label="Text format selection" className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setFormat('kanji')}
            className={`retro-admin-v3-format-btn px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              format === 'kanji' ? 'is-active' : ''
            }`}
          >
            Kanji (as-is)
          </button>
          <button
            type="button"
            onClick={() => setFormat('kana')}
            className={`retro-admin-v3-format-btn px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              format === 'kana' ? 'is-active' : ''
            }`}
          >
            Kana (strip kanji)
          </button>
          <button
            type="button"
            onClick={() => setFormat('mixed')}
            className={`retro-admin-v3-format-btn px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              format === 'mixed' ? 'is-active' : ''
            }`}
          >
            Mixed (no preprocessing)
          </button>
          <button
            type="button"
            onClick={() => setFormat('furigana_brackets')}
            className={`retro-admin-v3-format-btn px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              format === 'furigana_brackets' ? 'is-active' : ''
            }`}
          >
            Furigana Brackets
          </button>
        </div>
      </div>

      {/* Voice Selector */}
      <div>
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label htmlFor="voice-selector" className="block text-sm font-medium text-gray-700 mb-1">
          Voice
        </label>
        <select
          id="voice-selector"
          value={voiceId}
          onChange={(e) => setVoiceId(e.target.value)}
          className="retro-admin-v3-input w-full px-3 py-2"
        >
          {japaneseVoiceOptions.map((voice) => (
            <option key={voice.id} value={voice.id}>
              {voice.description} ({voice.gender})
            </option>
          ))}
        </select>
        <VoicePreview voiceId={voiceId} />
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
          className="retro-admin-v3-btn-primary flex items-center gap-2"
          disabled={isGenerating}
        >
          <Play className="w-4 h-4" />
          {isGenerating ? 'Generating...' : 'Generate Audio'}
        </button>

        <button
          type="button"
          onClick={handleGenerateAll}
          className="retro-admin-v3-btn-secondary flex items-center gap-2"
          disabled={isGenerating}
        >
          {isGenerating ? 'Generating All...' : 'Generate All 4 Formats'}
        </button>
      </div>
    </div>
  );
};

export default AudioTester;
