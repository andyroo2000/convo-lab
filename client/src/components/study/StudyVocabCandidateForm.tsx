interface StudyVocabCandidateFormProps {
  targetWord: string;
  sourceSentence: string;
  context: string;
  includeLearnerContext: boolean;
  isGenerating: boolean;
  onContextChange: (value: string) => void;
  onIncludeLearnerContextChange: (value: boolean) => void;
  onSourceSentenceChange: (value: string) => void;
  onSubmit: () => void;
  onTargetWordChange: (value: string) => void;
}

const StudyVocabCandidateForm = ({
  targetWord,
  sourceSentence,
  context,
  includeLearnerContext,
  isGenerating,
  onContextChange,
  onIncludeLearnerContextChange,
  onSourceSentenceChange,
  onSubmit,
  onTargetWordChange,
}: StudyVocabCandidateFormProps) => (
  <section className="card retro-paper-panel max-w-4xl">
    <div className="mb-5">
      <h2 className="font-display text-2xl text-brown">Vocab bundle</h2>
      <p className="mt-1 text-sm text-gray-600">
        Generate three sentence variants and a staged set of listening, reading, word, and cloze
        cards.
      </p>
    </div>
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="block" htmlFor="study-vocab-target-word">
        <span className="text-sm font-semibold text-navy">Target word</span>
        <input
          id="study-vocab-target-word"
          value={targetWord}
          onChange={(event) => onTargetWordChange(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3"
          placeholder="営業する"
          required
        />
      </label>
      <label className="block" htmlFor="study-vocab-source-sentence">
        <span className="text-sm font-semibold text-navy">Source sentence</span>
        <textarea
          id="study-vocab-source-sentence"
          value={sourceSentence}
          onChange={(event) => onSourceSentenceChange(event.target.value)}
          className="mt-2 min-h-24 w-full rounded-2xl border border-gray-300 px-4 py-3"
          placeholder="Optional sentence from your book"
        />
      </label>
      <label className="block" htmlFor="study-vocab-context">
        <span className="text-sm font-semibold text-navy">Extra context</span>
        <textarea
          id="study-vocab-context"
          value={context}
          onChange={(event) => onContextChange(event.target.value)}
          className="mt-2 min-h-24 w-full rounded-2xl border border-gray-300 px-4 py-3"
          placeholder="Optional nuance, book context, or preferred meaning"
        />
      </label>
      <label
        className="flex items-center gap-3 text-sm text-gray-700"
        htmlFor="study-vocab-context-toggle"
      >
        <input
          id="study-vocab-context-toggle"
          type="checkbox"
          checked={includeLearnerContext}
          onChange={(event) => onIncludeLearnerContextChange(event.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        Use recent study context
      </label>
      <button
        type="submit"
        disabled={isGenerating || !targetWord.trim()}
        className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isGenerating ? 'Generating…' : 'Generate vocab bundle'}
      </button>
    </form>
  </section>
);

export default StudyVocabCandidateForm;
