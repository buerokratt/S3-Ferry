import { registerAs } from '@nestjs/config';

import { FsConfig } from './fs.config.interface';
import { fsConfigSchema } from './fs.config.schema';
import { ConfigUtil } from '../../common/utils';

export const fsConfigFactory = registerAs('fs', (): FsConfig => {
  const env = ConfigUtil.validate(fsConfigSchema);

  return {
    dataDirectoryPath: <string>env['FS_DATA_DIRECTORY_PATH'],
  };
});
