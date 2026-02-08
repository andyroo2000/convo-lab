/* eslint-disable testing-library/no-node-access */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import CourseCreatorPage from '../CourseCreatorPage';

// Mock CourseGenerator component
vi.mock('../../components/courses/CourseGenerator', () => ({
  default: () => <div data-testid="course-generator">Course Generator Component</div>,
}));

describe('CourseCreatorPage', () => {
  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={['/app/create/audio-course/episode-123']}>
        <Routes>
          <Route path="/app/create/audio-course/:episodeId" element={<CourseCreatorPage />} />
        </Routes>
      </MemoryRouter>
    );

  it('should render page title', () => {
    renderPage();
    expect(screen.getByText('Create Audio Course')).toBeInTheDocument();
  });

  it('should render page description', () => {
    renderPage();
    expect(
      screen.getByText('Build a guided audio course from an existing dialogue')
    ).toBeInTheDocument();
  });

  it('should render CourseGenerator component', () => {
    renderPage();
    expect(screen.getByTestId('course-generator')).toBeInTheDocument();
  });

  it('should have border styling on header', () => {
    renderPage();
    const header = document.querySelector('.border-b-4.border-coral');
    expect(header).toBeInTheDocument();
  });
});
