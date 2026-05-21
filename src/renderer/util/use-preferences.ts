import { useCallback, useEffect, useState } from 'react';
import type { PreferencesFile } from '@shared/preferences';
import { ipc } from '../ipc-client';

/**
 * Reactive view onto the preferences file. We don't push prefs changes via an
 * IPC broadcast (yet) — instead, every save bumps a local refresh counter
 * and components re-fetch. The PreferencesModal is the only writer; everyone
 * else only reads.
 */
const subscribers = new Set<() => void>();

function notifyAll() {
  for (const sub of subscribers) sub();
}

export function usePreferences(): {
  prefs: PreferencesFile | null;
  reload: () => Promise<void>;
} {
  const [prefs, setPrefs] = useState<PreferencesFile | null>(null);

  const reload = useCallback(async () => {
    const next = await ipc.getPreferences();
    setPrefs(next);
  }, []);

  useEffect(() => {
    void reload();
    const sub = () => void reload();
    subscribers.add(sub);
    return () => {
      subscribers.delete(sub);
    };
  }, [reload]);

  return { prefs, reload };
}

/**
 * Persist the preferences file and trigger every `usePreferences` to refetch.
 * Call this from the PreferencesModal after a successful save.
 */
export async function savePreferences(next: PreferencesFile): Promise<void> {
  await ipc.setPreferences(next);
  notifyAll();
}
