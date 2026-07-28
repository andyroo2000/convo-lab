import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import StudyGradeButtons from '../StudyGradeButtons';

describe('StudyGradeButtons', () => {
  it('shows only the four grade names without scheduling intervals', () => {
    const onGrade = vi.fn();

    render(<StudyGradeButtons onGrade={onGrade} />);

    ['Again', 'Hard', 'Good', 'Easy'].forEach((grade) => {
      expect(screen.getByRole('button', { name: grade })).toBeInTheDocument();
    });
    expect(screen.queryByText(/^(?:<\d+[mhd]|\d+[mhdy]|\.\.\.)$/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Good' }));
    expect(onGrade).toHaveBeenCalledWith('good');
  });
});
