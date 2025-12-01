export interface AzureAccountConfig {
  readonly id: string;
  readonly connectionString: string;
}

export interface AzureConfig {
  readonly accounts: Map<string, AzureAccountConfig>;
}
