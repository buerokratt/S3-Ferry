import * as joi from 'joi';

const schema = {
  S3_REGION: joi.string().required(),
  S3_ENDPOINT_URL: joi.string().uri().required().allow(''),
  S3_ACCESS_KEY_ID: joi.string().required(),
  S3_SECRET_ACCESS_KEY: joi.string().required(),
  S3_DATA_BUCKET_NAME: joi.string().required(),
  S3_DATA_BUCKET_PATH: joi.string().allow(''),
};

export const s3ConfigSchema = joi.object<typeof schema>(schema);
