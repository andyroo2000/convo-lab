import type { JournalAnalysis } from './types';

export function correctedContent(analysis: JournalAnalysis) {
  const feedback = analysis.result!;
  const addition = analysis.currentReply?.result;
  const text = analysis.correctedDocument?.text ?? addition?.entryText ?? feedback.correctedText;
  const reading =
    analysis.correctedDocument?.reading ?? addition?.entryReading ?? feedback.correctedReading;
  return { text, reading };
}

export function versionText(analysis: JournalAnalysis, version: 'draft' | 'final') {
  if (version === 'final') return correctedContent(analysis).text;
  return [analysis.result, analysis.currentReply?.result]
    .filter((item) => item != null)
    .map((item) => item.segments.map((segment) => segment.text).join(''))
    .join('\n\n');
}
