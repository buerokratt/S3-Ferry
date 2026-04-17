import { Transform, TransformOptions } from 'class-transformer';

export const TransformStringToBoolean = (
  tranformOpts?: TransformOptions,
): PropertyDecorator =>
  Transform((args) => {
    const value =
      typeof args.value === 'string' ? args.value.toLowerCase() : args.value;
    if (['false', 'true', '1', '0'].includes(value)) {
      return value === 'true' || value === '1';
    }
    return value;
  }, tranformOpts);
