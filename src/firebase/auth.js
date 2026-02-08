/**
 * Auth — Firebase Authentication State Management
 * 
 * Phase 3.0 — Infrastructure Foundation
 * 
 * Provides Google Sign-In, auth state observation, and user session management.
 * The CEO (user) must be authenticated before running agents.
 */

import { auth } from './config.js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';

const provider = new GoogleAuthProvider();

/** @type {import('firebase/auth').User | null} */
let currentUser = null;

/** @type {Set<(user: import('firebase/auth').User | null) => void>} */
const listeners = new Set();

// Watch auth state
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  listeners.forEach(fn => fn(user));
});

/**
 * Sign in with Google popup
 * @returns {Promise<import('firebase/auth').User>}
 */
export async function signIn() {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err) {
    console.error('[Auth] Sign-in failed:', err);
    throw err;
  }
}

/**
 * Sign out the current user
 */
export async function signOut() {
  try {
    await firebaseSignOut(auth);
  } catch (err) {
    console.error('[Auth] Sign-out failed:', err);
    throw err;
  }
}

/**
 * Get the currently authenticated user
 * @returns {import('firebase/auth').User | null}
 */
export function getUser() {
  return currentUser;
}

/**
 * Check if a user is currently authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
  return currentUser !== null;
}

/**
 * Subscribe to auth state changes
 * @param {(user: import('firebase/auth').User | null) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onAuthChange(callback) {
  listeners.add(callback);
  // Immediately fire with current state
  callback(currentUser);
  return () => listeners.delete(callback);
}

/**
 * Get the current user's ID token (for Cloud Function calls)
 * @returns {Promise<string | null>}
 */
export async function getIdToken() {
  if (!currentUser) return null;
  return currentUser.getIdToken();
}
