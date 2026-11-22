const CATEGORY_COLORS = [
  ['review', 'bg-[#365f47]'],
  ['listen', 'bg-[#62879c]'],
  ['writing', 'bg-[#9d7fa7]'],
  ['create', 'bg-[#ab812e]'],
  ['immerse', 'bg-[#6a895e]'],
  ['conversation', 'bg-[#bc735d]'],
  ['wanikani', 'bg-[#69678e]'],
] as const;

export default CATEGORY_COLORS.map(([key, barColor]) => ({
  key,
  labelKey: `time.totals.${key}`,
  barColor,
}));
