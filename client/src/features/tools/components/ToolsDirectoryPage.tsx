import { ArrowRight, CalendarDays, Clock3, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const ToolsDirectoryPage = () => {
  const location = useLocation();
  const isAppTools = location.pathname.startsWith('/app/tools');
  const toolsBasePath = isAppTools ? '/app/tools' : '/tools';

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <section className="card retro-paper-panel">
        <h1 className="retro-headline text-2xl sm:text-3xl">ConvoLab Tools</h1>
        <p className="mt-2 text-base text-[#2f4f73]">
          Fast, practical Japanese learning tools focused on high-frequency skills: reading dates
          and telling time.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Link
          to={`${toolsBasePath}/japanese-date`}
          className="retro-tools-card card retro-paper-panel group"
          aria-label="Open Japanese Date Practice Tool"
        >
          <div className="inline-flex items-center gap-2 rounded border border-[#14325633] bg-[rgba(26,178,209,0.14)] px-2.5 py-1 text-[0.8rem] text-[#1b3f69] retro-caps">
            <CalendarDays className="h-4 w-4" />
            Date Reading
          </div>
          <h2 className="retro-headline mt-3 text-xl">Japanese Date Practice Tool</h2>
          <p className="mt-2 text-base text-[#2f4f73]">
            Practice reading Japanese dates with furigana and audio. Great for mastering monthly,
            yearly, and irregular day readings.
          </p>
          <div className="mt-5 flex items-center justify-between">
            <span className="retro-caps text-sm text-[#2f4f73]">Date converter + quiz</span>
            <span className="retro-tools-card-launch" aria-hidden>
              <span className="retro-tools-card-launch-orb">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="retro-tools-card-launch-label">
                Try
                <ArrowRight className="h-4 w-4" />
              </span>
            </span>
          </div>
        </Link>

        <Link
          to={`${toolsBasePath}/japanese-time`}
          className="retro-tools-card card retro-paper-panel group"
          aria-label="Open Japanese Time Practice Tool"
        >
          <div className="inline-flex items-center gap-2 rounded border border-[#14325633] bg-[rgba(26,178,209,0.14)] px-2.5 py-1 text-[0.8rem] text-[#1b3f69] retro-caps">
            <Clock3 className="h-4 w-4" />
            Time Reading
          </div>
          <h2 className="retro-headline mt-3 text-xl">Japanese Time Practice Tool</h2>
          <p className="mt-2 text-base text-[#2f4f73]">
            Build Japanese time fluency with a clock-style trainer, delayed reveal, and audio-first
            review loops.
          </p>
          <div className="mt-5 flex items-center justify-between">
            <span className="retro-caps text-sm text-[#2f4f73]">Clock drills + audio</span>
            <span className="retro-tools-card-launch" aria-hidden>
              <span className="retro-tools-card-launch-orb">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="retro-tools-card-launch-label">
                Try
                <ArrowRight className="h-4 w-4" />
              </span>
            </span>
          </div>
        </Link>
      </section>
    </div>
  );
};

export default ToolsDirectoryPage;
