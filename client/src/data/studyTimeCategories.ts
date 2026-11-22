const CATEGORY_COLORS = [
  ['review', 'text-blue-700', 'bg-[#365f47]', 'border-[#365f47]'],
  ['listen', 'text-cyan-700', 'bg-[#719bb1]', 'border-[#719bb1]'],
  ['writing', 'text-teal-700', 'bg-[#b499bf]', 'border-[#b499bf]'],
  ['create', 'text-amber-700', 'bg-[#d7ae56]', 'border-[#d7ae56]'],
  ['immerse', 'text-emerald-700', 'bg-[#81a472]', 'border-[#81a472]'],
  ['conversation', 'text-violet-700', 'bg-[#c87961]', 'border-[#c87961]'],
  ['wanikani', 'text-pink-700', 'bg-[#69678e]', 'border-[#69678e]'],
] as const;

export default CATEGORY_COLORS.map(([key, color, barColor, borderColor]) => ({
  key,
  labelKey: `time.totals.${key}`,
  color,
  barColor,
  borderColor,
}));
