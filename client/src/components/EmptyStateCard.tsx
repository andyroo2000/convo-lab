import { useNavigate } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

interface EmptyStateCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  buttonText: string;
  route: string;
  colorTheme: {
    bg: string; // e.g., 'bg-indigo-100'
    text: string; // e.g., 'text-indigo-600'
    border: string; // e.g., 'border-indigo-200'
    button: string; // e.g., 'bg-indigo-600 hover:bg-indigo-700'
  };
}

const EmptyStateCard = ({
  icon: Icon,
  title,
  description,
  buttonText,
  route,
  colorTheme,
}: EmptyStateCardProps) => {
  const navigate = useNavigate();

  return (
    <div className="max-w-md mx-auto py-12">
      <div
        className={`text-center space-y-6 p-8 rounded-2xl border-2 ${colorTheme.border} ${colorTheme.bg}`}
      >
        {/* Icon */}
        <div className="flex justify-center">
          <div className={`p-4 rounded-full ${colorTheme.bg} border-2 ${colorTheme.border}`}>
            <Icon className={`w-12 h-12 ${colorTheme.text}`} />
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-2">
          <h3 className={`text-xl font-semibold ${colorTheme.text}`}>{title}</h3>
          <p className="text-gray-600">{description}</p>
        </div>

        {/* CTA Button */}
        <button
          type="button"
          onClick={() => navigate(route)}
          className={`px-6 py-3 ${colorTheme.button} text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2`}
        >
          {buttonText}
          <span>→</span>
        </button>
      </div>
    </div>
  );
};

export default EmptyStateCard;
