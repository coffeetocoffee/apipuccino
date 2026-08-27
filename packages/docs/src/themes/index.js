/**
 * Themes: CSS vars, data-theme, localStorage + prefers-color-scheme, no flash
 * Inline script in <head> to avoid FOUC
 */
export const themes = ["default","dark","monokai","nord"];
export const themeToggleScript = `(() => { const t=localStorage.getItem("apipuccino-theme") || (matchMedia("(prefers-color-scheme:dark)").matches?"dark":"default"); document.documentElement.dataset.theme=t; })();`;
