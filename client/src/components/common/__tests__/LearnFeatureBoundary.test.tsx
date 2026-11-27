import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SectionFeatureBoundary from '../SectionFeatureBoundary';

const auth = vi.hoisted(() => ({ role: 'user' }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: auth }) }));

afterEach(() => {
  vi.unstubAllGlobals();
  auth.role = 'user';
});

function openLesson(flags: object, role = 'user') {
  auth.role = role;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => flags }));
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={['/app/learn/quartet-1-rashii']}>
        <Routes>
          <Route element={<SectionFeatureBoundary feature="learnEnabled" />}>
            <Route path="/app/learn/:lessonId" element={<p>Lesson content</p>} />
          </Route>
          <Route path="/app/journal" element={<p>Journal home</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Learn direct-link access', () => {
  it.each([{}, { learnEnabled: false }])('blocks absent or disabled flags: %j', async (flags) => {
    openLesson(flags);
    expect(await screen.findByText('Journal home')).toBeInTheDocument();
    expect(screen.queryByText('Lesson content')).not.toBeInTheDocument();
  });

  it('allows admins while the switch stays off', async () => {
    openLesson({ learnEnabled: false }, 'admin');
    expect(await screen.findByText('Lesson content')).toBeInTheDocument();
  });

  it('allows ordinary users only when the switch is on', async () => {
    openLesson({ learnEnabled: true });
    expect(await screen.findByText('Lesson content')).toBeInTheDocument();
  });
});
