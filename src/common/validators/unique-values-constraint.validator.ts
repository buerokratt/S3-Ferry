import { Injectable } from '@nestjs/common';
import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'uniqueValues', async: false })
@Injectable()
export class UniqueValuesConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const [property1, property2] = args.constraints;
    const object = args.object as any;
    return object[property1] !== object[property2];
  }

  defaultMessage(args: ValidationArguments) {
    const [property1, property2] = args.constraints;
    return `${property1} and ${property2} cannot have the same value`;
  }
}
