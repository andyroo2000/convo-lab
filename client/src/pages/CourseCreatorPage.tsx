import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CourseGenerator from '../components/courses/CourseGenerator';

export default function CourseCreatorPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate('/app/studio')}
          className="flex items-center gap-2 text-navy hover:text-indigo transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Studio
        </button>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy mb-2">Create Guided Audio Course</h1>
        <p className="text-gray-600">Design audio-only lessons with spaced repetition—perfect for hands-free learning</p>
      </div>

      <CourseGenerator />
    </div>
  );
}
