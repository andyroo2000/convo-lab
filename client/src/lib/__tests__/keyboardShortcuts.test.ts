import { describe, expect, it } from 'vitest';

import {
  hasBlockingShortcutState,
  isInteractiveShortcutTarget,
  shouldIgnoreGlobalShortcut,
} from '../keyboardShortcuts';

describe('keyboard shortcut policy', () => {
  it('recognizes native and ARIA interactive targets, including their descendants', () => {
    const button = document.createElement('button');
    const ariaButton = document.createElement('div');
    const child = document.createElement('span');
    ariaButton.setAttribute('role', 'button');
    ariaButton.append(child);

    expect(isInteractiveShortcutTarget(button)).toBe(true);
    expect(isInteractiveShortcutTarget(child)).toBe(true);
  });

  it('recognizes editable targets but leaves ordinary layout elements eligible', () => {
    const editable = document.createElement('div');
    const child = document.createElement('span');
    const layout = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    editable.append(child);

    expect(isInteractiveShortcutTarget(child)).toBe(true);
    expect(isInteractiveShortcutTarget(layout)).toBe(false);
    expect(isInteractiveShortcutTarget(window)).toBe(false);
  });

  it('ignores prevented, repeated, and modified global shortcuts', () => {
    const prevented = new KeyboardEvent('keydown', { cancelable: true });
    prevented.preventDefault();

    expect(hasBlockingShortcutState(prevented)).toBe(true);
    expect(hasBlockingShortcutState(new KeyboardEvent('keydown', { repeat: true }))).toBe(true);
    expect(hasBlockingShortcutState(new KeyboardEvent('keydown', { ctrlKey: true }))).toBe(true);
    expect(shouldIgnoreGlobalShortcut(new KeyboardEvent('keydown'))).toBe(false);
  });
});
