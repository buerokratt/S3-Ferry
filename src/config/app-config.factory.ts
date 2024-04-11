import { registerAs } from '@nestjs/config';

import { ConfigUtil } from '../common/utils';
import { AppConfig } from '../interfaces';

import { appConfigSchema } from './';

export const appConfigFactory = registerAs('api', (): AppConfig => {
  const env = ConfigUtil.validate(appConfigSchema);

  return {
    corsOrigin: split(<string>env['API_CORS_ORIGIN']),
    documentationEnabled: <boolean>env['API_DOCUMENTATION_ENABLED'],

    s3Region: <string>env['S3_REGION'],
    s3EndpointUrl: <string>env['S3_ENDPOINT_URL'],
    s3AccessKeyId: <string>env['S3_ACCESS_KEY_ID'],
    s3SecretAccessKey: <string>env['S3_SECRET_ACCESS_KEY'],
    s3DataBucketName: <string>env['S3_DATA_BUCKET_NAME'],
    s3DataBucketPath: <string>env['S3_DATA_BUCKET_PATH'],

    fsDataDirectoryPath: <string>env['FS_DATA_DIRECTORY_PATH'],
  };
});

function split(value: string): string | string[] {
  const values = value.split(',');
  return values.length === 1 ? values[0] : values;
}
