export const STUDY_IMPORT_ULID_SEGMENT = '[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}';
export const STUDY_IMPORT_ID_SEGMENT = `(?:${STUDY_IMPORT_ULID_SEGMENT}|[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12})`;

export const STUDY_IMPORT_UPLOAD_PATH_PATTERN = new RegExp(
  `^/imports/${STUDY_IMPORT_ULID_SEGMENT}/upload$`
);

export const LEARNING_OS_IMPORT_UPLOAD_PUBLIC_PATH_SOURCE = `^/api/learning-os/study/imports/${STUDY_IMPORT_ULID_SEGMENT}/upload$`;

export const LEARNING_OS_IMPORT_UPLOAD_PUBLIC_PATH_PATTERN = new RegExp(
  LEARNING_OS_IMPORT_UPLOAD_PUBLIC_PATH_SOURCE
);
