import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useLocation } from "react-router";
import { useTranslation } from "../i18n";

export interface SkillTranslationOutput {
  name: string;
  description: string;
  content_md: string | null;
  cached: boolean;
}

export interface MarketplaceTranslationInput {
  id: string;
  name: string;
  description: string | null;
  content_md?: string | null;
}

export interface BatchTranslationProgress {
  current: number;
  total: number;
  instance_id: string;
  skill_name: string;
}

export interface BatchTranslationFailure {
  instance_id: string;
  reason: string;
}

export interface BatchTranslationResult {
  succeeded: string[];
  failed: BatchTranslationFailure[];
}

type ViewMode = "translated" | "original";

interface TranslationStore {
  results: Map<string, SkillTranslationOutput>;
  view: Map<string, ViewMode>;
  inFlight: Map<string, Promise<SkillTranslationOutput>>;
}

interface SkillTranslationContextValue {
  isConfigured: boolean;
  refreshConfigured: () => Promise<boolean>;
  translateSkill: (instanceId: string, targetLang: string, force?: boolean) => Promise<SkillTranslationOutput>;
  translateMarketplace: (
    input: MarketplaceTranslationInput,
    targetLang: string,
    force?: boolean
  ) => Promise<SkillTranslationOutput>;
  translateBatch: (
    instanceIds: string[],
    targetLang: string,
    onProgress?: (p: BatchTranslationProgress) => void
  ) => Promise<BatchTranslationResult>;
  getTranslation: (key: string) => SkillTranslationOutput | null;
  getView: (key: string) => ViewMode;
  setView: (key: string, mode: ViewMode) => void;
  preloadCachedSkills: (instanceIds: string[], targetLang: string) => Promise<void>;
  preloadCachedMarketplace: (
    inputs: MarketplaceTranslationInput[],
    targetLang: string
  ) => Promise<void>;
  clearAll: () => void;
  clearCache: () => Promise<void>;
}

const SkillTranslationContext = createContext<SkillTranslationContextValue | null>(null);

export function SkillTranslationProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<TranslationStore>({
    results: new Map(),
    view: new Map(),
    inFlight: new Map(),
  });
  const [, forceRender] = useState(0);
  const bump = useCallback(() => forceRender((n) => n + 1), []);

  const [isConfigured, setIsConfigured] = useState(false);

  const refreshConfigured = useCallback(async (): Promise<boolean> => {
    try {
      const provider = await invoke<unknown>("get_llm_provider");
      const configured = provider != null;
      setIsConfigured(configured);
      return configured;
    } catch {
      setIsConfigured(false);
      return false;
    }
  }, []);

  useEffect(() => {
    refreshConfigured();
  }, [refreshConfigured]);

  const cacheKey = (instanceId: string, targetLang: string) =>
    `${targetLang}::${instanceId}`;

  const translateSkill = useCallback(
    async (instanceId: string, targetLang: string, force: boolean = false): Promise<SkillTranslationOutput> => {
      const key = cacheKey(instanceId, targetLang);
      const inflightKey = force ? `${key}::force` : key;
      const existing = storeRef.current.inFlight.get(inflightKey);
      if (existing) return existing;

      const promise = (async () => {
        const result = await invoke<SkillTranslationOutput>("translate_skill", {
          instanceId,
          targetLang,
          force,
        });
        storeRef.current.results.set(key, result);
        storeRef.current.view.set(key, "translated");
        bump();
        return result;
      })().finally(() => {
        storeRef.current.inFlight.delete(inflightKey);
      });

      storeRef.current.inFlight.set(inflightKey, promise);
      return promise;
    },
    [bump]
  );

  const translateMarketplace = useCallback(
    async (
      input: MarketplaceTranslationInput,
      targetLang: string,
      force: boolean = false
    ): Promise<SkillTranslationOutput> => {
      const key = cacheKey(input.id, targetLang);
      const inflightKey = force ? `${key}::force` : key;
      const existing = storeRef.current.inFlight.get(inflightKey);
      if (existing) return existing;

      const promise = (async () => {
        const result = await invoke<SkillTranslationOutput>("translate_marketplace_skill", {
          input,
          targetLang,
          force,
        });
        storeRef.current.results.set(key, result);
        storeRef.current.view.set(key, "translated");
        bump();
        return result;
      })().finally(() => {
        storeRef.current.inFlight.delete(inflightKey);
      });

      storeRef.current.inFlight.set(inflightKey, promise);
      return promise;
    },
    [bump]
  );

  const translateBatch = useCallback(
    async (
      instanceIds: string[],
      targetLang: string,
      onProgress?: (p: BatchTranslationProgress) => void
    ): Promise<BatchTranslationResult> => {
      let unlisten: UnlistenFn | null = null;
      if (onProgress) {
        unlisten = await listen<BatchTranslationProgress>(
          "llm:batch-progress",
          (event) => onProgress(event.payload)
        );
      }
      try {
        const result = await invoke<BatchTranslationResult>("translate_skills_batch", {
          instanceIds,
          targetLang,
        });
        for (const id of result.succeeded) {
          storeRef.current.view.set(cacheKey(id, targetLang), "translated");
        }
        bump();
        return result;
      } finally {
        if (unlisten) unlisten();
      }
    },
    [bump]
  );

  const getTranslation = useCallback((key: string) => {
    return storeRef.current.results.get(key) ?? null;
  }, []);

  const getView = useCallback((key: string): ViewMode => {
    return storeRef.current.view.get(key) ?? "original";
  }, []);

  const setView = useCallback(
    (key: string, mode: ViewMode) => {
      storeRef.current.view.set(key, mode);
      bump();
    },
    [bump]
  );

  const clearAll = useCallback(() => {
    storeRef.current.results.clear();
    storeRef.current.view.clear();
    bump();
  }, [bump]);

  const clearCache = useCallback(async () => {
    await invoke("clear_translation_cache");
    clearAll();
  }, [clearAll]);

  const preloadCachedSkills = useCallback(
    async (instanceIds: string[], targetLang: string): Promise<void> => {
      if (instanceIds.length === 0) return;
      try {
        const entries = await invoke<Array<{ key: string; translation: SkillTranslationOutput | null }>>(
          "get_cached_skill_translations",
          { instanceIds, targetLang },
        );
        let changed = false;
        for (const entry of entries) {
          if (!entry.translation) continue;
          const key = cacheKey(entry.key, targetLang);
          if (!storeRef.current.results.has(key)) {
            storeRef.current.results.set(key, entry.translation);
            changed = true;
          }
        }
        if (changed) bump();
      } catch {
        // ignore preload failure
      }
    },
    [bump],
  );

  const preloadCachedMarketplace = useCallback(
    async (inputs: MarketplaceTranslationInput[], targetLang: string): Promise<void> => {
      if (inputs.length === 0) return;
      try {
        const entries = await invoke<Array<{ key: string; translation: SkillTranslationOutput | null }>>(
          "get_cached_marketplace_translations",
          { inputs, targetLang },
        );
        let changed = false;
        for (const entry of entries) {
          if (!entry.translation) continue;
          const key = cacheKey(entry.key, targetLang);
          if (!storeRef.current.results.has(key)) {
            storeRef.current.results.set(key, entry.translation);
            changed = true;
          }
        }
        if (changed) bump();
      } catch {
        // ignore preload failure
      }
    },
    [bump],
  );

  // 自动缓存预热：根据路由变化预热对应页面的翻译
  const location = useLocation();
  const { language } = useTranslation();

  useEffect(() => {
    const preloadForRoute = async () => {
      if (!isConfigured) return;

      try {
        if (location.pathname === '/skills') {
          // Skills 页面：预热所有已安装 skill
          const skills = await invoke<Array<{ instance_id: string }>>('list_skills');
          const instanceIds = skills.map(s => s.instance_id);
          await preloadCachedSkills(instanceIds, language);
        } else if (location.pathname === '/marketplace') {
          // Marketplace 页面：预热前 50 个
          const items = await invoke<Array<{ id: string; name: string; description: string }>>(
            'get_marketplace_skills'
          );
          const top50 = items.slice(0, 50).map(s => ({
            id: s.id,
            name: s.name,
            description: s.description,
          }));
          await preloadCachedMarketplace(top50, language);
        }
      } catch (err) {
        // 预热失败静默处理，不影响用户
        console.debug('Cache preload failed:', err);
      }
    };

    preloadForRoute();
  }, [location.pathname, language, isConfigured, preloadCachedSkills, preloadCachedMarketplace]);

  const value: SkillTranslationContextValue = {
    isConfigured,
    refreshConfigured,
    translateSkill,
    translateMarketplace,
    translateBatch,
    getTranslation,
    getView,
    setView,
    preloadCachedSkills,
    preloadCachedMarketplace,
    clearAll,
    clearCache,
  };

  return (
    <SkillTranslationContext.Provider value={value}>
      {children}
    </SkillTranslationContext.Provider>
  );
}

export function useSkillTranslation() {
  const ctx = useContext(SkillTranslationContext);
  if (!ctx) {
    throw new Error("useSkillTranslation must be used within SkillTranslationProvider");
  }
  return ctx;
}

export function makeTranslationKey(instanceId: string, targetLang: string): string {
  return `${targetLang}::${instanceId}`;
}
