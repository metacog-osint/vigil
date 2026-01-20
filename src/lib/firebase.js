import { initializeApp } from 'firebase/app'
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'

// Firebase configuration
// These should be set in your .env file
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}

// Initialize Firebase (only if configured)
let app = null
let auth = null
let db = null

if (firebaseConfig.apiKey) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)
} else {
  console.warn('Firebase not configured. Set VITE_FIREBASE_* environment variables.')
}

export { auth, db }

// Auth functions
export async function signIn(email, password) {
  if (!auth) throw new Error('Firebase not configured')
  return signInWithEmailAndPassword(auth, email, password)
}

export async function signInWithGoogle() {
  if (!auth) throw new Error('Firebase not configured')
  const provider = new GoogleAuthProvider()
  return signInWithPopup(auth, provider)
}

export async function signOut() {
  if (!auth) throw new Error('Firebase not configured')

  // Clear session data on logout
  try {
    // Clear local storage auth data
    localStorage.removeItem('vigil_auth_user')
    localStorage.removeItem('vigil_push_subscription')
    sessionStorage.removeItem('vigil_auth_token')
    sessionStorage.removeItem('vigil_session_id')
    sessionStorage.removeItem('vigil_last_activity')
  } catch {
    // Ignore storage errors
  }

  return firebaseSignOut(auth)
}

export function onAuthChange(callback) {
  if (!auth) {
    callback(null)
    return () => {}
  }
  return onAuthStateChanged(auth, callback)
}

// User preferences (stored in Firestore)
export async function getUserPreferences(userId) {
  if (!db) return getDefaultPreferences()

  const docRef = doc(db, 'users', userId)
  const docSnap = await getDoc(docRef)

  if (docSnap.exists()) {
    return { ...getDefaultPreferences(), ...docSnap.data() }
  }

  // Create default preferences for new user
  const defaults = getDefaultPreferences()
  await setDoc(docRef, { ...defaults, createdAt: serverTimestamp() })
  return defaults
}

export async function updateUserPreferences(userId, preferences) {
  if (!db) return

  const docRef = doc(db, 'users', userId)
  await updateDoc(docRef, {
    ...preferences,
    updatedAt: serverTimestamp(),
  })
}

function getDefaultPreferences() {
  return {
    theme: 'dark',
    notifications: {
      criticalVulns: true,
      newIncidents: true,
      watchlistMatches: true,
    },
    defaultTimeRange: 30, // days
    watchedSectors: [],
    watchedActors: [],
  }
}

// Watchlist functions
export async function getWatchlist(userId) {
  if (!db) return { actors: [], iocs: [], cves: [] }

  const docRef = doc(db, 'watchlists', userId)
  const docSnap = await getDoc(docRef)

  if (docSnap.exists()) {
    return docSnap.data()
  }

  const defaultWatchlist = { actors: [], iocs: [], cves: [] }
  await setDoc(docRef, defaultWatchlist)
  return defaultWatchlist
}

export async function addToWatchlist(userId, type, item) {
  if (!db) return

  const docRef = doc(db, 'watchlists', userId)
  const watchlist = await getWatchlist(userId)

  if (!watchlist[type].find((i) => i.id === item.id)) {
    watchlist[type].push({
      ...item,
      addedAt: new Date().toISOString(),
    })
    await setDoc(docRef, watchlist)
  }
}

export async function removeFromWatchlist(userId, type, itemId) {
  if (!db) return

  const docRef = doc(db, 'watchlists', userId)
  const watchlist = await getWatchlist(userId)

  watchlist[type] = watchlist[type].filter((i) => i.id !== itemId)
  await setDoc(docRef, watchlist)
}

// Subscribe to watchlist changes
export function subscribeToWatchlist(userId, callback) {
  if (!db) {
    callback({ actors: [], iocs: [], cves: [] })
    return () => {}
  }

  const docRef = doc(db, 'watchlists', userId)
  return onSnapshot(docRef, (doc) => {
    if (doc.exists()) {
      callback(doc.data())
    } else {
      callback({ actors: [], iocs: [], cves: [] })
    }
  })
}

// Shift notes (similar to PolMil Watchcon)
export async function getShiftNotes(date) {
  if (!db) return []

  const notesRef = collection(db, 'shift_notes')
  const q = query(notesRef, where('date', '==', date))

  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
}

export async function addShiftNote(userId, note) {
  if (!db) return

  const notesRef = collection(db, 'shift_notes')
  const docRef = doc(notesRef)

  await setDoc(docRef, {
    ...note,
    authorId: userId,
    createdAt: serverTimestamp(),
  })
}
