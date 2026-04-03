- In this project, when I refer to "the logo" - I mean ConvoLab with the 2 icons to the right of the text. So, if I say to make the logo bigger, think of these items as a unit and make both of them larger by the same increment.

- Test credentials for local development are in `.env` under `TEST_USER_EMAIL` and `TEST_USER_PASSWORD`. Use these when testing the app with Playwright or manually.

## Worktree Setup

When creating a new worktree, the `server/.env` file must be configured correctly:

**CRITICAL**: Use this DATABASE_URL (replace `YOUR_MAC_USERNAME` with your actual username):

```
DATABASE_URL="postgresql://YOUR_MAC_USERNAME@localhost:5432/languageflow?schema=public"
```

**To find your Mac username**: Run `whoami` in terminal

**Why**: Worktrees need to use the local Mac superuser instead of the Docker `languageflow` user. Using the Docker user will cause Prisma connection errors like "User `languageflow` was denied access on the database `languageflow.public`"

**Production Credentials**: See `LOCAL_SETUP.md` (gitignored) for actual credentials including:

- Your specific Mac username for DATABASE_URL
- Fish Audio API keys
- Production server access instructions

If you don't have `LOCAL_SETUP.md`, copy `LOCAL_SETUP.md.example` and ask the project owner for credentials.

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
