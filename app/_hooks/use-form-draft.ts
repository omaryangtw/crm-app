"use client";

import { useState, useCallback, useEffect } from "react";
import {
  safeGetItem,
  safeSetItem,
  safeRemoveItem,
} from "@/app/_lib/utils/storage";

/** Shape persisted in localStorage for each draft. */
export interface DraftPayload {
  data: Record<string, unknown>;
  savedAt: string; // ISO timestamp
}

export interface UseFormDraftReturn {
  /** Whether an unrestored draft exists. */
  hasDraft: boolean;
  /** The draft form data, or null. */
  draftData: Record<string, unknown> | null;
  /** ISO timestamp of when the draft was saved, or null. */
  draftTimestamp: string | null;
  /** Persist current form values as a draft. */
  saveDraft: (data: Record<string, unknown>) => void;
  /** Remove the draft from localStorage and reset state. */
  clearDraft: () => void;
  /** Return draft data and hide the prompt (sets hasDraft = false). */
  restoreDraft: () => Record<string, unknown> | null;
}

/** Read a draft from localStorage, clearing corrupted data. */
function readDraft(key: string): DraftPayload | null {
  const raw = safeGetItem<DraftPayload>(key);
  if (
    raw !== null &&
    typeof raw === "object" &&
    "data" in raw &&
    "savedAt" in raw &&
    typeof (raw as DraftPayload).savedAt === "string"
  ) {
    return raw as DraftPayload;
  }
  // Corrupted or unexpected shape — wipe it
  if (raw !== null) safeRemoveItem(key);
  return null;
}

export function useFormDraft(
  storageKey: string,
  enabled: boolean,
): UseFormDraftReturn {
  // Start with empty state to match SSR output — avoids hydration mismatch.
  // localStorage is read in useEffect after mount.
  const [hasDraft, setHasDraft] = useState(false);
  const [draftData, setDraftData] = useState<Record<string, unknown> | null>(null);
  const [draftTimestamp, setDraftTimestamp] = useState<string | null>(null);

  // Read localStorage only after client mount to prevent SSR/client mismatch
  useEffect(() => {
    if (!enabled) return;
    const draft = readDraft(storageKey);
    if (draft) {
      setHasDraft(true);
      setDraftData(draft.data);
      setDraftTimestamp(draft.savedAt);
    }
  }, [enabled, storageKey]);

  const saveDraft = useCallback(
    (data: Record<string, unknown>) => {
      if (!enabled) return;
      const payload: DraftPayload = {
        data,
        savedAt: new Date().toISOString(),
      };
      safeSetItem(storageKey, payload);
      setDraftData(payload.data);
      setDraftTimestamp(payload.savedAt);
      setHasDraft(true);
    },
    [enabled, storageKey],
  );

  const clearDraft = useCallback(() => {
    if (!enabled) return;
    safeRemoveItem(storageKey);
    setHasDraft(false);
    setDraftData(null);
    setDraftTimestamp(null);
  }, [enabled, storageKey]);

  const restoreDraft = useCallback((): Record<string, unknown> | null => {
    if (!enabled) return null;
    setHasDraft(false);
    return draftData;
  }, [enabled, draftData]);

  return {
    hasDraft,
    draftData,
    draftTimestamp,
    saveDraft,
    clearDraft,
    restoreDraft,
  };
}
