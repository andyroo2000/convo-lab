import { useState } from 'react';

import AudioTester from './AudioTester';
import AudioCourseCreation from './AudioCourseCreation';
import CourseSelector from './CourseSelector';
import CourseDetails from './CourseDetails';
import ResultsViewer, { type TestResults } from './ResultsViewer';

const ScriptLabTab = () => {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [audioResults, setAudioResults] = useState<TestResults | null>(null);

  return (
    <div className="space-y-8 retro-admin-v3-pane retro-admin-v3-script-lab">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-navy mb-2 retro-admin-v3-section-title">
          Script Lab
        </h1>
        <p className="text-gray-600 retro-admin-v3-section-subtitle">
          Test script generation, audio formats, and debug course pipelines
        </p>
      </div>

      {/* Course Manager */}
      <section className="bg-white rounded-lg shadow p-6 retro-admin-v3-card">
        <h2 className="text-xl font-semibold mb-4 retro-admin-v3-card-title">Course Manager</h2>
        <p className="text-sm text-gray-600 mb-4">
          Create and manage test courses for experimentation
        </p>
        <CourseSelector selectedCourseId={selectedCourseId} onSelectCourse={setSelectedCourseId} />

        {/* Course Details - shown when a course is selected */}
        {selectedCourseId && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3 retro-admin-v3-card-title">
              Selected Course
            </h3>
            <CourseDetails courseId={selectedCourseId} />
          </div>
        )}
      </section>

      {/* Audio Course Creation */}
      <section className="bg-white rounded-lg shadow p-6 retro-admin-v3-card">
        <h2 className="text-xl font-semibold mb-4 retro-admin-v3-card-title">
          Audio Course Creation
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Generate a single-sentence Pimsleur-style script and iterate on the prompt quickly
        </p>
        <AudioCourseCreation />
      </section>

      {/* Audio Format Tester */}
      <section className="bg-white rounded-lg shadow p-6 retro-admin-v3-card">
        <h2 className="text-xl font-semibold mb-4 retro-admin-v3-card-title">
          Audio Format Tester
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Test Fish Audio with different Japanese text formats (kanji, kana, mixed, furigana)
        </p>
        <AudioTester onResultsChange={setAudioResults} />
      </section>

      {/* Results Viewer */}
      {audioResults && (
        <section className="bg-white rounded-lg shadow p-6 retro-admin-v3-card">
          <h2 className="text-xl font-semibold mb-4 retro-admin-v3-card-title">Results</h2>
          <ResultsViewer results={audioResults} />
        </section>
      )}
    </div>
  );
};

export default ScriptLabTab;
