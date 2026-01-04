interface RatingButtonsProps {
  onRate: (rating: 1 | 2 | 3 | 4) => void;
  disabled?: boolean;
}

const RatingButtons = ({ onRate, disabled = false }: RatingButtonsProps) => {
  const buttons = [
    { rating: 1 as const, label: 'Again', color: 'bg-red-500 hover:bg-red-600', key: '1' },
    { rating: 2 as const, label: 'Hard', color: 'bg-yellow-500 hover:bg-yellow-600', key: '2' },
    { rating: 3 as const, label: 'Good', color: 'bg-green-500 hover:bg-green-600', key: '3' },
    { rating: 4 as const, label: 'Easy', color: 'bg-blue-500 hover:bg-blue-600', key: '4' },
  ];

  return (
    <div className="flex gap-3 justify-center mt-8">
      {buttons.map(({ rating, label, color, key }) => (
        <button
          key={rating}
          type="button"
          onClick={() => onRate(rating)}
          disabled={disabled}
          className={`
            flex flex-col items-center gap-1 px-8 py-4 text-white rounded-lg
            transition-all transform hover:scale-105 active:scale-95
            ${color}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <span className="font-semibold text-lg">{label}</span>
          <span className="text-sm opacity-90">{key}</span>
        </button>
      ))}
    </div>
  );
};

export default RatingButtons;
