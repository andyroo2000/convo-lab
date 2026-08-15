const CATEGORY_COLORS = [
  ['review', 'text-blue-700', 'bg-blue-500', 'border-blue-500'],
  ['listen', 'text-cyan-700', 'bg-cyan-500', 'border-cyan-500'],
  ['create', 'text-amber-700', 'bg-amber-500', 'border-amber-500'],
  ['immerse', 'text-emerald-700', 'bg-emerald-500', 'border-emerald-500'],
  ['conversation', 'text-violet-700', 'bg-violet-500', 'border-violet-500'],
  ['wanikani', 'text-pink-700', 'bg-pink-500', 'border-pink-500'],
] as const;

export default CATEGORY_COLORS.map(([key, color, barColor, borderColor]) => ({
  key,
  labelKey: `time.totals.${key}`,
  color,
  barColor,
  borderColor,
}));
