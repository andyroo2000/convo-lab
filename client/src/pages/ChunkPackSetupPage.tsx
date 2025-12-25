import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Loader } from 'lucide-react';
import { useInvalidateLibrary } from '../hooks/useLibraryData';
import { useIsDemo } from '../hooks/useDemo';
import { API_URL } from '../config';
import DemoRestrictionModal from '../components/common/DemoRestrictionModal';

type JLPTLevel = 'N5' | 'N4' | 'N3';

type ChunkPackTheme =
  // N5
  | 'daily_routine'
  | 'greetings'
  | 'shopping'
  | 'family'
  | 'school'
  | 'food'
  | 'weather'
  | 'hobbies'
  // N4
  | 'health'
  | 'travel'
  | 'opinions'
  | 'plans'
  | 'feelings'
  | 'requests'
  | 'advice'
  | 'experiences'
  // N3
  | 'work'
  | 'social_life'
  | 'habits'
  | 'expectations'
  | 'comparisons'
  | 'reasoning'
  | 'preferences'
  | 'goals';

interface ThemeMetadata {
  id: ChunkPackTheme;
  name: string;
  level: JLPTLevel;
  description: string;
}

// Theme metadata (matches backend CHUNK_THEMES)
const CHUNK_THEMES: Record<ChunkPackTheme, ThemeMetadata> = {
  // N5
  daily_routine: {
    id: 'daily_routine',
    name: 'Daily Routine',
    level: 'N5',
    description: 'Essential expressions for daily activities',
  },
  greetings: {
    id: 'greetings',
    name: 'Greetings & Politeness',
    level: 'N5',
    description: 'Common social expressions',
  },
  shopping: {
    id: 'shopping',
    name: 'Shopping',
    level: 'N5',
    description: 'Buying things and asking about products',
  },
  family: {
    id: 'family',
    name: 'Family',
    level: 'N5',
    description: 'Talking about family and relationships',
  },
  school: {
    id: 'school',
    name: 'School',
    level: 'N5',
    description: 'Education-related expressions',
  },
  food: {
    id: 'food',
    name: 'Food & Eating',
    level: 'N5',
    description: 'Meals and food preferences',
  },
  weather: {
    id: 'weather',
    name: 'Weather',
    level: 'N5',
    description: 'Talking about weather and seasons',
  },
  hobbies: {
    id: 'hobbies',
    name: 'Hobbies & Interests',
    level: 'N5',
    description: 'Leisure activities',
  },
  // N4
  health: {
    id: 'health',
    name: 'Health & Body',
    level: 'N4',
    description: 'Medical situations and advice',
  },
  travel: {
    id: 'travel',
    name: 'Travel',
    level: 'N4',
    description: 'Planning trips and navigating',
  },
  opinions: {
    id: 'opinions',
    name: 'Opinions',
    level: 'N4',
    description: 'Expressing thoughts and uncertainty',
  },
  plans: {
    id: 'plans',
    name: 'Plans & Intentions',
    level: 'N4',
    description: 'Future intentions and decisions',
  },
  feelings: {
    id: 'feelings',
    name: 'Feelings & Emotions',
    level: 'N4',
    description: 'Expressing emotional states',
  },
  requests: {
    id: 'requests',
    name: 'Requests & Permissions',
    level: 'N4',
    description: 'Politely asking for things',
  },
  advice: {
    id: 'advice',
    name: 'Advice & Suggestions',
    level: 'N4',
    description: 'Giving and receiving recommendations',
  },
  experiences: {
    id: 'experiences',
    name: 'Experiences',
    level: 'N4',
    description: "Talking about what you've done",
  },
  // N3
  work: { id: 'work', name: 'Work & Professional', level: 'N3', description: 'Workplace language' },
  social_life: {
    id: 'social_life',
    name: 'Social Life',
    level: 'N3',
    description: 'Social expectations and relationships',
  },
  habits: {
    id: 'habits',
    name: 'Habits & Routines',
    level: 'N3',
    description: 'Describing regular behaviors',
  },
  expectations: {
    id: 'expectations',
    name: 'Expectations',
    level: 'N3',
    description: 'What should or will happen',
  },
  comparisons: {
    id: 'comparisons',
    name: 'Comparisons',
    level: 'N3',
    description: 'Contrasting and comparing',
  },
  reasoning: {
    id: 'reasoning',
    name: 'Reasoning',
    level: 'N3',
    description: 'Explaining causes and reasons',
  },
  preferences: {
    id: 'preferences',
    name: 'Preferences',
    level: 'N3',
    description: 'Expressing likes and choices',
  },
  goals: {
    id: 'goals',
    name: 'Goals & Purposes',
    level: 'N3',
    description: 'Expressing aims and objectives',
  },
};

function getThemesForLevel(level: JLPTLevel): ThemeMetadata[] {
  return Object.values(CHUNK_THEMES).filter((theme) => theme.level === level);
}

const ChunkPackSetupPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(['chunkPack']);
  const invalidateLibrary = useInvalidateLibrary();
  const isDemo = useIsDemo();
  const [jlptLevel, setJlptLevel] = useState<JLPTLevel>('N5');
  const [theme, setTheme] = useState<ChunkPackTheme>('daily_routine');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [showDemoModal, setShowDemoModal] = useState(false);

  // When JLPT level changes, reset to first theme for that level
  useEffect(() => {
    const themesForLevel = getThemesForLevel(jlptLevel);
    if (themesForLevel.length > 0) {
      setTheme(themesForLevel[0].id);
    }
  }, [jlptLevel]);

  const handleStartGeneration = async () => {
    // Block demo users from generating content
    if (isDemo) {
      setShowDemoModal(true);
      return;
    }

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
          // Invalidate library cache so new pack shows up
          invalidateLibrary();
          // Navigate to the pack examples
          navigate(`/app/chunk-packs/${jobData.result.packId}/examples`);
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
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 pb-6 border-b-4 border-yellow">
        <h1 className="text-5xl font-bold text-dark-brown mb-3">{t('chunkPack:pageTitle')}</h1>
        <p className="text-xl text-gray-600">{t('chunkPack:pageSubtitle')}</p>
      </div>

      {/* Main Card */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-white border-l-8 border-yellow p-8 shadow-sm">
          {/* Description */}
          <div className="bg-yellow-light border-l-4 border-yellow p-6 mb-8">
            <h2 className="text-xl font-bold text-dark-brown mb-3">{t('chunkPack:what.title')}</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              {t('chunkPack:what.description')}
            </p>
          </div>

          {/* Setup Options */}
          <div className="space-y-8">
            {/* JLPT Level Selection */}
            <div>
              <label htmlFor="chunk-pack-level-selection" className="block text-base sm:text-lg font-bold text-dark-brown mb-3 sm:mb-4">
                {t('chunkPack:setup.selectLevel')}
              </label>
              <div id="chunk-pack-level-selection" className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3" role="group" aria-label={t('chunkPack:setup.selectLevel')}>
                {(['N5', 'N4', 'N3'] as JLPTLevel[]).map((level) => (
                  <button
                    type="button"
                    key={level}
                    onClick={() => setJlptLevel(level)}
                    disabled={isGenerating}
                    className={`px-4 sm:px-6 py-3 sm:py-4 rounded-lg border-2 font-bold transition-all ${
                      jlptLevel === level
                        ? 'border-yellow bg-yellow text-dark-brown shadow-md'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-yellow hover:bg-yellow-light'
                    } disabled:opacity-50`}
                  >
                    <div className="text-lg sm:text-xl font-bold">{level}</div>
                    <div className="text-xs sm:text-sm mt-1 font-medium">
                      {t(`chunkPack:levels.${level.toLowerCase()}`)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Theme Selection */}
            <div>
              <label htmlFor="chunk-pack-theme-selection" className="block text-base sm:text-lg font-bold text-dark-brown mb-3 sm:mb-4">
                {t('chunkPack:setup.selectTheme')}
              </label>
              <div id="chunk-pack-theme-selection" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 max-h-80 overflow-y-auto p-2" role="group" aria-label={t('chunkPack:setup.selectTheme')}>
                {availableThemes.map((themeData) => (
                  <button
                    type="button"
                    key={themeData.id}
                    onClick={() => setTheme(themeData.id)}
                    disabled={isGenerating}
                    className={`px-3 sm:px-4 py-2 sm:py-3 rounded-lg border-2 text-left transition-all ${
                      theme === themeData.id
                        ? 'border-yellow bg-yellow text-dark-brown shadow-md'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-yellow hover:bg-yellow-light'
                    } disabled:opacity-50`}
                  >
                    <div className="font-bold text-sm sm:text-base">
                      {t(`chunkPack:themes.${themeData.id}.name`)}
                    </div>
                    <div className="text-xs sm:text-sm mt-1 text-gray-600">
                      {t(`chunkPack:themes.${themeData.id}.description`)}
                    </div>
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
                <span className="text-sm font-medium text-gray-700">
                  {t('chunkPack:progress.generating')}
                </span>
                <span className="text-sm text-gray-500">{progress}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">{t('chunkPack:progress.tip')}</p>
            </div>
          )}

          {/* Start Button */}
          <div className="mt-8">
            <button
              type="button"
              onClick={handleStartGeneration}
              disabled={isGenerating}
              className="w-full bg-yellow hover:bg-yellow-dark text-dark-brown font-bold text-base sm:text-lg px-8 sm:px-10 py-4 sm:py-5 rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3"
            >
              {isGenerating ? (
                <>
                  <Loader className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                  {t('chunkPack:actions.generating')}
                </>
              ) : (
                <>
                  <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
                  {t('chunkPack:actions.generate')}
                </>
              )}
            </button>
          </div>

          {/* Info Footer */}
          <div className="mt-6 pt-6 border-t text-center text-sm text-gray-500">
            <p>{t('chunkPack:tip')}</p>
          </div>
        </div>
      </div>

      {/* Demo Restriction Modal */}
      <DemoRestrictionModal isOpen={showDemoModal} onClose={() => setShowDemoModal(false)} />
    </div>
  );
};

export default ChunkPackSetupPage;
