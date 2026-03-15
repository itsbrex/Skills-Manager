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
} from "@/types";
import { cloudSyncPull, cloudSyncPush, cloudSyncResolve } from "@/services/cloudSync";
import { getAuthProfile, logoutAuth } from "@/services/auth";
import {
  setAuthProfileSnapshot,
  subscribeAuthProfile,
} from "@/services/authProfileStore";

type CloudSyncConflict = {
  revision: number;
  payload: CloudSyncPayload;
  localPayload: CloudSyncPayload;
};

type CloudSyncContextValue = {
  authProfile: AuthMeResponse | null;
  isAuthenticated: boolean;
  syncing: boolean;
  lastSyncedAt: number | null;
  conflict: CloudSyncConflict | null;
  error: string | null;
  manualSync: () => Promise<void>;
  resolveWithLocal: () => Promise<void>;
  resolveWithRemote: () => Promise<void>;
  refreshAuthProfile: () => Promise<void>;
  logout: () => Promise<void>;
};

const CloudSyncContext = createContext<CloudSyncContextValue | null>(null);
const AUTO_SYNC_INTERVAL_MS = 30_000;
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
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [conflict, setConflict] = useState<CloudSyncConflict | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inFlightRef = useRef(false);
  const conflictRef = useRef<CloudSyncConflict | null>(null);
  const lastPullUserRef = useRef<string | null>(null);

  useEffect(() => {
    conflictRef.current = conflict;
  }, [conflict]);

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

  const applyCloudPayload = useCallback(async (payload: CloudSyncPayload) => {
    const config = await invoke<AppConfig>("get_config");
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

    const skills = await invoke<Skill[]>("list_skills");

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

  const handlePushResult = useCallback(
    (result: CloudSyncPushResult) => {
      if (result.status === "conflict") {
        setConflict({
          revision: result.revision,
          payload: result.payload,
          localPayload: result.local_payload,
        });
        return;
      }
      if (result.status === "synced") {
        updateLastSynced();
      }
    },
    [updateLastSynced],
  );

  const performPush = useCallback(async () => {
    setError(null);
    const result = await cloudSyncPush();
    handlePushResult(result);
  }, [handlePushResult]);

  const performPull = useCallback(async () => {
    setError(null);
    const snapshot = await cloudSyncPull();
    if (snapshot.payload) {
      updateLastSynced();
    }
  }, [updateLastSynced]);

  useEffect(() => {
    if (!authProfile?.user_id) {
      lastPullUserRef.current = null;
      return;
    }
    if (lastPullUserRef.current === authProfile.user_id) {
      return;
    }
    lastPullUserRef.current = authProfile.user_id;
    void runSyncTask(async () => {
      try {
        await performPull();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }, [authProfile?.user_id, performPull, runSyncTask]);

  useEffect(() => {
    if (!authProfile) {
      return;
    }
    const timer = window.setInterval(() => {
      if (conflictRef.current) {
        return;
      }
      void runSyncTask(async () => {
        try {
          await performPush();
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    }, AUTO_SYNC_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [authProfile, performPush, runSyncTask]);

  const manualSync = useCallback(async () => {
    await runSyncTask(async () => {
      try {
        await performPush();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }, [performPush, runSyncTask]);

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
      lastSyncedAt,
      conflict,
      error,
      manualSync,
      resolveWithLocal,
      resolveWithRemote,
      refreshAuthProfile,
      logout,
    }),
    [
      authProfile,
      syncing,
      lastSyncedAt,
      conflict,
      error,
      manualSync,
      resolveWithLocal,
      resolveWithRemote,
      refreshAuthProfile,
      logout,
    ],
  );

  return value;
}
