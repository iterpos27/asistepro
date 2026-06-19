const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Readable } = require('stream');

const DRIVER = (process.env.STORAGE_DRIVER || 'database').toLowerCase();

function createS3Client() {
  return new S3Client({
    region: process.env.STORAGE_REGION || 'us-east-1',
    endpoint: process.env.STORAGE_ENDPOINT || undefined,
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true',
    credentials:
      process.env.STORAGE_ACCESS_KEY_ID && process.env.STORAGE_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
            secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
}

async function streamToBuffer(stream) {
  if (!stream) return Buffer.alloc(0);
  if (Buffer.isBuffer(stream)) return stream;
  if (stream instanceof Uint8Array) return Buffer.from(stream);
  if (!(stream instanceof Readable)) return Buffer.from(stream);

  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function buildPublicUrl(bucket, key) {
  const baseUrl = process.env.STORAGE_PUBLIC_BASE_URL?.replace(/\/$/, '');
  if (!baseUrl) return null;
  return `${baseUrl}/${bucket}/${encodeURIComponent(key)}`;
}

async function putObject({ bucket = process.env.STORAGE_BUCKET, key, body, contentType }) {
  if (DRIVER !== 's3') {
    return {
      provider: 'database',
      bucket: null,
      key: null,
      url: null,
      body,
      contentType,
    };
  }

  if (!bucket || !key) {
    const error = new Error('Configuracion de storage incompleta');
    error.statusCode = 500;
    throw error;
  }

  const client = createS3Client();
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType || 'application/octet-stream',
  }));

  return {
    provider: 's3',
    bucket,
    key,
    url: buildPublicUrl(bucket, key),
    body: null,
    contentType,
  };
}

async function getObject({ bucket = process.env.STORAGE_BUCKET, key, fallbackBody }) {
  if (DRIVER !== 's3' || !key) return fallbackBody || null;

  const client = createS3Client();
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return streamToBuffer(result.Body);
}

async function deleteObject({ bucket = process.env.STORAGE_BUCKET, key }) {
  if (DRIVER !== 's3' || !key) return;
  const client = createS3Client();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

function getStorageStatus() {
  return {
    driver: DRIVER,
    bucket: process.env.STORAGE_BUCKET || null,
    endpoint: process.env.STORAGE_ENDPOINT || null,
    publicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL || null,
  };
}

module.exports = {
  deleteObject,
  getObject,
  getStorageStatus,
  putObject,
};
