/** Strip ANSI escape sequences from terminal output */
export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\].*?\x07/g, '');
}

/** Prepare agent terminal output for text-to-speech */
export function filterSpeechText(raw: string): string {
  let text = stripAnsi(raw);

  // Remove fenced code blocks
  text = text.replace(/```[\s\S]*?```/g, ' ');

  // Remove inline code
  text = text.replace(/`[^`]+`/g, ' ');

  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // Skip if mostly non-speech (paths, json blobs)
  if (text.length < 3) return '';
  if (/^[\d\s%\-_.:/\\]+$/.test(text)) return '';
  if (/^[\w./~\\-]+$/.test(text) && (text.includes('/') || text.includes('\\'))) return '';

  // Cap length for TTS
  return text.slice(0, 800);
}
