import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '../..');

test('the deployment archive is a valid representative Anki collection', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'convolab-import-smoke-'));
  const archivePath = path.join(directory, 'smoke.colpkg');

  try {
    await execFileAsync('python3', [
      path.join(repositoryRoot, '.github/scripts/create-study-import-smoke-archive.py'),
      archivePath,
    ]);

    const archiveStat = await stat(archivePath);
    assert.ok(archiveStat.size > 32 * 1024 * 1024);

    const verification = await execFileAsync('python3', [
      '-c',
      `
import json, sqlite3, tempfile, zipfile
with zipfile.ZipFile(${JSON.stringify(archivePath)}) as archive:
    with tempfile.NamedTemporaryFile() as collection:
        collection.write(archive.read("collection.anki21"))
        collection.flush()
        database = sqlite3.connect(collection.name)
        counts = {
            table: database.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
            for table in ("notes", "cards", "revlog")
        }
        database.close()
    print(json.dumps({
        "entries": sorted(archive.namelist()),
        "mediaBytes": archive.getinfo("0").file_size,
        "counts": counts,
    }))
`,
    ]);

    assert.deepEqual(JSON.parse(verification.stdout), {
      entries: ['0', '1', 'collection.anki21', 'media'],
      mediaBytes: 32 * 1024 * 1024,
      counts: { notes: 2, cards: 3, revlog: 2 },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('the production workflow wires import activation through verification and rollback', async () => {
  const workflow = await readFile(
    path.join(repositoryRoot, '.github/workflows/deploy-learning-os-prod.yml'),
    'utf8'
  );

  for (const requiredContract of [
    'enable_imports:',
    'ENABLE_IMPORTS: ${{ inputs.enable_imports }}',
    'validate_boolean_input enable_imports "$ENABLE_IMPORTS"',
    '\\"studyApiImports\\" = $enable_imports_sql',
    '\\"studyApiImports\\" = $previous_imports_sql',
    'expected_flag_state="$desired_parent_sql|$enable_settings_sql|$enable_overview_sql|$enable_browser_sql|$enable_browser_detail_sql|$enable_new_queue_sql|$enable_imports_sql|',
    'bash .github/scripts/smoke-study-import-lifecycle.sh',
  ]) {
    assert.match(workflow, new RegExp(requiredContract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.doesNotMatch(workflow, /\\"studyApiImports\\" = false/);
});

test('the lifecycle smoke script remains valid Bash', async () => {
  const scriptPath = path.join(
    repositoryRoot,
    '.github/scripts/smoke-study-import-lifecycle.sh'
  );
  const script = await readFile(scriptPath, 'utf8');

  await execFileAsync('bash', ['-n', scriptPath]);

  for (const requiredContract of [
    'trap cleanup EXIT',
    'delete_learning_os_smoke_user',
    'delete_convolab_smoke_user',
    'restore_proxy_identity',
    '/api/learning-os/study/imports/readiness',
    "/api/learning-os/study/imports'",
    '/api/learning-os/study/imports/$import_job_id/upload',
    '/api/learning-os/study/imports/$import_job_id/complete',
    '/api/learning-os/study/imports/$import_job_id',
    '/api/learning-os/study/imports/$cancel_job_id/cancel',
    'response.data.summary.imported_cards',
  ]) {
    assert.ok(script.includes(requiredContract), `Missing lifecycle contract: ${requiredContract}`);
  }
});
