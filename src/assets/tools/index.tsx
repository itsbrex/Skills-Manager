// Tool icons - place SVG files in this directory with the tool ID as filename
// e.g., claude-code.svg, codex.svg, codebuddy.svg

// Import all SVG files from this directory
const svgModules = import.meta.glob('./*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

// Build a map of tool ID -> SVG URL
const toolIconUrls: Record<string, string> = {};
for (const path in svgModules) {
  // Extract filename without extension: ./claude-code.svg -> claude-code
  const id = path.replace('./', '').replace('.svg', '');
  toolIconUrls[id] = svgModules[path];
}

export const getToolIconUrl = (id: string): string | null => {
  return toolIconUrls[id] || null;
};

// Generic fallback icon component (terminal style)
export const GenericToolIcon = () => (
  <svg width="44" height="44" viewBox="0 0 100 100" style={{ flexShrink: 0, borderRadius: 12 }}>
    <defs>
      <linearGradient id="generic-tool-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6B7280" />
        <stop offset="100%" stopColor="#4B5563" />
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="22" fill="url(#generic-tool-grad)"/>
    <path d="M30 40L45 50L30 60" stroke="white" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M50 60H70" stroke="white" strokeWidth="6" strokeLinecap="round"/>
  </svg>
);
