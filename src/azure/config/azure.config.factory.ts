import { registerAs } from '@nestjs/config';

import { AzureAccountConfig, AzureConfig } from './azure.config.interface';

/**
 * Extracts AccountName from Azure connection string
 * Format: DefaultEndpointsProtocol=https;AccountName=accountname;AccountKey=...
 */
function extractAccountName(connectionString: string): string | null {
  const match = connectionString.match(/AccountName=([^;]+)/i);
  return match ? match[1].trim() : null;
}

/**
 * Sanitizes account name for use in IDs
 * - Converts to lowercase
 * - Replaces invalid characters with hyphens
 * - Removes leading/trailing hyphens
 */
function sanitizeAccountName(accountName: string): string {
  return accountName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export const azureConfigFactory = registerAs('azure', (): AzureConfig => {
  // Get all environment variables
  const env = process.env;
  const accounts = new Map<string, AzureAccountConfig>();

  // Extract account numbers from environment variables
  const accountNumbers = new Set<string>();

  for (const key of Object.keys(env)) {
    const match = key.match(/^AZURE_ACCOUNT_(\d+)_/);
    if (match) {
      accountNumbers.add(match[1]);
    }
  }

  // Build account configurations
  for (const accountNumber of accountNumbers) {
    const connectionStringKey = `AZURE_ACCOUNT_${accountNumber}_CONNECTION_STRING`;

    const connectionString = env[connectionStringKey];

    if (connectionString) {
      const accountName = extractAccountName(connectionString);

      if (!accountName) {
        // Fallback to numeric ID if AccountName cannot be extracted
        const id = `azure-${accountNumber}`;
        accounts.set(id, {
          id,
          connectionString,
        });
      } else {
        const sanitizedAccountName = sanitizeAccountName(accountName);
        const id = `azure-${sanitizedAccountName}`;
        accounts.set(id, {
          id,
          connectionString,
        });
      }
    }
  }

  return { accounts };
});
