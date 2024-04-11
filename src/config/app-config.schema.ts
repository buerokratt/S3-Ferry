import * as joi from 'joi';

const schema = {
  API_CORS_ORIGIN: joi.string().required().allow(''),
  API_DOCUMENTATION_ENABLED: joi.boolean().required(),

  S3_REGION: joi.string().required(),
  S3_ENDPOINT_URL: joi.string().uri().required().allow(''),
  S3_ACCESS_KEY_ID: joi.string().required(),
  S3_SECRET_ACCESS_KEY: joi.string().required(),
  S3_DATA_BUCKET_NAME: joi.string().required(),
  S3_DATA_BUCKET_PATH: joi.string().allow(''),

  FS_DATA_DIRECTORY_PATH: joi.string().required(),
};

export const appConfigSchema = joi.object<typeof schema>(schema);
