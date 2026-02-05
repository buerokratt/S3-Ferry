import * as joi from 'joi';

const schema = {
  API_CORS_ORIGIN: joi.string().required().allow(''),
  API_DOCUMENTATION_ENABLED: joi.boolean().required(),
};

export const appConfigSchema = joi.object<typeof schema>(schema);
