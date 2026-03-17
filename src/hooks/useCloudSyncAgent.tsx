import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  AppConfig,
  AuthMeResponse,
  CloudSyncPayload,
  CloudSyncPushResult,
  Skill,
  VaultBackupConsent,
} from "@/types";
import {
  cloudSyncPull,
  cloudSyncPush,
  cloudSyncResolve,
  installMarketplaceSkillByRef,
  vaultBackup,
  vaultDownload,
} from "@/services/cloudSync";
import {
  buildMissingSkillRestores,
  runVaultBackupThenPush,
} from "@/services/cloudSyncUtils";
import { syncPullThenPush, type SyncStage } from "@/services/cloudSyncWorkflow";
import { getAuthProfile, logoutAuth } from "@/services/auth";
import {
  setAuthProfileSnapshot,
  subscribeAuthProfile,
} from "@/services/authProfileStore";
import {
  getCloudSyncSettingsSnapshot,
  setCloudSyncSettingsSnapshot,
  subscribeCloudSyncSettings,
} from "@/services/cloudSyncSettingsStore";
import { defaultPreferences } from "@/constants/preferences";

type CloudSyncConflict = {
  revision: number;
  payload: CloudSyncPayload;
  localPayload: CloudSyncPayload;
};

type CloudSyncContextValue = {
  authProfile: AuthMeResponse | null;
  isAuthenticated: boolean;
  syncing: boolean;
  syncStage: SyncStage;
  lastSyncedAt: number | null;
  conflict: CloudSyncConflict | null;
  error: string | null;
  vaultConsent: VaultBackupConsent;
  vaultConsentDialogOpen: boolean;
  manualSync: () => Promise<void>;
  acceptVaultConsent: () => Promise<void>;
  denyVaultConsent: () => Promise<void>;
  cancelVaultConsent: () => void;
  refreshVaultConsent: () => Promise<VaultBackupConsent>;
  resolveWithLocal: () => Promise<void>;
  resolveWithRemote: () => Promise<void>;
  refreshAuthProfile: () => Promise<void>;
  logout: () => Promise<void>;
};

const CloudSyncContext = createContext<CloudSyncContextValue | null>(null);
const AUTH_REFRESH_INTERVAL_MS = 30_000;

export function CloudSyncProvider({ children }: { children: React.ReactNode }) {
  const value = useCloudSyncAgent();
  return (
    <CloudSyncContext.Provider value={value}>
      {children}
    </CloudSyncContext.Provider>
  );
}

export function useCloudSync() {
  const context = useContext(CloudSyncContext);
  if (!context) {
    throw new Error("useCloudSync must be used within CloudSyncProvider");
  }
  return context;
}

function useCloudSyncAgent(): CloudSyncContextValue {
  const [authProfile, setAuthProfile] = useState<AuthMeResponse | null>(null);
  const initialSettings = getCloudSyncSettingsSnapshot();
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(initialSettings.auto);
  const [autoSyncIntervalMs, setAutoSyncIntervalMs] = useState(
    initialSettings.intervalMinutes * 60_000,
  );
  const [syncing, setSyncing] = useState(false);
  const [syncStage, setSyncStage] = useState<SyncStage>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [conflict, setConflict] = useState<CloudSyncConflict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vaultConsent, setVaultConsent] = useState<VaultBackupConsent>("unknown");
  const [vaultConsentDialogOpen, setVaultConsentDialogOpen] = useState(false);

  const inFlightRef = useRef(false);
  const conflictRef = useRef<CloudSyncConflict | null>(null);
  const errorRef = useRef<string | null>(null);
  const vaultConsentRef = useRef<VaultBackupConsent>("unknown");
  const pendingManualSyncRef = useRef(false);

  useEffect(() => {
    conflictRef.current = conflict;
  }, [conflict]);

  useEffect(() => {
    errorRef.current = error;
  }, [error]);

  useEffect(() => {
    vaultConsentRef.current = vaultConsent;
  }, [vaultConsent]);

  useEffect(() => {
    invoke<AppConfig>("get_config")
      .then((config) => {
        const prefs = config.preferences;
        if (!prefs) {
          return;
        }
        setCloudSyncSettingsSnapshot({
          auto: prefs.cloud_sync_auto,
          intervalMinutes: prefs.cloud_sync_interval_minutes,
        });
        const consent =
          prefs.vault_backup_consent ?? defaultPreferences.vault_backup_consent;
        setVaultConsent(consent);
      })
      .catch(() => {
        // ignore config load failures for auto sync settings
      });
  }, []);

  useEffect(() => {
    return subscribeCloudSyncSettings((settings) => {
      setAutoSyncEnabled(settings.auto);
      const normalizedMinutes =
        Number.isFinite(settings.intervalMinutes) && settings.intervalMinutes > 0
          ? settings.intervalMinutes
          : 10;
      setAutoSyncIntervalMs(normalizedMinutes * 60_000);
    });
  }, []);

  const refreshAuthProfile = useCallback(async () => {
    try {
      const profile = await getAuthProfile();
      setAuthProfileSnapshot(profile);
    } catch (err) {
      console.warn("Failed to refresh auth profile:", err);
    }
  }, []);

  useEffect(() => {
    return subscribeAuthProfile((profile) => {
      setAuthProfile(profile);
    });
  }, []);

  useEffect(() => {
    void refreshAuthProfile();
  }, [refreshAuthProfile]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshAuthProfile();
    }, AUTH_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refreshAuthProfile]);

  const updateLastSynced = useCallback(() => {
    setLastSyncedAt(Math.floor(Date.now() / 1000));
  }, []);

  const refreshVaultConsent = useCallback(async () => {
    try {
      const config = await invoke<AppConfig>("get_config");
      const consent =
        config.preferences?.vault_backup_consent ??
        defaultPreferences.vault_backup_consent;
      setVaultConsent(consent);
      return consent;
    } catch (err) {
      return vaultConsentRef.current;
    }
  }, []);

  const updateVaultConsent = useCallback(async (consent: VaultBackupConsent) => {
    try {
      const config = await invoke<AppConfig>("get_config");
      const preferences = {
        ...defaultPreferences,
        ...(config.preferences ?? {}),
        vault_backup_consent: consent,
      };
      await invoke("save_config", { config: { ...config, preferences } });
      setVaultConsent(consent);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return false;
    }
  }, []);

  const applyCloudPayload = useCallback(async (payload: CloudSyncPayload) => {
    const config = await invoke<AppConfig>("get_config");
    if (payload.preferences) {
      const merged = {
        ...defaultPreferences,
        ...(config.preferences ?? {}),
        ...payload.preferences,
      };
      config.preferences = merged;
      await invoke("save_config", { config });
      setCloudSyncSettingsSnapshot({
        auto: merged.cloud_sync_auto,
        intervalMinutes: merged.cloud_sync_interval_minutes,
      });
      setVaultConsent(merged.vault_backup_consent);
    }
    const existingCustomTools = config.custom_tools || {};

    for (const tool of payload.custom_tools) {
      if (existingCustomTools[tool.id]) {
        await invoke("update_custom_tool", {
          toolId: tool.id,
          name: tool.name,
          configPath: tool.config_path,
          skillsPath: tool.skills_path,
          iconPath: null,
          enabled: tool.enabled,
        });
        continue;
      }

      await invoke("create_custom_tool", {
        toolId: tool.id,
        name: tool.name,
        configPath: tool.config_path,
        skillsPath: tool.skills_path,
        iconPath: null,
      });

      await invoke("update_custom_tool", {
        toolId: tool.id,
        name: tool.name,
        configPath: tool.config_path,
        skillsPath: tool.skills_path,
        iconPath: null,
        enabled: tool.enabled,
      });
    }

    const refreshed = await invoke<AppConfig>("get_config");
    const toolIds = new Set<string>([
      ...Object.keys(refreshed.tools || {}),
      ...Object.keys(refreshed.custom_tools || {}),
    ]);

    let skills = await invoke<Skill[]>("list_skills");
    const restorePlan = buildMissingSkillRestores(payload.skills, skills);
    const missingErrors: string[] = [];
    if (restorePlan.length > 0) {
      for (const restore of restorePlan) {
        const missing = restore.skill;
        try {
          if (restore.type === "marketplace") {
            const marketplace = missing.marketplace;
            if (!marketplace) {
              continue;
            }
            await installMarketplaceSkillByRef({
              name: missing.name,
              marketplace_source_id: marketplace.marketplace_source_id ?? undefined,
              marketplace_skill_id:
                marketplace.marketplace_skill_id ?? missing.id,
              marketplace_skill_slug: marketplace.marketplace_skill_slug ?? undefined,
              repo_url: marketplace.repo_url,
              skill_path: marketplace.skill_path,
              remote_revision: marketplace.remote_revision ?? undefined,
            });
            continue;
          }
          if (restore.type === "vault") {
            const skillId = missing.vault?.skill_id ?? missing.id;
            await vaultDownload(skillId);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          missingErrors.push(`${missing.id}: ${message}`);
        }
      }

      await invoke("refresh_skills");
      skills = await invoke<Skill[]>("list_skills");
    }

    for (const [toolId, toolState] of Object.entries(payload.tool_states)) {
      if (!toolIds.has(toolId)) {
        continue;
      }
      await invoke("set_tool_enabled", { toolId, enabled: toolState.enabled });
      if (!toolState.enabled) {
        continue;
      }
      const desired = new Set(toolState.enabled_skills);
      for (const skill of skills) {
        const currentEnabled = Boolean(skill.enabled?.[toolId]);
        const shouldEnable = desired.has(skill.id);
        if (shouldEnable && !currentEnabled) {
          await invoke("enable_skill", { skillId: skill.id, toolId });
        }
        if (!shouldEnable && currentEnabled) {
          await invoke("disable_skill", { skillId: skill.id, toolId });
        }
      }
    }

    await invoke("refresh_tools");
    await invoke("refresh_skills");

    if (missingErrors.length > 0) {
      throw new Error(`Restore failed: ${missingErrors.join("; ")}`);
    }
  }, []);

  const runSyncTask = useCallback(async (task: () => Promise<void>) => {
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    setSyncing(true);
    try {
      await task();
    } finally {
      inFlightRef.current = false;
      setSyncing(false);
    }
  }, []);

  const performPush = useCallback(
    async (allowVaultBackup: boolean): Promise<CloudSyncPushResult> => {
      setError(null);
      const result = allowVaultBackup
        ? await runVaultBackupThenPush(vaultBackup, cloudSyncPush)
        : await cloudSyncPush();
      if (result.status === "synced" || result.status === "skipped") {
        updateLastSynced();
      }
      return result;
    },
    [updateLastSynced],
  );

  const performPull = useCallback(async () => {
    setError(null);
    const snapshot = await cloudSyncPull();
    if (snapshot.payload) {
      await applyCloudPayload(snapshot.payload);
      updateLastSynced();
    }
  }, [applyCloudPayload, updateLastSynced]);

  const pullLatest = useCallback(async () => {
    setError(null);
    await syncPullThenPush({
      pull: performPull,
      push: async () => ({ status: "skipped", reason: "pull_only" } as const),
      onStage: (stage) => {
        if (stage === "pushing") {
          return;
        }
        setSyncStage(stage);
      },
      onError: setError,
      retryOnConflict: false,
    });
  }, [performPull]);

  const pullThenPush = useCallback(
    async (allowVaultBackup: boolean) => {
      setError(null);
      await syncPullThenPush({
        pull: performPull,
        push: () => performPush(allowVaultBackup),
        onStage: setSyncStage,
        onError: setError,
        retryOnConflict: true,
      });
    },
    [performPull, performPush],
  );

  useEffect(() => {
    if (!authProfile?.user_id) {
      return;
    }
    void runSyncTask(async () => {
      try {
        await pullLatest();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }, [authProfile?.user_id, pullLatest, runSyncTask]);

  useEffect(() => {
    if (!authProfile?.user_id || !autoSyncEnabled) {
      return;
    }
    if (autoSyncIntervalMs <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      if (errorRef.current) {
        return;
      }
      void runSyncTask(async () => {
        try {
          const allowVaultBackup = vaultConsentRef.current === "granted";
          await pullThenPush(allowVaultBackup);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    }, autoSyncIntervalMs);

    return () => window.clearInterval(timer);
  }, [authProfile?.user_id, autoSyncEnabled, autoSyncIntervalMs, pullThenPush, runSyncTask]);

  const manualSync = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }
    const consent = await refreshVaultConsent();
    if (consent === "unknown") {
      pendingManualSyncRef.current = true;
      setVaultConsentDialogOpen(true);
      return;
    }
    await runSyncTask(async () => {
      try {
        await pullThenPush(consent === "granted");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }, [pullThenPush, refreshVaultConsent, runSyncTask]);

  const acceptVaultConsent = useCallback(async () => {
    setVaultConsentDialogOpen(false);
    const updated = await updateVaultConsent("granted");
    if (!updated) {
      pendingManualSyncRef.current = false;
      return;
    }
    if (!pendingManualSyncRef.current) {
      return;
    }
    pendingManualSyncRef.current = false;
    await runSyncTask(async () => {
      try {
        await pullThenPush(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }, [pullThenPush, runSyncTask, updateVaultConsent]);

  const denyVaultConsent = useCallback(async () => {
    setVaultConsentDialogOpen(false);
    const updated = await updateVaultConsent("denied");
    if (!updated) {
      pendingManualSyncRef.current = false;
      return;
    }
    if (!pendingManualSyncRef.current) {
      return;
    }
    pendingManualSyncRef.current = false;
    await runSyncTask(async () => {
      try {
        await pullThenPush(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }, [pullThenPush, runSyncTask, updateVaultConsent]);

  const cancelVaultConsent = useCallback(() => {
    setVaultConsentDialogOpen(false);
    pendingManualSyncRef.current = false;
  }, []);

  const resolveWithLocal = useCallback(async () => {
    if (!conflictRef.current) {
      return;
    }
    const localPayload = conflictRef.current.localPayload;
    await runSyncTask(async () => {
      try {
        await cloudSyncResolve(localPayload);
        setConflict(null);
        updateLastSynced();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }, [runSyncTask, updateLastSynced]);

  const resolveWithRemote = useCallback(async () => {
    if (!conflictRef.current) {
      return;
    }
    const remotePayload = conflictRef.current.payload;
    await runSyncTask(async () => {
      try {
        await applyCloudPayload(remotePayload);
        await cloudSyncPull();
        setConflict(null);
        updateLastSynced();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }, [applyCloudPayload, runSyncTask, updateLastSynced]);

  const logout = useCallback(async () => {
    await runSyncTask(async () => {
      try {
        await logoutAuth();
        setAuthProfileSnapshot(null);
        setConflict(null);
        setLastSyncedAt(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }, [runSyncTask]);

  const value = useMemo(
    () => ({
      authProfile,
      isAuthenticated: Boolean(authProfile),
      syncing,
      syncStage,
      lastSyncedAt,
      conflict,
      error,
      vaultConsent,
      vaultConsentDialogOpen,
      manualSync,
      acceptVaultConsent,
      denyVaultConsent,
      cancelVaultConsent,
      refreshVaultConsent,
      resolveWithLocal,
      resolveWithRemote,
      refreshAuthProfile,
      logout,
    }),
    [
      authProfile,
      syncing,
      syncStage,
      lastSyncedAt,
      conflict,
      error,
      vaultConsent,
      vaultConsentDialogOpen,
      manualSync,
      acceptVaultConsent,
      denyVaultConsent,
      cancelVaultConsent,
      refreshVaultConsent,
      resolveWithLocal,
      resolveWithRemote,
      refreshAuthProfile,
      logout,
    ],
  );

  return value;
}
