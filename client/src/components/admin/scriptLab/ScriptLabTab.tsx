import { useState } from 'react';

import AudioTester from './AudioTester';
import CourseSelector from './CourseSelector';
import CourseDetails from './CourseDetails';
import ResultsViewer from './ResultsViewer';

interface TestResults {
  format?: string;
  allFormats?: unknown[];
  [key: string]: unknown;
}

const ScriptLabTab = () => {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [audioResults, setAudioResults] = useState<TestResults | null>(null);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-navy mb-2">Script Lab</h1>
        <p className="text-gray-600">
          Test script generation, audio formats, and debug course pipelines
        </p>
      </div>

      {/* Course Manager */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-navy mb-4">Course Manager</h2>
        <p className="text-sm text-gray-600 mb-4">
          Create and manage test courses for experimentation
        </p>
        <CourseSelector
          selectedCourseId={selectedCourseId}
          onSelectCourse={setSelectedCourseId}
        />

        {/* Course Details - shown when a course is selected */}
        {selectedCourseId && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-navy mb-3">Selected Course</h3>
            <CourseDetails courseId={selectedCourseId} />
          </div>
        )}
      </section>

      {/* Audio Format Tester */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-navy mb-4">Audio Format Tester</h2>
        <p className="text-sm text-gray-600 mb-4">
          Test Fish Audio with different Japanese text formats (kanji, kana, mixed, furigana)
        </p>
        <AudioTester onResultsChange={setAudioResults} />
      </section>

      {/* Results Viewer */}
      {audioResults && (
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-navy mb-4">Results</h2>
          <ResultsViewer results={audioResults} />
        </section>
      )}
    </div>
  );
};

export default ScriptLabTab;
