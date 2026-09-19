export function languageForPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    mdx: 'markdown',
    css: 'css',
    scss: 'scss',
    html: 'html',
    htm: 'html',
    yaml: 'yaml',
    yml: 'yaml',
    rs: 'rust',
    py: 'python',
    go: 'go',
    sql: 'sql',
    sh: 'shell',
    toml: 'toml',
    xml: 'xml',
    svg: 'xml'
  };
  return map[ext] || 'plaintext';
}
