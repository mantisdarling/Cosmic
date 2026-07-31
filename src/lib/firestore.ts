/**
 * src/lib/firestore.ts
 *
 * Firestore helpers for reading and writing user progress data.
 *
 * Security hardening:
 *  - Every nodeId and roadmapId passed in is validated against NodeIdSchema/SlugSchema
 *    before touching Firestore — prevents path traversal in document IDs.
 *  - Users can ONLY read/write their own UID path (enforced here AND in Firestore rules).
 *  - Firestore Security Rules (see firestore.rules) are the PRIMARY defense —
 *    these helpers are a defense-in-depth layer.
 *  - All errors go through toSafeError() — no raw Firestore errors reach the UI.
 *  - onSnapshot listeners are always returned for cleanup to prevent memory leaks.
 */

import {
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, isFirebaseReady } from './firebase';
import {
  NodeIdSchema,
  SlugSchema,
  NodeStatusSchema,
  toSafeError,
  type NodeStatus,
} from './security';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NodeProgress {
  status: NodeStatus;
  updatedAt: unknown; // Firestore Timestamp
}

export interface ProgressMap {
  [nodeId: string]: NodeProgress;
}

// ── Path helper (prevents path traversal) ───────────────────────────────────

/**
 * Builds a Firestore document reference for a user's node progress.
 * Both uid and nodeId are validated before use.
 *
 * Firestore path: users/{uid}/roadmaps/{roadmapId}/nodes/{nodeId}
 */
function getNodeDocRef(uid: string, roadmapId: string, nodeId: string) {
  // Validate roadmap and node IDs — rejects any path-traversal characters
  const safeRoadmapId = SlugSchema.parse(roadmapId);
  const safeNodeId = NodeIdSchema.parse(nodeId);

  // UID comes from Firebase Auth — already validated by Firebase SDK,
  // but we enforce it's a non-empty string with safe chars as extra defense
  if (!/^[a-zA-Z0-9]{10,128}$/.test(uid)) {
    throw new Error('Invalid UID format');
  }

  return doc(db, 'users', uid, 'roadmaps', safeRoadmapId, 'nodes', safeNodeId);
}

function getRoadmapCollectionRef(uid: string, roadmapId: string) {
  const safeRoadmapId = SlugSchema.parse(roadmapId);
  if (!/^[a-zA-Z0-9]{10,128}$/.test(uid)) throw new Error('Invalid UID format');
  return collection(db, 'users', uid, 'roadmaps', safeRoadmapId, 'nodes');
}

// ── Public helpers ───────────────────────────────────────────────────────────

/**
 * Set the progress status for a single roadmap node.
 * Validates all inputs before writing to Firestore.
 */
export async function setNodeProgress(
  user: User,
  roadmapId: string,
  nodeId: string,
  status: NodeStatus,
): Promise<{ success: boolean; error?: string }> {
  if (!isFirebaseReady()) {
    return { success: false, error: 'Service temporarily unavailable.' };
  }

  try {
    // Validate status through schema
    const safeStatus = NodeStatusSchema.parse(status);
    const ref = getNodeDocRef(user.uid, roadmapId, nodeId);

    await setDoc(ref, {
      status: safeStatus,
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (err: unknown) {
    const safe = toSafeError(err, 'UNKNOWN');
    return { success: false, error: safe.message };
  }
}

/**
 * Remove progress for a node (reset to "todo").
 */
export async function clearNodeProgress(
  user: User,
  roadmapId: string,
  nodeId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isFirebaseReady()) {
    return { success: false, error: 'Service temporarily unavailable.' };
  }

  try {
    const ref = getNodeDocRef(user.uid, roadmapId, nodeId);
    await deleteDoc(ref);
    return { success: true };
  } catch (err) {
    const safe = toSafeError(err, 'UNKNOWN');
    return { success: false, error: safe.message };
  }
}

/**
 * Subscribe to real-time progress updates for a roadmap.
 * Returns an unsubscribe function — MUST be called on component unmount.
 */
export function subscribeToProgress(
  user: User,
  roadmapId: string,
  callback: (progress: ProgressMap) => void,
  onError: (error: string) => void,
): Unsubscribe {
  if (!isFirebaseReady()) {
    onError('Service temporarily unavailable.');
    return () => {};
  }

  try {
    const colRef = getRoadmapCollectionRef(user.uid, roadmapId);

    return onSnapshot(
      colRef,
      { includeMetadataChanges: false },
      (snapshot) => {
        const progress: ProgressMap = {};
        snapshot.forEach((docSnap) => {
          // Validate doc ID before using as key
          const id = NodeIdSchema.safeParse(docSnap.id);
          if (id.success) {
            progress[id.data] = docSnap.data() as NodeProgress;
          }
        });
        callback(progress);
      },
      (err) => {
        const safe = toSafeError(err, 'PERMISSION_DENIED');
        onError(safe.message);
      },
    );
  } catch (err) {
    const safe = toSafeError(err, 'UNKNOWN');
    onError(safe.message);
    return () => {};
  }
}

/**
 * One-time fetch of all progress for a roadmap.
 */
export async function fetchProgress(
  user: User,
  roadmapId: string,
): Promise<ProgressMap> {
  if (!isFirebaseReady()) return {};

  try {
    const colRef = getRoadmapCollectionRef(user.uid, roadmapId);
    const snapshot = await getDocs(colRef);
    const progress: ProgressMap = {};
    snapshot.forEach((docSnap) => {
      const id = NodeIdSchema.safeParse(docSnap.id);
      if (id.success) {
        progress[id.data] = docSnap.data() as NodeProgress;
      }
    });
    return progress;
  } catch {
    return {};
  }
}
