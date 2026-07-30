import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectCommand,
} from "npm:@aws-sdk/client-s3";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
};

export type UploadResult = {
  key: string;
  size: number;
};

/** Read R2 credentials from Supabase Edge Function secrets (Deno.env). */
export function loadR2Config(): R2Config {
  const accountId       = Deno.env.get("R2_ACCOUNT_ID");
  const accessKeyId     = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  const bucketName      = Deno.env.get("R2_BUCKET_NAME");
  const endpoint        = Deno.env.get("R2_ENDPOINT");

  const missing = (
    [
      ["R2_ACCOUNT_ID",        accountId],
      ["R2_ACCESS_KEY_ID",     accessKeyId],
      ["R2_SECRET_ACCESS_KEY", secretAccessKey],
      ["R2_BUCKET_NAME",       bucketName],
      ["R2_ENDPOINT",          endpoint],
    ] as [string, string | undefined][]
  )
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    throw new Error(`Missing Edge Function secrets: ${missing.join(", ")}`);
  }

  return {
    accountId:       accountId!,
    accessKeyId:     accessKeyId!,
    secretAccessKey: secretAccessKey!,
    bucketName:      bucketName!,
    endpoint:        endpoint!,
  };
}

/** Initialise an S3-compatible client pointed at Cloudflare R2. */
export function createR2Client(cfg: R2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId:     cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
}

/**
 * Verify bucket access by listing at most 0 keys.
 * Lightest valid S3 call: authenticates and confirms the bucket is reachable.
 */
export async function verifyBucketAccess(
  client: S3Client,
  bucketName: string,
): Promise<void> {
  await client.send(
    new ListObjectsV2Command({ Bucket: bucketName, MaxKeys: 0 }),
  );
}

/**
 * Upload a binary file to R2.
 *
 * @param client      - Initialised S3Client
 * @param bucketName  - Destination bucket
 * @param key         - Object key (path inside the bucket)
 * @param body        - File bytes as Uint8Array
 * @param contentType - MIME type to store on the object
 * @returns UploadResult with the stored key and byte size
 */
export async function uploadFile(
  client: S3Client,
  bucketName: string,
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<UploadResult> {
  await client.send(
    new PutObjectCommand({
      Bucket:      bucketName,
      Key:         key,
      Body:        body,
      ContentType: contentType,
    }),
  );

  return { key, size: body.byteLength };
}

/**
 * Delete an object from R2.
 * Used by the rollback path when a database insert fails after upload.
 */
export async function deleteFile(
  client: S3Client,
  bucketName: string,
  key: string,
): Promise<void> {
  await client.send(
    new DeleteObjectCommand({ Bucket: bucketName, Key: key }),
  );
}
