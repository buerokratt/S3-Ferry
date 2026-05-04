import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

export class ConfigUtil {
  static validate<T extends Record<string, any>>(
    type: new () => T,
    config: Record<string, unknown>,
  ): T {
    const configuration = plainToInstance(type, config);
    const errors = validateSync(configuration, {
      skipMissingProperties: false,
    });
    if (errors.length > 0) throw new Error(errors.toString());
    else return configuration;
  }
}
