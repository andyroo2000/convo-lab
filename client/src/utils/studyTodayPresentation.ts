const estimateReviewMinutes = (
  reviewCount: number,
  medianReviewDurationSeconds: number | null | undefined
) => {
  if (
    reviewCount <= 0 ||
    medianReviewDurationSeconds === null ||
    medianReviewDurationSeconds === undefined ||
    !Number.isFinite(medianReviewDurationSeconds) ||
    medianReviewDurationSeconds <= 0
  ) {
    return null;
  }

  return Math.max(1, Math.ceil((reviewCount * medianReviewDurationSeconds) / 60));
};

export default estimateReviewMinutes;
