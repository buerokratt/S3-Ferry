# S3-Ferry
A generic service to trasnfer files to and from any S3 platform

---

## Local Development
To develop the S3 Ferry, it's recommended to have [nvm](https://github.com/nvm-sh/nvm) installed, which will ensure you have the correct node and npm versions.

```
# Run nvm use to switch to the correct node version
nvm use

# Install node dependencies
npm install

# Run the development server
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

## Docker
You can run the S3 Ferry inside docker. The API will be exposed at `http://localhost:3000`.

```
# Build the docker image
docker compose build

# Run the docker images
docker compose up
```

---

## Tests
API endpoints are covered with basic e2e tests written with [Jest](https://jestjs.io/)´.

```
# Run tests locally
npm run test:e2e
```
