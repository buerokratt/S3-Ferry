import * as path from 'path';

import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'validatePath', async: false })
export class PathConstraint implements ValidatorConstraintInterface {
  validate(userInput: string) {
    return (
      userInput.indexOf('\0') === -1 &&
      path.normalize(userInput).replace(/^(\.\.(\/|\\|$))+/, '') ===
        userInput &&
      /^[0-9a-zA-Z-._/]+$/.test(userInput)
    );
  }

  defaultMessage() {
    return 'Path contains illegal characters';
  }
}
