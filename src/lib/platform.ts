const platform =
  typeof navigator !== "undefined"
    ?  
      navigator.platform || navigator.userAgent
    : "";

export const isMac = /mac|iphone|ipad/i.test(platform);

/** The primary modifier: Cmd on macOS, Ctrl elsewhere. */
export const MOD_KEY_LABEL = isMac ? "⌘" : "Ctrl";
