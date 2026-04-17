import { registerAs } from '@nestjs/config';

import { FsConfigSchema } from './fs.config.schema';
import { ConfigUtil } from '../../common/utils';

export const fsConfigFactory = registerAs('fs', () => {
  return ConfigUtil.validate(FsConfigSchema, {
    dataDirectoryPath: process.env.FS_DATA_DIRECTORY_PATH,
  });
});
