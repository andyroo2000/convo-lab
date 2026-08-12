export default async function getAdminScriptErrorMessage(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  const apiMessage = data && typeof data.message === 'string' ? data.message.trim() : '';
  return apiMessage || fallback;
}
