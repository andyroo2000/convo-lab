import { X, Sparkles, MessageSquare, Headphones, BookOpen, Zap } from 'lucide-react';

interface CustomContentGuideProps {
  onClose: () => void;
}

const CustomContentGuide = ({ onClose }: CustomContentGuideProps) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-periwinkle to-dark-periwinkle px-8 py-6 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-8 h-8 text-white" />
            <h2 className="text-3xl font-bold text-white">Create Your Own Content</h2>
          </div>
          <p className="text-white text-opacity-90">
            Ready to personalize your learning? Generate custom content in seconds!
          </p>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="space-y-6">
            {/* Why create custom content */}
            <div>
              <h3 className="text-xl font-semibold text-navy mb-3">Why create your own?</h3>
              <p className="text-gray-700 mb-4">
                Custom content lets you learn from topics <span className="font-semibold">you actually care about</span> - whether that&apos;s ordering coffee, discussing your hobbies, or navigating specific situations you&apos;ll encounter.
              </p>
            </div>

            {/* Quick overview of options */}
            <div>
              <h3 className="text-xl font-semibold text-navy mb-4">Choose what works for you:</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-4 p-4 bg-cream rounded-xl border-l-4 border-periwinkle">
                  <div className="bg-periwinkle rounded-lg p-2 flex-shrink-0">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-navy mb-1">Dialogues</h4>
                    <p className="text-sm text-gray-600">
                      Turn any text into a conversation between two native speakers
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-cream rounded-xl border-l-4 border-coral">
                  <div className="bg-coral rounded-lg p-2 flex-shrink-0">
                    <Headphones className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-navy mb-1">Audio Courses</h4>
                    <p className="text-sm text-gray-600">
                      Pimsleur-style spaced repetition courses from your own content
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-cream rounded-xl border-l-4 border-strawberry">
                  <div className="bg-strawberry rounded-lg p-2 flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-navy mb-1">Narrow Listening & More</h4>
                    <p className="text-sm text-gray-600">
                      Advanced techniques for grammar mastery and fluency
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick start tip */}
            <div className="bg-periwinkle-light border-l-4 border-periwinkle p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-periwinkle flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-navy mb-1">Quick Start Tip</p>
                  <p className="text-sm text-gray-700">
                    Start with a <span className="font-semibold">Dialogue</span>! Just paste any text (even in English) and we&apos;ll create a natural conversation at your level in under 2 minutes.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action button */}
          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="btn-primary px-8 py-3"
            >
              Let&apos;s create something!
            </button>
          </div>
        </div>
      </div>
    </div>
  );

export default CustomContentGuide;
