import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

import { TransformStringToBoolean } from '../transformers';

export class AppConfigSchema {
  @IsString({ each: true })
  readonly corsOrigin!: string | string[];

  @IsBoolean()
  @IsNotEmpty()
  @TransformStringToBoolean()
  readonly documentationEnabled!: boolean;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  readonly port?: number;
}
