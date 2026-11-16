import './dialogMock';
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
it('opens narration choices in a modal and cancels without a selection', () => {
  render(<ToolbarExample />);
  const toolbar = screen.getByRole('group', { name: 'Entry toolbar' });
  const settings = within(toolbar).getByRole('button', { name: 'Narration voice' });
  fireEvent.click(settings);
  expect(screen.getByRole('dialog', { name: 'Choose your narration voice' })).toBeVisible();
  expect(settings).toHaveAttribute('aria-haspopup', 'dialog');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
