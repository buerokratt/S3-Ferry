import { registerAs } from '@nestjs/config';

import { AzureAccountConfig, AzureConfig } from './azure.config.interface';

export const azureConfigFactory = registerAs('azure', (): AzureConfig => {
  const connectionStrings = extractAzureConnectionStrings(process.env);
  const accounts = buildAccountConfigs(connectionStrings);

  return { accounts };
});

/**
 * Extracts Azure account connection strings from environment variables
 * Returns a map of account number to connection string
 */
export function extractAzureConnectionStrings(
  env: Record<string, string | undefined>,
): Map<string, string> {
  const connectionStrings = new Map<string, string>();

  for (const key of Object.keys(env)) {
    const match = key.match(/^AZURE_ACCOUNT_(\d+)_CONNECTION_STRING$/);
    if (match) {
      const accountNumber = match[1];
      const connectionString = env[key];
      if (connectionString) {
        connectionStrings.set(accountNumber, connectionString);
      }
    }
  }

  return connectionStrings;
}

/**
 * Builds all Azure account configurations from connection strings map
 */
export function buildAccountConfigs(
  connectionStrings: Map<string, string>,
): Map<string, AzureAccountConfig> {
  const accounts = new Map<string, AzureAccountConfig>();

  for (const [accountNumber, connectionString] of connectionStrings.entries()) {
    const accountConfig = buildAccountConfig(accountNumber, connectionString);
    accounts.set(accountConfig.id, accountConfig);
  }

  return accounts;
}

/**
 * Builds account configuration from account number and connection string
 */
export function buildAccountConfig(
  accountNumber: string,
  connectionString: string,
): AzureAccountConfig {
  const accountName = extractAccountName(connectionString);

  if (!accountName) {
    // Fallback to numeric ID if AccountName cannot be extracted
    const id = `azure-${accountNumber}`;
    return {
      id,
      connectionString,
    };
  }

  const id = `azure-${accountName}`;
  return {
    id,
    connectionString,
  };
}

/**
 * Extracts AccountName from Azure connection string
 * Format: DefaultEndpointsProtocol=https;AccountName=accountname;AccountKey=...
 */
function extractAccountName(connectionString: string): string | null {
  const match = connectionString.match(/AccountName=([^;]+)/i);
  return match ? match[1].trim() : null;
}
