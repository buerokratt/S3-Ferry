import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

import { S3_DEFAULT_CONFIG_KEY } from '../../s3/s3.constants';
import { StorageType } from '../enums/storage-type.enum';

@ValidatorConstraint({ name: 'configKeyByStorageType', async: false })
class ConfigKeyByStorageTypeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const [storageTypeFieldName] = args.constraints as [string];
    const object = args.object as Record<string, unknown>;
    const storageType = object[storageTypeFieldName] as StorageType | undefined;

    if (storageType === StorageType.S3) {
      return typeof value === 'string' && value.trim().length > 0;
    }

    return value === undefined || value === null;
  }

  defaultMessage(args: ValidationArguments): string {
    const [storageTypeFieldName] = args.constraints as [string];
    const object = args.object as Record<string, unknown>;
    const storageType = object[storageTypeFieldName] as StorageType | undefined;

    if (storageType === StorageType.S3) {
      return `"${args.property}" must be a non-empty string when ${storageTypeFieldName} is ${StorageType.S3}`;
    }

    return `"${args.property}" must be omitted when ${storageTypeFieldName} is not ${StorageType.S3}`;
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
 * - `@IsOptional()` to skip validation when the field is omitted
 *
 * Validation behavior:
 * - when `storageTypeFieldName` points to a field with value `S3`, the decorated
 *   property must be a non-empty string if provided, and downstream code may
 *   apply the default config key when it is omitted
 * - when the referenced storage type is anything other than `S3`, the decorated
 *   property must be omitted
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
      description: `When ${storageTypeFieldName} is ${StorageType.S3}, this value defaults to \`${S3_DEFAULT_CONFIG_KEY}\` if omitted. Omit for other storage types.`,
    }),
    configKeyByStorageType(storageTypeFieldName, validationOptions),
    IsOptional(),
  );
}
