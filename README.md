# Storage-Ferry

A generic service to transfer files between different storage backends (local filesystem, S3, Azure Blob, etc.)

---

## Local Development

To develop the Storage Ferry, it's recommended to have [nvm](https://github.com/nvm-sh/nvm) installed, which will ensure you
have the correct node and npm versions.

```sh
# Install the required node version
nvm install

# Switch to the required node version
nvm use

# Install node dependencies
npm install

# Run the localstack and azurite containers
docker compose up localstack azurite

# Run the API in development mode
npm run start:dev
```

---

## Coding Standards

Linting and formatting is done with [ESLint](https://eslint.org/) and [Prettier](https://prettier.io/).

```sh
# Run eslint
npm run lint:check

# Run prettier
npm run format:check
```

---

## Running Tests

```sh
# Run localstack and azurite - tests will fail otherwise
docker compose up localstack azurite
# Run e2e tests locally
npm run test:e2e
```

---

## Docker

You can run the Storage Ferry inside docker. The API will be exposed at `http://localhost:3000`.

```sh
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

| Variable                            | Description                                                                                                                                                                                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_CORS_ORIGIN`                   | Specify CORS allowed domains. <br/>- Asterisk (`*`) to allow all<br/>- Empty value to allow nothing<br/>- Otherwise provide a comma separated list of allowed domains                                                                                                                 |
| `API_DOCUMENTATION_ENABLED`         | Enable API documentation, value can be either `true` or `false`                                                                                                                                                                                                                       |
| `S3_REGION`                         | Endpoint region for the S3 storage                                                                                                                                                                                                                                                    |
| `S3_ENDPOINT_URL`                   | Endpoint URL for the S3 storage. Can be used with S3-compatible services (e.g., MinIO, DigitalOcean Spaces) by providing a custom endpoint URL. Leave empty to use default AWS S3 endpoints.                                                                                          |
| `S3_ACCESS_KEY_ID`                  | Access key for the S3 storage                                                                                                                                                                                                                                                         |
| `S3_SECRET_ACCESS_KEY`              | Secret access key for the S3 storage                                                                                                                                                                                                                                                  |
| `S3_DATA_BUCKET_NAME`               | Data bucket name for the S3 storage                                                                                                                                                                                                                                                   |
| `S3_DATA_BUCKET_PATH`               | Data bucket path for the S3 storage                                                                                                                                                                                                                                                   |
| `FS_DATA_DIRECTORY_PATH`            | Local filesystem data directory path                                                                                                                                                                                                                                                  |
| `AZURE_ACCOUNT_*_CONNECTION_STRING` | Azure Storage account connection string. Can include `BlobEndpoint` parameter to use custom endpoints (e.g., Azurite for local development). Note: While technically supported, there are very few production-ready Azure-compatible services compared to S3-compatible alternatives. |
