export const S3_DEFAULT_CONFIG_KEY = 'default' as const;
export const S3_ENV_FIELD_SUFFIX = [
  'REGION',
  'ENDPOINT_URL',
  'ACCESS_KEY_ID',
  'SECRET_ACCESS_KEY',
  'DATA_BUCKET_NAME',
  'DATA_BUCKET_PATH',
  'FS_DATA_DIRECTORY_PATH',
] as const;
export const S3_ENV_PREFIX = 'S3_' as const;
