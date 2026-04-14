"use client";

import { useState, useCallback, useEffect } from "react";
import type { ExportQuery } from "@/app/_lib/schemas/export-schema";
import {
  safeGetItem,
  safeSetItem,
  safeRemoveItem,
} from "@/app/_lib/utils/storage";

const STORAGE_KEY = "export-presets";

/** A user-defined export preset stored in localStorage. */
export interface CustomPreset {
  name: string;
  query: ExportQuery;
  columns: Record<string, boolean>;
  createdAt: string; // ISO timestamp
}

export interface UseExportPresetsReturn {
  /** All custom presets. */
  presets: CustomPreset[];
  /** Save a preset (overwrites if same name exists). Returns false for blank names. */
  savePreset: (
    name: string,
    query: ExportQuery,
    columns: Record<string, boolean>,
  ) => boolean;
  /** Delete a preset by name. */
  deletePreset: (name: string) => void;
  /** Load a preset by name. Returns query + columns, or null if not found. */
  loadPreset: (
    name: string,
  ) => { query: ExportQuery; columns: Record<string, boolean> } | null;
}

/** Read presets from localStorage, clearing corrupted data. */
function readPresets(): CustomPreset[] {
  const raw = safeGetItem<CustomPreset[]>(STORAGE_KEY);
  if (Array.isArray(raw)) return raw;
  // Corrupted or unexpected shape — wipe it
  safeRemoveItem(STORAGE_KEY);
  return [];
}

export function useExportPresets(): UseExportPresetsReturn {
  // Start with empty array to match SSR output — avoids hydration mismatch.
  const [presets, setPresets] = useState<CustomPreset[]>([]);

  // Read localStorage only after client mount
  useEffect(() => {
    setPresets(readPresets());
  }, []);

  const savePreset = useCallback(
    (
      name: string,
      query: ExportQuery,
      columns: Record<string, boolean>,
    ): boolean => {
      if (name.trim() === "") return false;

      const now = new Date().toISOString();
      const entry: CustomPreset = { name, query, columns, createdAt: now };

      setPresets((prev) => {
        const exists = prev.some((p) => p.name === name);
        const next = exists
          ? prev.map((p) => (p.name === name ? entry : p))
          : [...prev, entry];
        safeSetItem(STORAGE_KEY, next);
        return next;
      });

      return true;
    },
    [],
  );

  const deletePreset = useCallback(
    (name: string) => {
      setPresets((prev) => {
        const next = prev.filter((p) => p.name !== name);
        safeSetItem(STORAGE_KEY, next);
        return next;
      });
    },
    [],
  );

  const loadPreset = useCallback(
    (
      name: string,
    ): { query: ExportQuery; columns: Record<string, boolean> } | null => {
      // Read from current state via closure-safe approach:
      // We read directly from localStorage to avoid stale closure issues.
      const all = readPresets();
      const found = all.find((p) => p.name === name);
      if (!found) return null;
      return { query: found.query, columns: found.columns };
    },
    [],
  );

  return { presets, savePreset, deletePreset, loadPreset };
}
