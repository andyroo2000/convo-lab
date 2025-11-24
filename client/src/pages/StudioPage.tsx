import { useNavigate } from 'react-router-dom';
import { MessageSquare, Headphones, Sparkles, Brain, BookOpen } from 'lucide-react';

export default function StudioPage() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-navy mb-2">Your Language Lab</h1>
        <p className="text-gray-600">
          Design custom activities using research-backed SLA methods
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Dialogue Content Type */}
        <button
          onClick={() => navigate('/app/studio/create/dialogue')}
          className="card hover:shadow-xl transition-all duration-300 text-left group cursor-pointer border-2 border-transparent hover:border-periwinkle"
          data-testid="studio-card-dialogues"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-periwinkle-light rounded-lg group-hover:bg-periwinkle/20 transition-colors">
              <MessageSquare className="w-8 h-8 text-periwinkle" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-navy mb-2 group-hover:text-periwinkle transition-colors">
                Comprehensible Input Dialogues
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Generate AI dialogues from your own stories, calibrated to your proficiency level. Rich, contextual input that's i+1.
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>✓ Personalized topics and scenarios</li>
                <li>✓ Multiple speakers at varied proficiency</li>
                <li>✓ Sentence variations to explore alternatives</li>
                <li>✓ Natural audio with adjustable speed</li>
              </ul>
            </div>
          </div>
        </button>

        {/* Course Content Type */}
        <button
          onClick={() => navigate('/app/studio/create/audio-course')}
          className="card hover:shadow-xl transition-all duration-300 text-left group cursor-pointer border-2 border-transparent hover:border-coral"
          data-testid="studio-card-audio-course"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-coral-light rounded-lg group-hover:bg-coral/20 transition-colors">
              <Headphones className="w-8 h-8 text-coral" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-navy mb-2 group-hover:text-coral transition-colors">
                Guided Audio Course
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Audio-only lessons built from your dialogues—~30 minutes each, perfect for your commute or morning walk. No screen needed.
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>✓ Hands-free, audio-only format</li>
                <li>✓ Built from your dialogue library</li>
                <li>✓ Guided L1 narration with L2 recall prompts</li>
                <li>✓ Spaced repetition across 30-min lessons</li>
              </ul>
            </div>
          </div>
        </button>

        {/* Narrow Listening Content Type */}
        <button
          onClick={() => navigate('/app/studio/create/narrow-listening')}
          className="card hover:shadow-xl transition-all duration-300 text-left group cursor-pointer border-2 border-transparent hover:border-strawberry"
          data-testid="studio-card-narrow-listening"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-strawberry-light rounded-lg group-hover:bg-strawberry/20 transition-colors">
              <Sparkles className="w-8 h-8 text-strawberry" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-navy mb-2 group-hover:text-strawberry transition-colors">
                Narrow Listening Packs
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                The same story told 5 different ways—different tenses, formality, and perspectives. Deeply internalize patterns through repetition with variation.
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>✓ 5 controlled variations per pack</li>
                <li>✓ Systematic grammar/politeness changes</li>
                <li>✓ Multiple speed options (0.7x - 1.0x)</li>
                <li>✓ JLPT-level targeting</li>
              </ul>
            </div>
          </div>
        </button>

        {/* Processing Instruction Mode */}
        <button
          onClick={() => navigate('/app/studio/create/processing-instruction')}
          className="card hover:shadow-xl transition-all duration-300 text-left group cursor-pointer border-2 border-transparent hover:border-indigo-600"
          data-testid="studio-card-processing-instruction"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition-colors">
              <Brain className="w-8 h-8 text-indigo-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-navy mb-2 group-hover:text-indigo-600 transition-colors">
                Processing Instruction Activities
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Learn grammar through structured input, not explicit rules. Answer meaning-based questions that train your brain to notice key features.
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>✓ Focus attention on form-meaning connections</li>
                <li>✓ Meaning-focused comprehension tasks</li>
                <li>✓ Audio-based with immediate feedback</li>
                <li>✓ No metalinguistic explanations during practice</li>
              </ul>
            </div>
          </div>
        </button>

        {/* Lexical Chunk Packs */}
        <button
          onClick={() => navigate('/app/studio/create/lexical-chunk-pack')}
          className="card hover:shadow-xl transition-all duration-300 text-left group cursor-pointer border-2 border-transparent hover:border-yellow"
          data-testid="studio-card-lexical-chunks"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-yellow-light rounded-lg group-hover:bg-yellow/20 transition-colors">
              <BookOpen className="w-8 h-8 text-yellow-dark" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-navy mb-2 group-hover:text-yellow-dark transition-colors">
                Lexical Chunk Packs
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Acquire phrases as complete units—the way native speakers use language. Learn high-frequency chunks through examples, stories, and usage-based exercises.
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>✓ 5-8 high-value chunks per pack</li>
                <li>✓ Multiple contextualized examples</li>
                <li>✓ Integrated story using all chunks</li>
                <li>✓ Meaning-focused practice exercises</li>
              </ul>
            </div>
          </div>
        </button>
      </div>

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>Experiment, iterate, and discover what works for your learning style.</p>
      </div>
    </div>
  );
}
