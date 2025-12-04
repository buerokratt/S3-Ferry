import { Inject, Injectable } from '@nestjs/common';

import { StorageAccountDto } from '../../common/dtos';
import { azureConfigFactory } from '../config';
import { AzureConfig } from '../config/azure.config.interface';

@Injectable()
export class AzureAccountService {
  constructor(
    @Inject(azureConfigFactory.KEY) private readonly config: AzureConfig,
  ) {}

  listAccounts(): StorageAccountDto[] {
    const accounts: StorageAccountDto[] = [];

    for (const [id] of this.config.accounts.entries()) {
      accounts.push({
        id,
      });
    }

    return accounts;
  }
}
