import type { ReadingPage } from './types';

const ReadingPageIllustration = ({ page }: { page: ReadingPage }) => {
  const crop = page.imageCrop ?? { left: 0, top: 0, width: 100, height: 100 };
  return (
    <img
      className="full-page-illustration"
      src={page.imageUrl}
      alt={`Book illustration — page ${page.number}`}
      style={{
        width: `${10000 / crop.width}%`,
        height: `${10000 / crop.height}%`,
        left: `${(-100 * crop.left) / crop.width}%`,
        top: `${(-100 * crop.top) / crop.height}%`,
      }}
    />
  );
};

export default ReadingPageIllustration;
