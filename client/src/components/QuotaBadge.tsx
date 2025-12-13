import { useQuota } from '../hooks/useQuota';

/**
 * Badge component that displays the user's remaining content generation quota
 * Only shows for non-admin users who have a quota limit
 */
export default function QuotaBadge() {
  const { quotaInfo, loading } = useQuota();

  // Don't show for loading state, unlimited users, or if quota couldn't be fetched
  if (loading || !quotaInfo || quotaInfo.unlimited) return null;

  const { used, limit, remaining } = quotaInfo.quota!;
  const percentage = (used / limit) * 100;

  // Determine badge color based on usage
  const getBadgeColor = () => {
    if (percentage >= 90) return 'bg-red-100 text-red-700';
    if (percentage >= 80) return 'bg-orange-100 text-orange-700';
    return 'bg-blue-100 text-blue-700';
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${getBadgeColor()}`}>
      <span className="text-sm font-medium">
        {remaining}/{limit} generations left this week
      </span>
      {percentage >= 80 && (
        <span className="text-xs font-semibold px-2 py-0.5 bg-white bg-opacity-50 rounded-full">
          {percentage >= 90 ? 'Low quota' : 'Running low'}
        </span>
      )}
    </div>
  );
}
