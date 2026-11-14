import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import JournalVoicePicker from '../JournalVoicePicker';

const ToolbarExample = () => {
  const [target, setTarget] = useState<HTMLSpanElement | null>(null);
  return (
    <>
      <div role="group" aria-label="Entry toolbar">
        <button type="button">Copy</button>
        <span ref={setTarget} />
      </div>
      <JournalVoicePicker
        toolbarTarget={target}
        voices={[]}
        selected=""
        disabled={false}
        onChoose={vi.fn()}
      />
      <div role="group" aria-label="Audio player" />
    </>
  );
};
it('keeps the settings trigger beside Copy while opening the picker before the player', () => {
  render(<ToolbarExample />);
  const toolbar = screen.getByRole('group', { name: 'Entry toolbar' });
  const settings = within(toolbar).getByRole('button', { name: 'Narration voice' });
  fireEvent.click(settings);
  const panel = screen.getByRole('region', { name: 'Choose your narration voice' });
  const player = screen.getByRole('group', { name: 'Audio player' });
  expect(toolbar.compareDocumentPosition(panel)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect(panel.compareDocumentPosition(player)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect(settings).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
});
