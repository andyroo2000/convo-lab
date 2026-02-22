import { ArrowRight, CalendarDays, Clock3, Hash, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const ToolsDirectoryPage = () => {
  const location = useLocation();
  const isAppTools = location.pathname.startsWith('/app/tools');
  const toolsBasePath = isAppTools ? '/app/tools' : '/tools';

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <section className="card retro-paper-panel">
        <h1 className="retro-headline text-2xl sm:text-3xl">
          ConvoLab Tools: Small drills, big progress.
        </h1>
        <p className="mt-2 text-base text-[#2f4f73]">
          Practice Japanese dates, times, counters, and verb forms at your own pace.
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
          <h2 className="retro-headline mt-3 text-xl">Dates</h2>
          <p className="mt-2 text-base text-[#2f4f73]">
            Can you read today&apos;s date in Japanese? How about a random one? Practice until dates
            roll off your tongue.
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
          <h2 className="retro-headline mt-3 text-xl">Telling Time</h2>
          <p className="mt-2 text-base text-[#2f4f73]">
            What time is it? Say it in Japanese! Start simple and work your way up. You&apos;ll be
            reading clocks like a pro before you know it.
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

        <Link
          to={`${toolsBasePath}/japanese-counters`}
          className="retro-tools-card card retro-paper-panel group"
          aria-label="Open Japanese Counter Practice Tool"
        >
          <div className="inline-flex items-center gap-2 rounded border border-[#14325633] bg-[rgba(26,178,209,0.14)] px-2.5 py-1 text-[0.8rem] text-[#1b3f69] retro-caps">
            <Hash className="h-4 w-4" />
            Counter Drills
          </div>
          <h2 className="retro-headline mt-3 text-xl">Counting Things</h2>
          <p className="mt-2 text-base text-[#2f4f73]">
            In Japanese, how you count depends on what you&apos;re counting. It&apos;s one of those
            things that clicks with practice, so start with the most common ones and build from
            there.
          </p>
          <div className="mt-5 flex items-center justify-between">
            <span className="retro-caps text-sm text-[#2f4f73]">Object cards + counter quiz</span>
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
