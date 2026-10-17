import assert from 'node:assert/strict';

const requiredPlaybackContracts = [
  'wait_for_health "convolab-server-$active_color"',
  'bash .github/scripts/smoke-auth-signup-verification-lifecycle.sh',
  'Disposable Learning OS content browser session established.',
  'script_smoke_episode_id="$(cat /proc/sys/kernel/random/uuid)"',
  'script_smoke_inserted=true',
  'cleanup_script_smoke best-effort',
  '"/api/convolab/scripts/$script_smoke_episode_id/status"',
  '"https://convo-lab.com/api/convolab/scripts/media/$script_smoke_media_id?viewAs=$user_id"',
  '"https://convo-lab.com/api/convolab/scripts/$script_smoke_episode_id/audio/$script_smoke_render_id?viewAs=$user_id"',
  'Audio Script Learning OS routing and streaming smoke checks passed.',

];

export function assertRequiredPlaybackContracts(workflow) {
  for (const requiredContract of requiredPlaybackContracts) {
    assert.ok(
      workflow.includes(requiredContract),
      `Missing permanent saved playback contract: ${requiredContract}`
    );
  }
}
