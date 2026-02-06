interface LanguageLevelSidebarProps {
  language: string;
  level: string;
  className?: string;
}

function getLanguageBgClass(language: string): string {
  const bgMap: Record<string, string> = {
    ja: 'bg-periwinkle',
  };
  return bgMap[language.toLowerCase()] || 'bg-periwinkle';
}

const LanguageLevelSidebar = ({ language, level, className = '' }: LanguageLevelSidebarProps) => (
  <div
    className={`w-12 flex-shrink-0 ${getLanguageBgClass(language)} flex flex-col items-center justify-center gap-1 py-3 px-1 ${className}`}
  >
    <span className="text-[10px] font-bold text-white uppercase tracking-wide text-center leading-tight">
      {language}
    </span>
    <span className="text-[10px] font-bold text-white uppercase tracking-wide text-center leading-tight">
      {level}
    </span>
  </div>
);

export default LanguageLevelSidebar;
