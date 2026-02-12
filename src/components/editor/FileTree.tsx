import { useState } from "react";
import { FileNode } from "@/types";

interface FileTreeProps {
  root: FileNode;
  selectedPath: string;
  onSelectFile: (path: string) => void;
}

export function FileTree({ root, selectedPath, onSelectFile }: FileTreeProps) {
  return (
    <div style={{
      width: 200,
      overflow: "auto",
      flexShrink: 0,
    }}>
      <TreeNode
        node={root}
        selectedPath={selectedPath}
        onSelectFile={onSelectFile}
        level={0}
      />
    </div>
  );
}

interface TreeNodeProps {
  node: FileNode;
  selectedPath: string;
  onSelectFile: (path: string) => void;
  level: number;
}

function TreeNode({ node, selectedPath, onSelectFile, level }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(level === 0);
  const isSelected = selectedPath === node.path;

  const handleClick = () => {
    if (node.is_dir) {
      setExpanded(!expanded);
    } else {
      onSelectFile(node.path);
    }
  };

  return (
    <div>
      <div
        onClick={handleClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 8px",
          paddingLeft: 8 + level * 12,
          cursor: "pointer",
          backgroundColor: isSelected ? "var(--secondary)" : "transparent",
          color: isSelected ? "var(--foreground)" : "var(--muted-foreground)",
          fontSize: 13,
          userSelect: "none",
        }}
      >
        {node.is_dir ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
            }}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {node.name}
        </span>
      </div>
      {node.is_dir && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
