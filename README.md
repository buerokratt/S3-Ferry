# S3-Ferry

A generic service to trasnfer files to and from any S3 platform

---

## Local Development

To develop the S3 Ferry, it's recommended to have [nvm](https://github.com/nvm-sh/nvm) installed, which will ensure you
have the correct node and npm versions.

```
# Install the required node version
nvm install

# Switch to the required node version
nvm use

# Install node dependencies
npm install

# Run the locakstack container
docker compose up localstack

# Run the API in development mode
npm run start:dev
```

---

## Coding Standards

Linting and formatting is done with [ESLint](https://eslint.org/) and [Prettier](https://prettier.io/).

```
# Run eslint
npm run lint:check

# Run prettier
npm run format:check
```

---

## Running Tests

API endpoints are covered with basic e2e tests written with [Jest](https://jestjs.io/).

```
# Run e2e tests locally
npm run test:e2e
```

---

## Docker

You can run the S3 Ferry inside docker. The API will be exposed at `http://localhost:3000`.

```
# Build the docker image
docker compose build

# Run the docker images
docker compose up
```

---

## Documentation

Automatically generated API documentation can be found
at [http://localhost:3000/documentation](http://localhost:3000/documentation)

---

## Environment Variables

Environment variables and their meaning is defined below.

| Variable                    | Description                                                                                                                                                           |
|-----------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `API_CORS_ORIGIN`           | Specify CORS allowed domains. <br/>- Asterisk (`*`) to allow all<br/>- Empty value to allow nothing<br/>- Otherwise provide a comma separated list of allowed domains |
| `API_DOCUMENTATION_ENABLED` | Enable API documentation, value can be either `true` or `false`                                                                                                       |
| `S3_REGION`                 | Endpoint region for the S3 storage                                                                                                                                    |
| `S3_ENDPOINT_URL`           | Endpoint URL for the S3 storage                                                                                                                                       |
| `S3_ACCESS_KEY_ID`          | Access key for the S3 storage                                                                                                                                         |
| `S3_SECRET_ACCESS_KEY`      | Secret access key for the S3 storage                                                                                                                                  |
| `S3_DATA_BUCKET_NAME`       | Data bucket name for the S3 storage                                                                                                                                   |
| `S3_DATA_BUCKET_PATH`       | Data bucket path for the S3 storage                                                                                                                                   |
| `FS_DATA_DIRECTORY_PATH`    | Local filesystem data directory path                                                                                                                                  |

