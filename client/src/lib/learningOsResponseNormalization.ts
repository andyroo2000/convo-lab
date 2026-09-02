export type JsonRecord = Record<string, unknown>;

export const isJsonRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const unwrapLearningOsData = (value: unknown): unknown =>
  isJsonRecord(value) && Object.prototype.hasOwnProperty.call(value, 'data') ? value.data : value;

export const stringValue = (record: JsonRecord, camelKey: string, snakeKey: string): string => {
  const value = record[camelKey] ?? record[snakeKey];
  return typeof value === 'string' ? value : '';
};

export const nullableStringValue = (
  record: JsonRecord,
  camelKey: string,
  snakeKey: string
): string | null => {
  const value = record[camelKey] ?? record[snakeKey];
  return typeof value === 'string' ? value : null;
};

export const numberValue = (record: JsonRecord, camelKey: string, snakeKey: string): number => {
  const value = record[camelKey] ?? record[snakeKey];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

export const nullableNumberValue = (
  record: JsonRecord,
  camelKey: string,
  snakeKey: string
): number | null => {
  const value = record[camelKey] ?? record[snakeKey];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

export const nestedRecord = (
  record: JsonRecord,
  camelKey: string,
  snakeKey: string
): JsonRecord => {
  const value = record[camelKey] ?? record[snakeKey];
  return isJsonRecord(value) ? value : {};
};
