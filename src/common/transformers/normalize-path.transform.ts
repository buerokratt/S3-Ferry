import { TransformFnParams } from 'class-transformer';

export function NormalizeFilePath(params: TransformFnParams) {
  return params.value.normalize().replace(/^(\.\.(\/|\\|$))+/, '');
}
