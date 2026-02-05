import { registerAs } from '@nestjs/config';

import { S3Config } from './s3.config.interface';
import { s3ConfigSchema } from './s3.config.schema';
import { ConfigUtil } from '../../common/utils';

export const s3ConfigFactory = registerAs('s3', (): S3Config => {
  const env = ConfigUtil.validate(s3ConfigSchema);

  return {
    region: <string>env['S3_REGION'],
    endpointUrl: <string>env['S3_ENDPOINT_URL'],
    accessKeyId: <string>env['S3_ACCESS_KEY_ID'],
    secretAccessKey: <string>env['S3_SECRET_ACCESS_KEY'],
    dataBucketName: <string>env['S3_DATA_BUCKET_NAME'],
    dataBucketPath: <string>env['S3_DATA_BUCKET_PATH'],
  };
});
