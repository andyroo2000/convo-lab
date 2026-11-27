import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import AudienceEditor from './AudienceEditor';
import * as api from './api';

vi.mock('./api', async (load) => ({
  ...(await load<typeof api>()),
  searchUsers: vi.fn(),
  saveAudience: vi.fn(),
  saveGroup: vi.fn(),
}));
const maya = { id: '1', name: 'Maya', email: 'maya@example.com', role: 'user' };
const ken = { id: '2', name: 'Ken', email: 'ken@example.com', role: 'user' };
const audience: api.FeatureAudience = {
  feature: 'readingsEnabled',
  version: 4,
  users: [maya],
  groupIds: ['beta'],
};
const beta: api.AccessGroup = {
  id: 'beta',
  name: 'Beta testers',
  version: 2,
  users: [ken],
  features: ['readingsEnabled'],
};
function setup() {
  const saved = vi.fn();
  const close = vi.fn();
  const Harness = () => {
    const [groups, setGroups] = useState([beta]);
    return (
      <AudienceEditor
        audience={audience}
        groups={groups}
        label="Readings"
        global={false}
        onClose={close}
        onSaved={saved}
        onGroupSaved={(group) =>
          setGroups((current) => [...current.filter((item) => item.id !== group.id), group])
        }
      />
    );
  };
  render(<Harness />);
  return { saved, close };
}
beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
  };
  vi.mocked(api.searchUsers).mockImplementation(async (filters) => {
    const users = [maya, ken].filter((user) =>
      user.name.toLowerCase().includes(filters.search.toLowerCase())
    );
    return { users, total: users.length, page: 1, lastPage: 1 };
  });
  vi.mocked(api.saveAudience).mockResolvedValue(audience);
});
it('preserves selections across database searches and saves group grants with the version', async () => {
  const { saved } = setup();
  await waitFor(() => expect(screen.getByLabelText('Select Ken')).toBeEnabled());
  fireEvent.click(screen.getByLabelText('Select Ken'));
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'maya' } });
  await waitFor(() => expect(screen.queryByLabelText('Select Ken')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Remove Ken' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save audience' }));
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(api.saveAudience).toHaveBeenCalledWith({ ...audience, users: [maya, ken] });
});
it('cancels without saving and displays inherited access separately from direct selection', async () => {
  const { close } = setup();
  await waitFor(() => expect(screen.getByLabelText('Select Ken')).toBeEnabled());
  expect(screen.getByLabelText('Select Ken')).not.toBeChecked();
  expect(within(screen.getByRole('table')).getByText('Beta testers')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Select Ken'));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(close).toHaveBeenCalledOnce();
  expect(api.saveAudience).not.toHaveBeenCalled();
});
it('creates a reusable group from selected users, then requires saving the feature audience', async () => {
  vi.mocked(api.saveGroup).mockResolvedValue({
    ...beta,
    id: 'new',
    name: 'Friends',
    users: [maya],
    features: [],
  });
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Create group from selected users' }));
  const modal = screen.getByRole('dialog', { name: 'Create group' });
  fireEvent.change(within(modal).getByRole('textbox', { name: 'Group name' }), {
    target: { value: 'Friends' },
  });
  fireEvent.click(within(modal).getByRole('button', { name: 'Create group' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Create group' })).not.toBeInTheDocument()
  );
  expect(api.saveGroup).toHaveBeenCalledWith({
    id: '',
    name: 'Friends',
    version: 0,
    users: [maya],
    features: [],
  });
  expect(api.saveAudience).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Save audience' }));
  await waitFor(() =>
    expect(api.saveAudience).toHaveBeenCalledWith({ ...audience, groupIds: ['beta', 'new'] })
  );
});
it('keeps the draft after a conflict and prevents duplicate submissions while pending', async () => {
  vi.mocked(api.saveAudience).mockRejectedValue(
    new Error('Audience changed. Reload before saving. (409)')
  );
  setup();
  await waitFor(() => expect(screen.getByLabelText('Select Ken')).toBeEnabled());
  fireEvent.click(screen.getByLabelText('Select Ken'));
  const saveButton = screen.getByRole('button', { name: 'Save audience' });
  fireEvent.click(saveButton);
  fireEvent.click(saveButton);
  await screen.findByRole('alert');
  expect(api.saveAudience).toHaveBeenCalledOnce();
  expect(screen.getByLabelText('Select Ken')).toBeChecked();
  expect(screen.getByRole('dialog', { name: 'Edit audience · Readings' })).toBeInTheDocument();
});
it('dismisses only the nested group dialog and keeps the unsaved audience open', async () => {
  const { close } = setup();
  await waitFor(() => expect(screen.getByLabelText('Select Ken')).toBeEnabled());
  fireEvent.click(screen.getByLabelText('Select Ken'));
  fireEvent.click(screen.getByRole('button', { name: 'Create group from selected users' }));
  const groupDialog = screen.getByRole('dialog', { name: 'Create group' });
  fireEvent(groupDialog, new Event('cancel', { cancelable: true }));
  expect(screen.queryByRole('dialog', { name: 'Create group' })).not.toBeInTheDocument();
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Select Ken')).toBeChecked();
});

it('keeps the opening version when parent data refreshes during an unsaved edit', async () => {
  const props = {
    audience,
    groups: [beta],
    label: 'Readings',
    global: false,
    onClose: vi.fn(),
    onSaved: vi.fn(),
    onGroupSaved: vi.fn(),
  };
  const view = render(<AudienceEditor {...props} />);
  await waitFor(() => expect(screen.getByLabelText('Select Ken')).toBeEnabled());
  fireEvent.click(screen.getByLabelText('Select Ken'));
  view.rerender(<AudienceEditor {...props} audience={{ ...audience, version: 5, users: [] }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Save audience' }));
  await waitFor(() =>
    expect(api.saveAudience).toHaveBeenCalledWith({ ...audience, users: [maya, ken] })
  );
});
