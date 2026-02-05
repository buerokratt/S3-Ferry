import * as joi from 'joi';

// Dynamic schema that validates Azure account environment variables
// Pattern: AZURE_ACCOUNT_{N}_CONNECTION_STRING and AZURE_ACCOUNT_{N}_CONTAINER_NAME
// We use unknown(true) to allow any keys, then validate them in the factory
export const azureConfigSchema = joi.object().unknown(true);
