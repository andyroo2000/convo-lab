import { useEffect, useState } from 'react';
import { CheckCircle, Circle, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

import { API_URL } from '../../../config';

interface CourseDetailsProps {
  courseId: string;
}

interface VocabularyItem {
  textL2: string;
  readingL2?: string;
  translationL1: string;
}

interface Exchange {
  speakerName?: string;
  order?: number;
  textL2: string;
  readingL2?: string;
  translationL1: string;
  vocabularyItems?: VocabularyItem[];
}

interface ScriptUnit {
  type: string;
  text?: string;
  speed?: number;
  seconds?: number;
  [key: string]: unknown;
}

interface CourseInfo {
  id: string;
  title: string;
  description?: string;
  status: string;
  createdAt: string;
  jlptLevel?: string;
  hasExchanges: boolean;
  hasScript: boolean;
  hasAudio: boolean;
  audioUrl?: string;
  sourceText?: string;
  exchanges?: Exchange[];
  scriptUnits?: ScriptUnit[];
}

const CourseDetails = ({ courseId }: CourseDetailsProps) => {
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSourceText, setShowSourceText] = useState(true);
  const [showExchanges, setShowExchanges] = useState(false);
  const [showScriptUnits, setShowScriptUnits] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState('');

  useEffect(() => {
    const fetchCourseDetails = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await fetch(`${API_URL}/api/admin/script-lab/courses/${courseId}`, {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to fetch course details');
        const data = await response.json();
        setCourse(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load course');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourseDetails();
  }, [courseId]);

  const handleGenerateCourse = async () => {
    setIsGenerating(true);
    setError('');
    setGenerateSuccess('');
    try {
      // Call the admin course generation endpoint
      const response = await fetch(`${API_URL}/api/admin/courses/${courseId}/generate-dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to generate course content');
      }

      setGenerateSuccess('Dialogue generation started! Refresh in a few moments to see the exchanges.');

      // Refresh course details after a delay
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate course');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading course details...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-600">{error}</div>;
  }

  if (!course) {
    return null;
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4">
      {/* Success Message */}
      {generateSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {generateSuccess}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-navy">{course.title}</h3>
          <p className="text-sm text-gray-500">
            Created: {new Date(course.createdAt).toLocaleDateString()}
          </p>
        </div>
        {(() => {
          let statusClasses = 'px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700';
          if (course.status === 'ready') {
            statusClasses = 'px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700';
          } else if (course.status === 'generating') {
            statusClasses = 'px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-700';
          } else if (course.status === 'error') {
            statusClasses = 'px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-700';
          }
          return <span className={statusClasses}>{course.status}</span>;
        })()}
      </div>

      {/* Generate Content Button */}
      {!course.hasExchanges && course.status === 'draft' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700 mb-3">
            📝 This course has no content yet. Generate dialogue exchanges from the source text to
            get started.
          </p>
          <button
            type="button"
            onClick={handleGenerateCourse}
            disabled={isGenerating}
            className="btn-primary"
          >
            {isGenerating ? 'Generating...' : 'Generate Dialogue Exchanges'}
          </button>
        </div>
      )}

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Pipeline Status</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            {course.hasExchanges ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <Circle className="w-4 h-4 text-gray-300" />
            )}
            <span className={course.hasExchanges ? 'text-gray-900' : 'text-gray-400'}>
              Dialogue Exchanges Generated
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {course.hasScript ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <Circle className="w-4 h-4 text-gray-300" />
            )}
            <span className={course.hasScript ? 'text-gray-900' : 'text-gray-400'}>
              Script Units Generated
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {course.hasAudio ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <Circle className="w-4 h-4 text-gray-300" />
            )}
            <span className={course.hasAudio ? 'text-gray-900' : 'text-gray-400'}>
              Audio Assembled
            </span>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-gray-200">
        <a
          href={`/app/courses/${course.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-indigo hover:text-indigo-dark flex items-center gap-1"
        >
          View in Course Library
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Source Text */}
      {course.sourceText && (
        <div className="pt-2 border-t border-gray-200">
          <button
            type="button"
            onClick={() => setShowSourceText(!showSourceText)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-indigo transition-colors mb-2"
          >
            {showSourceText ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            Source Text
          </button>
          {showSourceText && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
              <p className="text-sm whitespace-pre-wrap font-mono">{course.sourceText}</p>
            </div>
          )}
        </div>
      )}

      {/* Exchanges (if generated) */}
      {course.hasExchanges && course.exchanges && (
        <div className="pt-2 border-t border-gray-200">
          <button
            type="button"
            onClick={() => setShowExchanges(!showExchanges)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-indigo transition-colors mb-2"
          >
            {showExchanges ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            Dialogue Exchanges ({Array.isArray(course.exchanges) ? course.exchanges.length : 0})
          </button>
          {showExchanges && (
            <div className="space-y-3">
              {Array.isArray(course.exchanges) &&
                course.exchanges.map((exchange, index) => (
                  <div key={`exchange-${exchange.order || index}`} className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-semibold text-indigo">
                        {exchange.speakerName || `Speaker ${index + 1}`}
                      </span>
                      <span className="text-xs text-gray-500">Exchange {exchange.order || index + 1}</span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Japanese:</div>
                        <div className="text-sm font-medium text-gray-900">{exchange.textL2}</div>
                      </div>
                      {exchange.readingL2 && (
                        <div>
                          <div className="text-xs text-gray-600 mb-1">Reading:</div>
                          <div className="text-sm text-gray-700 font-mono">{exchange.readingL2}</div>
                        </div>
                      )}
                      <div>
                        <div className="text-xs text-gray-600 mb-1">English:</div>
                        <div className="text-sm text-gray-700 italic">{exchange.translationL1}</div>
                      </div>
                      {exchange.vocabularyItems && exchange.vocabularyItems.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-600 mb-1">Vocabulary:</div>
                          <div className="flex flex-wrap gap-2">
                            {exchange.vocabularyItems.map((vocab) => (
                              <span
                                key={`vocab-${vocab.textL2}-${vocab.readingL2 || ''}`}
                                className="inline-flex items-center px-2 py-1 bg-white border border-blue-300 rounded text-xs"
                              >
                                <span className="font-medium">{vocab.textL2}</span>
                                {vocab.readingL2 && (
                                  <span className="ml-1 text-gray-500">({vocab.readingL2})</span>
                                )}
                                <span className="ml-1 text-gray-600">= {vocab.translationL1}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Script Units (if generated) */}
      {course.hasScript && course.scriptUnits && (
        <div className="pt-2 border-t border-gray-200">
          <button
            type="button"
            onClick={() => setShowScriptUnits(!showScriptUnits)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-indigo transition-colors mb-2"
          >
            {showScriptUnits ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            Lesson Script Units ({Array.isArray(course.scriptUnits) ? course.scriptUnits.length : 0})
          </button>
          {showScriptUnits && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {Array.isArray(course.scriptUnits) &&
                course.scriptUnits.map((unit, index) => (
                  <div key={`unit-${unit.type}-${unit.text?.substring(0, 20) || index}`} className="flex items-start gap-3 text-sm">
                    <span className="text-xs text-gray-400 font-mono w-8 flex-shrink-0">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      {unit.type === 'narration_L1' && (
                        <div className="bg-amber-50 border-l-4 border-amber-400 px-3 py-2">
                          <div className="text-xs text-amber-600 font-semibold mb-1">
                            NARRATOR (English)
                          </div>
                          <div className="text-gray-700 italic">{unit.text}</div>
                        </div>
                      )}
                      {unit.type === 'L2' && (
                        <div className="bg-blue-50 border-l-4 border-blue-400 px-3 py-2">
                          <div className="text-xs text-blue-600 font-semibold mb-1">
                            JAPANESE {unit.speed !== 1.0 && `(${unit.speed}x speed)`}
                          </div>
                          <div className="text-gray-900 font-medium">{unit.text}</div>
                          {unit.reading && (
                            <div className="text-gray-600 text-xs font-mono mt-1">
                              {unit.reading}
                            </div>
                          )}
                        </div>
                      )}
                      {unit.type === 'pause' && (
                        <div className="bg-gray-50 border-l-4 border-gray-300 px-3 py-2">
                          <div className="text-xs text-gray-500">
                            PAUSE: {unit.durationSeconds}s
                          </div>
                        </div>
                      )}
                      {unit.type === 'marker' && (
                        <div className="bg-purple-50 border-l-4 border-purple-300 px-3 py-2">
                          <div className="text-xs text-purple-600 font-semibold">
                            MARKER: {unit.label}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      <div className="pt-2 border-t border-gray-200">
        <p className="text-sm text-gray-600 mb-2">
          This test course is ready for experimentation. Use the Audio Format Tester below to test
          different Japanese text preprocessing approaches.
        </p>
        {!course.hasExchanges && (
          <p className="text-sm text-amber-600">
            💡 To generate the full course pipeline (exchanges → script → audio), use the existing
            admin course endpoints or wait for Phase 2 of Script Lab which will add visual pipeline
            controls.
          </p>
        )}
      </div>
    </div>
  );
};

export default CourseDetails;
