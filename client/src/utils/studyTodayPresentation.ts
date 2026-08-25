const REVIEW_ESTIMATE_SECONDS_PER_CARD = 23;

const estimateReviewMinutes = (reviewCount: number) => {
  if (reviewCount <= 0) {
    return null;
  }

  return Math.max(1, Math.ceil((reviewCount * REVIEW_ESTIMATE_SECONDS_PER_CARD) / 60));
};

export const calendarDayLabel = (startsAt: Date, locale: string, now = new Date()) => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate());
  const dayDifference = Math.round((eventDay.getTime() - today.getTime()) / 86_400_000);

  if (dayDifference >= 0 && dayDifference <= 1) {
    const label = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      dayDifference,
      'day'
    );
    return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1);
  }

  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(startsAt);
};

export default estimateReviewMinutes;
