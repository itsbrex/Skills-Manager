import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import MonacoEditor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileTree } from "@/components/editor/FileTree";
import { MarketplaceSkill, SkillFileNode, FileNode } from "@/types";
import { useTranslation } from "@/i18n";
import { useTheme } from "@/hooks/useTheme";
import { ExternalLink } from "lucide-react";

interface SkillDetailModalProps {
  skill: MarketplaceSkill;
  onClose: () => void;
  onInstall: (skill: MarketplaceSkill, event?: MouseEvent) => void;
  installing: boolean;
}

interface ParsedFrontmatter {
  name?: string;
  description?: string;
  compatibility: string[];
  metadata: Record<string, string>;
}

const skillTreeCache = new Map<string, SkillFileNode>();
const fileContentCache = new Map<string, string>();

export function SkillDetailModal({ skill, onClose, onInstall, installing }: SkillDetailModalProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isLinux = navigator.userAgent.includes("Linux");
  const [fileTree, setFileTree] = useState<SkillFileNode | null>(null);
  const [selectedPath, setSelectedPath] = useState("");
  const [previewContent, setPreviewContent] = useState("");
  const [previewPath, setPreviewPath] = useState("");
  const [filesLoading, setFilesLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewRequestId = useRef(0);
  const canShowFiles = Boolean(skill.repo_url && skill.skill_path);

  const markdownComponents = useMemo(() => ({
    h1: (props: any) => (
      <h1
        {...props}
        style={{
          fontSize: "24px",
          lineHeight: 1.25,
          margin: "10px 0 14px",
          fontWeight: 700,
          letterSpacing: "-0.01em",
        }}
      />
    ),
    h2: (props: any) => (
      <h2
        {...props}
        style={{
          fontSize: "19px",
          lineHeight: 1.3,
          margin: "18px 0 10px",
          fontWeight: 650,
        }}
      />
    ),
    h3: (props: any) => (
      <h3
        {...props}
        style={{
          fontSize: "15px",
          lineHeight: 1.4,
          margin: "14px 0 8px",
          fontWeight: 620,
        }}
      />
    ),
    p: (props: any) => <p {...props} style={{ margin: "8px 0", color: "var(--foreground)" }} />,
    ul: (props: any) => <ul {...props} style={{ margin: "8px 0 12px", paddingLeft: "20px" }} />,
    ol: (props: any) => <ol {...props} style={{ margin: "8px 0 12px", paddingLeft: "20px" }} />,
    li: (props: any) => <li {...props} style={{ margin: "4px 0" }} />,
    blockquote: (props: any) => (
      <blockquote
        {...props}
        style={{
          borderLeft: "3px solid var(--border)",
          margin: "12px 0",
          padding: "4px 0 4px 10px",
          color: "var(--muted-foreground)",
        }}
      />
    ),
    hr: (props: any) => (
      <hr
        {...props}
        style={{
          border: "none",
          borderTop: "1px solid var(--border)",
          margin: "16px 0",
        }}
      />
    ),
    table: (props: any) => (
      <div style={{ overflowX: "auto", margin: "12px 0" }}>
        <table
          {...props}
          style={{
            width: "100%",
            borderCollapse: "collapse",
            border: "1px solid var(--border)",
            fontSize: "12px",
          }}
        />
      </div>
    ),
    th: (props: any) => (
      <th
        {...props}
        style={{
          border: "1px solid var(--border)",
          backgroundColor: "var(--secondary)",
          padding: "6px 8px",
          textAlign: "left",
          fontWeight: 600,
        }}
      />
    ),
    td: (props: any) => (
      <td
        {...props}
        style={{
          border: "1px solid var(--border)",
          padding: "6px 8px",
          verticalAlign: "top",
        }}
      />
    ),
    code: ({ inline, children, ...props }: any) => (
      inline ? (
        <code
          {...props}
          style={{
            fontFamily: "Menlo, Monaco, 'Courier New', monospace",
            backgroundColor: "var(--secondary)",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            padding: "1px 4px",
            fontSize: "12px",
          }}
        >
          {children}
        </code>
      ) : (
        <code {...props}>{children}</code>
      )
    ),
    pre: (props: any) => (
      <pre
        {...props}
        style={{
          overflowX: "auto",
          backgroundColor: "var(--secondary)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "10px 12px",
          fontSize: "12px",
        }}
      />
    ),
  }), []);

  const fileMap = useMemo(() => {
    const map = new Map<string, string>();
    if (fileTree) {
      collectDownloadUrls(fileTree, map);
    }
    return map;
  }, [fileTree]);

  const treeForDisplay = useMemo<FileNode | null>(() => {
    if (!fileTree) return null;
    return convertToFileNode(fileTree);
  }, [fileTree]);

  const fileCount = useMemo(() => {
    if (!fileTree) return 0;
    return countFiles(fileTree);
  }, [fileTree]);

  useEffect(() => {
    let cancelled = false;
    previewRequestId.current += 1;
    const requestId = previewRequestId.current;

    setSelectedPath("");
    setPreviewContent("");
    setPreviewPath("");
    setPreviewError(null);
    setError(null);

    async function loadFiles() {
      try {
        if (!skill.repo_url || !skill.skill_path) {
          setFilesLoading(false);
          setFileTree(null);
          return;
        }

        const cacheKey = makeSkillTreeCacheKey(skill.repo_url, skill.skill_path);
        const cachedTree = skillTreeCache.get(cacheKey);
        if (cachedTree) {
          if (!cancelled && requestId === previewRequestId.current) {
            setFileTree(cachedTree);
            setFilesLoading(false);
          }
          return;
        }

        setFileTree(null);
        setFilesLoading(true);
        const skillPath = skill.skill_path;
        const tree = await invoke<SkillFileNode>("fetch_skill_files", {
          repoUrl: skill.repo_url,
          skillPath,
        });
        if (!cancelled && requestId === previewRequestId.current) {
          skillTreeCache.set(cacheKey, tree);
          setFileTree(tree);
        }
      } catch (err) {
        if (!cancelled && requestId === previewRequestId.current) {
          setError(err instanceof Error ? err.message : String(err));
          setFileTree(null);
        }
      } finally {
        if (!cancelled && requestId === previewRequestId.current) {
          setFilesLoading(false);
        }
      }
    }

    void loadFiles();

    return () => {
      cancelled = true;
    };
  }, [skill]);

  const handleSelectFile = useCallback(async (path: string) => {
    if (path === selectedPath && !previewError) return;
    setSelectedPath(path);
    setPreviewPath(path);
    setPreviewError(null);
    const downloadUrl = fileMap.get(path);
    if (!downloadUrl) {
      setPreviewContent("");
      setPreviewError(t("marketplace.noPreview"));
      return;
    }

    const cachedContent = fileContentCache.get(downloadUrl);
    if (cachedContent !== undefined) {
      setPreviewContent(cachedContent);
      setContentLoading(false);
      return;
    }

    const requestId = previewRequestId.current + 1;
    previewRequestId.current = requestId;
    setPreviewContent("");
    setContentLoading(true);
    try {
      const content = await invoke<string>("fetch_skill_file_content", { downloadUrl });
      if (requestId !== previewRequestId.current) {
        return;
      }
      fileContentCache.set(downloadUrl, content);
      setPreviewContent(content);
    } catch (err) {
      if (requestId !== previewRequestId.current) {
        return;
      }
      setPreviewContent("");
      setPreviewError(err instanceof Error ? err.message : String(err));
    } finally {
      if (requestId === previewRequestId.current) {
        setContentLoading(false);
      }
    }
  }, [fileMap, previewError, selectedPath, t]);

  useEffect(() => {
    if (!fileTree) return;
    const defaultPath = findDefaultPath(fileTree);
    if (defaultPath) {
      void handleSelectFile(defaultPath);
    }
  }, [fileTree, handleSelectFile]);

  const isMarkdown = previewPath.toLowerCase().endsWith(".md");
  const parsedMarkdown = useMemo(() => {
    if (!isMarkdown || !previewContent) {
      return { body: previewContent, frontmatter: null as ParsedFrontmatter | null };
    }
    return parseMarkdownWithFrontmatter(previewContent);
  }, [isMarkdown, previewContent]);

  const handleOpenExternalLink = useCallback(async (event: MouseEvent, url: string) => {
    event.stopPropagation();
    if (url) {
      try {
        await openUrl(url);
      } catch (err) {
        console.error("Failed to open URL:", err);
      }
    }
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.45)",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "980px",
          maxWidth: "90vw",
          maxHeight: "90vh",
          backgroundColor: "var(--background)",
          borderRadius: "16px",
          border: "1px solid var(--border)",
          boxShadow: "0 18px 60px rgba(0,0,0,0.25)",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 22px",
          borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--foreground)" }}>
                {skill.name}
              </div>
              {skill.repo_url && (
                <span
                  style={{
                    color: "var(--muted-foreground)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                  onClick={(e) => handleOpenExternalLink(e, skill.repo_url!)}
                  title={t("marketplace.openInBrowser")}
                >
                  <ExternalLink size={15} />
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {skill.author && (
                <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                  {t("marketplace.author").replace("{author}", skill.author)}
                </span>
              )}
              <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                {t("marketplace.source").replace("{source}", skill.source_name)}
              </span>
            </div>
            {skill.tags.length > 0 && (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {skill.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: "11px",
                      fontWeight: 500,
                      color: "var(--primary)",
                      backgroundColor: "rgba(9, 105, 218, 0.12)",
                      padding: "3px 8px",
                      borderRadius: "999px",
                      border: "1px solid rgba(9, 105, 218, 0.35)",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--secondary)",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {canShowFiles ? (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: "grid",
                gridTemplateColumns: "240px 1px minmax(0, 1fr)",
              }}
            >
              <div style={{ minHeight: 0, overflow: "auto" }}>
                {!treeForDisplay ? (
                  <div style={{ padding: "16px", fontSize: "12px", color: error ? "var(--color-error)" : "var(--muted-foreground)" }}>
                    {error || t("marketplace.loadingFiles")}
                    {!error && (
                      <div style={{ marginTop: "10px", display: "grid", gap: "6px" }}>
                        <div style={{ height: "10px", borderRadius: "6px", backgroundColor: "var(--secondary)" }} />
                        <div style={{ height: "10px", borderRadius: "6px", backgroundColor: "var(--secondary)" }} />
                        <div style={{ height: "10px", borderRadius: "6px", backgroundColor: "var(--secondary)" }} />
                      </div>
                    )}
                  </div>
                ) : (
                  <FileTree
                    root={treeForDisplay}
                    selectedPath={selectedPath}
                    onSelectFile={handleSelectFile}
                  />
                )}
              </div>
              <div style={{ width: "1px", backgroundColor: "var(--border)" }} />
              <div style={{ minWidth: 0, minHeight: 0, padding: "18px 20px", overflow: "hidden" }}>
                {filesLoading && !treeForDisplay ? (
                  <div style={{ color: "var(--muted-foreground)" }}>{t("marketplace.loadingFiles")}</div>
                ) : contentLoading ? (
                  <div style={{ color: "var(--muted-foreground)" }}>
                    {t("marketplace.loadingPreview")}
                    <div style={{ marginTop: "10px", display: "grid", gap: "8px" }}>
                      <div style={{ height: "12px", borderRadius: "6px", backgroundColor: "var(--secondary)" }} />
                      <div style={{ height: "12px", borderRadius: "6px", backgroundColor: "var(--secondary)" }} />
                      <div style={{ height: "12px", borderRadius: "6px", backgroundColor: "var(--secondary)" }} />
                    </div>
                  </div>
                ) : previewError ? (
                  <div style={{ color: "var(--color-error)" }}>
                    {previewError}
                  </div>
                ) : previewContent ? (
                  isMarkdown ? (
                    <div style={{
                      fontSize: "13px",
                      lineHeight: 1.6,
                      color: "var(--foreground)",
                      overflow: "auto",
                      height: "100%",
                    }}>
                      {parsedMarkdown.frontmatter && (
                        <div
                          style={{
                            border: "1px solid var(--border)",
                            background: "linear-gradient(180deg, var(--secondary) 0%, transparent 100%)",
                            borderRadius: "10px",
                            padding: "12px 14px",
                            marginBottom: "14px",
                          }}
                        >
                          <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--foreground)", marginBottom: "6px" }}>
                            {parsedMarkdown.frontmatter.name || skill.name}
                          </div>
                          {parsedMarkdown.frontmatter.description && (
                            <div style={{ color: "var(--muted-foreground)", marginBottom: "8px" }}>
                              {parsedMarkdown.frontmatter.description}
                            </div>
                          )}
                          {(parsedMarkdown.frontmatter.compatibility.length > 0 ||
                            Object.keys(parsedMarkdown.frontmatter.metadata).length > 0) && (
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                              {parsedMarkdown.frontmatter.compatibility.map((item) => (
                                <span
                                  key={`compat-${item}`}
                                  style={{
                                    fontSize: "11px",
                                    border: "1px solid var(--border)",
                                    backgroundColor: "var(--background)",
                                    color: "var(--muted-foreground)",
                                    borderRadius: "999px",
                                    padding: "2px 8px",
                                  }}
                                >
                                  compatibility: {item}
                                </span>
                              ))}
                              {Object.entries(parsedMarkdown.frontmatter.metadata).map(([key, value]) => (
                                <span
                                  key={`meta-${key}`}
                                  style={{
                                    fontSize: "11px",
                                    border: "1px solid var(--border)",
                                    backgroundColor: "var(--background)",
                                    color: "var(--muted-foreground)",
                                    borderRadius: "999px",
                                    padding: "2px 8px",
                                  }}
                                >
                                  {key}: {value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {parsedMarkdown.body ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {parsedMarkdown.body}
                        </ReactMarkdown>
                      ) : (
                        <div style={{ color: "var(--muted-foreground)" }}>{t("marketplace.noPreview")}</div>
                      )}
                    </div>
                  ) : isLinux ? (
                    <pre style={{
                      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
                      fontSize: "12px",
                      lineHeight: 1.6,
                      color: "var(--foreground)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      height: "100%",
                      overflow: "auto",
                    }}>
                      {previewContent}
                    </pre>
                  ) : (
                    <MonacoEditor
                      height="100%"
                      language={getLanguage(previewPath)}
                      value={previewContent}
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 12,
                        lineNumbers: "on",
                        wordWrap: "on",
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                      }}
                      theme={theme === "dark" ? "vs-dark" : "light"}
                    />
                  )
                ) : (
                  <div style={{ color: "var(--muted-foreground)" }}>
                    {t("marketplace.noPreview")}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              flex: 1,
              padding: "24px",
              overflow: "auto",
              color: "var(--foreground)",
            }}>
              {error && (
                <div style={{ color: "var(--color-error)", marginBottom: "12px" }}>{error}</div>
              )}
              <div style={{ fontSize: "14px", lineHeight: 1.6 }}>
                {skill.description || t("skills.noDescription")}
              </div>
            </div>
          )}
        </div>

        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 22px",
          borderTop: "1px solid var(--border)",
          fontSize: "12px",
          color: "var(--muted-foreground)",
        }}>
          <span>
            {t("marketplace.files")}: {fileTree ? fileCount : (filesLoading ? "-" : 0)}
          </span>
          {skill.install_status === "installed" ? (
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              fontWeight: 500,
              color: "var(--color-success)",
              backgroundColor: "var(--color-success-bg)",
              padding: "6px 10px",
              borderRadius: "8px",
              border: "1px solid var(--color-success-border)",
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {t("marketplace.installed")}
            </span>
          ) : (
            <button
              onClick={(e) => onInstall(skill, e)}
              disabled={installing}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--primary-foreground)",
                backgroundColor: "var(--foreground)",
                border: "none",
                borderRadius: "8px",
                cursor: installing ? "wait" : "pointer",
                opacity: installing ? 0.7 : 1,
              }}
            >
              {installing ? t("marketplace.installing") : t("marketplace.install")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function makeSkillTreeCacheKey(repoUrl: string, skillPath: string): string {
  return `${repoUrl}::${skillPath}`;
}

function convertToFileNode(node: SkillFileNode): FileNode {
  return {
    name: node.name,
    path: node.path,
    is_dir: node.is_dir,
    children: node.children?.map(convertToFileNode),
  };
}

function collectDownloadUrls(node: SkillFileNode, map: Map<string, string>) {
  if (node.is_dir) {
    node.children?.forEach((child) => collectDownloadUrls(child, map));
  } else if (node.download_url) {
    map.set(node.path, node.download_url);
  }
}

function findDefaultPath(node: SkillFileNode): string | null {
  if (!node.is_dir) {
    const lower = node.name.toLowerCase();
    if (lower === "skill.md" || lower === "readme.md") {
      return node.path;
    }
    return null;
  }

  if (node.children) {
    for (const child of node.children) {
      const found = findDefaultPath(child);
      if (found) return found;
    }
  }
  return findFirstFile(node);
}

function findFirstFile(node: SkillFileNode): string | null {
  if (!node.is_dir) {
    return node.path;
  }
  if (node.children) {
    for (const child of node.children) {
      const found = findFirstFile(child);
      if (found) return found;
    }
  }
  return null;
}

function countFiles(node: SkillFileNode): number {
  if (!node.is_dir) return 1;
  if (!node.children) return 0;
  return node.children.reduce((sum, child) => sum + countFiles(child), 0);
}

function getLanguage(path: string): string {
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
}

function parseMarkdownWithFrontmatter(raw: string): { body: string; frontmatter: ParsedFrontmatter | null } {
  const normalized = raw.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return { body: raw, frontmatter: null };
  }

  const frontmatter = parseFrontmatterBlock(match[1]);
  const body = normalized.slice(match[0].length).trimStart();
  return { body, frontmatter };
}

function parseFrontmatterBlock(block: string): ParsedFrontmatter | null {
  const result: ParsedFrontmatter = {
    compatibility: [],
    metadata: {},
  };
  const lines = block.split("\n");
  let section: "compatibility" | "metadata" | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const rootMatch = trimmed.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (rootMatch && !line.startsWith("  ")) {
      const key = rootMatch[1];
      const value = stripYamlValue(rootMatch[2]);
      if (key === "name") {
        result.name = value;
        section = null;
        continue;
      }
      if (key === "description") {
        result.description = value;
        section = null;
        continue;
      }
      if (key === "compatibility") {
        section = "compatibility";
        if (value) result.compatibility.push(value);
        continue;
      }
      if (key === "metadata") {
        section = "metadata";
        continue;
      }
      section = null;
      continue;
    }

    const listMatch = trimmed.match(/^-\s+(.+)$/);
    if (listMatch && section === "compatibility") {
      result.compatibility.push(stripYamlValue(listMatch[1]));
      continue;
    }

    const nestedMatch = line.match(/^\s{2,}([A-Za-z0-9_-]+):\s*(.*)$/);
    if (nestedMatch && section === "metadata") {
      const key = nestedMatch[1];
      const value = stripYamlValue(nestedMatch[2]);
      if (value) {
        result.metadata[key] = value;
      }
    }
  }

  if (
    !result.name &&
    !result.description &&
    result.compatibility.length === 0 &&
    Object.keys(result.metadata).length === 0
  ) {
    return null;
  }

  return result;
}

function stripYamlValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}
