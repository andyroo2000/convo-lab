import {
  AudioLines,
  BookOpenCheck,
  Brain,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  Clock3,
  CloudOff,
  Code2,
  Database,
  Dumbbell,
  Expand,
  Headphones,
  Image as ImageIcon,
  Layers3,
  LockKeyhole,
  MessagesSquare,
  Minimize,
  Play,
  Sparkles,
  TimerReset,
  Trophy,
  Volume2,
  WandSparkles,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import Logo from '../components/common/Logo';
import '../styles/features.css';

type FeatureMedia =
  | 'existing-apps'
  | 'origin'
  | 'tracker-story'
  | 'ai-practice-story'
  | 'knowledge-silos'
  | 'own-data'
  | 'shared-context'
  | 'overview'
  | 'create-word'
  | 'progressive'
  | 'fsrs'
  | 'wanikani'
  | 'rich-cards'
  | 'daily-audio'
  | 'practice'
  | 'study-time'
  | 'achievements'
  | 'build-story'
  | 'code-health'
  | 'score-prompt'
  | 'goal-progress';

interface FeatureSlide {
  id: string;
  kicker: string;
  title: string;
  description: string;
  shortLabel: string;
  media: FeatureMedia;
}

const FEATURE_SLIDES: FeatureSlide[] = [
  {
    id: 'why-i-built-it',
    kicker: 'Why I made it',
    title: 'Great apps. Separate memories.',
    description:
      'Anki knew my flashcards. WaniKani knew my kanji. Bunpro knew my grammar. They were all useful, but each one held a different piece of my learning history.',
    shortLabel: 'Why I built it',
    media: 'existing-apps',
  },
  {
    id: 'little-apps-for-the-gaps',
    kicker: 'Filling the gaps',
    title: 'Then I started making the missing pieces.',
    description:
      'First a study-time tracker, then an AI Dialogue Generator and card maker. Each mini app solved something I wanted—but it also became one more separate tool.',
    shortLabel: 'My first apps',
    media: 'origin',
  },
  {
    id: 'the-first-gap',
    kicker: 'The first mini app',
    title: 'I started with the easiest gap.',
    description:
      'A study-time tracker seemed simple enough to build. Seeing how much time I spent—and what I spent it on—made the work visible and surprisingly motivating.',
    shortLabel: 'The first gap',
    media: 'tracker-story',
  },
  {
    id: 'ai-made-practice',
    kicker: 'Then AI',
    title: 'What if practice could be made for me?',
    description:
      'The Dialogue Generator made conversations about topics I cared about, at roughly my level. The card maker helped turn useful words into study material.',
    shortLabel: 'AI-made practice',
    media: 'ai-practice-story',
  },
  {
    id: 'the-silo-problem',
    kicker: 'The real problem',
    title: 'Every app had its own version of me.',
    description:
      'Anki knew most of my vocabulary and grammar. WaniKani knew my kanji. The Dialogue Generator knew neither, and my tutor time lived in Calendar.',
    shortLabel: 'The silo problem',
    media: 'knowledge-silos',
  },
  {
    id: 'own-the-data',
    kicker: 'The turning point',
    title: 'So I rebuilt the part I couldn’t connect.',
    description:
      'Anki could not expose all the learning data I needed. Rebuilding its review system let ConvoLab own that history, while WaniKani and Google Calendar could sync through their APIs.',
    shortLabel: 'Owning the data',
    media: 'own-data',
  },
  {
    id: 'shared-context',
    kicker: 'The underlying idea',
    title: 'Now every part can know what I know.',
    description:
      'One shared model of vocabulary strength and kanji knowledge can shape cards, dialogues, and listening practice to my current level—including when furigana should disappear.',
    shortLabel: 'Shared context',
    media: 'shared-context',
  },
  {
    id: 'overview',
    kicker: 'Japanese study, connected',
    title: 'Study cards are only one part of the system.',
    description:
      'ConvoLab brings spaced repetition, listening practice, focused drills, and study tracking into one learning workflow.',
    shortLabel: 'Overview',
    media: 'overview',
  },
  {
    id: 'create-from-a-word',
    kicker: 'Card creation',
    title: 'Start with a word.',
    description:
      'Enter a vocabulary item and optional context. ConvoLab prepares example sentences, readings, meanings, audio, and a staged set of cards.',
    shortLabel: 'Start with a word',
    media: 'create-word',
  },
  {
    id: 'progressive-cards',
    kicker: 'Progressive cards',
    title: 'One word becomes a sequence.',
    description:
      'Audio recognition comes first. Text, word-level, and cloze cards unlock as the earlier material progresses instead of entering the queue at once.',
    shortLabel: 'Progressive cards',
    media: 'progressive',
  },
  {
    id: 'fsrs',
    kicker: 'Review scheduling',
    title: 'FSRS decides when a card returns.',
    description:
      'Review history and Again, Hard, Good, or Easy ratings update the schedule. The next interval is visible before each choice.',
    shortLabel: 'FSRS scheduling',
    media: 'fsrs',
  },
  {
    id: 'wanikani',
    kicker: 'WaniKani integration',
    title: 'Your known kanji come with you.',
    description:
      'Learned vocabulary can become ConvoLab study material automatically. Known kanji also control where furigana appears.',
    shortLabel: 'WaniKani',
    media: 'wanikani',
  },
  {
    id: 'card-formats',
    kicker: 'Card formats',
    title: 'Cards can ask in more than one way.',
    description:
      'Prompts can use text, audio, or images. Answers can include readings, meanings, example sentences, notes, and pitch-accent information.',
    shortLabel: 'Card formats',
    media: 'rich-cards',
  },
  {
    id: 'daily-audio',
    kicker: 'Daily Audio',
    title: 'Current cards become a listening session.',
    description:
      'ConvoLab creates a thirty-minute practice from the material being studied, with synchronized Japanese, optional furigana, and translation.',
    shortLabel: 'Daily Audio',
    media: 'daily-audio',
  },
  {
    id: 'practice-anywhere',
    kicker: 'Drills and offline study',
    title: 'Practice extends beyond card reviews.',
    description:
      'Short drills cover reading, grammar, sentence order, one-pass listening, and quick responses. Five days of cards and media can be prepared offline.',
    shortLabel: 'Drills and offline',
    media: 'practice',
  },
  {
    id: 'study-time',
    kicker: 'Study-time tracking',
    title: 'See where the time goes.',
    description:
      'Reviewing, listening, creating cards, Calendar sessions, and WaniKani activity can be viewed by period, activity, and source.',
    shortLabel: 'Study time',
    media: 'study-time',
  },
  {
    id: 'achievements',
    kicker: 'Achievements',
    title: 'Milestones make accumulated work visible.',
    description:
      'Earned badges record review, listening, and study milestones. Locked badges show progress toward the next threshold.',
    shortLabel: 'Achievements',
    media: 'achievements',
  },
  {
    id: 'how-it-was-built',
    kicker: 'From product to process',
    title: 'Then the agents started reviewing each other.',
    description:
      'ConvoLab became a test bed for an adversarial development loop: one agent implements, another challenges the result, and the cycle repeats.',
    shortLabel: 'How it was built',
    media: 'build-story',
  },
  {
    id: 'code-health-reality-check',
    kicker: 'The reality check',
    title: 'The review loop helped. It did not make the code perfect.',
    description:
      'Using Claude Code review bots against my local agents undoubtedly improved correctness and code quality overall. My first CodeScene analysis still found an average code health of 8.6 out of 10—close to good, with real technical debt remaining.',
    shortLabel: 'Code health',
    media: 'code-health',
  },
  {
    id: 'the-code-health-prompt',
    kicker: 'The instruction',
    title: 'The prompt became the quality gate.',
    description:
      'I asked an agent to turn the recommendations into small, measurable changes. A higher score was required for every merge, while hotspot health remained the real priority.',
    shortLabel: 'The prompt',
    media: 'score-prompt',
  },
  {
    id: 'goal-driven-refactors',
    kicker: 'Persistent Goal',
    title: 'A persistent goal kept the constraint alive.',
    description:
      'The agent carried the target across multiple PRs. The exchange shows the actual instruction, plan, measured result, and decision to wait for independent checks.',
    shortLabel: 'Goal in progress',
    media: 'goal-progress',
  },
];

const CODE_HEALTH_PROMPT =
  "Okay, I'd like for us to address the recommendations in a series of well-scoped PRs that should only be merged if they increase the score. Our goal is to get to at least 9.25 while prioritizing hotspot health over squeezing the aggregate score higher";

const GOAL_AGENT_RESPONSES = [
  {
    label: 'Agent · plan',
    text: "I'm continuing with the next hotspot slice: achievement synchronization and completion coordination inside useStudyReviewSession. I'll keep it behavior-preserving, require the original hotspot to improve beyond 2.62, require every extracted module to remain healthy, and repeat the full CodeScene/review/deploy gate before merging.",
  },
  {
    label: 'Agent · result',
    text: 'The second slice clears the local gate with a larger improvement: the main hotspot rises 2.62 → 2.79, and both new achievement modules score 10.0. The existing 49-test session suite—including its extensive achievement race, offline, recovery, and undo cases—passes unchanged.',
  },
  {
    label: 'Agent · merge gate',
    text: "PR #548 is open with the 2.62 → 2.79 CodeScene result documented. The complete local gate passed; I'm waiting for the independent CodeScene and review checks before any merge.",
  },
] as const;

const MediaLabel = ({ children, audio = false }: { children: string; audio?: boolean }) => (
  <div className="feature-media-label">
    {audio ? <Volume2 aria-hidden="true" /> : <Play aria-hidden="true" />}
    {children}
  </div>
);

const ExistingAppsMedia = () => {
  const apps = [
    {
      name: 'Anki',
      detail: 'Flashcards',
      memory: 'Vocabulary + grammar',
      className: 'is-anki',
      icon: <Layers3 aria-hidden="true" />,
    },
    {
      name: 'WaniKani',
      detail: 'Kanji',
      memory: 'Kanji + related vocabulary',
      className: 'is-wanikani',
      icon: <span lang="ja">ワ</span>,
    },
    {
      name: 'Bunpro',
      detail: 'Grammar',
      memory: 'Grammar progress',
      className: 'is-bunpro',
      icon: <BookOpenCheck aria-hidden="true" />,
    },
  ];

  return (
    <div
      className="feature-existing-apps-media feature-media-panel"
      aria-label="Established language-learning apps"
    >
      <MediaLabel>My study stack</MediaLabel>
      <div className="feature-existing-apps-grid">
        {apps.map(({ name, detail, memory, className, icon }) => (
          <article className={className} key={name}>
            <div className="feature-existing-app-icon">{icon}</div>
            <p>{detail}</p>
            <strong>{name}</strong>
            <small>{memory}</small>
            <span>Its own memory</span>
          </article>
        ))}
      </div>
      <p className="feature-existing-apps-caption">
        Three strong tools. Three separate versions of what I knew.
      </p>
    </div>
  );
};

const OriginMedia = () => (
  <div className="feature-origin-media feature-media-panel" aria-label="Homemade study apps">
    <div className="feature-origin-collage">
      <figure className="is-tracker">
        <img
          src="/presentation/jlpt-study-tracker.png"
          alt="JLPT N3 Study Tracker showing a weekly study-time chart"
        />
        <figcaption>Study-time tracker</figcaption>
      </figure>
      <figure className="is-card-maker">
        <img
          src="/presentation/ai-card-maker.png"
          alt="AI Card Maker showing the create study card interface"
        />
        <figcaption>AI card maker</figcaption>
      </figure>
      <figure className="is-dialogue">
        <img
          src="/presentation/dialogue-generator.png"
          alt="Dialogue Generator showing the Sangenjaya Memories dialogue"
        />
        <figcaption>Dialogue generator</figcaption>
      </figure>
    </div>
  </div>
);

const TrackerStoryMedia = () => (
  <div
    className="feature-tracker-story-media feature-media-panel"
    aria-label="The first study-time tracker"
  >
    <figure className="feature-story-screenshot">
      <img
        src="/presentation/jlpt-study-tracker.png"
        alt="JLPT N3 Study Tracker with study time grouped by activity"
      />
    </figure>
    <aside className="feature-story-aside">
      <Clock3 aria-hidden="true" />
      <small>The useful part</small>
      <strong>Look back later.</strong>
      <p>Time spent became visible by day and by activity.</p>
    </aside>
  </div>
);

const AiPracticeStoryMedia = () => (
  <div
    className="feature-ai-story-media feature-media-panel"
    aria-label="AI-created dialogues and cards"
  >
    <figure className="feature-ai-dialogue-shot">
      <img
        src="/presentation/dialogue-generator.png"
        alt="Dialogue Generator with a personalized Japanese conversation"
      />
      <figcaption>
        <MessagesSquare aria-hidden="true" />
        Dialogue from a topic
      </figcaption>
    </figure>
    <figure className="feature-ai-card-shot">
      <img
        src="/presentation/ai-card-maker.png"
        alt="AI Card Maker with a study-card creation form"
      />
      <figcaption>
        <WandSparkles aria-hidden="true" />
        Card from a word
      </figcaption>
    </figure>
  </div>
);

const KnowledgeSilosMedia = () => {
  const silos = [
    { title: 'Anki', detail: 'Vocabulary + grammar', icon: Layers3 },
    { title: 'WaniKani', detail: 'Kanji knowledge', mark: 'ワ' },
    { title: 'Dialogue Generator', detail: 'Topics + level', icon: MessagesSquare },
    { title: 'Google Calendar', detail: 'Tutor time', icon: CalendarDays },
  ];

  return (
    <div className="feature-silos-media feature-media-panel" aria-label="Disconnected app data">
      <div className="feature-silo-grid">
        {silos.map(({ title, detail, icon: Icon, mark }) => (
          <article key={title}>
            <span>{mark ?? (Icon ? <Icon aria-hidden="true" /> : null)}</span>
            <strong>{title}</strong>
            <small>{detail}</small>
            <b>
              <LockKeyhole aria-hidden="true" /> Isolated
            </b>
          </article>
        ))}
      </div>
      <div className="feature-silo-divider">
        <i />
        <span>No shared context</span>
        <i />
      </div>
      <p>A correct answer in one app changed nothing in the others.</p>
    </div>
  );
};

const OwnDataMedia = () => (
  <div className="feature-own-data-media feature-media-panel" aria-label="Connected learning data">
    <div className="feature-own-data-core">
      <Database aria-hidden="true" />
      <small>ConvoLab owns</small>
      <strong>Review history</strong>
      <span>Vocabulary strength</span>
    </div>
    <div className="feature-own-data-connections">
      <article>
        <span className="feature-wanikani-mark">ワ</span>
        <div>
          <strong>WaniKani</strong>
          <small>Kanji + vocabulary via API</small>
        </div>
        <b>Syncs in</b>
      </article>
      <article>
        <span className="feature-calendar-mark">
          <CalendarDays aria-hidden="true" />
        </span>
        <div>
          <strong>Google Calendar</strong>
          <small>Online tutor lesson time</small>
        </div>
        <b>Syncs in</b>
      </article>
    </div>
    <p className="feature-own-data-result">
      One place can finally connect the whole learning history.
    </p>
  </div>
);

const SharedContextMedia = () => (
  <div
    className="feature-context-media feature-media-panel"
    aria-label="Shared Japanese knowledge model"
  >
    <MediaLabel>One shared learning model</MediaLabel>
    <div className="feature-context-system">
      <div className="feature-context-inputs">
        <article>
          <span className="feature-wanikani-mark">ワ</span>
          <span>
            <strong>WaniKani</strong>
            <small>Kanji knowledge</small>
          </span>
        </article>
        <article>
          <span className="feature-context-review-icon">
            <CircleGauge aria-hidden="true" />
          </span>
          <span>
            <strong>Review history</strong>
            <small>Vocabulary strength</small>
          </span>
        </article>
      </div>
      <div className="feature-context-core">
        <Brain aria-hidden="true" />
        <small>Shared context</small>
        <strong>What I know</strong>
      </div>
      <div className="feature-context-outputs">
        <article>
          <Layers3 aria-hidden="true" />
          <span>Cards</span>
        </article>
        <article>
          <MessagesSquare aria-hidden="true" />
          <span>Dialogues</span>
        </article>
        <article>
          <Headphones aria-hidden="true" />
          <span>Listening</span>
        </article>
      </div>
      <p className="feature-context-result">Right level · familiar kanji · useful next words</p>
    </div>
  </div>
);

const OverviewMedia = () => (
  <div className="feature-overview-media feature-media-panel" aria-label="ConvoLab workflow">
    <MediaLabel>Product overview</MediaLabel>
    <div className="feature-overview-card is-study">
      <span className="feature-overview-icon">
        <Layers3 aria-hidden="true" />
      </span>
      <div>
        <strong>Study</strong>
        <small>Due cards and progressive vocabulary paths</small>
      </div>
      <b>18 due</b>
    </div>
    <div className="feature-overview-card is-listen">
      <span className="feature-overview-icon">
        <Headphones aria-hidden="true" />
      </span>
      <div>
        <strong>Daily Audio</strong>
        <small>Listening practice from current cards</small>
      </div>
      <b>30 min</b>
    </div>
    <div className="feature-overview-card is-track">
      <span className="feature-overview-icon">
        <TimerReset aria-hidden="true" />
      </span>
      <div>
        <strong>Study time</strong>
        <small>Review, listening, creation, and outside study</small>
      </div>
      <b>6h 42m</b>
    </div>
  </div>
);

const CreateWordMedia = () => (
  <div className="feature-create-media feature-media-panel" aria-label="Vocabulary generator">
    <MediaLabel>Interaction placeholder · 00:12</MediaLabel>
    <div className="feature-browser-window">
      <div className="feature-window-bar" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="feature-generator-content">
        <div className="feature-generator-form">
          <p>Vocabulary bundle</p>
          <span className="feature-field-label">Target word</span>
          <div lang="ja">営業する</div>
          <span className="feature-field-label">Optional context</span>
          <div>From a conversation about work</div>
          <span className="feature-generate-button">
            <WandSparkles aria-hidden="true" /> Generate vocabulary path
          </span>
        </div>
        <div className="feature-generation-result">
          <div className="feature-generation-heading">
            <strong>11 cards prepared</strong>
            <small>Three example sentences · five stages</small>
          </div>
          <div className="feature-sentence-preview" lang="ja">
            日本で営業しています。
            <small>I work in sales in Japan.</small>
          </div>
          <div className="feature-sentence-preview" lang="ja">
            営業時間は九時からです。
            <small>Business hours begin at nine.</small>
          </div>
          <div className="feature-generated-kinds">
            <span>Audio</span>
            <span>Text</span>
            <span>Word</span>
            <span>Cloze</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const ProgressiveMedia = () => {
  const stages = [
    ['Sentence audio', 'Listen and recognize', 'Ready'],
    ['Sentence text', 'Read in context', 'Next'],
    ['Word audio', 'Recognize the word', 'Locked'],
    ['Word text', 'Recall the meaning', 'Locked'],
    ['Sentence cloze', 'Produce it in context', 'Locked'],
  ];

  return (
    <div className="feature-progressive-media feature-media-panel" aria-label="Card path">
      <MediaLabel>Vocabulary path</MediaLabel>
      <div className="feature-phone-shell">
        <div className="feature-phone-sensor" />
        <div className="feature-phone-content">
          <p className="feature-phone-kicker">Vocabulary path · five stages</p>
          <h2 lang="ja">営業する</h2>
          <p className="feature-phone-reading" lang="ja">
            えいぎょうする · to do business
          </p>
          <ol>
            {stages.map(([title, detail, status], index) => (
              <li key={title} className={status === 'Locked' ? 'is-locked' : ''}>
                <span className="feature-stage-number">{index + 1}</span>
                <span>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </span>
                <b>{status}</b>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
};

const FsrsMedia = () => (
  <div className="feature-fsrs-media feature-media-panel" aria-label="FSRS review example">
    <MediaLabel audio>Card review with audio</MediaLabel>
    <div className="feature-review-card">
      <div className="feature-review-status">
        <span>
          Failed <b>2</b>
        </span>
        <span>
          Due <b>14</b>
        </span>
        <span>
          New <b>4</b>
        </span>
      </div>
      <div className="feature-review-answer">
        <p lang="ja">営業時間は九時からです。</p>
        <small lang="ja">えいぎょうじかん は くじ から です</small>
        <strong>Business hours begin at nine.</strong>
        <div className="feature-pitch-line" aria-label="Pitch accent diagram">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="feature-review-grades">
        <span>
          <small>10m</small>
          <b>Again</b>
        </span>
        <span>
          <small>1d</small>
          <b>Hard</b>
        </span>
        <span>
          <small>3d</small>
          <b>Good</b>
        </span>
        <span>
          <small>7d</small>
          <b>Easy</b>
        </span>
      </div>
    </div>
  </div>
);

const WaniKaniMedia = () => (
  <div className="feature-wanikani-media feature-media-panel" aria-label="WaniKani sync">
    <MediaLabel>Interaction placeholder · 00:10</MediaLabel>
    <div className="feature-wanikani-window">
      <div className="feature-wanikani-heading">
        <span className="feature-wanikani-mark">ワ</span>
        <div>
          <strong>WaniKani connected</strong>
          <small>Last synchronized today</small>
        </div>
        <b>
          <Check aria-hidden="true" /> Connected
        </b>
      </div>
      <div className="feature-wanikani-stats">
        <span>
          <strong>412</strong>
          <small>Known kanji</small>
        </span>
        <span>
          <strong>286</strong>
          <small>Vocabulary imported</small>
        </span>
      </div>
      <div className="feature-furigana-demo">
        <p>Adaptive furigana</p>
        <div lang="ja">
          会社で
          <ruby>
            新人<rt>しんじん</rt>
          </ruby>
          を
          <ruby>
            紹介<rt>しょうかい</rt>
          </ruby>
          しました。
        </div>
        <small>Readings remain on words containing kanji not yet known.</small>
      </div>
    </div>
  </div>
);

const RichCardsMedia = () => (
  <div className="feature-rich-card-media feature-media-panel" aria-label="Rich card formats">
    <MediaLabel audio>Answer reveal · 00:08</MediaLabel>
    <div className="feature-rich-card-stack">
      <div className="feature-rich-card-back" aria-hidden="true">
        <ImageIcon />
        Image prompt
      </div>
      <div className="feature-rich-card-front">
        <div className="feature-card-audio">
          <AudioLines aria-hidden="true" /> Play answer audio
        </div>
        <h2 lang="ja">営業する</h2>
        <p lang="ja">えいぎょうする</p>
        <div className="feature-accent-plot" aria-label="Pitch accent pattern">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <strong>to do business; to conduct sales</strong>
        <div className="feature-example-pair">
          <span lang="ja">日本で営業しています。</span>
          <small>I work in sales in Japan.</small>
        </div>
      </div>
    </div>
  </div>
);

const DailyAudioMedia = () => (
  <div className="feature-audio-media feature-media-panel" aria-label="Daily Audio player">
    <MediaLabel audio>Audio interaction · 00:15</MediaLabel>
    <div className="feature-audio-player">
      <p>Recognition</p>
      <h2>Today’s listening practice</h2>
      <div className="feature-audio-transcript">
        <div lang="ja">
          <ruby>
            営業<rt>えいぎょう</rt>
          </ruby>
          時間は九時からです。
        </div>
        <small>Business hours begin at nine.</small>
      </div>
      <div className="feature-waveform" aria-label="Audio waveform">
        {Array.from({ length: 31 }, (_, index) => (
          <i key={index} />
        ))}
      </div>
      <div className="feature-audio-times">
        <span>12:46</span>
        <span>−17:14</span>
      </div>
      <div className="feature-audio-controls">
        <span>−15</span>
        <b>
          <Play aria-hidden="true" />
        </b>
        <span>+15</span>
      </div>
      <div className="feature-transcript-options">
        <span>Furigana on</span>
        <span>Translation on</span>
      </div>
    </div>
  </div>
);

const PracticeMedia = () => (
  <div className="feature-practice-media feature-media-panel" aria-label="Drills and offline study">
    <MediaLabel>Two connected modes</MediaLabel>
    <div className="feature-practice-grid">
      <section>
        <div className="feature-practice-title">
          <Dumbbell aria-hidden="true" />
          <span>
            <b>Daily circuit</b>
            <small>Five focused questions</small>
          </span>
        </div>
        <ol>
          <li>
            <BookOpenCheck aria-hidden="true" />
            <span>Timed reading</span>
            <b>1</b>
          </li>
          <li>
            <Brain aria-hidden="true" />
            <span>Grammar judgment</span>
            <b>2</b>
          </li>
          <li>
            <AudioLines aria-hidden="true" />
            <span>Listen once</span>
            <b>3</b>
          </li>
          <li>
            <CircleGauge aria-hidden="true" />
            <span>Quick response</span>
            <b>4</b>
          </li>
        </ol>
      </section>
      <section className="feature-offline-card">
        <CloudOff aria-hidden="true" />
        <p>Offline readiness</p>
        <strong>Five days prepared</strong>
        <div>
          <i />
        </div>
        <small>
          Cards, audio, and images are stored on the device. Saved work synchronizes later.
        </small>
      </section>
    </div>
  </div>
);

const StudyTimeMedia = () => (
  <div className="feature-time-media feature-media-panel" aria-label="Study time dashboard">
    <MediaLabel>Chart interaction · 00:10</MediaLabel>
    <div className="feature-time-window">
      <div className="feature-time-heading">
        <div>
          <p>Study time</p>
          <h2>Your study rhythm</h2>
        </div>
        <span>Week⌄</span>
      </div>
      <div className="feature-time-stats">
        <span>
          <small>Total</small>
          <strong>6h 42m</strong>
        </span>
        <span>
          <small>Daily average</small>
          <strong>34m</strong>
        </span>
        <span>
          <small>Best rhythm</small>
          <strong>Tuesday</strong>
        </span>
      </div>
      <div className="feature-time-chart" aria-label="Study time by day">
        {[
          ['monday', 'M'],
          ['tuesday', 'T'],
          ['wednesday', 'W'],
          ['thursday', 'T'],
          ['friday', 'F'],
          ['saturday', 'S'],
          ['sunday', 'S'],
        ].map(([dayId, dayLabel]) => (
          <span key={dayId}>
            <i>
              <b />
            </i>
            <small>{dayLabel}</small>
          </span>
        ))}
      </div>
      <div className="feature-time-legend">
        <span>Review</span>
        <span>Listen</span>
        <span>Create</span>
        <span>WaniKani</span>
      </div>
    </div>
  </div>
);

const AchievementsMedia = () => (
  <div className="feature-achievements-media feature-media-panel" aria-label="Achievement badges">
    <MediaLabel>Milestone gallery</MediaLabel>
    <div className="feature-badge-row">
      <article className="feature-badge is-earned">
        <div>
          <Trophy aria-hidden="true" />
          <i />
          <i />
          <i />
        </div>
        <strong>First Hundred</strong>
        <small>100 reviews · earned</small>
      </article>
      <article className="feature-badge is-earned">
        <div>
          <Headphones aria-hidden="true" />
          <i />
          <i />
          <i />
        </div>
        <strong>Deep Listener</strong>
        <small>300 minutes · earned</small>
      </article>
      <article className="feature-badge is-locked">
        <div>
          <LockKeyhole aria-hidden="true" />
          <i />
          <i />
          <i />
        </div>
        <strong>Steady Recall</strong>
        <small>42 stable cards to go</small>
      </article>
    </div>
  </div>
);

const BuildStoryMedia = () => (
  <div className="feature-build-media feature-media-panel" aria-label="Adversarial agent loop">
    <MediaLabel>Next chapter</MediaLabel>
    <div className="feature-agent-loop">
      <article className="is-codex">
        <span>
          <Code2 aria-hidden="true" />
        </span>
        <p>Codex</p>
        <strong>Implement</strong>
        <small>Build the feature and tests</small>
      </article>
      <div className="feature-agent-arrows" aria-label="Review loop">
        <span>Review →</span>
        <b>Challenge</b>
        <span>← Revise</span>
      </div>
      <article className="is-claude">
        <span>
          <Sparkles aria-hidden="true" />
        </span>
        <p>Claude Code</p>
        <strong>Critique</strong>
        <small>Find risks, gaps, and weak assumptions</small>
      </article>
    </div>
    <p className="feature-loop-caption">The disagreement is the quality-control mechanism.</p>
  </div>
);

const CodeHealthMedia = () => (
  <div className="feature-code-health-media feature-media-panel" aria-label="CodeScene analysis">
    <figure>
      <img
        src="/presentation/codescene-code-health.png"
        alt="CodeScene analysis of ConvoLab showing code-health and technical-debt results"
      />
    </figure>
    <div className="feature-code-health-score">
      <small>First CodeScene analysis</small>
      <strong>
        8.6 <em>/ 10</em>
      </strong>
      <span>Average code health</span>
    </div>
    <div className="feature-code-health-verdict">
      <span>Improved overall</span>
      <i aria-hidden="true">→</i>
      <strong>Still not perfect</strong>
    </div>
  </div>
);

const ScorePromptMedia = () => (
  <div className="feature-score-prompt-media feature-media-panel" aria-label="Code health prompt">
    <span className="feature-prompt-mark" aria-hidden="true">
      “
    </span>
    <blockquote>“{CODE_HEALTH_PROMPT}”</blockquote>
    <div className="feature-prompt-rules" aria-label="Rules established by the prompt">
      <span>Well-scoped PRs</span>
      <span>Merge only on improvement</span>
      <span>Target ≥ 9.25</span>
      <span>Hotspot health first</span>
    </div>
  </div>
);

const GoalProgressMedia = () => (
  <div
    className="feature-goal-progress-media feature-media-panel"
    aria-label="Recreated goal-driven agent exchange"
  >
    <div className="feature-agent-exchange">
      <header>
        <div>
          <CircleGauge aria-hidden="true" />
          <span>
            <small>Persistent goal</small>
            <strong>Code health ≥ 9.25</strong>
          </span>
        </div>
        <b>Active</b>
      </header>
      <article className="is-user">
        <span>Original prompt</span>
        <p>{CODE_HEALTH_PROMPT}</p>
      </article>
      <div className="feature-agent-responses">
        {GOAL_AGENT_RESPONSES.map(({ label, text }, index) => (
          <article className={`is-agent is-response-${index + 1}`} key={label}>
            <span>{label}</span>
            <p>{text}</p>
          </article>
        ))}
      </div>
      <footer className="feature-goal-results">
        <span>
          <small>Hotspot health</small>
          <strong>2.62 → 2.79</strong>
        </span>
        <span>
          <small>New modules</small>
          <strong>10.0</strong>
        </span>
        <p>Local gate passed · waiting for CodeScene + independent review</p>
      </footer>
    </div>
  </div>
);

const FeatureMediaView = ({ type }: { type: FeatureMedia }) => {
  switch (type) {
    case 'existing-apps':
      return <ExistingAppsMedia />;
    case 'origin':
      return <OriginMedia />;
    case 'tracker-story':
      return <TrackerStoryMedia />;
    case 'ai-practice-story':
      return <AiPracticeStoryMedia />;
    case 'knowledge-silos':
      return <KnowledgeSilosMedia />;
    case 'own-data':
      return <OwnDataMedia />;
    case 'shared-context':
      return <SharedContextMedia />;
    case 'overview':
      return <OverviewMedia />;
    case 'create-word':
      return <CreateWordMedia />;
    case 'progressive':
      return <ProgressiveMedia />;
    case 'fsrs':
      return <FsrsMedia />;
    case 'wanikani':
      return <WaniKaniMedia />;
    case 'rich-cards':
      return <RichCardsMedia />;
    case 'daily-audio':
      return <DailyAudioMedia />;
    case 'practice':
      return <PracticeMedia />;
    case 'study-time':
      return <StudyTimeMedia />;
    case 'achievements':
      return <AchievementsMedia />;
    case 'build-story':
      return <BuildStoryMedia />;
    case 'code-health':
      return <CodeHealthMedia />;
    case 'score-prompt':
      return <ScorePromptMedia />;
    case 'goal-progress':
      return <GoalProgressMedia />;
    default:
      return null;
  }
};

const FeaturesPage = () => {
  const initialIndex = useMemo(() => {
    const hash = window.location.hash.slice(1);
    const hashIndex = FEATURE_SLIDES.findIndex((slide) => slide.id === hash);
    return hashIndex >= 0 ? hashIndex : 0;
  }, []);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [isPresenting, setIsPresenting] = useState(Boolean(document.fullscreenElement));
  const wheelTimestamp = useRef(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const goTo = useCallback((index: number) => {
    setActiveIndex(Math.min(Math.max(index, 0), FEATURE_SLIDES.length - 1));
  }, []);

  useEffect(() => {
    window.history.replaceState(null, '', `#${FEATURE_SLIDES[activeIndex].id}`);
  }, [activeIndex]);

  useEffect(() => {
    const onHashChange = () => {
      const hashIndex = FEATURE_SLIDES.findIndex(
        (slide) => slide.id === window.location.hash.slice(1)
      );
      if (hashIndex >= 0) setActiveIndex(hashIndex);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { target } = event;
      const isInteractive =
        target instanceof Element && target.closest('button, a, input, textarea, select');
      if (event.key === ' ' && isInteractive) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === ' ') {
        event.preventDefault();
        goTo(activeIndex + 1);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        goTo(activeIndex - 1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        goTo(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        goTo(FEATURE_SLIDES.length - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, goTo]);

  useEffect(() => {
    const onFullscreenChange = () => setIsPresenting(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const handleWheel = (event: ReactWheelEvent<HTMLElement>) => {
    const dominantDelta =
      Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (Math.abs(dominantDelta) < 24 || Date.now() - wheelTimestamp.current < 650) return;
    wheelTimestamp.current = Date.now();
    goTo(activeIndex + (dominantDelta > 0 ? 1 : -1));
  };

  const handleTouchStart = (event: ReactTouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLElement>) => {
    if (!touchStart.current) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    touchStart.current = null;
    const dominantDelta = Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY;
    if (Math.abs(dominantDelta) < 48) return;
    goTo(activeIndex + (dominantDelta < 0 ? 1 : -1));
  };

  const togglePresentation = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen?.();
    } else {
      await document.documentElement.requestFullscreen?.();
    }
  };

  const activeSlide = FEATURE_SLIDES[activeIndex];

  return (
    <main
      className="feature-deck"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <header className="feature-deck-header">
        <a href="/" aria-label="ConvoLab home" className="feature-deck-brand">
          <Logo size="medium" variant="dark" showKana showIcons={false} alwaysShowText />
        </a>
        <div className="feature-deck-header-actions">
          <button type="button" onClick={togglePresentation} className="feature-present-button">
            {isPresenting ? <Minimize aria-hidden="true" /> : <Expand aria-hidden="true" />}
            <span>{isPresenting ? 'Exit' : 'Present'}</span>
          </button>
          <div className="feature-deck-position">
            <span>Building ConvoLab</span>
            <strong>
              {String(activeIndex + 1).padStart(2, '0')} /{' '}
              {String(FEATURE_SLIDES.length).padStart(2, '0')}
            </strong>
          </div>
        </div>
      </header>

      <section className="feature-deck-stage" aria-live="polite" aria-atomic="true">
        <div className="feature-deck-copy" key={`copy-${activeSlide.id}`}>
          <p className="feature-deck-kicker">{activeSlide.kicker}</p>
          <h1>{activeSlide.title}</h1>
          <p className="feature-deck-description">{activeSlide.description}</p>
          {activeSlide.media === 'progressive' ? (
            <div className="feature-stage-summary" aria-label="Progressive card stages">
              <span>Listen</span>
              <i>›</i>
              <span>Read</span>
              <i>›</i>
              <span>Word</span>
              <i>›</i>
              <span>Cloze</span>
            </div>
          ) : null}
        </div>
        <div className="feature-deck-media" key={`media-${activeSlide.id}`}>
          <FeatureMediaView type={activeSlide.media} />
        </div>
      </section>

      <footer className="feature-deck-footer">
        <div className="feature-deck-dots" aria-label="Feature slides">
          {FEATURE_SLIDES.map((slide, index) => (
            <button
              type="button"
              key={slide.id}
              className={index === activeIndex ? 'is-active' : ''}
              onClick={() => goTo(index)}
              aria-current={index === activeIndex ? 'step' : undefined}
              aria-label={`Go to ${slide.shortLabel}`}
            />
          ))}
        </div>
        <p className="feature-deck-hint">Scroll, swipe, or use arrow keys</p>
        <div className="feature-deck-controls">
          <button
            type="button"
            onClick={() => goTo(activeIndex - 1)}
            disabled={activeIndex === 0}
            aria-label="Previous feature"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => goTo(activeIndex + 1)}
            disabled={activeIndex === FEATURE_SLIDES.length - 1}
            aria-label="Next feature"
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </footer>
    </main>
  );
};

export default FeaturesPage;
