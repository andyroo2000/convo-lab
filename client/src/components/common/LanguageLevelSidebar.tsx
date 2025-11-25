interface LanguageLevelSidebarProps {
  language: string;
  level: string;
  className?: string;
}

export default function LanguageLevelSidebar({ language, level, className = '' }: LanguageLevelSidebarProps) {
  return (
    <div className={`w-12 flex-shrink-0 bg-gradient-to-br from-periwinkle to-strawberry flex flex-col items-center justify-center gap-1 py-3 px-1 ${className}`}>
      <span className="text-[10px] font-bold text-white uppercase tracking-wide text-center leading-tight">
        {language}
      </span>
      <span className="text-[10px] font-bold text-white uppercase tracking-wide text-center leading-tight">
        {level}
      </span>
    </div>
  );
}
