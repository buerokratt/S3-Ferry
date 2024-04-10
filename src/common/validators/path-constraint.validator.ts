import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'validatePath', async: false })
export class PathConstraint implements ValidatorConstraintInterface {
  validate(userInput: string) {
    return userInput.indexOf('\0') !== -1 ? false : true;
  }
}
