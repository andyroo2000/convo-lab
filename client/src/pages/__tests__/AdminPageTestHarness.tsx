// Complex admin page testing with tables and forms requires direct node access
import { vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import AdminPage from '../AdminPage';

export const mockNavigate = vi.fn();
const hoistedMockUser = vi.hoisted(() => ({
  value: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
}));
export const mockUser = hoistedMockUser;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: hoistedMockUser.value,
  }),
}));

vi.mock('../../components/admin/AvatarCropperModal', () => ({
  default: ({
    isOpen,
    imageUrl,
    onClose,
    onSave,
    title,
  }: {
    isOpen: boolean;
    imageUrl: string;
    onClose: () => void;
    onSave: (
      blob: Blob,
      cropArea: { x: number; y: number; width: number; height: number }
    ) => Promise<void>;
    title?: string;
  }) =>
    isOpen ? (
      <div data-testid="avatar-cropper-modal">
        <span>{title}</span>
        <span>{imageUrl}</span>
        <button
          type="button"
          onClick={() => {
            onSave(new Blob(['cropped-image']), {
              x: 1,
              y: 2,
              width: 100,
              height: 100,
            }).catch(() => undefined);
          }}
        >
          Save Crop
        </button>
        <button type="button" onClick={onClose}>
          Cancel Crop
        </button>
      </div>
    ) : null,
}));

vi.mock('../../components/common/Toast', () => ({
  default: ({ isVisible, message, type }: { isVisible: boolean; message: string; type: string }) =>
    isVisible ? (
      <div data-testid="toast" data-type={type}>
        {message}
      </div>
    ) : null,
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

export const mockUsers = [
  {
    id: 'user-1',
    email: 'user1@test.com',
    name: 'User One',
    displayName: 'User 1',
    role: 'user',
    createdAt: new Date('2024-01-01').toISOString(),
    _count: { episodes: 5, courses: 2 },
  },
  {
    id: 'user-2',
    email: 'user2@test.com',
    name: 'User Two',
    displayName: 'User 2',
    role: 'user',
    createdAt: new Date('2024-01-15').toISOString(),
    _count: { episodes: 3, courses: 1 },
  },
];

export const mockInviteCodes = [
  {
    id: 'code-1',
    code: 'ABCD1234',
    usedBy: null,
    usedAt: null,
    createdAt: new Date('2024-01-01').toISOString(),
  },
  {
    id: 'code-2',
    code: 'EFGH5678',
    usedBy: 'user-1',
    usedAt: new Date('2024-01-15').toISOString(),
    createdAt: new Date('2024-01-01').toISOString(),
    user: { id: 'user-1', email: 'user1@test.com', name: 'User One' },
  },
];

export const mockStats = {
  users: 150,
  episodes: 523,
  courses: 234,
  inviteCodes: { total: 50, used: 30, available: 20 },
};

export const mockSpeakerAvatars = [
  {
    id: 'avatar-1',
    filename: 'ja-female-casual.jpg',
    croppedUrl: 'https://example.com/ja-female-casual-cropped.jpg',
    originalUrl: 'https://example.com/ja-female-casual-original.jpg',
    language: 'ja',
    gender: 'female',
    tone: 'casual',
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString(),
  },
  {
    id: 'avatar-2',
    filename: 'ja-male-polite.jpg',
    croppedUrl: 'https://example.com/ja-male-polite-cropped.jpg',
    originalUrl: 'https://example.com/ja-male-polite-original.jpg',
    language: 'ja',
    gender: 'male',
    tone: 'polite',
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString(),
  },
];

export const mockFeatureFlags = {
  id: 'flags-1',
  dialoguesEnabled: true,
  scriptsEnabled: true,
  audioCourseEnabled: true,
  flashcardsEnabled: true,
  updatedAt: new Date('2024-01-01').toISOString(),
};

export const mockPronunciationDictionary = {
  keepKanji: ['橋'],
  forceKana: { 北海道: 'ほっかいどう' },
  verbKana: { 話す: 'はなす' },
  updatedAt: new Date('2024-01-02').toISOString(),
};

export const selectAvatarFile = async (input: HTMLInputElement, file: File) => {
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  await act(async () => {
    input.onchange?.({ target: input } as unknown as Event);
  });
};

export const mockAvatarObjectUrls = (...urls: string[]) => {
  const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const originalRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  const createObjectUrl = vi.fn();
  urls.forEach((url) => createObjectUrl.mockReturnValueOnce(url));
  const revokeObjectUrl = vi.fn();

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createObjectUrl,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeObjectUrl,
  });

  return {
    createObjectUrl,
    revokeObjectUrl,
    restore: () => {
      if (originalCreateObjectUrl) {
        Object.defineProperty(URL, 'createObjectURL', originalCreateObjectUrl);
      } else {
        Reflect.deleteProperty(URL, 'createObjectURL');
      }
      if (originalRevokeObjectUrl) {
        Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectUrl);
      } else {
        Reflect.deleteProperty(URL, 'revokeObjectURL');
      }
    },
  };
};

export function resetAdminPageMocks() {
  vi.clearAllMocks();
  mockUser.value = { id: 'admin-1', email: 'admin@test.com', role: 'admin' };
  global.fetch = vi.fn();
}

export function mockAvatarReads() {
  (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url.includes('/api/convolab/admin/avatars/speakers')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSpeakerAvatars),
      });
    }
    if (url.includes('/api/convolab/admin/users')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ users: [] }),
      });
    }
    return Promise.reject(new Error('Unknown endpoint'));
  });
}

export function mockSettingsReads() {
  (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
    (url: string, options: RequestInit | undefined) => {
      if (url.includes('/sanctum/csrf-cookie')) return Promise.resolve({ ok: true });
      if (url.includes('/api/feature-flags')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockFeatureFlags),
        });
      }
      if (url.includes('/api/convolab/admin/pronunciation-dictionaries')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPronunciationDictionary),
        });
      }
      return Promise.reject(new Error(`Unknown endpoint: ${url} (${options?.method ?? 'GET'})`));
    }
  );
}

export const renderPage = (tab = 'users') =>
  render(
    <MemoryRouter initialEntries={[`/app/admin/${tab}`]}>
      <Routes>
        <Route path="/app/admin/:tab?" element={<AdminPage />} />
      </Routes>
    </MemoryRouter>
  );
