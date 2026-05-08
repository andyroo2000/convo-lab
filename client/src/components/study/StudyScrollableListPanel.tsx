import type { ReactNode } from 'react';

interface StudyScrollableListPanelProps {
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  panelTestId?: string;
  scrollRegionTestId?: string;
}

const StudyScrollableListPanel = ({
  header,
  children,
  footer,
  panelTestId,
  scrollRegionTestId,
}: StudyScrollableListPanelProps) => (
  <div
    data-testid={panelTestId}
    className="card retro-paper-panel min-w-0 overflow-hidden xl:sticky xl:top-6 xl:flex xl:max-h-[calc(100vh-3rem)] xl:flex-col xl:self-start"
  >
    <div className="border-b border-gray-200 px-4 py-3">{header}</div>

    <div data-testid={scrollRegionTestId} className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
      {children}
    </div>

    {footer ? (
      <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        {footer}
      </div>
    ) : null}
  </div>
);

export default StudyScrollableListPanel;
