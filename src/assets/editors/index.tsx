import React from "react";

const iconStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  flexShrink: 0,
};

export const VSCodeIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <path d="M17.5 0L24 5.5V18.5L17.5 24L0 12L5 7.5L17.5 16V8L0 12L17.5 0Z" fill="#007ACC"/>
  </svg>
);

export const CursorIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="currentColor">
    <rect width="24" height="24" rx="4" fill="#1a1a1a"/>
    <path d="M7 6l10 6-10 6V6z" fill="#fff"/>
  </svg>
);

export const WindsurfIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#6366f1"/>
    <path d="M6 18L12 6l6 12H6z" fill="#fff"/>
  </svg>
);

export const ZedIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#000"/>
    <path d="M6 8h12v2H10l8 6H6v-2h8L6 8z" fill="#fff"/>
  </svg>
);

export const SublimeIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#FF9800"/>
    <path d="M6 8l12 4-12 4V8z" fill="#fff"/>
  </svg>
);

export const VimIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#019733"/>
    <path d="M6 6l6 12 6-12H6z" fill="#fff"/>
  </svg>
);

export const NeovimIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#57A143"/>
    <path d="M6 6l6 12 6-12H6z" fill="#fff"/>
  </svg>
);

export const IdeaIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#000"/>
    <circle cx="12" cy="12" r="6" fill="#FC801D"/>
  </svg>
);

export const PyCharmIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#21D789"/>
    <rect x="6" y="6" width="12" height="12" fill="#000"/>
  </svg>
);

export const WebStormIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#00CDD7"/>
    <rect x="6" y="6" width="12" height="12" fill="#000"/>
  </svg>
);

export const XcodeIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#147EFB"/>
    <path d="M6 6l12 12M18 6L6 18" stroke="#fff" strokeWidth="2"/>
  </svg>
);

export const AndroidStudioIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#3DDC84"/>
    <circle cx="12" cy="10" r="5" fill="#fff"/>
    <rect x="8" y="15" width="8" height="4" rx="1" fill="#fff"/>
  </svg>
);

export const TextMateIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#9B4DCA"/>
    <path d="M7 7h10v2H7V7zm2 4h6v6H9v-6z" fill="#fff"/>
  </svg>
);

export const TerminalIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#000"/>
    <path d="M6 8l4 4-4 4M12 16h6" stroke="#fff" strokeWidth="2"/>
  </svg>
);

export const FinderIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#1C9BEF"/>
    <circle cx="9" cy="10" r="2" fill="#fff"/>
    <circle cx="15" cy="10" r="2" fill="#fff"/>
    <path d="M8 15c2 2 6 2 8 0" stroke="#fff" strokeWidth="2"/>
  </svg>
);

export const BuiltinIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#6366f1"/>
    <path d="M7 7h10v10H7V7z" stroke="#fff" strokeWidth="2" fill="none"/>
    <path d="M9 11h6M9 14h4" stroke="#fff" strokeWidth="1.5"/>
  </svg>
);

export const editorIcons: Record<string, React.FC> = {
  vscode: VSCodeIcon,
  cursor: CursorIcon,
  windsurf: WindsurfIcon,
  zed: ZedIcon,
  sublime: SublimeIcon,
  vim: VimIcon,
  neovim: NeovimIcon,
  idea: IdeaIcon,
  pycharm: PyCharmIcon,
  webstorm: WebStormIcon,
  xcode: XcodeIcon,
  "android-studio": AndroidStudioIcon,
  textmate: TextMateIcon,
  terminal: TerminalIcon,
  finder: FinderIcon,
  builtin: BuiltinIcon,
};

export const getEditorIcon = (id: string): React.FC => {
  return editorIcons[id] || BuiltinIcon;
};
