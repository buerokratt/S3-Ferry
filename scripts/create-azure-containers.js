/* eslint-disable */
const { BlobServiceClient } = require('@azure/storage-blob');

const containers = ['buerokratt']; // Add more container names as needed

const connectionString =
  'DefaultEndpointsProtocol=http;AccountName=testaccount1;AccountKey=dGVzdGtleTE9PQ==;BlobEndpoint=http://azurite:10000/testaccount1;QueueEndpoint=http://azurite:10001/testaccount1;TableEndpoint=http://azurite:10002/testaccount1;';

async function createContainers() {
  const blobServiceClient = BlobServiceClient.fromConnectionString(
    connectionString,
  );

  for (const containerName of containers) {
    try {
      const containerClient = blobServiceClient.getContainerClient(containerName);
      await containerClient.createIfNotExists();
      console.log(`✓ Container '${containerName}' created/verified`);
    } catch (error) {
      console.error(
        `✗ Failed to create container '${containerName}':`,
        error.message,
      );
      process.exit(1);
    }
  }
  console.log('✓ All containers created successfully!');
}

createContainers().catch((error) => {
  console.error('Error creating containers:', error);
  process.exit(1);
});

