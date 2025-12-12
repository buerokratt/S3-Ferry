# Storage-Ferry

A generic service to transfer files between different storage backends (local filesystem, S3, Azure Blob, etc.)

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

## Coding Standards

Linting and formatting is done with [ESLint](https://eslint.org/) and [Prettier](https://prettier.io/).

```sh
# Run eslint
npm run lint:check

# Run prettier
npm run format:check
```

## Running Tests

```sh
# Run localstack and azurite - e2e tests will fail otherwise
docker compose up localstack azurite
# Run unit tests
npm run test
# Run e2e tests
npm run test:e2e
```

## Docker

You can run the Storage Ferry inside docker. The API will be exposed at `http://localhost:3000`.

```sh
# Build the docker image
docker compose build

# Run the docker images
docker compose up
```

## Swagger Documentation

Automatically generated API documentation can be found
at [http://localhost:3000/documentation](http://localhost:3000/documentation)

## Endpoints

### Request Body Validation

All endpoints that accept file location data validate the following:

- `files`: Must be a non-empty array of file location objects
- Each file location object requires:
  - `storageAccountId`: Must be a string starting with `azure-` prefix (currently only Azure Blob Storage is supported)
  - `container`: Must be a string matching path constraints (alphanumeric, dashes, dots, underscores, and forward slashes only; no path traversal sequences)
  - `fileName`: Must be a string matching the same path constraints as `container`
- For create operations, `content` must be a non-empty string

Failing the validation will result in a `400` Bad Request error.

### GET `/v1/storage-accounts`

Lists all available storage accounts configured in the system. You can use these IDs to make requests to the other endpoints.

**Response:**

```json
[
  { "id": "azure-buerokratt8481675820" },
  { "id": "azure-buerokratt1234567890" },
  { "id": "azure-buerokratt9876543210" }
]
```

**Note:** See validation rules above. See [Azure Environment Variables](#azure) for information about account configuration.

**Errors:**

| Status Code | Description                                                              |
| ----------- | ------------------------------------------------------------------------ |
| `500`       | Unexpected internal server error occurred while listing storage accounts |

All errors are also logged in server logs.

### POST `/v1/files/create`

Creates a file in storage at one or more specified locations. The same content is used for all file locations.

**Request body:**

```json
{
  "files": [
    {
      "storageAccountId": "azure-buerokratt8481675820",
      "container": "my-container",
      "fileName": "path/to/file.json"
    }
  ],
  "content": "[{\"id\":1,\"name\":\"item1\"},{\"id\":2,\"name\":\"item2\"}]"
}
```

**Request body with multiple locations:**

```json
{
  "files": [
    {
      "storageAccountId": "azure-buerokratt8481675820",
      "container": "container1",
      "fileName": "file1.json"
    },
    {
      "storageAccountId": "azure-buerokratt1234567890",
      "container": "container2",
      "fileName": "file2.json"
    }
  ],
  "content": "[{\"id\":1,\"name\":\"item1\"},{\"id\":2,\"name\":\"item2\"}]"
}
```

**Note:** See validation rules above. See [Azure Environment Variables](#azure) for information about account configuration.

**Errors:**

| Status Code | Description                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `400`       | Bad request - Request body validation failed or storage type not supported (account ID doesn't start with `azure-`) |
| `404`       | Not found - Storage account not found or container not found                                                        |
| `500`       | Unexpected internal server error occurred while creating the file                                                   |

All errors are also logged in server logs.

### DELETE `/v1/files/delete`

Deletes a file from storage at one or more specified locations.

**Request body:**

```json
{
  "files": [
    {
      "storageAccountId": "azure-buerokratt8481675820",
      "container": "my-container",
      "fileName": "path/to/file.json"
    }
  ]
}
```

**Request body with multiple locations:**

```json
{
  "files": [
    {
      "storageAccountId": "azure-buerokratt8481675820",
      "container": "container1",
      "fileName": "file1.json"
    },
    {
      "storageAccountId": "azure-buerokratt1234567890",
      "container": "container2",
      "fileName": "file2.json"
    }
  ]
}
```

**Note:** See validation rules above. See [Azure Environment Variables](#azure) for information about account configuration.

**Errors:**

| Status Code | Description                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `400`       | Bad request - Request body validation failed or storage type not supported (account ID doesn't start with `azure-`) |
| `404`       | Not found - Storage account not found, container not found, or blob not found                                       |
| `500`       | Unexpected internal server error occurred while deleting the file                                                   |

All errors are also logged in server logs.

## Environment Variables

Environment variables and their meaning is defined below.

### General

| Variable                    | Description                                                                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_CORS_ORIGIN`           | Specify CORS allowed domains. <br/>- Asterisk (`*`) to allow all<br/>- Empty value to allow nothing<br/>- Otherwise provide a comma separated list of allowed domains |
| `API_DOCUMENTATION_ENABLED` | Enable API documentation, value can be either `true` or `false`                                                                                                       |
| `FS_DATA_DIRECTORY_PATH`    | Local filesystem data directory path                                                                                                                                  |

### Azure

| Variable                            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AZURE_ACCOUNT_*_CONNECTION_STRING` | Azure Storage account connection string. The asterisk (`*`) represents a number (e.g., `AZURE_ACCOUNT_1_CONNECTION_STRING`, `AZURE_ACCOUNT_2_CONNECTION_STRING`). You can define multiple accounts by using different numbers. The connection string can include `BlobEndpoint` parameter to use custom endpoints (e.g., Azurite for local development). See `config/test.env` for examples. <br/><br/>**Account ID Generation:** The account ID is generated from the connection string as `azure-{accountName}`, where `accountName` is extracted from the `AccountName` parameter in the connection string (e.g., `AccountName=myaccount` → ID: `azure-myaccount`). If the `AccountName` cannot be extracted from the connection string, the system falls back to using the account number from the environment variable name (e.g., `AZURE_ACCOUNT_1_CONNECTION_STRING` → ID: `azure-1`). |

### S3

| Variable               | Description                                                                                                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `S3_REGION`            | Endpoint region for the S3 storage                                                                                                                                                           |
| `S3_ENDPOINT_URL`      | Endpoint URL for the S3 storage. Can be used with S3-compatible services (e.g., MinIO, DigitalOcean Spaces) by providing a custom endpoint URL. Leave empty to use default AWS S3 endpoints. |
| `S3_ACCESS_KEY_ID`     | Access key for the S3 storage                                                                                                                                                                |
| `S3_SECRET_ACCESS_KEY` | Secret access key for the S3 storage                                                                                                                                                         |
| `S3_DATA_BUCKET_NAME`  | Data bucket name for the S3 storage                                                                                                                                                          |
| `S3_DATA_BUCKET_PATH`  | Data bucket path for the S3 storage                                                                                                                                                          |
