#!/bin/sh
set -e

apk add --no-cache curl

# Wait for Azurite to be ready
echo "Waiting for Azurite to be ready..."
until curl -s http://azurite:10000 > /dev/null 2>&1; do
  sleep 1
done
echo "Azurite is ready!"

# Install Azure Storage Blob package in /tmp (writable location)
echo "Installing @azure/storage-blob..."
cd /tmp
npm install --no-save @azure/storage-blob

# Run Node.js script to create containers
NODE_PATH=/tmp/node_modules node /scripts/create-azure-containers.js

