import * as joi from 'joi';

const schema = {
  // TODO: Allow only * or comma separated URIs
  API_CORS_ORIGIN: joi.string().required(),
  API_DOCUMENTATION_ENABLED: joi.boolean().required(),

  S3_ACCESS_KEY_ID: joi.string().required(),
  S3_SECRET_ACCESS_KEY: joi.string().required(),
  S3_DATA_BUCKET_NAME: joi.string().required(),
  S3_DATA_BUCKET_PATH: joi.string().allow(''),
  S3_ENDPOINT_URL: joi.string().uri().required(),
  S3_REGION: joi.string().required(),

  FS_DATA_DIRECTORY_PATH: joi.string().required(),
};

export const appConfigSchema = joi.object<typeof schema>(schema);
