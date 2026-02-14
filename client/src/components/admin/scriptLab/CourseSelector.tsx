import { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw } from 'lucide-react';

import { API_URL } from '../../../config';

interface TestCourse {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  hasExchanges: boolean;
  hasScript: boolean;
  hasAudio: boolean;
}

interface CourseSelectorProps {
  selectedCourseId: string | null;
  onSelectCourse: (courseId: string | null) => void;
}

const CourseSelector = ({ selectedCourseId, onSelectCourse }: CourseSelectorProps) => {
  const [courses, setCourses] = useState<TestCourse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create form state
  const [title, setTitle] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [jlptLevel, setJlptLevel] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchCourses = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/admin/script-lab/courses`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch test courses');
      const data = await response.json();
      setCourses(data.courses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load courses');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/api/admin/script-lab/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title,
          sourceText,
          jlptLevel: jlptLevel || undefined,
        }),
      });

      if (!response.ok) throw new Error('Failed to create test course');

      const data = await response.json();
      setSuccess('Test course created successfully!');
      setTitle('');
      setSourceText('');
      setJlptLevel('');
      setShowCreateForm(false);
      await fetchCourses();
      onSelectCourse(data.courseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create course');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedCourseId) return;
    // eslint-disable-next-line no-alert, no-restricted-globals
    if (!confirm('Delete this test course?')) return;

    try {
      const response = await fetch(`${API_URL}/api/admin/script-lab/courses`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ courseIds: [selectedCourseId] }),
      });

      if (!response.ok) throw new Error('Failed to delete course');

      setSuccess('Test course deleted');
      onSelectCourse(null);
      await fetchCourses();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete course');
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  return (
    <div className="space-y-4 retro-admin-v3-module">
      {/* Error/Success Messages */}
      {error && <div className="retro-admin-v3-alert is-error">{error}</div>}
      {success && <div className="retro-admin-v3-alert is-success">{success}</div>}

      {/* Course Selector Dropdown + Actions */}
      <div className="flex items-center gap-3">
        <select
          value={selectedCourseId || ''}
          onChange={(e) => onSelectCourse(e.target.value || null)}
          className="retro-admin-v3-input flex-1 px-3 py-2 text-sm"
          disabled={isLoading}
        >
          <option value="">Select a test course...</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title} - {course.status}
              {course.hasExchanges && ' [Exchanges]'}
              {course.hasScript && ' [Script]'}
              {course.hasAudio && ' [Audio]'}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={fetchCourses}
          className="retro-admin-v3-btn-secondary flex items-center gap-2"
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>

        <button
          type="button"
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="retro-admin-v3-btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Test Course
        </button>

        {selectedCourseId && (
          <button
            type="button"
            onClick={handleDeleteSelected}
            className="retro-admin-v3-btn-danger"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateCourse}
          className="retro-admin-v3-subpanel border border-gray-200 rounded-lg p-4 space-y-4"
        >
          <h3 className="text-lg font-semibold text-navy">Create New Test Course</h3>

          <div>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label htmlFor="course-title" className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="course-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="retro-admin-v3-input w-full px-3 py-2"
              placeholder="e.g., Hokkaido Cycling Test"
              required
            />
          </div>

          <div>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label
              htmlFor="course-source-text"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Source Text <span className="text-red-500">*</span>
            </label>
            <textarea
              id="course-source-text"
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              className="retro-admin-v3-input w-full px-3 py-2"
              rows={5}
              placeholder="Enter the episode source text (Japanese scenario)"
              required
            />
          </div>

          <div>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label
              htmlFor="course-jlpt-level"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              JLPT Level (Optional)
            </label>
            <select
              id="course-jlpt-level"
              value={jlptLevel}
              onChange={(e) => setJlptLevel(e.target.value)}
              className="retro-admin-v3-input w-full px-3 py-2"
            >
              <option value="">No specific level</option>
              <option value="N5">N5 (Beginner)</option>
              <option value="N4">N4</option>
              <option value="N3">N3 (Intermediate)</option>
              <option value="N2">N2</option>
              <option value="N1">N1 (Advanced)</option>
            </select>
          </div>

          <div className="flex gap-3">
            <button type="submit" className="retro-admin-v3-btn-primary" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Test Course'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="retro-admin-v3-btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Course Count */}
      <p className="text-xs text-gray-500">
        {isLoading ? 'Loading...' : `${courses.length} test course(s)`}
      </p>
    </div>
  );
};

export default CourseSelector;
