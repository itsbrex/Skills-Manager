import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import MonacoEditor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { FileTree } from "@/components/editor/FileTree";
import { FileNode } from "@/types";
import { useTranslation } from "@/i18n";
import { useTheme } from "@/hooks/useTheme";

// Helper for timeout removed as per user request

export function EditorPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
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

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
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
          const firstMd = findFirstFile(tree, ".md") || findFirstFile(tree);
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
            <MonacoEditor
              height="100%"
              language={getLanguage(selectedPath)}
              value={content}
              onChange={(value) => setContent(value || "")}
              onMount={(editor) => { editorRef.current = editor; }}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: "on",
                wordWrap: "on",
                wrappingStrategy: "advanced",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                quickSuggestions: false,
                suggestOnTriggerCharacters: false,
                parameterHints: { enabled: false },
              }}
              theme={theme === "dark" ? "vs-dark" : "light"}
            />
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
