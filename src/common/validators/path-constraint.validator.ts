import * as path from 'path';

import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'validatePath', async: false })
export class PathConstraint implements ValidatorConstraintInterface {
  /**
   * Validates file paths to prevent path traversal attacks.
   * Uses three-layer defense:
   * 1. Blocks null bytes (can bypass some checks)
   * 2. Normalizes path and removes leading ../ sequences - if result differs from input, traversal was attempted
   * 3. Whitelist: only allows alphanumeric, dashes, dots, underscores, and forward slashes
   */
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
