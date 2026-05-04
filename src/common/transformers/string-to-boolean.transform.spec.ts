import { plainToClass } from 'class-transformer';

import { TransformStringToBoolean } from './string-to-boolean.transform';

class Class {
  @TransformStringToBoolean()
  readonly property!: boolean;
}

describe('TransformStringToBoolean', () => {
  it(`should transform 'true' to true`, () => {
    expect(plainToClass(Class, { property: 'true' }).property).toBe(true);
  });

  it(`should transform '1' to true`, () => {
    expect(plainToClass(Class, { property: '1' }).property).toBe(true);
  });

  it(`should transform 'false' to false`, () => {
    expect(plainToClass(Class, { property: 'false' }).property).toBe(false);
  });

  it(`should transform '0' to false`, () => {
    expect(plainToClass(Class, { property: '0' }).property).toBe(false);
  });

  it('should be case insensitive', () => {
    expect(plainToClass(Class, { property: 'TRUE' }).property).toBe(true);
  });

  it('should not transform a non string value', () => {
    expect(plainToClass(Class, { property: true }).property).toBe(true);
    expect(plainToClass(Class, { property: undefined }).property).toBe(
      undefined,
    );
    expect(plainToClass(Class, { property: null }).property).toBe(null);
  });

  it('should not transform a non boolean string', () => {
    expect(plainToClass(Class, { property: 'foo' }).property).toBe('foo');
  });
});
