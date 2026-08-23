import { S3Client } from "npm:@aws-sdk/client-s3";
import { deleteFile } from "./r2.ts";

/**
 * Attempt to delete an R2 object that was uploaded before a database
 * insertion failed.
 *
 * This is a best-effort cleanup.  If the delete itself fails (e.g. a
 * transient network error), the orphaned object must be cleaned up
 * manually or by an R2 lifecycle rule.  The original error is always
 * re-thrown so the caller returns the correct failure response to the
 * client — the rollback outcome never suppresses it.
 *
 * @param client     - Initialised S3Client
 * @param bucketName - R2 bucket name
 * @param key        - Object key to delete
 * @param cause      - The original error that triggered the rollback
 */
export async function rollbackR2Upload(
  client: S3Client,
  bucketName: string,
  key: string,
  cause: unknown,
): Promise<never> {
  try {
    await deleteFile(client, bucketName, key);
    console.warn(`[rollback] Deleted orphaned R2 object: ${key}`);
  } catch (deleteErr) {
    // Log but do not throw — the original error takes priority.
    console.error(
      `[rollback] Failed to delete orphaned R2 object "${key}":`,
      deleteErr,
    );
  }

  // Always re-throw the original cause.
  throw cause;
}
