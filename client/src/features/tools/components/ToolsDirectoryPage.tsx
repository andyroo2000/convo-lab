import { ArrowRight } from 'lucide-react';
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
          Fast, practical tools for Japanese learners. Start with date and time reading.
        </p>
      </section>

      <section className="card retro-paper-panel">
        <h2 className="retro-headline text-xl">Japanese Date & Time</h2>
        <p className="mt-2 text-base text-[#2f4f73]">
          Convert dates and times to natural Japanese script with furigana.
        </p>

        <div className="mt-4">
          <Link
            to={`${toolsBasePath}/japanese-date`}
            className="btn-primary inline-flex items-center gap-2"
          >
            Open Tool
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default ToolsDirectoryPage;
