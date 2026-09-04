import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle, Circle, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

import { adminApi } from '../../../lib/adminApi';

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
  type: 'narration_L1' | 'L2' | 'pause' | 'marker';
  text?: string;
  reading?: string;
  speed?: number;
  durationSeconds?: number;
  label?: string;
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

const STATUS_CLASSES: Record<string, string> = {
  ready: 'bg-green-100 text-green-700',
  generating: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
};

const StatusBadge = ({ status }: { status: string }) => {
  const colors = STATUS_CLASSES[status] ?? 'bg-gray-100 text-gray-700';
  return <span className={`px-2 py-1 text-xs font-medium rounded ${colors}`}>{status}</span>;
};

const PipelineStep = ({ complete, children }: { complete: boolean; children: string }) => {
  const Icon = complete ? CheckCircle : Circle;
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className={`w-4 h-4 ${complete ? 'text-green-600' : 'text-gray-300'}`} />
      <span className={complete ? 'text-gray-900' : 'text-gray-400'}>{children}</span>
    </div>
  );
};

const PipelineStatus = ({ course }: { course: CourseInfo }) => (
  <div>
    <h4 className="text-sm font-medium text-gray-700 mb-2">Pipeline Status</h4>
    <div className="space-y-2">
      <PipelineStep complete={course.hasExchanges}>Dialogue Exchanges Generated</PipelineStep>
      <PipelineStep complete={course.hasScript}>Script Units Generated</PipelineStep>
      <PipelineStep complete={course.hasAudio}>Audio Assembled</PipelineStep>
    </div>
  </div>
);

interface SectionToggleProps {
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

const SectionToggle = ({ isOpen, onToggle, children }: SectionToggleProps) => {
  const Icon = isOpen ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-indigo transition-colors mb-2"
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
};

interface SourceTextSectionProps {
  sourceText?: string;
  isOpen: boolean;
  onToggle: () => void;
}

const SourceTextSection = ({ sourceText, isOpen, onToggle }: SourceTextSectionProps) => {
  if (!sourceText) return null;
  return (
    <div className="pt-2 border-t border-gray-200">
      <SectionToggle isOpen={isOpen} onToggle={onToggle}>
        Source Text
      </SectionToggle>
      {isOpen && (
        <div className="retro-admin-v3-subpanel bg-gray-50 border border-gray-200 rounded-md p-3">
          <p className="text-sm whitespace-pre-wrap font-mono">{sourceText}</p>
        </div>
      )}
    </div>
  );
};

const VocabularyList = ({ items }: { items?: VocabularyItem[] }) => {
  if (!items?.length) return null;
  return (
    <div>
      <div className="text-xs text-gray-600 mb-1">Vocabulary:</div>
      <div className="flex flex-wrap gap-2">
        {items.map((vocab) => (
          <span
            key={`vocab-${vocab.textL2}-${vocab.readingL2 || ''}`}
            className="inline-flex items-center px-2 py-1 bg-white border border-blue-300 rounded text-xs retro-admin-v3-pill"
          >
            <span className="font-medium">{vocab.textL2}</span>
            {vocab.readingL2 && <span className="ml-1 text-gray-500">({vocab.readingL2})</span>}
            <span className="ml-1 text-gray-600">= {vocab.translationL1}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

const ExchangeCard = ({ exchange, index }: { exchange: Exchange; index: number }) => (
  <div className="retro-admin-v3-subpanel bg-blue-50 border border-blue-200 rounded-md p-3">
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
      <VocabularyList items={exchange.vocabularyItems} />
    </div>
  </div>
);

interface ExchangesSectionProps {
  hasExchanges: boolean;
  exchanges?: Exchange[];
  isOpen: boolean;
  onToggle: () => void;
}

const ExchangesSection = ({ hasExchanges, exchanges, isOpen, onToggle }: ExchangesSectionProps) => {
  if (!hasExchanges || !exchanges) return null;
  const items = Array.isArray(exchanges) ? exchanges : [];
  return (
    <div className="pt-2 border-t border-gray-200">
      <SectionToggle isOpen={isOpen} onToggle={onToggle}>
        Dialogue Exchanges ({items.length})
      </SectionToggle>
      {isOpen && (
        <div className="space-y-3">
          {items.map((exchange, index) => (
            <ExchangeCard
              key={`exchange-${exchange.order || index}`}
              exchange={exchange}
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ScriptUnitContent = ({ unit }: { unit: ScriptUnit }) => {
  if (unit.type === 'narration_L1') {
    return (
      <div className="bg-amber-50 border-l-4 border-amber-400 px-3 py-2">
        <div className="text-xs text-amber-600 font-semibold mb-1">NARRATOR (English)</div>
        <div className="text-gray-700 italic">{unit.text}</div>
      </div>
    );
  }
  if (unit.type === 'L2') {
    return (
      <div className="bg-blue-50 border-l-4 border-blue-400 px-3 py-2">
        <div className="text-xs text-blue-600 font-semibold mb-1">
          JAPANESE {unit.speed !== 1.0 && `(${unit.speed}x speed)`}
        </div>
        <div className="text-gray-900 font-medium">{unit.text}</div>
        {unit.reading && <div className="text-gray-600 text-xs font-mono mt-1">{unit.reading}</div>}
      </div>
    );
  }
  if (unit.type === 'pause') {
    return (
      <div className="bg-gray-50 border-l-4 border-gray-300 px-3 py-2">
        <div className="text-xs text-gray-500">PAUSE: {unit.durationSeconds}s</div>
      </div>
    );
  }
  if (unit.type === 'marker') {
    return (
      <div className="bg-purple-50 border-l-4 border-purple-300 px-3 py-2">
        <div className="text-xs text-purple-600 font-semibold">MARKER: {unit.label}</div>
      </div>
    );
  }
  return null;
};

interface ScriptUnitsSectionProps {
  hasScript: boolean;
  scriptUnits?: ScriptUnit[];
  isOpen: boolean;
  onToggle: () => void;
}

const ScriptUnitsSection = ({
  hasScript,
  scriptUnits,
  isOpen,
  onToggle,
}: ScriptUnitsSectionProps) => {
  if (!hasScript || !scriptUnits) return null;
  const units = Array.isArray(scriptUnits) ? scriptUnits : [];
  return (
    <div className="pt-2 border-t border-gray-200">
      <SectionToggle isOpen={isOpen} onToggle={onToggle}>
        Lesson Script Units ({units.length})
      </SectionToggle>
      {isOpen && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {units.map((unit, index) => (
            <div
              key={`unit-${unit.type}-${unit.text?.substring(0, 20) || index}`}
              className="flex items-start gap-3 text-sm"
            >
              <span className="text-xs text-gray-400 font-mono w-8 flex-shrink-0">{index + 1}</span>
              <div className="flex-1">
                <ScriptUnitContent unit={unit} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface GeneratePromptProps {
  course: CourseInfo;
  isGenerating: boolean;
  onGenerate: () => void;
}

const GeneratePrompt = ({ course, isGenerating, onGenerate }: GeneratePromptProps) => {
  if (course.hasExchanges || course.status !== 'draft') return null;
  return (
    <div className="retro-admin-v3-note bg-blue-50 border border-blue-200 rounded-lg p-4">
      <p className="text-sm text-blue-700 mb-3">
        📝 This course has no content yet. Generate dialogue exchanges from the source text to get
        started.
      </p>
      <button
        type="button"
        onClick={onGenerate}
        disabled={isGenerating}
        className="retro-admin-v3-btn-primary"
      >
        {isGenerating ? 'Generating...' : 'Generate Dialogue Exchanges'}
      </button>
    </div>
  );
};

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
        const response = await fetch(adminApi.scriptLabCourse(courseId), {
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
      const response = await fetch(adminApi.adminCourseOperation(courseId, 'generate-dialogue'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to generate course content');
      }

      setGenerateSuccess(
        'Dialogue generation started! Refresh in a few moments to see the exchanges.'
      );

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
    return <div className="retro-admin-v3-muted text-sm">Loading course details...</div>;
  }

  if (error) {
    return <div className="retro-admin-v3-alert is-error text-sm">{error}</div>;
  }

  if (!course) {
    return null;
  }

  return (
    <div className="retro-admin-v3-subpanel border border-gray-200 rounded-lg p-4 space-y-4">
      {/* Success Message */}
      {generateSuccess && <div className="retro-admin-v3-alert is-success">{generateSuccess}</div>}

      {/* Error Message */}
      {error && <div className="retro-admin-v3-alert is-error">{error}</div>}

      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-navy">{course.title}</h3>
          <p className="text-sm text-gray-500">
            Created: {new Date(course.createdAt).toLocaleDateString()}
          </p>
        </div>
        <StatusBadge status={course.status} />
      </div>

      <GeneratePrompt
        course={course}
        isGenerating={isGenerating}
        onGenerate={handleGenerateCourse}
      />

      <PipelineStatus course={course} />

      <div className="pt-2 border-t border-gray-200">
        <a
          href={`/app/courses/${course.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm retro-admin-v3-link flex items-center gap-1"
        >
          View in Course Library
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <SourceTextSection
        sourceText={course.sourceText}
        isOpen={showSourceText}
        onToggle={() => setShowSourceText(!showSourceText)}
      />

      <ExchangesSection
        hasExchanges={course.hasExchanges}
        exchanges={course.exchanges}
        isOpen={showExchanges}
        onToggle={() => setShowExchanges(!showExchanges)}
      />

      <ScriptUnitsSection
        hasScript={course.hasScript}
        scriptUnits={course.scriptUnits}
        isOpen={showScriptUnits}
        onToggle={() => setShowScriptUnits(!showScriptUnits)}
      />

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
