import { useState } from 'react';
import { MessageSquare, Headphones } from 'lucide-react';
import DialogueGenerator from '../components/dialogue/DialogueGenerator';
import CourseGenerator from '../components/courses/CourseGenerator';

type ContentType = 'dialogue' | 'course' | null;

export default function StudioPage() {
  const [selectedType, setSelectedType] = useState<ContentType>(null);

  if (selectedType === 'dialogue') {
    return (
      <div>
        <div className="mb-8">
          <button
            onClick={() => setSelectedType(null)}
            className="text-sm text-gray-600 hover:text-navy mb-4 flex items-center gap-2"
          >
            ← Back to content types
          </button>
          <h1 className="text-3xl font-bold text-navy mb-2">Create Dialogue</h1>
          <p className="text-gray-600">
            Transform your stories and experiences into natural language learning dialogues
          </p>
        </div>

        <DialogueGenerator />
      </div>
    );
  }

  if (selectedType === 'course') {
    return (
      <div>
        <div className="mb-8">
          <button
            onClick={() => setSelectedType(null)}
            className="text-sm text-gray-600 hover:text-navy mb-4 flex items-center gap-2"
          >
            ← Back to content types
          </button>
          <h1 className="text-3xl font-bold text-navy mb-2">Create Audio Course</h1>
          <p className="text-gray-600">
            Create Pimsleur-style interactive audio lessons with spaced repetition and anticipation drills
          </p>
        </div>

        <CourseGenerator />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-navy mb-2">Create Learning Content</h1>
        <p className="text-gray-600">
          Choose the type of content you want to create
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Dialogue Content Type */}
        <button
          onClick={() => setSelectedType('dialogue')}
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
          onClick={() => setSelectedType('course')}
          className="card hover:shadow-xl transition-all duration-300 text-left group cursor-pointer border-2 border-transparent hover:border-purple-600"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
              <Headphones className="w-8 h-8 text-purple-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-navy mb-2 group-hover:text-purple-600 transition-colors">
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
      </div>

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>More content types coming soon: Flashcards, Reading Comprehension, and more!</p>
      </div>
    </div>
  );
}
