import { useNavigate } from 'react-router-dom';
import { MessageSquare, Headphones, Sparkles, Brain, BookOpen } from 'lucide-react';

export default function StudioPage() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-navy mb-2">Create Learning Content</h1>
        <p className="text-gray-600">
          Choose the type of content you want to create
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Dialogue Content Type */}
        <button
          onClick={() => navigate('/studio/create/dialogue')}
          className="card hover:shadow-xl transition-all duration-300 text-left group cursor-pointer border-2 border-transparent hover:border-indigo"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo/10 rounded-lg group-hover:bg-indigo/20 transition-colors">
              <MessageSquare className="w-8 h-8 text-indigo" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-navy mb-2 group-hover:text-indigo transition-colors">
                Interactive Dialogue
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Create natural conversations from your stories and experiences. Perfect for practicing real-world scenarios.
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>✓ Multiple speakers with different proficiency levels</li>
                <li>✓ Natural conversation flow</li>
                <li>✓ Sentence variations for practice</li>
                <li>✓ Audio playback with timing</li>
              </ul>
            </div>
          </div>
        </button>

        {/* Course Content Type */}
        <button
          onClick={() => navigate('/studio/create/audio-course')}
          className="card hover:shadow-xl transition-all duration-300 text-left group cursor-pointer border-2 border-transparent hover:border-orange-500"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-orange-50 rounded-lg group-hover:bg-orange-100 transition-colors">
              <Headphones className="w-8 h-8 text-orange-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-navy mb-2 group-hover:text-orange-500 transition-colors">
                Audio Course
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Pimsleur-style interactive audio lessons with spaced repetition and anticipation drills.
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>✓ Guided narration in your native language</li>
                <li>✓ Anticipation prompts with pauses</li>
                <li>✓ Spaced repetition for retention</li>
                <li>✓ Graduated difficulty progression</li>
              </ul>
            </div>
          </div>
        </button>

        {/* Narrow Listening Content Type */}
        <button
          onClick={() => navigate('/studio/create/narrow-listening')}
          className="card hover:shadow-xl transition-all duration-300 text-left group cursor-pointer border-2 border-transparent hover:border-purple-600"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
              <Sparkles className="w-8 h-8 text-purple-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-navy mb-2 group-hover:text-purple-600 transition-colors">
                Narrow Listening
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Generate story variations with controlled grammar changes. Perfect for noticing language patterns.
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>✓ 5 variations of the same story</li>
                <li>✓ Controlled grammar and politeness changes</li>
                <li>✓ Slow audio (0.7x) for shadowing</li>
                <li>✓ JLPT level targeting</li>
              </ul>
            </div>
          </div>
        </button>

        {/* Processing Instruction Mode */}
        <button
          onClick={() => navigate('/studio/create/processing-instruction')}
          className="card hover:shadow-xl transition-all duration-300 text-left group cursor-pointer border-2 border-transparent hover:border-indigo-600"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition-colors">
              <Brain className="w-8 h-8 text-indigo-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-navy mb-2 group-hover:text-indigo-600 transition-colors">
                Processing Instruction
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Train your brain to process particles correctly through meaning-based comprehension tasks.
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>✓ は vs が particle distinction</li>
                <li>✓ Meaning-focused questions (not grammar rules)</li>
                <li>✓ Audio-based comprehension</li>
                <li>✓ Immediate feedback with explanations</li>
              </ul>
            </div>
          </div>
        </button>

        {/* Lexical Chunk Packs */}
        <button
          onClick={() => navigate('/studio/create/lexical-chunk-pack')}
          className="card hover:shadow-xl transition-all duration-300 text-left group cursor-pointer border-2 border-transparent hover:border-emerald-600"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors">
              <BookOpen className="w-8 h-8 text-emerald-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-navy mb-2 group-hover:text-emerald-600 transition-colors">
                Lexical Chunk Packs
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Learn high-value Japanese chunks through examples, stories, and exercises.
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>✓ 5-8 chunks per pack</li>
                <li>✓ Real-world usage examples with audio</li>
                <li>✓ Story that reuses all chunks</li>
                <li>✓ Practice exercises</li>
              </ul>
            </div>
          </div>
        </button>
      </div>

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>More content types coming soon: Flashcards, Reading Comprehension, and more!</p>
      </div>
    </div>
  );
}
