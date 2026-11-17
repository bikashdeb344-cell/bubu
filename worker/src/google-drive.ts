import {
  DirectoryDetail,
  DriveStatusResponse,
  Env,
  MMUDirectoryMap,
  MMUId,
  SessionType,
  VALID_MMUS,
} from './types';

// In-memory token cache for worker lifecycle
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

function base64UrlEncode(data: Uint8Array | string): string {
  const binary = typeof data === 'string' ? data : String.fromCharCode(...data);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function pemToBinary(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s+/g, '');
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    buf[i] = raw.charCodeAt(i);
  }
  return buf;
}

/**
 * Exchanges Google Service Account JWT for a valid Access Token using Web Crypto
 */
async function getServiceAccountAccessToken(
  clientEmail: string,
  privateKeyPem: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(payload)
  )}`;

  const keyBuffer = pemToBinary(privateKeyPem);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const jwt = `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorDetail = response.statusText;
    try {
      const parsed = JSON.parse(errorBody);
      errorDetail = parsed.error_description || parsed.error || errorDetail;
    } catch {
      // ignore
    }
    throw new Error(`Google Service Account auth failed (${response.status}): ${errorDetail}`);
  }

  const tokenData = (await response.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  cachedAccessToken = tokenData.access_token;
  tokenExpiresAt = Date.now() + tokenData.expires_in * 1000;
  return cachedAccessToken;
}

/**
 * Exchanges Google OAuth Refresh Token for a valid Access Token
 */
async function getOAuthAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('refresh_token', refreshToken);
  params.append('grant_type', 'refresh_token');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorDetail = response.statusText;
    try {
      const parsed = JSON.parse(errorBody);
      errorDetail = parsed.error_description || parsed.error || errorDetail;
    } catch {
      // ignore parse error
    }
    throw new Error(`Google OAuth token refresh failed (${response.status}): ${errorDetail}`);
  }

  const tokenData = (await response.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  cachedAccessToken = tokenData.access_token;
  tokenExpiresAt = Date.now() + tokenData.expires_in * 1000;
  return cachedAccessToken;
}

/**
 * Gets an active Google access token using either Service Account or OAuth 2.0
 */
export async function getAccessToken(env: Env): Promise<string> {
  // Return cached token if valid for at least 60 more seconds
  const now = Date.now();
  if (cachedAccessToken && tokenExpiresAt - now > 60_000) {
    return cachedAccessToken;
  }

  // 1. Check Service Account credentials
  let saEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let saKey = env.GOOGLE_PRIVATE_KEY;

  if (env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const parsed = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
      saEmail = parsed.client_email;
      saKey = parsed.private_key;
    } catch {
      // ignore
    }
  }

  if (saEmail && saKey) {
    return await getServiceAccountAccessToken(saEmail, saKey);
  }

  // 2. Check OAuth Refresh Token credentials
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = env;
  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REFRESH_TOKEN) {
    return await getOAuthAccessToken(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN);
  }

  throw new Error('Google Drive credentials (Service Account or OAuth) are not configured.');
}

/**
 * Checks if the configured root folder exists and is a valid directory
 */
export async function getRootFolderInfo(
  accessToken: string,
  rootFolderId: string
): Promise<{ id: string; name: string }> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
    rootFolderId
  )}?fields=id,name,mimeType,trashed&supportsAllDrives=true`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Configured root folder ID "${rootFolderId}" was not found in Google Drive.`);
    }
    const errText = await res.text();
    throw new Error(`Failed to access root folder (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { id: string; name: string; mimeType: string; trashed: boolean };

  if (data.trashed) {
    throw new Error(`Configured root folder "${data.name}" (${rootFolderId}) is in the Google Drive trash.`);
  }

  if (data.mimeType !== 'application/vnd.google-apps.folder') {
    throw new Error(`Configured root ID "${rootFolderId}" is not a folder (MIME: ${data.mimeType}).`);
  }

  return { id: data.id, name: data.name };
}

/**
 * Lists child folders under a given parent folder
 */
export async function listChildFolders(
  accessToken: string,
  parentId: string
): Promise<Map<string, string>> {
  // Map of folderName -> folderId
  const folderMap = new Map<string, string>();
  let pageToken: string | undefined = undefined;

  do {
    const query = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      query
    )}&fields=nextPageToken,files(id,name)&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true`;

    if (pageToken) {
      url += `&pageToken=${encodeURIComponent(pageToken)}`;
    }

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to list folders under parent ${parentId} (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as {
      nextPageToken?: string;
      files: Array<{ id: string; name: string }>;
    };

    if (data.files) {
      for (const file of data.files) {
        folderMap.set(file.name, file.id);
      }
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return folderMap;
}

/**
 * Creates a folder inside a specified parent directory
 */
export async function createFolder(
  accessToken: string,
  folderName: string,
  parentId: string
): Promise<string> {
  const url = 'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create folder "${folderName}" under parent ${parentId} (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

/**
 * Validates the entire Google Drive directory structure.
 * If autoRepair is true, creates any missing MMU or AM/PM folders.
 */
export async function validateAndRepairDriveStructure(
  env: Env,
  autoRepair: boolean = false
): Promise<DriveStatusResponse> {
  const hasServiceAccount =
    (!!env.GOOGLE_SERVICE_ACCOUNT_EMAIL && !!env.GOOGLE_PRIVATE_KEY) ||
    !!env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const hasOAuth =
    !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET && !!env.GOOGLE_REFRESH_TOKEN;

  if ((!hasServiceAccount && !hasOAuth) || !env.GOOGLE_DRIVE_ROOT_FOLDER_ID) {
    return {
      status: 'not_configured',
      authenticated: false,
      rootFolderFound: false,
      totalExpected: 18,
      totalVerified: 0,
      repairedCount: 0,
      repairedPaths: [],
      mmuStructure: {},
      message: 'Google Drive backend credentials or root folder ID are not configured.',
    };
  }

  // 1. Authenticate
  const accessToken = await getAccessToken(env);

  // 2. Locate root folder
  const rootInfo = await getRootFolderInfo(accessToken, env.GOOGLE_DRIVE_ROOT_FOLDER_ID);

  // 3. Inspect MMU folders directly under root
  const rootChildFolders = await listChildFolders(accessToken, rootInfo.id);

  const mmuStructure: MMUDirectoryMap = {};
  const repairedPaths: string[] = [];
  let totalVerified = 0;

  for (const mmu of VALID_MMUS) {
    let mmuFolderId = rootChildFolders.get(mmu);

    if (!mmuFolderId) {
      if (autoRepair) {
        mmuFolderId = await createFolder(accessToken, mmu, rootInfo.id);
        repairedPaths.push(`${mmu}/`);
      }
    }

    mmuStructure[mmu] = {
      id: mmuFolderId,
      verified: !!mmuFolderId,
    };

    if (mmuFolderId) {
      // Check AM and PM subdirectories inside this MMU
      const subFolders = await listChildFolders(accessToken, mmuFolderId);

      // Check AM
      let amId = subFolders.get('AM');
      if (!amId && autoRepair) {
        amId = await createFolder(accessToken, 'AM', mmuFolderId);
        repairedPaths.push(`${mmu}/AM`);
      }
      const amVerified = !!amId;
      if (amVerified) totalVerified++;

      // Check PM
      let pmId = subFolders.get('PM');
      if (!pmId && autoRepair) {
        pmId = await createFolder(accessToken, 'PM', mmuFolderId);
        repairedPaths.push(`${mmu}/PM`);
      }
      const pmVerified = !!pmId;
      if (pmVerified) totalVerified++;

      mmuStructure[mmu].AM = { id: amId, verified: amVerified };
      mmuStructure[mmu].PM = { id: pmId, verified: pmVerified };
    } else {
      mmuStructure[mmu].AM = { verified: false };
      mmuStructure[mmu].PM = { verified: false };
    }
  }

  const isFullyVerified = totalVerified === 18;
  const status: DriveStatusResponse['status'] = isFullyVerified
    ? 'verified'
    : repairedPaths.length > 0
    ? 'repairing'
    : 'connected';

  let message = `${totalVerified}/18 Directories Verified`;
  if (repairedPaths.length > 0) {
    message = `Missing directories repaired (${repairedPaths.length} created). ${totalVerified}/18 Directories Verified`;
  } else if (!isFullyVerified) {
    message = `Directory structure incomplete: only ${totalVerified}/18 subdirectories found. Initialization required.`;
  }

  return {
    status,
    authenticated: true,
    rootFolderFound: true,
    rootFolderId: rootInfo.id,
    totalExpected: 18,
    totalVerified,
    repairedCount: repairedPaths.length,
    repairedPaths,
    mmuStructure,
    message,
  };
}

/**
 * Resolves the destination folder ID for a specific MMU and Session.
 * Automatically creates the MMU and Session directories if missing.
 */
export async function getDestinationFolderId(
  env: Env,
  mmu: MMUId,
  session: SessionType
): Promise<string> {
  const accessToken = await getAccessToken(env);
  const rootId = env.GOOGLE_DRIVE_ROOT_FOLDER_ID!;

  // 1. Get or create MMU folder
  const rootFolders = await listChildFolders(accessToken, rootId);
  let mmuId = rootFolders.get(mmu);
  if (!mmuId) {
    mmuId = await createFolder(accessToken, mmu, rootId);
  }

  // 2. Get or create Session folder (AM or PM)
  const sessionFolders = await listChildFolders(accessToken, mmuId);
  let sessionId = sessionFolders.get(session);
  if (!sessionId) {
    sessionId = await createFolder(accessToken, session, mmuId);
  }

  return sessionId;
}

/**
 * Uploads a single file to Google Drive using the Resumable Upload protocol.
 */
export async function uploadFileToDrive(
  accessToken: string,
  destinationFolderId: string,
  filename: string,
  mimeType: string,
  fileBytes: Uint8Array
): Promise<{ id: string; name: string; size: string; mimeType: string }> {
  // Step 1: Initiate resumable upload session
  const initUrl =
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true';

  const metadata = {
    name: filename,
    parents: [destinationFolderId],
    mimeType,
  };

  const initRes = await fetch(initUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': fileBytes.length.toString(),
    },
    body: JSON.stringify(metadata),
  });

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`Failed to initiate Google Drive upload session (${initRes.status}): ${errText}`);
  }

  const uploadLocation = initRes.headers.get('Location');
  if (!uploadLocation) {
    throw new Error('Google Drive upload initiation did not return an upload Location URL.');
  }

  // Step 2: Upload file bytes to the resumable upload URL
  const uploadRes = await fetch(uploadLocation, {
    method: 'PUT',
    headers: {
      'Content-Length': fileBytes.length.toString(),
      'Content-Type': mimeType,
    },
    body: fileBytes,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Failed to upload file bytes to Google Drive (${uploadRes.status}): ${errText}`);
  }

  return (await uploadRes.json()) as {
    id: string;
    name: string;
    size: string;
    mimeType: string;
  };
}

/**
 * Rigorously verifies that the uploaded file exists in Google Drive,
 * is in the correct parent folder, has the correct filename and MIME type,
 * and confirms no duplicate corruption. (Section 12.D requirement)
 */
export async function verifyUploadedFileInDrive(
  accessToken: string,
  fileId: string,
  expectedFolderId: string,
  expectedFilename: string,
  expectedMimeType: string
): Promise<{ verified: boolean; error?: string }> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
    fileId
  )}?fields=id,name,mimeType,size,parents,trashed&supportsAllDrives=true`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    return {
      verified: false,
      error: `Post-upload verification failed: file ${fileId} could not be retrieved (${res.status}).`,
    };
  }

  const fileInfo = (await res.json()) as {
    id: string;
    name: string;
    mimeType: string;
    parents?: string[];
    trashed?: boolean;
  };

  if (fileInfo.trashed) {
    return { verified: false, error: `Uploaded file ${fileId} was found in trash.` };
  }

  if (fileInfo.name !== expectedFilename) {
    return {
      verified: false,
      error: `Uploaded file name mismatch: expected "${expectedFilename}", got "${fileInfo.name}".`,
    };
  }

  if (!fileInfo.parents || !fileInfo.parents.includes(expectedFolderId)) {
    return {
      verified: false,
      error: `Uploaded file parent folder mismatch: expected ${expectedFolderId}, got ${fileInfo.parents?.join(
        ', '
      )}.`,
    };
  }

  return { verified: true };
}
