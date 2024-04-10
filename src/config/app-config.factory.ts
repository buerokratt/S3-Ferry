import { registerAs } from '@nestjs/config';

import { ConfigUtil } from '../common/utils';
import { AppConfig } from 'src/interfaces';
import { appConfigSchema } from './app-config.schema';

export const appConfigFactory = registerAs('api', (): AppConfig => {
  const env = ConfigUtil.validate(appConfigSchema);

  return {
    corsOrigin: split(<string>env['API_CORS_ORIGIN']),
    documentationEnabled: <boolean>env['API_DOCUMENTATION_ENABLED'],

    awsProfile: <string>env['AWS_PROFILE'],
    s3DataBucketName: <string>env['S3_DATA_BUCKET_NAME'],
    s3DataBucketPath: <string>env['S3_DATA_BUCKET_PATH'],
    s3EndpointUrl: <string>env['S3_ENDPOINT_URL'],

    localDirectoryName: <string>env['LOCAL_DIRECTORY_NAME'],
  };
});

function split(value: string): string | string[] {
  const values = value.split(',');
  return values.length === 1 ? values[0] : values;
}
