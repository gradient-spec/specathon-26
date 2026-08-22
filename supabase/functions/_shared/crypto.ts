function getEncryptionKey(): Uint8Array {
  const keyHex = Deno.env.get("CREDENTIAL_ENCRYPTION_KEY");
  if (!keyHex) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY is missing from environment.");
  }
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY must be exactly 64 hexadecimal characters.");
  }
  
  const keyBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    keyBytes[i] = parseInt(keyHex.substring(i * 2, i * 2 + 2), 16);
  }
  return keyBytes;
}

export async function encryptPassword(password: string): Promise<string> {
  const keyBytes = getEncryptionKey();
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes as unknown as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(password);
  
  const cipherTextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  const cipherText = new Uint8Array(cipherTextBuffer);
  
  // Pack IV and ciphertext together
  const packed = new Uint8Array(iv.length + cipherText.length);
  packed.set(iv, 0);
  packed.set(cipherText, iv.length);
  
  // Return as base64 string
  return btoa(String.fromCharCode(...packed));
}

export async function decryptPassword(encryptedBase64: string): Promise<string> {
  const keyBytes = getEncryptionKey();
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes as unknown as BufferSource,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  // Decode base64
  const binaryString = atob(encryptedBase64);
  const packed = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    packed[i] = binaryString.charCodeAt(i);
  }

  // Extract IV and ciphertext
  const iv = packed.slice(0, 12);
  const cipherText = packed.slice(12);

  // Decrypt
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    cipherText
  );

  return new TextDecoder().decode(decryptedBuffer);
}
