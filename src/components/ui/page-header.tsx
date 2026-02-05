interface PageHeaderProps {
  title: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 32px",
        borderBottom: "1px solid var(--border)",
        backgroundColor: "var(--background)",
        flexShrink: 0,
      }}
    >
      <h1
        style={{
          fontSize: "20px",
          fontWeight: 600,
          color: "var(--foreground)",
          margin: 0,
        }}
      >
        {title}
      </h1>
      {actions && (
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {actions}
        </div>
      )}
    </header>
  );
}
