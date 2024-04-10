import * as Joi from 'joi';

const schema = {
  // TODO: Allow only * or comma separated URIs
  API_CORS_ORIGIN: Joi.string().required(),
  API_DOCUMENTATION_ENABLED: Joi.boolean().required(),

  AWS_PROFILE: Joi.string().required(),
  S3_DATA_BUCKET_NAME: Joi.string().required(),
  S3_DATA_BUCKET_PATH: Joi.string().allow(''),
  S3_ENDPOINT_URL: Joi.string().uri().required(),

  LOCAL_DIRECTORY_NAME: Joi.string().required(),
};

export const appConfigSchema = Joi.object<typeof schema>(schema);
