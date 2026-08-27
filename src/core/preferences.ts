export const PROFILE_STORAGE_KEY = 'signalui.interface-on-demand.profile.v1';

export type InterfaceProfileId = 'operator-mobile' | 'manager-desktop' | 'auditor-desktop';

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ProfilePreferenceStore {
  read(): InterfaceProfileId;
  write(profileId: InterfaceProfileId): void;
  clear(): void;
}

const DEFAULT_PROFILE: InterfaceProfileId = 'manager-desktop';
const VALID_PROFILES = new Set<InterfaceProfileId>([
  'operator-mobile',
  'manager-desktop',
  'auditor-desktop',
]);

function isInterfaceProfileId(value: string | null): value is InterfaceProfileId {
  return value !== null && VALID_PROFILES.has(value as InterfaceProfileId);
}

export function createProfilePreferenceStore(storage?: PreferenceStorage): ProfilePreferenceStore {
  let fallback: InterfaceProfileId = DEFAULT_PROFILE;

  return {
    read(): InterfaceProfileId {
      try {
        const persisted = storage?.getItem(PROFILE_STORAGE_KEY) ?? null;
        if (isInterfaceProfileId(persisted)) {
          fallback = persisted;
          return persisted;
        }
      } catch {
        // Browser storage may be blocked; the session-local fallback remains authoritative.
      }
      return fallback;
    },

    write(profileId: InterfaceProfileId): void {
      fallback = profileId;
      try {
        storage?.setItem(PROFILE_STORAGE_KEY, profileId);
      } catch {
        // Explicit preference remains available in memory for the current page session.
      }
    },

    clear(): void {
      fallback = DEFAULT_PROFILE;
      try {
        storage?.removeItem(PROFILE_STORAGE_KEY);
      } catch {
        // Reset still succeeds in memory when storage access is unavailable.
      }
    },
  };
}
