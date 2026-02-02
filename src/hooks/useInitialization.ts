import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useInitialization() {
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkInitialization();
  }, []);

  async function checkInitialization() {
    try {
      const result = await invoke<boolean>("is_initialized");
      setIsInitialized(result);
    } catch (error) {
      console.error("Failed to check initialization:", error);
      setIsInitialized(false);
    } finally {
      setIsLoading(false);
    }
  }

  async function markInitialized() {
    setIsInitialized(true);
  }

  return { isInitialized, isLoading, markInitialized };
}
