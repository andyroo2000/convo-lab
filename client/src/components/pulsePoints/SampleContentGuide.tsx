import { X, Sparkles, Headphones, MessageSquare, Check } from 'lucide-react';

interface SampleContentGuideProps {
  onClose: () => void;
}

const SampleContentGuide = ({ onClose }: SampleContentGuideProps) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-coral to-strawberry px-8 py-6 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-8 h-8 text-white" />
            <h2 className="text-3xl font-bold text-white">Welcome to ConvoLab!</h2>
          </div>
          <p className="text-white text-opacity-90">
            We&apos;ve added sample content to your library to get you started
          </p>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="space-y-6">
            {/* What&apos;s included */}
            <div>
              <h3 className="text-xl font-semibold text-navy mb-4">What&apos;s in your library:</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-cream rounded-xl">
                  <div className="bg-periwinkle rounded-lg p-2 flex-shrink-0">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-navy mb-1">3 Sample Dialogues</h4>
                    <p className="text-sm text-gray-600">
                      Everyday conversations at your level: Meeting Someone New, At a Café, and Making Weekend Plans
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-cream rounded-xl">
                  <div className="bg-coral rounded-lg p-2 flex-shrink-0">
                    <Headphones className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-navy mb-1">1 Audio Course</h4>
                    <p className="text-sm text-gray-600">
                      Pimsleur-style course on Travel & Transportation - learn while listening
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* How to use */}
            <div>
              <h3 className="text-xl font-semibold text-navy mb-4">How to use your sample content:</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-coral flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700">
                    <span className="font-semibold">Look for the blue &ldquo;Sample&rdquo; badge</span> on content cards in your library
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-coral flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700">
                    <span className="font-semibold">Click any content</span> to start practicing immediately
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-coral flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700">
                    <span className="font-semibold">Delete sample content</span> anytime if you don&apos;t need it
                  </p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="bg-coral-light border-l-4 border-coral p-4 rounded-lg">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Ready to create your own?</span> Use the &ldquo;Generate New Content&rdquo; buttons to create custom dialogues and courses tailored to your interests.
              </p>
            </div>
          </div>

          {/* Action button */}
          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="btn-primary px-8 py-3"
            >
              Got it, let&apos;s start learning!
            </button>
          </div>
        </div>
      </div>
    </div>
  );

export default SampleContentGuide;
