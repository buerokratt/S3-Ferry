import { env } from 'process';

import { registerAs } from '@nestjs/config';

import { S3ConfigSchema } from './s3.config.schema';
import { ConfigUtil } from '../../common/utils';
import {
  S3_DEFAULT_CONFIG_KEY,
  S3_ENV_FIELD_SUFFIX,
  S3_ENV_PREFIX,
} from '../s3.constants';

type S3BucketField = (typeof S3_ENV_FIELD_SUFFIX)[number];
type S3BucketConfigFields = Partial<Record<S3BucketField, string>>;
type S3BucketConfigFieldMap = Record<string, S3BucketConfigFields>;

export const s3ConfigFactory = registerAs(
  's3',
  (): Record<string, S3ConfigSchema> => {
    const fieldMap = parseS3EnvVariables();
    if (!fieldMap[S3_DEFAULT_CONFIG_KEY]) {
      throw new Error(`Missing required S3 config: "${S3_DEFAULT_CONFIG_KEY}"`);
    }

    return Object.fromEntries(
      Object.entries(fieldMap).map(([key, fields]) => [
        key,
        ConfigUtil.validate(S3ConfigSchema, {
          region: fields.REGION,
          endpointUrl: fields.ENDPOINT_URL,
          accessKeyId: fields.ACCESS_KEY_ID,
          secretAccessKey: fields.SECRET_ACCESS_KEY,
          dataBucketName: fields.DATA_BUCKET_NAME,
          dataBucketPath: fields.DATA_BUCKET_PATH,
          fsDataDirectoryPath: fields.FS_DATA_DIRECTORY_PATH,
        }),
      ]),
    );
  },
);

function parseS3EnvVariables(): S3BucketConfigFieldMap {
  const fieldMap: S3BucketConfigFieldMap = Object.create(null);

  for (const [envName, envValue] of Object.entries(env)) {
    const entry = getS3EnvEntry(envName, envValue);
    if (!entry) continue;

    fieldMap[entry.key] ??= Object.create(null);
    fieldMap[entry.key][entry.field] = entry.value;
  }

  return fieldMap;
}

function getS3EnvEntry(
  envName: string,
  envValue?: string,
): Readonly<{ key: string; field: S3BucketField; value: string }> | undefined {
  if (!envName.startsWith(S3_ENV_PREFIX)) return;

  const upperEnvName = envName.toUpperCase();

  for (const field of S3_ENV_FIELD_SUFFIX) {
    const suffix = `_${field}`;
    if (!upperEnvName.endsWith(suffix)) continue;

    const rawKey = envName.slice(S3_ENV_PREFIX.length, -suffix.length).trim();
    if (!rawKey || envValue === undefined) return;

    return { key: rawKey.toLowerCase(), field, value: envValue };
  }
}
