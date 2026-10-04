import { BookMarked } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import useReadings from './useReadings';

const ReadingsNav = ({ disabled = false }: { disabled?: boolean }) => {
  const readings = useReadings(!disabled);
  const location = useLocation();
  if (disabled || !readings.data?.length) return null;
  const active = location.pathname.startsWith('/app/readings');
  return (
    <Link
      to="/app/readings"
      className={`retro-nav-tab relative inline-flex items-center justify-center transition-all ${active ? 'is-active bg-white text-navy shadow-md' : 'text-white hover:bg-white/20'}`}
    >
      <BookMarked className="w-5 h-5 mr-2.5 flex-shrink-0" />
      Readings
    </Link>
  );
};

export default ReadingsNav;
