export default function getDeviceStudyTimeZone(): string | undefined {
  try {
    const { timeZone } = Intl.DateTimeFormat().resolvedOptions();
    return typeof timeZone === 'string' && timeZone.length > 0 ? timeZone : undefined;
  } catch {
    return undefined;
  }
}
