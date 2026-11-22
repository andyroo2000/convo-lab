import { expect, test, type BrowserContext, type Route } from '@playwright/test';
import type { JournalEntry } from '../client/src/features/journal/types';

type PendingDraft = Pick<JournalEntry, 'title' | 'body' | 'entryDate'> & {
  expectedVersion: number;
};

class SyncServer {
  online = true;
  loseResponse = false;
  owner = '123';
  writes = 0;
  readonly entries = new Map<string, JournalEntry>();
  readonly deleted = new Set<string>();

  async install(context: BrowserContext) {
    await context.addInitScript(() =>
      localStorage.setItem('convolab:journal-keyboard:v1', 'device')
    );
    await context.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
    await context.route('**/api/**', (route) => this.respond(route));
  }

  private async respond(route: Route) {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/convolab/auth/me') {
      await route.fulfill({
        json: {
          id: this.owner,
          name: 'Sync tester',
          email: 'sync@example.test',
          role: 'user',
          onboardingCompleted: true,
        },
      });
      return;
    }
    if (!path.startsWith('/api/journal/entries')) {
      await route.fulfill({ json: this.auxiliary(path) });
      return;
    }
    if (!this.online) {
      await route.abort('internetdisconnected');
      return;
    }
    const id = path.split('/')[4];
    if (!id) {
      await route.fulfill({ json: { data: [...this.entries.values()], nextCursor: null } });
      return;
    }
    if (route.request().method() === 'PUT') {
      await this.save(route, id);
      return;
    }
    const entry = this.entries.get(id);
    if (!entry) {
      await route.fulfill({ status: 404, json: { message: 'Unavailable' } });
      return;
    }
    const result = path.endsWith('/analysis') ? { data: null, entry } : { data: entry };
    await route.fulfill({ json: result });
  }

  private async save(route: Route, id: string) {
    const draft = route.request().postDataJSON() as PendingDraft;
    if (route.request().headers()['x-journal-owner'] !== this.owner) {
      await route.fulfill({ status: 403, json: { message: 'Session changed' } });
      return;
    }
    if (this.deleted.has(id)) {
      await route.fulfill({ status: 404, json: {} });
      return;
    }
    const saved = this.persist(id, draft);
    if (!saved) {
      await route.fulfill({ status: 409, json: { message: 'Changed elsewhere' } });
      return;
    }
    if (this.loseResponse) {
      this.loseResponse = false;
      await route.abort('connectionreset');
      return;
    }
    await route.fulfill({ json: { data: saved } });
  }

  private persist(id: string, draft: PendingDraft) {
    const current = this.entries.get(id);
    const unchanged = current?.body === draft.body && current?.title === draft.title;
    if (unchanged) return current;
    if ((current?.version ?? 0) !== draft.expectedVersion) return null;
    const saved = {
      id,
      title: draft.title,
      body: draft.body,
      entryDate: draft.entryDate,
      version: (current?.version ?? 0) + 1,
      createdAt: 'now',
      updatedAt: 'now',
    };
    this.writes += 1;
    this.entries.set(id, saved);
    return saved;
  }

  private auxiliary(path: string) {
    if (path === '/api/feature-flags')
      return { flashcardsEnabled: false, readingsEnabled: false, studyTimeEnabled: false };
    if (path === '/api/journal/tutor') return { data: { selectedId: null, tutors: [] } };
    return { data: [] };
  }
}

const editor = (page: import('@playwright/test').Page) =>
  page.getByRole('textbox', { name: 'Journal entry in Japanese' });

test('offline writing survives reload and automatically syncs without Submit', async ({
  page,
  context,
}, info) => {
  const server = new SyncServer();
  await server.install(context);
  await page.goto('/app/journal');
  await expect(editor(page)).toBeVisible();
  server.online = false;
  await editor(page).fill('AUTO SYNC TEST - offline create');
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  await page.reload();
  await expect(editor(page)).toHaveValue('AUTO SYNC TEST - offline create');
  server.online = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByText('Synced', { exact: true })).toBeVisible();
  expect(server.entries.size).toBe(1);
  await page.screenshot({ path: info.outputPath('automatic-reconnect.png'), fullPage: true });
});

test('lost responses preserve one entry and later typing reaches the server', async ({
  page,
  context,
}) => {
  const server = new SyncServer();
  server.loseResponse = true;
  await server.install(context);
  await page.goto('/app/journal');
  await editor(page).fill('AUTO SYNC TEST - first version');
  await expect.poll(() => server.entries.size).toBe(1);
  await editor(page).fill('AUTO SYNC TEST - newer typing');
  await page.reload();
  await expect(editor(page)).toHaveValue('AUTO SYNC TEST - newer typing');
  await expect(page.getByText('Synced', { exact: true })).toBeVisible();
  expect(server.entries.size).toBe(1);
  expect([...server.entries.values()][0].body).toBe('AUTO SYNC TEST - newer typing');
  expect(server.writes).toBe(2);
});

test('remote deletion pauses offline writing and offers a separate copy', async ({
  page,
  context,
}, info) => {
  const server = new SyncServer();
  await server.install(context);
  await page.goto('/app/journal');
  await editor(page).fill('AUTO SYNC TEST - initial');
  await expect(page.getByText('Synced', { exact: true })).toBeVisible();
  const id = [...server.entries.keys()][0];
  server.online = false;
  await editor(page).fill('AUTO SYNC TEST - preserve this offline edit');
  server.entries.delete(id);
  server.deleted.add(id);
  server.online = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByRole('button', { name: 'Save my writing as a new entry' })).toBeVisible();
  await expect(editor(page)).toHaveValue('AUTO SYNC TEST - preserve this offline edit');
  await page.screenshot({ path: info.outputPath('deleted-entry-recovery.png'), fullPage: true });
  await page.getByRole('button', { name: 'Save my writing as a new entry' }).click();
  await expect(page.getByText('Synced', { exact: true })).toBeVisible();
  expect(server.entries.has(id)).toBe(false);
  expect([...server.entries.values()][0].body).toBe('AUTO SYNC TEST - preserve this offline edit');
});

test('an account change in another tab cannot receive the old accounts draft', async ({
  page,
  context,
}) => {
  const server = new SyncServer();
  await server.install(context);
  await page.goto('/app/journal');
  await expect(editor(page)).toBeVisible();
  server.online = false;
  await editor(page).fill('AUTO SYNC TEST - owner one private writing');
  server.owner = '456';
  server.online = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByRole('alert')).toContainText('needs attention');
  expect(server.entries.size).toBe(0);
  await expect(editor(page)).toHaveValue('AUTO SYNC TEST - owner one private writing');
});
