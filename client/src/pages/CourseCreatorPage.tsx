import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CourseGenerator from '../components/courses/CourseGenerator';

export default function CourseCreatorPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 pb-6 border-b-4 border-coral">
        <h1 className="text-5xl font-bold text-dark-brown mb-3">Guided Audio Course</h1>
        <p className="text-xl text-gray-600">Audio-only lessons perfect for your commute or morning walk</p>
      </div>

      <CourseGenerator />
    </div>
  );
}
