import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

import { TransformStringToBoolean } from '../transformers';

export class AppConfigSchema {
  @IsString({ each: true })
  readonly corsOrigin!: string | string[];

  @IsBoolean()
  @IsNotEmpty()
  @TransformStringToBoolean()
  readonly documentationEnabled!: boolean;
}
