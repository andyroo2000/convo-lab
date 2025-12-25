import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import CourseCreatorPage from '../CourseCreatorPage';

// Mock CourseGenerator component
vi.mock('../../components/courses/CourseGenerator', () => ({
  default: () => <div data-testid="course-generator">Course Generator Component</div>,
}));

describe('CourseCreatorPage', () => {
  const renderPage = () => render(
      <BrowserRouter>
        <CourseCreatorPage />
      </BrowserRouter>
    );

  it('should render page title', () => {
    renderPage();
    expect(screen.getByText('Guided Audio Course')).toBeInTheDocument();
  });

  it('should render page description', () => {
    renderPage();
    expect(screen.getByText('Audio-only lessons perfect for your commute or morning walk')).toBeInTheDocument();
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
