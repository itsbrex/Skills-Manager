import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import MonacoEditor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { FileTree } from "@/components/editor/FileTree";
import { FileNode, Skill } from "@/types";
import { useTranslation } from "@/i18n";
import { useTheme } from "@/hooks/useTheme";
import {
  useSkillTranslation,
  makeTranslationKey,
  type SkillFileTranslationProgress,
  type SkillTranslationOutput,
} from "@/hooks/useSkillTranslation";
import { TranslateIconButton } from "@/components/translation/TranslateIconButton";

// Helper for timeout removed as per user request

export function EditorPage() {
  const { t, language } = useTranslation();
  const { theme } = useTheme();
  const translation = useSkillTranslation();
  const isLinux = navigator.userAgent.includes("Linux");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rootPath = searchParams.get("root") || "";
  const initialFile = searchParams.get("file") || "";

  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [selectedPath, setSelectedPath] = useState(initialFile);
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [relatedSkill, setRelatedSkill] = useState<Skill | null>(null);
  const [translatingFile, setTranslatingFile] = useState(false);
  const [fileTranslation, setFileTranslation] = useState<SkillTranslationOutput | null>(null);
  const [fileViewMode, setFileViewMode] = useState<"original" | "translated">("original");
  const [skillFileProgress, setSkillFileProgress] = useState<SkillFileTranslationProgress | null>(null);
  const [translationNotice, setTranslationNotice] = useState<string | null>(null);

  const isSkillMdFile = selectedPath.toLowerCase().endsWith("skill.md");
  const isTranslatableFile = /\.(md|mdx|markdown|txt|text)$/i.test(selectedPath);
  const translationKey = relatedSkill ? makeTranslationKey(relatedSkill.instance_id, language) : null;
  const translatedResult = translationKey ? translation.getTranslation(translationKey) : null;
  const viewMode = translationKey ? translation.getView(translationKey) : "original";
  const relatedSelectedPath = useMemo(
    () => getPathWithinSkill(rootPath, selectedPath, relatedSkill?.path ?? null),
    [rootPath, selectedPath, relatedSkill?.path],
  );
  const cachedFileTranslation = relatedSkill && relatedSelectedPath
    ? translation.getFileTranslation(relatedSkill.instance_id, language, relatedSelectedPath)
    : null;
  const activeFileTranslation = cachedFileTranslation ?? fileTranslation;
  const showingSkillTranslation =
    isSkillMdFile && translatedResult != null && viewMode === "translated" && !!translatedResult.content_md;
  const showingFileTranslation =
    !showingSkillTranslation && activeFileTranslation != null && fileViewMode === "translated" && !!activeFileTranslation.content_md;
  const showingTranslation = showingSkillTranslation || showingFileTranslation;
  const hasTranslationForCurrentFile =
    (isSkillMdFile && translatedResult != null) || (!isSkillMdFile && activeFileTranslation != null);
  const canTranslateCurrentFile = isTranslatableFile && content.length > 0;
  const displayContent = useMemo(
    () =>
      showingSkillTranslation
        ? translatedResult?.content_md ?? content
        : showingFileTranslation
          ? activeFileTranslation?.content_md ?? content
          : content,
    [showingSkillTranslation, showingFileTranslation, translatedResult, activeFileTranslation, content],
  );

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const lastEmittedRef = useRef("");
  // Track the most recent value we render into Monaco; updated in render so
  // subsequent prop-driven onChange callbacks can compare reliably.
  lastEmittedRef.current = displayContent;
  const hasUnsavedChanges = content !== originalContent;

  // Load file tree
  useEffect(() => {
    console.log("[Editor] useEffect check - rootPath:", rootPath);
    if (!rootPath) {
      console.log("[Editor] No rootPath, setting loading false");
      setLoading(false);
      setError("No root path specified");
      return;
    }

    async function loadTree() {
      console.log("[Editor] Starting loadTree...", rootPath);
      try {
        const tree = await invoke<FileNode>("read_directory_tree", { path: rootPath });
        console.log("[Editor] Tree loaded successfully", tree);
        setFileTree(tree);

        // If no file selected, find first .md file
        if (!selectedPath && tree.children) {
          const firstMd = findSkillMdFile(tree) || findFirstFile(tree, ".md") || findFirstFile(tree);
          console.log("[Editor] Auto-selecting file:", firstMd);
          if (firstMd) {
            setSelectedPath(firstMd);
          }
        }
      } catch (err) {
        console.error("[Editor] Tree load error:", err);
        setError(String(err));
      }
    }
    loadTree();
  }, [rootPath]);

  // Look up related skill: try exact path match first, then derive from the
  // currently-open SKILL.md absolute path (handles skill packages where
  // rootPath is the package root and selectedPath is a member subpath).
  useEffect(() => {
    if (!rootPath) return;
    let cancelled = false;
    void (async () => {
      try {
        const skills = await invoke<Skill[]>("list_skills");
        if (cancelled) return;
        const normalize = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "");
        const rootNorm = normalize(rootPath);

        let found: Skill | null = skills.find((s) => normalize(s.path) === rootNorm) ?? null;

        if (!found && selectedPath) {
          const fileAbs = normalize(`${rootPath}/${selectedPath}`);
          found = skills
            .map((skill) => ({ skill, path: normalize(skill.path) }))
            .filter(({ path }) => fileAbs === path || fileAbs.startsWith(`${path}/`))
            .sort((a, b) => b.path.length - a.path.length)[0]?.skill ?? null;
        }

        setRelatedSkill(found);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rootPath, selectedPath]);

  const formatTranslationError = useCallback((err: unknown): string => {
    if (typeof err === "object" && err !== null && "kind" in err) {
      const e = err as { kind?: string };
      if (e.kind === "not_configured") return t("editor.llmNotConfigured");
    }
    return t("editor.translationFailed");
  }, [t]);

  const handleTranslateFile = useCallback(async (force: boolean = false) => {
    // Skill docs branch: translate every translatable file under the skill root.
    if (relatedSkill) {
      let configured = translation.isConfigured;
      if (!configured) {
        configured = await translation.refreshConfigured();
      }
      if (!configured) {
        setError(t("editor.llmNotConfigured"));
        return;
      }
      setTranslatingFile(true);
      setSkillFileProgress(null);
      setTranslationNotice(null);
      try {
        const result = await translation.translateSkillFiles(
          relatedSkill.instance_id,
          language,
          force,
          (progress) => {
            setSkillFileProgress(progress);
            setTranslationNotice(
              t("editor.translateFilesProgress")
                .replace("{current}", String(progress.current))
                .replace("{total}", String(progress.total))
                .replace("{path}", progress.path),
            );
          },
        );
        if (isSkillMdFile && translationKey) {
          translation.setView(translationKey, "translated");
        } else if (relatedSelectedPath) {
          const currentTranslation = result.files.find(
            (file) => normalizePath(file.path) === normalizePath(relatedSelectedPath),
          )?.translation;
          if (currentTranslation) {
            setFileTranslation(currentTranslation);
            setFileViewMode("translated");
          }
        }

        const doneMessage = result.failed.length > 0
          ? t("editor.translateFilesPartialFailed")
              .replace("{ok}", String(result.files.length))
              .replace("{fail}", String(result.failed.length))
          : t("editor.translateFilesDone").replace("{count}", String(result.files.length));
        setTranslationNotice(doneMessage);
      } catch (err) {
        setError(formatTranslationError(err));
      } finally {
        setTranslatingFile(false);
        setSkillFileProgress(null);
      }
      return;
    }

    // Generic file branch
    if (!canTranslateCurrentFile) return;
    let configured = translation.isConfigured;
    if (!configured) {
      configured = await translation.refreshConfigured();
    }
    if (!configured) {
      setError(t("editor.llmNotConfigured"));
      return;
    }
    setTranslatingFile(true);
    setTranslationNotice(null);
    try {
      const result = await invoke<SkillTranslationOutput>("translate_text_content", {
        label: selectedPath,
        content,
        targetLang: language,
        force,
      });
      setFileTranslation(result);
      setFileViewMode("translated");
    } catch (err) {
      setError(formatTranslationError(err));
    } finally {
      setTranslatingFile(false);
    }
  }, [
    isSkillMdFile,
    relatedSkill,
    relatedSelectedPath,
    translationKey,
    translation,
    language,
    t,
    formatTranslationError,
    canTranslateCurrentFile,
    selectedPath,
    content,
  ]);

  const toggleView = useCallback(() => {
    if (isSkillMdFile && translationKey) {
      translation.setView(translationKey, viewMode === "translated" ? "original" : "translated");
      return;
    }
    setFileViewMode((m) => (m === "translated" ? "original" : "translated"));
  }, [isSkillMdFile, translationKey, translation, viewMode]);

  // Reset file-level translation when switching files / language (not on content edits)
  useEffect(() => {
    setFileTranslation(null);
    setFileViewMode("original");
  }, [selectedPath, language]);

  // Preload cached file translation when content available
  useEffect(() => {
    if (!selectedPath || !content || !isTranslatableFile || isSkillMdFile) return;
    let cancelled = false;
    void (async () => {
      try {
        const hit = await invoke<SkillTranslationOutput | null>("get_cached_text_translation", {
          label: relatedSelectedPath ?? selectedPath,
          content,
          targetLang: language,
        });
        if (cancelled) return;
        if (hit) {
          setFileTranslation(hit);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPath, relatedSelectedPath, content, language, isTranslatableFile, isSkillMdFile]);

  // Load file content
  useEffect(() => {
    console.log("[Editor] useEffect check - selectedPath:", selectedPath);
    if (!rootPath || !selectedPath) {
      console.log("[Editor] Missing path, setting loading false");
      setLoading(false);
      return;
    }

    async function loadFile() {
      console.log("[Editor] Starting loadFile...", selectedPath);
      setLoading(true);
      try {
        const fullPath = selectedPath === "." ? rootPath : `${rootPath}/${selectedPath}`;
        console.log("[Editor] Invoking read_file with:", fullPath);

        const fileContent = await invoke<string>("read_file", { path: fullPath });

        console.log("[Editor] File content loaded, length:", fileContent.length);
        setContent(fileContent);
        setOriginalContent(fileContent);
        setError(null);
      } catch (err) {
        console.error("[Editor] File load error:", err);
        setError(String(err));
      } finally {
        console.log("[Editor] loadFile finally - setting loading false");
        setLoading(false);
      }
    }
    loadFile();
  }, [rootPath, selectedPath]);

  const handleSave = useCallback(async () => {
    if (!rootPath || !selectedPath || saving) return;

    setSaving(true);
    try {
      const fullPath = selectedPath === "." ? rootPath : `${rootPath}/${selectedPath}`;
      await invoke("write_file", { path: fullPath, content });
      setOriginalContent(content);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }, [rootPath, selectedPath, saving, content]);

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  const handleSelectFile = useCallback((path: string) => {
    if (path === selectedPath) return;

    if (hasUnsavedChanges) {
      const confirmed = window.confirm(t("editor.unsavedChangesDesc"));
      if (!confirmed) return;
    }

    setSelectedPath(path);
  }, [selectedPath, hasUnsavedChanges, t]);

  const handleBack = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(t("editor.unsavedChangesDesc"));
      if (!confirmed) return;
    }
    navigate(-1);
  };

  const getLanguage = (path: string): string => {
    const ext = path.split(".").pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      md: "markdown",
      json: "json",
      js: "javascript",
      ts: "typescript",
      tsx: "typescript",
      jsx: "javascript",
      css: "css",
      html: "html",
      yaml: "yaml",
      yml: "yaml",
      toml: "toml",
      rs: "rust",
      py: "python",
    };
    return langMap[ext || ""] || "plaintext";
  };

  const skillName = fileTree?.name || rootPath.split("/").pop() || "";
  const translationProgressPercent = skillFileProgress && skillFileProgress.total > 0
    ? Math.max(0, Math.min(100, (skillFileProgress.current / skillFileProgress.total) * 100))
    : 0;
  const compactTranslationStatus = translatingFile && skillFileProgress
    ? t("editor.translateFilesCompact")
        .replace("{current}", String(skillFileProgress.current))
        .replace("{total}", String(skillFileProgress.total))
        .replace("{path}", skillFileProgress.path)
    : translationNotice;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      backgroundColor: "var(--background)",
    }}>
      {/* Toolbar */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px 12px 80px",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={handleBack}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 10px",
              fontSize: 13,
              color: "var(--foreground)",
              backgroundColor: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            {t("editor.back")}
          </button>
          <span style={{ fontSize: 15, fontWeight: 500, color: "var(--foreground)" }}>
            {skillName}
          </span>
          {hasUnsavedChanges && (
            <span style={{
              fontSize: 11,
              padding: "2px 6px",
              backgroundColor: "var(--secondary)",
              borderRadius: 4,
              color: "var(--muted-foreground)",
            }}>
              {t("editor.modified")}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {compactTranslationStatus && (
            <div
              role="status"
              aria-live="polite"
              title={compactTranslationStatus}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                maxWidth: 320,
                minWidth: 0,
                height: 28,
                padding: "0 10px",
                border: "1px solid var(--border)",
                borderRadius: 7,
                backgroundColor: "color-mix(in srgb, var(--primary) 7%, var(--background))",
                color: "var(--foreground)",
                fontSize: 12,
                lineHeight: 1,
                flexShrink: 1,
              }}
            >
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {compactTranslationStatus}
              </span>
              {translatingFile && skillFileProgress && (
                <div
                  aria-hidden
                  style={{
                    width: 72,
                    height: 4,
                    borderRadius: 999,
                    overflow: "hidden",
                    backgroundColor: "color-mix(in srgb, var(--foreground) 14%, transparent)",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: `${translationProgressPercent}%`,
                      height: "100%",
                      backgroundColor: "var(--primary)",
                      transition: "width 0.2s ease",
                    }}
                  />
                </div>
              )}
            </div>
          )}
          {canTranslateCurrentFile && (
            <TranslateIconButton
              hasTranslation={hasTranslationForCurrentFile}
              showingTranslation={showingTranslation}
              translating={translatingFile}
              translateLabel={t("editor.translate")}
              showOriginalLabel={t("editor.showOriginal")}
              showTranslationLabel={t("editor.showTranslation")}
              translatingLabel={t("editor.translating")}
              retranslateLabel={t("skills.retranslate")}
              onClick={() => {
                if (hasTranslationForCurrentFile) {
                  toggleView();
                } else {
                  void handleTranslateFile();
                }
              }}
              onRetranslate={() => void handleTranslateFile(true)}
            />
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasUnsavedChanges}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 500,
              color: hasUnsavedChanges ? "var(--primary-foreground)" : "var(--muted-foreground)",
              backgroundColor: hasUnsavedChanges ? "var(--foreground)" : "transparent",
              border: hasUnsavedChanges ? "none" : "1px solid var(--border)",
              borderRadius: 6,
              cursor: saving || !hasUnsavedChanges ? "default" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            {saving ? t("editor.saving") : t("editor.save")}
          </button>
        </div>
      </header>

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* File tree */}
        {fileTree && (
          <FileTree
            root={fileTree}
            selectedPath={selectedPath}
            onSelectFile={handleSelectFile}
          />
        )}

        {/* Editor */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--muted-foreground)",
            }}>
              Loading...
            </div>
          ) : error ? (
            <div style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#dc2626",
            }}>
              {error}
            </div>
          ) : (
            isLinux ? (
              // Simple textarea fallback for Linux to avoid Monaco worker issues
              <textarea
                style={{
                  width: "100%",
                  height: "100%",
                  padding: "20px",
                  fontFamily: "Menlo, Monaco, 'Courier New', monospace",
                  fontSize: "14px",
                  lineHeight: "1.5",
                  resize: "none",
                  border: "none",
                  outline: "none",
                  backgroundColor: "var(--background)",
                  color: "var(--foreground)",
                  tabSize: 2,
                }}
                value={displayContent}
                onChange={(e) => {
                  if (showingTranslation) return;
                  setContent(e.target.value);
                }}
                readOnly={showingTranslation}
                spellCheck={false}
              />
            ) : (
              <MonacoEditor
                height="100%"
                language={getLanguage(selectedPath)}
                value={displayContent}
                onChange={(value) => {
                  if (showingTranslation) return;
                  const next = value || "";
                  const normNext = next.replace(/\r\n/g, "\n");
                  const normLast = lastEmittedRef.current.replace(/\r\n/g, "\n");
                  if (normNext === normLast) return;
                  setContent(next);
                }}
                onMount={(editor) => { editorRef.current = editor; }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: "on",
                  wordWrap: "on",
                  wrappingStrategy: "advanced",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  readOnly: showingTranslation,
                  tabSize: 2,
                  quickSuggestions: false,
                  suggestOnTriggerCharacters: false,
                  parameterHints: { enabled: false },
                }}
                theme={theme === "dark" ? "vs-dark" : "light"}
              />
            )
          )}
        </div>
      </div>

      {/* Status bar */}
      <footer style={{
        padding: "6px 16px",
        borderTop: "1px solid var(--border)",
        fontSize: 12,
        color: "var(--muted-foreground)",
        flexShrink: 0,
      }}>
        {selectedPath}
      </footer>
    </div>
  );
}

function findFirstFile(node: FileNode, extension?: string): string | null {
  if (!node.is_dir) {
    if (!extension || node.name.endsWith(extension)) {
      return node.path;
    }
    return null;
  }

  if (node.children) {
    for (const child of node.children) {
      const found = findFirstFile(child, extension);
      if (found) return found;
    }
  }
  return null;
}

function findSkillMdFile(node: FileNode): string | null {
  if (!node.is_dir) {
    return node.name.toLowerCase() === "skill.md" ? node.path : null;
  }
  if (node.children) {
    for (const child of node.children) {
      const found = findSkillMdFile(child);
      if (found) return found;
    }
  }
  return null;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

function normalizeRelativePath(path: string): string {
  return normalizePath(path).replace(/^\.\/+/, "").replace(/^\/+/, "");
}

function getPathWithinSkill(rootPath: string, selectedPath: string, skillPath: string | null): string | null {
  if (!rootPath || !selectedPath || !skillPath) return null;
  const root = normalizePath(rootPath);
  const skillRoot = normalizePath(skillPath);
  const selectedAbs = normalizePath(selectedPath === "." ? root : `${root}/${selectedPath}`);

  if (selectedAbs === skillRoot) return ".";
  if (!selectedAbs.startsWith(`${skillRoot}/`)) return null;
  return normalizeRelativePath(selectedAbs.slice(skillRoot.length + 1));
}
