import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import PISetupPage from '../PISetupPage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../hooks/useDemo', () => ({
  useIsDemo: () => false,
}));

vi.mock('../../components/common/DemoRestrictionModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="demo-modal">Demo Modal</div> : null,
}));

describe('PISetupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  const renderPage = () =>
    render(
      <BrowserRouter>
        <PISetupPage />
      </BrowserRouter>
    );

  it('should render page title', () => {
    renderPage();
    expect(screen.getByText('Processing Instruction Activities')).toBeInTheDocument();
  });

  it('should render all JLPT level buttons', () => {
    renderPage();
    expect(screen.getByText('N5')).toBeInTheDocument();
    expect(screen.getByText('N4')).toBeInTheDocument();
    expect(screen.getByText('N3')).toBeInTheDocument();
    expect(screen.getByText('N2')).toBeInTheDocument();
  });

  it('should have N5 selected by default', () => {
    renderPage();
    const n5Button = screen.getByText('N5').closest('button');
    expect(n5Button).toHaveClass('bg-keylime');
  });

  it('should show N5 grammar points by default', () => {
    renderPage();
    expect(screen.getByText('は vs が')).toBeInTheDocument();
  });

  it('should change grammar points when level is changed', () => {
    renderPage();

    const n4Button = screen.getByText('N4').closest('button');
    fireEvent.click(n4Button!);

    expect(screen.getByText('〜から vs 〜ので')).toBeInTheDocument();
  });

  it('should render item count options', () => {
    renderPage();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('~5-7 minutes')).toBeInTheDocument();
    expect(screen.getByText('~8-10 minutes')).toBeInTheDocument();
  });

  it('should render start button', () => {
    renderPage();
    expect(screen.getByText('Start Practice Session')).toBeInTheDocument();
  });
});
