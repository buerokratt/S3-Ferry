// import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { IsEnum, validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { StorageConfigKey } from './storage-config-key.decorator';
import { StorageType } from '../enums/storage-type.enum';

class Class {
  @IsEnum(StorageType)
  type!: StorageType;

  @StorageConfigKey('type')
  configKey?: string;
}

describe('StorageConfigKey', () => {
  it('FS with omitted configKey is valid', async () => {
    const dto = plainToInstance(Class, {
      type: StorageType.FS,
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('FS with non-empty configKey is valid', async () => {
    const dto = plainToInstance(Class, {
      type: StorageType.FS,
      configKey: 'custom-root',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('configKey is trimmed before validation', async () => {
    const dto = plainToInstance(Class, {
      type: StorageType.FS,
      configKey: '  custom-root  ',
    });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.configKey).toBe('custom-root');
  });

  it('FS with whitespace-only configKey is invalid', async () => {
    const dto = plainToInstance(Class, {
      type: StorageType.FS,
      configKey: '   ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.constraints).toEqual({
      configKeyByStorageType:
        '"configKey" must be a non-empty string when type is FS or S3',
    });
  });

  it('FS with null configKey is invalid', async () => {
    const dto = plainToInstance(Class, {
      type: StorageType.FS,
      configKey: null,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.constraints).toEqual({
      configKeyByStorageType:
        '"configKey" must be a non-empty string when type is FS or S3',
    });
  });

  it('S3 with omitted configKey is valid', async () => {
    const dto = plainToInstance(Class, {
      type: StorageType.S3,
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('S3 with non-empty configKey is valid', async () => {
    const dto = plainToInstance(Class, {
      type: StorageType.S3,
      configKey: 'custom-root',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('AZURE with provided configKey is invalid', async () => {
    const dto = plainToInstance(Class, {
      type: StorageType.AZURE,
      configKey: 'custom-root',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.constraints).toEqual({
      configKeyByStorageType:
        '"configKey" must be omitted when type is not FS or S3',
    });
  });

  it('invalid sibling type keeps configKey validation active', async () => {
    const dto = plainToInstance(Class, {
      type: 'BROKEN' as StorageType,
      configKey: 'custom-root',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['type', 'configKey']),
    );
  });
});
