export type CloudSyncSettings = {
  auto: boolean;
  intervalMinutes: number;
};

type CloudSyncSettingsListener = (settings: CloudSyncSettings) => void;

let currentSettings: CloudSyncSettings = { auto: true, intervalMinutes: 10 };
const listeners = new Set<CloudSyncSettingsListener>();

export function getCloudSyncSettingsSnapshot(): CloudSyncSettings {
  return currentSettings;
}

export function setCloudSyncSettingsSnapshot(settings: CloudSyncSettings): void {
  currentSettings = settings;
  listeners.forEach((listener) => listener(currentSettings));
}

export function subscribeCloudSyncSettings(
  listener: CloudSyncSettingsListener,
): () => void {
  listeners.add(listener);
  listener(currentSettings);
  return () => {
    listeners.delete(listener);
  };
}
