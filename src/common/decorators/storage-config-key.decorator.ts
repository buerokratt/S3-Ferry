import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

import { S3_DEFAULT_CONFIG_KEY } from '../../s3/s3.constants';
import { StorageType } from '../enums/storage-type.enum';

const KEYED_STORAGE_TYPES = [StorageType.FS, StorageType.S3] as const;

@ValidatorConstraint({ name: 'configKeyByStorageType', async: false })
class ConfigKeyByStorageTypeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const [storageTypeFieldName] = args.constraints as [string];
    const object = args.object as Record<string, unknown>;
    const storageType = object[storageTypeFieldName] as StorageType | undefined;
    const isKeyedStorageType = KEYED_STORAGE_TYPES.includes(
      storageType as (typeof KEYED_STORAGE_TYPES)[number],
    );

    if (value === undefined) {
      return true;
    }

    if (isKeyedStorageType) {
      return typeof value === 'string' && value.trim().length > 0;
    }

    return false;
  }

  defaultMessage(args: ValidationArguments): string {
    const [storageTypeFieldName] = args.constraints as [string];
    const object = args.object as Record<string, unknown>;
    const storageType = object[storageTypeFieldName] as StorageType | undefined;
    const isKeyedStorageType = KEYED_STORAGE_TYPES.includes(
      storageType as (typeof KEYED_STORAGE_TYPES)[number],
    );

    if (isKeyedStorageType) {
      return `"${args.property}" must be a non-empty string when ${storageTypeFieldName} is ${StorageType.FS} or ${StorageType.S3}`;
    }

    return `"${args.property}" must be omitted when ${storageTypeFieldName} is not ${StorageType.FS} or ${StorageType.S3}`;
  }
}

function configKeyByStorageType(
  storageTypeFieldName: string,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName.toString(),
      options: validationOptions,
      constraints: [storageTypeFieldName],
      validator: ConfigKeyByStorageTypeConstraint,
    });
  };
}

/**
 * Applies the standard decorators for an optional storage config key field.
 *
 * This composite decorator bundles:
 * - `@Transform(...)` to trim string input before validation
 * - `@ApiPropertyOptional(...)` to expose the field in Swagger as optional
 * - an internal `class-validator` decorator to enforce the storage-type-specific rule
 *
 * Omitted values are allowed because the internal validator treats `undefined`
 * as absent. Explicitly provided values, including `null`, are still validated.
 *
 * Validation behavior:
 * - when `storageTypeFieldName` points to a field with value `FS` or `S3`, the
 *   decorated property may be omitted and downstream code may apply the default
 *   config key, or it may be a non-empty string after trimming
 * - when the referenced storage type is anything other than `FS` or `S3`, the
 *   decorated property must be omitted
 *
 * @param storageTypeFieldName Name of the sibling DTO field that contains the
 * storage type used to validate the decorated property.
 * @param validationOptions Optional `class-validator` options forwarded to the
 * internal storage-type validator.
 */
export function StorageConfigKey(
  storageTypeFieldName: string,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    ApiPropertyOptional({
      description: `When ${storageTypeFieldName} is ${StorageType.FS} or ${StorageType.S3}, this value defaults to \`${S3_DEFAULT_CONFIG_KEY}\` if omitted. Omit for ${StorageType.AZURE} and other non-keyed storage types.`,
    }),
    configKeyByStorageType(storageTypeFieldName, validationOptions),
  );
}
