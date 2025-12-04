import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  azureConfigFactory,
  buildAccountConfig,
  buildAccountConfigs,
  extractAzureConnectionStrings,
} from './azure.config.factory';

describe('AzureConfigFactory', () => {
  describe('extractAzureConnectionStrings', () => {
    it('should extract connection strings from environment variables', () => {
      const env = {
        AZURE_ACCOUNT_1_CONNECTION_STRING: 'conn1',
        AZURE_ACCOUNT_2_CONNECTION_STRING: 'conn2',
        S3_REGION: 'us-east-1',
      };

      const result = extractAzureConnectionStrings(env);

      expect(result.size).toBe(2);
      expect(result.get('1')).toBe('conn1');
      expect(result.get('2')).toBe('conn2');
    });

    it('should ignore undefined connection strings', () => {
      const env = {
        AZURE_ACCOUNT_1_CONNECTION_STRING: 'conn1',
        AZURE_ACCOUNT_2_CONNECTION_STRING: undefined,
      };

      const result = extractAzureConnectionStrings(env);

      expect(result.size).toBe(1);
      expect(result.get('1')).toBe('conn1');
    });

    it('should return empty map when no Azure accounts exist', () => {
      const env = { S3_REGION: 'us-east-1' };

      const result = extractAzureConnectionStrings(env);

      expect(result.size).toBe(0);
    });
  });

  describe('buildAccountConfig', () => {
    it('should build config with account name from connection string', () => {
      const connectionString =
        'DefaultEndpointsProtocol=https;AccountName=myaccount;AccountKey=key==;EndpointSuffix=core.windows.net';

      const result = buildAccountConfig('1', connectionString);

      expect(result).toEqual({
        id: 'azure-myaccount',
        connectionString,
      });
    });

    it('should use fallback ID when account name cannot be extracted', () => {
      const connectionString = 'InvalidConnectionString';

      const result = buildAccountConfig('2', connectionString);

      expect(result).toEqual({
        id: 'azure-2',
        connectionString,
      });
    });
  });

  describe('buildAccountConfigs', () => {
    it('should build all account configs from connection strings', () => {
      const connectionStrings = new Map([
        [
          '1',
          'DefaultEndpointsProtocol=https;AccountName=account1;AccountKey=key==;EndpointSuffix=core.windows.net',
        ],
        [
          '2',
          'DefaultEndpointsProtocol=https;AccountName=account2;AccountKey=key==;EndpointSuffix=core.windows.net',
        ],
      ]);

      const result = buildAccountConfigs(connectionStrings);

      expect(result.size).toBe(2);
      expect(result.get('azure-account1')?.connectionString).toBe(
        connectionStrings.get('1'),
      );
      expect(result.get('azure-account2')?.connectionString).toBe(
        connectionStrings.get('2'),
      );
    });

    it('should handle fallback IDs for invalid connection strings', () => {
      const connectionStrings = new Map([
        ['1', 'InvalidConnectionString'],
        [
          '2',
          'DefaultEndpointsProtocol=https;AccountName=valid;AccountKey=key==;EndpointSuffix=core.windows.net',
        ],
      ]);

      const result = buildAccountConfigs(connectionStrings);

      expect(result.size).toBe(2);
      expect(result.get('azure-1')?.connectionString).toBe(
        'InvalidConnectionString',
      );
      expect(result.get('azure-valid')?.connectionString).toBe(
        connectionStrings.get('2'),
      );
    });
  });

  describe('azureConfigFactory', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should build config from process.env', () => {
      process.env = {
        AZURE_ACCOUNT_1_CONNECTION_STRING:
          'DefaultEndpointsProtocol=https;AccountName=testaccount1;AccountKey=key==;EndpointSuffix=core.windows.net',
        AZURE_ACCOUNT_2_CONNECTION_STRING:
          'DefaultEndpointsProtocol=https;AccountName=testaccount2;AccountKey=key==;EndpointSuffix=core.windows.net',
      };

      const result = azureConfigFactory();

      expect(result.accounts.size).toBe(2);
      expect(result.accounts.get('azure-testaccount1')).toBeDefined();
      expect(result.accounts.get('azure-testaccount2')).toBeDefined();
    });

    it('should return empty config when no Azure accounts in env', () => {
      process.env = { S3_REGION: 'us-east-1' };

      const result = azureConfigFactory();

      expect(result.accounts.size).toBe(0);
    });
  });
});
