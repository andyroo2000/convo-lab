import { useNavigate } from 'react-router-dom';
import { MessageSquare, Headphones, Sparkles, Brain, BookOpen } from 'lucide-react';

export default function CreatePage() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-12 text-center px-4 sm:px-0">
        <h1 className="text-5xl font-bold text-dark-brown mb-3">What do you want to create?</h1>
        <p className="text-lg text-gray-600">
          Choose an activity type to get started
        </p>
      </div>

      <div className="max-w-5xl mx-auto space-y-3">
        {/* Dialogue Content Type */}
        <button
          onClick={() => navigate('/app/create/dialogue')}
          className="w-full flex items-center bg-white hover:bg-periwinkle-light transition-all duration-200 hover:shadow-xl group"
          data-testid="create-card-dialogues"
        >
          <div className="w-20 sm:w-32 flex-shrink-0 bg-periwinkle flex flex-col items-center justify-center py-6 sm:py-8">
            <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 text-white mb-2" />
            <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide">Dialogue</span>
          </div>
          <div className="flex-1 px-4 sm:px-8 py-4 sm:py-6">
            <h2 className="text-xl sm:text-3xl font-bold text-dark-brown group-hover:text-periwinkle transition-colors mb-1 sm:mb-2">
              Comprehensible Input Dialogues
            </h2>
            <p className="text-sm sm:text-base text-gray-600">
              Generate AI dialogues from your own stories, calibrated to your proficiency level
            </p>
          </div>
        </button>

        {/* Course Content Type */}
        <button
          onClick={() => navigate('/app/create/audio-course')}
          className="w-full flex items-center bg-white hover:bg-coral-light transition-all duration-200 hover:shadow-xl group"
          data-testid="create-card-audio-course"
        >
          <div className="w-20 sm:w-32 flex-shrink-0 bg-coral flex flex-col items-center justify-center py-6 sm:py-8">
            <Headphones className="w-10 h-10 sm:w-12 sm:h-12 text-white mb-2" />
            <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide text-center leading-tight">Audio<br/>Course</span>
          </div>
          <div className="flex-1 px-4 sm:px-8 py-4 sm:py-6">
            <h2 className="text-xl sm:text-3xl font-bold text-dark-brown group-hover:text-coral transition-colors mb-1 sm:mb-2">
              Guided Audio Course
            </h2>
            <p className="text-sm sm:text-base text-gray-600">
              Audio-only lessons built from your dialogues—perfect for your commute or morning walk
            </p>
          </div>
        </button>

        {/* Narrow Listening Content Type */}
        <button
          onClick={() => navigate('/app/create/narrow-listening')}
          className="w-full flex items-center bg-white hover:bg-strawberry-light transition-all duration-200 hover:shadow-xl group"
          data-testid="create-card-narrow-listening"
        >
          <div className="w-20 sm:w-32 flex-shrink-0 bg-strawberry flex flex-col items-center justify-center py-6 sm:py-8">
            <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 text-white mb-2" />
            <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide text-center leading-tight">Narrow<br/>Listening</span>
          </div>
          <div className="flex-1 px-4 sm:px-8 py-4 sm:py-6">
            <h2 className="text-xl sm:text-3xl font-bold text-dark-brown group-hover:text-strawberry transition-colors mb-1 sm:mb-2">
              Narrow Listening Packs
            </h2>
            <p className="text-sm sm:text-base text-gray-600">
              The same story told 5 different ways—deeply internalize patterns through repetition
            </p>
          </div>
        </button>

        {/* Processing Instruction Mode */}
        <button
          onClick={() => navigate('/app/create/processing-instruction')}
          className="w-full flex items-center bg-white hover:bg-keylime-light transition-all duration-200 hover:shadow-xl group"
          data-testid="create-card-processing-instruction"
        >
          <div className="w-20 sm:w-32 flex-shrink-0 bg-keylime flex flex-col items-center justify-center py-6 sm:py-8">
            <Brain className="w-10 h-10 sm:w-12 sm:h-12 text-white mb-2" />
            <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide text-center">Grammar</span>
          </div>
          <div className="flex-1 px-4 sm:px-8 py-4 sm:py-6">
            <h2 className="text-xl sm:text-3xl font-bold text-dark-brown group-hover:text-keylime-dark transition-colors mb-1 sm:mb-2">
              Processing Instruction Activities
            </h2>
            <p className="text-sm sm:text-base text-gray-600">
              Learn grammar through structured input—answer meaning-based questions
            </p>
          </div>
        </button>

        {/* Lexical Chunk Packs */}
        <button
          onClick={() => navigate('/app/create/lexical-chunk-pack')}
          className="w-full flex items-center bg-white hover:bg-yellow-light transition-all duration-200 hover:shadow-xl group"
          data-testid="create-card-lexical-chunks"
        >
          <div className="w-20 sm:w-32 flex-shrink-0 bg-yellow flex flex-col items-center justify-center py-6 sm:py-8">
            <BookOpen className="w-10 h-10 sm:w-12 sm:h-12 text-dark-brown mb-2" />
            <span className="text-xs sm:text-sm font-bold text-dark-brown uppercase tracking-wide text-center leading-tight">Chunk<br/>Pack</span>
          </div>
          <div className="flex-1 px-4 sm:px-8 py-4 sm:py-6">
            <h2 className="text-xl sm:text-3xl font-bold text-dark-brown group-hover:text-yellow-dark transition-colors mb-1 sm:mb-2">
              Lexical Chunk Packs
            </h2>
            <p className="text-sm sm:text-base text-gray-600">
              Acquire phrases as complete units—learn high-frequency chunks through examples
            </p>
          </div>
        </button>
      </div>

      <p className="text-center text-gray-500 mt-12 px-4 sm:px-0">
        Experiment, iterate, and discover what works for your learning style.
      </p>
    </div>
  );
}
