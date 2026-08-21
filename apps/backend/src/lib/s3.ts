import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '../config/env'

let client: S3Client | null = null

export function s3Configured(): boolean {
  return !!(env.storage.endpoint && env.storage.accessKeyId && env.storage.secretAccessKey)
}

export function getS3(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: env.storage.endpoint || undefined,
      region: env.storage.region,
      forcePathStyle: env.storage.forcePathStyle,
      credentials: {
        accessKeyId: env.storage.accessKeyId,
        secretAccessKey: env.storage.secretAccessKey,
      },
    })
  }
  return client
}

export async function presignPut(key: string, contentType?: string, expiresIn = 3600): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: env.storage.bucket,
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(getS3(), cmd, { expiresIn })
}

export async function presignGet(key: string, expiresIn = 3600): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: env.storage.bucket, Key: key })
  return getSignedUrl(getS3(), cmd, { expiresIn })
}

export async function deleteObject(key: string, bucket = env.storage.bucket): Promise<void> {
  await getS3().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

/**
 * Fetch an object for server-side streaming. Used to serve private recordings
 * (the recordings bucket is not publicly exposed) to authorized users.
 */
export async function getObjectStream(key: string, bucket = env.storage.bucket) {
  const out = await getS3().send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  return {
    body: out.Body as NodeJS.ReadableStream | undefined,
    contentType: out.ContentType,
    contentLength: out.ContentLength,
  }
}
