# Learn local MVP

Preview: http://localhost:5177/app/learn

Learn is controlled by the Learn switch in Admin → Feature Visibility Settings. It defaults to off for existing and new installations; admins retain access. Both the web routes/navigation and every Learn API endpoint enforce this gate. Deploy the API migration before the web release. The preview remains isolated from production; keep its worktrees while refining the workflow.

## Start the preview again

API worktree: `/Users/andrewlandry/.codex/worktrees/quartet-learn-api/learning-os`

```sh
php .local/artisan.php serve --host=127.0.0.1 --port=8087
```

Web worktree: `/Users/andrewlandry/.codex/worktrees/quartet-learn-web/convo-lab`

```sh
LEARNING_OS_API_URL=http://127.0.0.1:8087 VITE_DISABLE_PWA=true npm run dev --workspace=client -- --host 127.0.0.1 --port 5177 --strictPort
```

The ignored API `.local/artisan.php` launcher loads existing local settings and the configured tutor API key without copying secrets. It overrides database, session, cache, queue and mail settings for this preview. Data is stored in the worktree’s `database/learn-local.sqlite`; this is a new isolated database, not a copy of production. The disposable local account is `learn@convolab.local`; its password is supplied in the handoff.

## Implemented

- Practice → Learn navigation; responsive chapter notebook and lesson workspace.
- All nine Quartet 1 Chapter 1 grammar points in textbook order: といえば, なら, とおり／どおり, らしい, ために／ためのN, がきっかけで, ようになる, ようにする and によると. There are 59 conversational explanation steps and all 42 dedicated workbook A questions. Each explanation has the textbook example, an original English explanation/translation and “Does that make sense so far?”.
- “I understand” advances without a tutor call; “Previous explanation” returns within Understand without clearing feedback or per-step drafts. The next step remains preloaded. Previous validates the first-step boundary, phase, ownership and session version, and preserves review identity.
- といえば and がきっかけで have no dedicated workbook A set. Their explanations finish directly at Reflect; Ready and Workbook are disabled with an explanatory label. Their mixed-review practice remains deferred until the learner has covered the combined grammar.
- The らしい explanations cover every example in textbook pp. 10–11 §4, including the comparison with hearsay そうだ. Mixed workbook exercises on pp. 17–19 remain deferred until their prerequisite grammar is covered. Completed lessons offer “Review explanations” without clearing saved answers or repeating the workbook; each review has separate reply and draft context.
- Clickable Understand, Ready?, Workbook and Reflect stages on desktop and in mobile lesson contents. Each stage remembers its position; saved answers, feedback and per-step drafts survive navigation. Reflect is available after completing the dedicated workbook, or the explanations for points without a workbook set. Revisited completed lessons retain their completion badge, and readiness resumes the saved workbook question. Stage changes make no tutor call.
- The とおり／どおり introduction covers all five textbook p. 10 §3 examples: curry instructions, the soccer result, interview preparation, Professor Nakamura matching a rumor, and work according to plan. Each uses the same conversational acknowledgement flow. The six dedicated workbook prompts remain; mixed exercises are deferred.
- Explicit readiness is available before workbook practice, alongside direct Workbook navigation, with explicit advancement after feedback.
- One reply box accepts answers, questions and mixed replies. The tutor infers intent; clarification never marks a question answered. Tutor questions and feedback use the selected Journal portrait in a separate card, with the advancement button inside the latest tutor card. The reply box retains an accessible label without visible heading copy. New feedback focuses on grammar and meaning, explicitly connects alternate meanings, and omits generic readiness questions and unsolicited cultural commentary.
- WaniKani-aware furigana throughout teaching text, examples, questions, references, tutor replies and correction notes. Readings stay visible until known-kanji data is available; the local preview account is connected and synced.
- Journal highlights and popovers on the exact original answer. No polished final document is returned or displayed.
- Server-saved notebook history, source labels, original prompts, session ownership checks, optimistic versioning, request deduplication and a bounded in-flight lease.
- Unsent drafts survive reload in the same browser tab. Failure preserves the draft. Restart requires an inline confirmation.
- One automatic repair attempt for invalid tutor annotations; unsuccessful responses never overwrite the notebook.

## Scope and limitations

- This covers the nine grammar points and dedicated workbook A exercises. Chapter 1 reading, listening, speaking, writing and mixed workbook B practice are outside this slice.
- Per-example source-audio URLs have not been verified for these grammar prompts, so no speaker is shown. The source-audio component accepts a verified clip URL and label when an exercise supplies one. It does not synthesize book audio.
- The tutor uses the existing Journal model and selected tutor preference. Step-by-step explanations and checks are curated; follow-ups and answer feedback are generated.
- The learner decides when to advance after feedback, including after a wrong answer. There is no automatic mastery score.
- API responses are synchronous. Leaving mid-response is safe: reopen the lesson to retrieve saved feedback. A failed response retains the unsent draft.
- Do not remove these worktrees while the preview or ongoing refinement uses them.

## Validation

The client typecheck, production build, targeted lint and twenty-six Learn client tests pass. Thirty Learn API tests cover ownership, progression, readiness, original-text preservation, stale sessions, duplicate requests, failure recovery, completion/restart, annotation repair, inferred message intent, mixed answer/question replies and introduction acknowledgements, preloaded advancement without tutor calls, idempotent button retries and workbook answer gates. Review tests cover retained answers, separate review context, no tutor calls for navigation, and returning directly to completion. The expanded examples were also checked in Chrome at desktop and 390px width. Live provider checks distinguish clarification, tentative answers and mixed replies while preserving original text. Browser QA uses real tutor calls at desktop and 390px phone width, including intentionally wrong らしい and とおり／どおり answers, correction popovers, clarification, navigation and reload/resume.

CodeScene MCP reviewed every changed/new supported source file and tests: no findings; scored files are 10.0. Declarative routing/type/bootstrap files have no numerical score. CSS is unsupported by CodeScene and was covered by build and visual checks.

## Chapter coverage

Textbook Japanese examples were checked in the owned digital textbook on printed pp. 8–15. Explanations and English renderings are written for this tutor flow. Dedicated workbook prompts were checked on printed pp. 13–16; blanks and context are retained without added answers or hints.

| Point           | Explanation steps | Workbook A questions |
| --------------- | ----------------: | -------------------: |
| といえば        |                 4 | None in the workbook |
| なら            |                 9 |                    7 |
| とおり／どおり  |                 5 |                    6 |
| らしい          |                 9 |                    6 |
| ために／ためのN |                10 |                    6 |
| がきっかけで    |                 4 | None in the workbook |
| ようになる      |                 8 |                    6 |
| ようにする      |                 6 |                    6 |
| によると        |                 4 |                    5 |

The chapter progression test traverses all 59 explanations and all 42 workbook prompts through the API. Additional tests cover backward navigation, retained feedback and review identity, stale requests, separate drafts on previous/next, and zero-workbook completion. Live tutor checks cover a potential-form error before ために, clarification of habit versus ability in ようになる, and an accepted によると answer. Desktop and 390px browser QA covers the Previous button, the full chapter list, textbook-only stage availability and a new workbook dialogue.
