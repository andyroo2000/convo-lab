import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Loader } from 'lucide-react';

import { API_URL } from '../config';

type JLPTLevel = 'N5' | 'N4' | 'N3';

type ChunkPackTheme =
  // N5
  | 'daily_routine' | 'greetings' | 'shopping' | 'family' | 'school' | 'food' | 'weather' | 'hobbies'
  // N4
  | 'health' | 'travel' | 'opinions' | 'plans' | 'feelings' | 'requests' | 'advice' | 'experiences'
  // N3
  | 'work' | 'social_life' | 'habits' | 'expectations' | 'comparisons' | 'reasoning' | 'preferences' | 'goals';

interface ThemeMetadata {
  id: ChunkPackTheme;
  name: string;
  level: JLPTLevel;
  description: string;
}

// Theme metadata (matches backend CHUNK_THEMES)
const CHUNK_THEMES: Record<ChunkPackTheme, ThemeMetadata> = {
  // N5
  daily_routine: { id: 'daily_routine', name: 'Daily Routine', level: 'N5', description: 'Essential expressions for daily activities' },
  greetings: { id: 'greetings', name: 'Greetings & Politeness', level: 'N5', description: 'Common social expressions' },
  shopping: { id: 'shopping', name: 'Shopping', level: 'N5', description: 'Buying things and asking about products' },
  family: { id: 'family', name: 'Family', level: 'N5', description: 'Talking about family and relationships' },
  school: { id: 'school', name: 'School', level: 'N5', description: 'Education-related expressions' },
  food: { id: 'food', name: 'Food & Eating', level: 'N5', description: 'Meals and food preferences' },
  weather: { id: 'weather', name: 'Weather', level: 'N5', description: 'Talking about weather and seasons' },
  hobbies: { id: 'hobbies', name: 'Hobbies & Interests', level: 'N5', description: 'Leisure activities' },
  // N4
  health: { id: 'health', name: 'Health & Body', level: 'N4', description: 'Medical situations and advice' },
  travel: { id: 'travel', name: 'Travel', level: 'N4', description: 'Planning trips and navigating' },
  opinions: { id: 'opinions', name: 'Opinions', level: 'N4', description: 'Expressing thoughts and uncertainty' },
  plans: { id: 'plans', name: 'Plans & Intentions', level: 'N4', description: 'Future intentions and decisions' },
  feelings: { id: 'feelings', name: 'Feelings & Emotions', level: 'N4', description: 'Expressing emotional states' },
  requests: { id: 'requests', name: 'Requests & Permissions', level: 'N4', description: 'Politely asking for things' },
  advice: { id: 'advice', name: 'Advice & Suggestions', level: 'N4', description: 'Giving and receiving recommendations' },
  experiences: { id: 'experiences', name: 'Experiences', level: 'N4', description: 'Talking about what you\'ve done' },
  // N3
  work: { id: 'work', name: 'Work & Professional', level: 'N3', description: 'Workplace language' },
  social_life: { id: 'social_life', name: 'Social Life', level: 'N3', description: 'Social expectations and relationships' },
  habits: { id: 'habits', name: 'Habits & Routines', level: 'N3', description: 'Describing regular behaviors' },
  expectations: { id: 'expectations', name: 'Expectations', level: 'N3', description: 'What should or will happen' },
  comparisons: { id: 'comparisons', name: 'Comparisons', level: 'N3', description: 'Contrasting and comparing' },
  reasoning: { id: 'reasoning', name: 'Reasoning', level: 'N3', description: 'Explaining causes and reasons' },
  preferences: { id: 'preferences', name: 'Preferences', level: 'N3', description: 'Expressing likes and choices' },
  goals: { id: 'goals', name: 'Goals & Purposes', level: 'N3', description: 'Expressing aims and objectives' },
};

function getThemesForLevel(level: JLPTLevel): ThemeMetadata[] {
  return Object.values(CHUNK_THEMES).filter(theme => theme.level === level);
}

export default function ChunkPackSetupPage() {
  const navigate = useNavigate();
  const [jlptLevel, setJlptLevel] = useState<JLPTLevel>('N5');
  const [theme, setTheme] = useState<ChunkPackTheme>('daily_routine');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // When JLPT level changes, reset to first theme for that level
  useEffect(() => {
    const themesForLevel = getThemesForLevel(jlptLevel);
    if (themesForLevel.length > 0) {
      setTheme(themesForLevel[0].id);
    }
  }, [jlptLevel]);

  const handleStartGeneration = async () => {
    setIsGenerating(true);
    setError(null);
    setProgress(0);

    try {
      // Start generation job
      const response = await fetch(`${API_URL}/api/chunk-packs/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jlptLevel,
          theme,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start chunk pack generation');
      }

      const { jobId } = await response.json();

      // Poll for job completion
      const pollJob = async () => {
        const jobResponse = await fetch(`${API_URL}/api/chunk-packs/job/${jobId}`, {
          credentials: 'include',
        });

        if (!jobResponse.ok) {
          throw new Error('Failed to check job status');
        }

        const jobData = await jobResponse.json();
        setProgress(jobData.progress || 0);

        if (jobData.state === 'completed') {
          // Navigate to the pack examples
          navigate(`/chunk-packs/${jobData.result.packId}/examples`);
        } else if (jobData.state === 'failed') {
          throw new Error('Chunk pack generation failed');
        } else {
          // Continue polling
          setTimeout(pollJob, 2000);
        }
      };

      pollJob();
    } catch (err: any) {
      console.error('Error generating chunk pack:', err);
      setError(err.message || 'Failed to generate chunk pack. Please try again.');
      setIsGenerating(false);
    }
  };

  const availableThemes = getThemesForLevel(jlptLevel);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <button
          onClick={() => navigate('/studio')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Studio
        </button>

        {/* Main Card */}
        <div className="card bg-white shadow-xl">
          {/* Title Section */}
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-navy">Lexical Chunk Packs</h1>
              <p className="text-gray-600 mt-1">Learn high-value Japanese chunks</p>
            </div>
          </div>

          {/* Description */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-8">
            <h2 className="font-semibold text-emerald-900 mb-2">What is this?</h2>
            <p className="text-sm text-emerald-800 leading-relaxed">
              Lexical Chunk Packs teach <strong>5-8 high-frequency Japanese chunks</strong> through examples, stories, and exercises.
              You'll learn multi-word phrases that real Japanese speakers use every day - not just isolated words.
              Each pack includes audio, context, and practice to help these chunks become part of your active vocabulary.
            </p>
          </div>

          {/* Setup Options */}
          <div className="space-y-6">
            {/* JLPT Level Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Select Your Level
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['N5', 'N4', 'N3'] as JLPTLevel[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => setJlptLevel(level)}
                    disabled={isGenerating}
                    className={`px-6 py-4 rounded-lg border-2 font-medium transition-all ${
                      jlptLevel === level
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    } disabled:opacity-50`}
                  >
                    <div className="text-xl font-bold">{level}</div>
                    <div className="text-xs mt-1">
                      {level === 'N5' && 'Beginner'}
                      {level === 'N4' && 'Elementary'}
                      {level === 'N3' && 'Intermediate'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Theme Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Select Theme
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-80 overflow-y-auto p-2">
                {availableThemes.map((themeData) => (
                  <button
                    key={themeData.id}
                    onClick={() => setTheme(themeData.id)}
                    disabled={isGenerating}
                    className={`px-4 py-3 rounded-lg border-2 text-left transition-all ${
                      theme === themeData.id
                        ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    } disabled:opacity-50`}
                  >
                    <div className="font-semibold text-sm">{themeData.name}</div>
                    <div className="text-xs mt-1 text-gray-600">{themeData.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Progress Bar */}
          {isGenerating && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Generating lexical chunk pack...</span>
                <span className="text-sm text-gray-500">{progress}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                This may take 30-60 seconds. We're generating content and audio...
              </p>
            </div>
          )}

          {/* Start Button */}
          <div className="mt-8 pt-6 border-t">
            <button
              onClick={handleStartGeneration}
              disabled={isGenerating}
              className="w-full btn-primary text-lg py-4 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Generating Lexical Chunk Pack...
                </>
              ) : (
                <>
                  <BookOpen className="w-5 h-5" />
                  Generate Lexical Chunk Pack
                </>
              )}
            </button>
          </div>

          {/* Info Footer */}
          <div className="mt-6 pt-6 border-t text-center text-sm text-gray-500">
            <p>
              💡 Tip: Each pack contains 5-8 chunks with examples, a story, and exercises.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
