import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';

interface ApiDataWithMetaResponseArgs<TData extends Type, TMeta extends Type> {
  status: HttpStatus;
  data: {
    type: TData;
    isArray?: boolean;
  };
  meta: { type: TMeta };
}

export const ApiDataWithMetaResponse = <TData extends Type, TMeta extends Type>(
  args: ApiDataWithMetaResponseArgs<TData, TMeta>,
) =>
  applyDecorators(
    ApiExtraModels(args.data.type),
    ApiExtraModels(args.meta.type),
    ApiResponse({
      status: args.status,
      schema: {
        type: 'object',
        properties: {
          data: args.data.isArray
            ? {
                type: 'array',
                items: { $ref: getSchemaPath(args.data.type) },
              }
            : { $ref: getSchemaPath(args.data.type) },
          meta: { $ref: getSchemaPath(args.meta.type) },
        },
        required: ['data'],
      },
    }),
  );

export const ApiOkDataWithMetaResponse = <
  TData extends Type,
  TMeta extends Type,
>(
  args: Omit<ApiDataWithMetaResponseArgs<TData, TMeta>, 'status'>,
) => ApiDataWithMetaResponse({ ...args, status: HttpStatus.OK });
