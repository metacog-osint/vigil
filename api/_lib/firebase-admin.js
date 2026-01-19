/**
 * Firebase Admin SDK Initialization
 * Used for verifying Firebase ID tokens in API routes
 */

import admin from 'firebase-admin'

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    })
  } else {
    console.warn('Firebase Admin: Missing credentials, token verification will fail')
  }
}

/**
 * Verify Firebase ID token
 * @param {string} token - Firebase ID token from client
 * @returns {Promise<object|null>} - Decoded token or null if invalid
 */
export async function verifyFirebaseToken(token) {
  if (!token) {
    return null
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token)
    return decoded
  } catch (error) {
    console.error('Firebase token verification failed:', error.message)
    return null
  }
}

/**
 * Extract bearer token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} - Token or null
 */
export function extractBearerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.substring(7)
}

/**
 * Middleware helper to verify auth and return user context
 * @param {Request} request - Incoming request
 * @returns {Promise<{user: object|null, error: string|null}>}
 */
export async function verifyRequest(request) {
  const authHeader = request.headers.get('authorization')
  const token = extractBearerToken(authHeader)

  if (!token) {
    return { user: null, error: 'Missing authorization header' }
  }

  const user = await verifyFirebaseToken(token)
  if (!user) {
    return { user: null, error: 'Invalid or expired token' }
  }

  return { user, error: null }
}

export default admin
