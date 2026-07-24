- In this project, when I refer to "the logo" - I mean ConvoLab with the 2 icons to the right of the text. So, if I say to make the logo bigger, think of these items as a unit and make both of them larger by the same increment.

- Test credentials for local development are in `.env` under `TEST_USER_EMAIL` and `TEST_USER_PASSWORD`. Use these when testing the app with Playwright or manually.

## Worktree Setup

Convo Lab is a static React frontend. Run `npm install` at the repository root,
then `npm run dev`. The local Vite proxy connects browser API routes to Learning
OS; configure its target with `LEARNING_OS_API_URL` when the default local URL is
not appropriate.

## Audio Storage

**NEVER commit binary audio files (MP3, WAV, etc.) to the git repository.** All pre-rendered audio must be stored on Google Cloud Storage (GCS) in the `convolab-storage` bucket under `tools-audio/`.

### Upload flow

1. Generate audio files locally (e.g., via a TTS QC script)
2. Upload to GCS: `gsutil -m cp -r <local-dir>/* gs://convolab-storage/tools-audio/<tool-name>/google-kento-professional/`
3. In client code, build paths like `/tools-audio/<tool-name>/google-kento-professional/<id>.mp3`
4. Use the default `resolveToolAudioUrls: true` behavior in `playAudioClipSequence` — this resolves paths to GCS signed URLs via `POST /api/tools-audio/signed-urls`

### Do NOT

- Set `resolveToolAudioUrls: false` — this bypasses GCS and tries to serve from the local filesystem
- Place MP3 files in `client/public/tools-audio/` — they bloat the repo and clone times
- Commit audio files even temporarily — they persist in git history forever

### Existing tools on GCS

- `tools-audio/japanese-counters/google-kento-professional/`
- `tools-audio/japanese-date/google-kento-professional/`
- `tools-audio/japanese-time/google-kento-professional/`
- `tools-audio/japanese-money/google-kento-professional/`
- `tools-audio/japanese-verbs/google-kento-professional/`
