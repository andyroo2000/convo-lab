import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import MasterySpreadChart from '../MasterySpreadChart';

const spread = {
  apprentice: 42,
  guru: 54,
  master: 33,
  enlightened: 16,
  burned: 5,
};

describe('MasterySpreadChart', () => {
  it('keeps the mastery stages in progression order', () => {
    render(<MasterySpreadChart spread={spread} />);

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual([
      'Apprentice',
      'Guru',
      'Master',
      'Enlightened',
      'Burned',
    ]);
  });

  it('renders a segmented distribution with aligned count and share columns', () => {
    render(<MasterySpreadChart spread={spread} />);

    expect(screen.getByText('150 cards')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Apprentice 28%.*Guru 36%.*Burned 3%/ })
    ).toBeInTheDocument();

    const table = screen.getByRole('table', { name: 'Cards by mastery stage' });
    expect(within(table).getAllByRole('row')).toHaveLength(6);
    expect(within(table).getByRole('columnheader', { name: 'Cards' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Share' })).toBeInTheDocument();
    expect(within(table).getByText('54')).toBeInTheDocument();
    expect(within(table).getByText('36%')).toBeInTheDocument();
  });

  it('handles an empty spread without invalid percentages', () => {
    render(
      <MasterySpreadChart
        spread={{ apprentice: 0, guru: 0, master: 0, enlightened: 0, burned: 0 }}
      />
    );

    expect(screen.getByText('0 cards')).toBeInTheDocument();
    expect(screen.getAllByText('0%')).toHaveLength(5);
  });

  it('clamps invalid negative counts before calculating widths', () => {
    render(
      <MasterySpreadChart
        spread={{ apprentice: -1, guru: 4, master: 0, enlightened: 0, burned: 0 }}
      />
    );

    expect(screen.getByText('4 cards')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Apprentice 0%.*Guru 100%/ })).toBeInTheDocument();
  });
});
