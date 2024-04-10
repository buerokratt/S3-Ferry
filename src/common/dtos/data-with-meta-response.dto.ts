export class DataWithMetaResponseDto<TData, TMeta> {
  readonly data!: TData;
  readonly meta!: TMeta;
}
