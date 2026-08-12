class StudyReviewIdentityMismatchError extends Error {
  constructor(
    public readonly submittedReviewId: string,
    public readonly receivedReviewId: string
  ) {
    super('Study review response did not match the submitted review ID.');
    this.name = 'StudyReviewIdentityMismatchError';
  }
}

export default StudyReviewIdentityMismatchError;
