import { registerAs } from '@nestjs/config';

import { ConfigUtil } from '../utils';
import { AppConfig } from '../interfaces';

import { appConfigSchema } from './';

export const appConfigFactory = registerAs('api', (): AppConfig => {
  const env = ConfigUtil.validate(appConfigSchema);

  return {
    corsOrigin: split(<string>env['API_CORS_ORIGIN']),
    documentationEnabled: <boolean>env['API_DOCUMENTATION_ENABLED'],
  };
});

function split(value: string): string | string[] {
  const values = value.split(',');
  return values.length === 1 ? values[0] : values;
}
