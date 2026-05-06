import { env } from 'process';

import { registerAs } from '@nestjs/config';

import { ConfigUtil } from '../utils';

import { AppConfigSchema } from './';

export const appConfigFactory = registerAs('api', (): AppConfigSchema => {
  return ConfigUtil.validate(AppConfigSchema, {
    corsOrigin: split(<string>env['API_CORS_ORIGIN']),
    documentationEnabled: <string>env['API_DOCUMENTATION_ENABLED'],
    port: <string>env['API_PORT'],
  });
});

function split(value: string): string | string[] {
  const values = value.split(',');
  return values.length === 1 ? values[0] : values;
}
