import fs from 'node:fs';
import path from 'node:path';
import {
  DesignAssetItem,
  ColorToken,
  TypographySample,
  DesignOverview
} from '@agentic/shared-contracts';

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.bmp']);
const SVG_EXTS = new Set(['.svg']);
const FONT_EXTS = new Set(['.woff2', '.woff', '.ttf', '.otf']);

export class DesignAssetsService {
  async getOverview(repoPaths: string[]): Promise<DesignOverview> {
    const assets: DesignAssetItem[] = [];
    const colorCounts = new Map<string, number>();

    const scanDir = (dir: string, baseDir: string, depth = 0) => {
      if (depth > 5 || !fs.existsSync(dir)) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (
            entry.name.startsWith('.') ||
            entry.name === 'node_modules' ||
            entry.name === 'target' ||
            entry.name === 'dist' ||
            entry.name === 'build'
          ) {
            continue;
          }

          const fullPath = path.join(dir, entry.name);
          if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            const rel = path.relative(baseDir, fullPath);

            let type: 'image' | 'svg' | 'font' | null = null;
            if (IMAGE_EXTS.has(ext)) type = 'image';
            else if (SVG_EXTS.has(ext)) type = 'svg';
            else if (FONT_EXTS.has(ext)) type = 'font';

            if (type) {
              const stat = fs.statSync(fullPath);
              assets.push({
                id: `${rel}-${stat.size}`,
                name: entry.name,
                path: fullPath,
                relativePath: rel,
                type,
                size: stat.size,
                ext
              });
            }

            // Extract colors from css, svg, html, json files
            if (['.css', '.svg', '.html', '.json', '.tsx', '.jsx'].includes(ext)) {
              if (fs.statSync(fullPath).size < 500000) {
                try {
                  const content = fs.readFileSync(fullPath, 'utf8');
                  const hexMatches = content.match(/#(?:[0-9a-fA-F]{3,4}){1,2}\b/g);
                  if (hexMatches) {
                    for (const rawHex of hexMatches) {
                      const hex = rawHex.toUpperCase();
                      colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
                    }
                  }
                } catch {}
              }
            }
          } else if (entry.isDirectory()) {
            scanDir(fullPath, baseDir, depth + 1);
          }
        }
      } catch {
        // ignore permission errors
      }
    };

    for (const repo of repoPaths) {
      scanDir(repo, repo, 0);
    }

    // Top 24 colors sorted by frequency
    const colors: ColorToken[] = Array.from(colorCounts.entries())
      .map(([hex, count]) => ({ hex, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 24);

    const typography: TypographySample[] = [
      {
        name: 'System Interface',
        family: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
        weight: '400 / 600',
        sample: 'The quick brown fox jumps over the lazy dog 1234567890'
      },
      {
        name: 'Monospace Code',
        family: '"SF Mono", "JetBrains Mono", Menlo, Monaco, monospace',
        weight: '400 / 500',
        sample: 'const agent = new LocalEngine({ isolation: "worktree" });'
      },
      {
        name: 'Display Serif',
        family: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
        weight: '600 / 700',
        sample: 'Elevating human and machine creative collaboration.'
      }
    ];

    const imageCount = assets.filter((a) => a.type === 'image').length;
    const svgCount = assets.filter((a) => a.type === 'svg').length;
    const fontCount = assets.filter((a) => a.type === 'font').length;

    return {
      assets,
      colors,
      typography,
      stats: {
        images: imageCount,
        svgs: svgCount,
        fonts: fontCount,
        colors: colors.length
      }
    };
  }

  async readAsset(filePath: string): Promise<{ dataUrl: string; text?: string }> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Asset not found: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    const buffer = fs.readFileSync(filePath);

    let mime = 'application/octet-stream';
    if (ext === '.png') mime = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
    else if (ext === '.webp') mime = 'image/webp';
    else if (ext === '.gif') mime = 'image/gif';
    else if (ext === '.svg') mime = 'image/svg+xml';
    else if (ext === '.woff2') mime = 'font/woff2';
    else if (ext === '.woff') mime = 'font/woff';
    else if (ext === '.ttf') mime = 'font/ttf';

    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mime};base64,${base64}`;

    let text: string | undefined;
    if (ext === '.svg') {
      text = buffer.toString('utf8');
    }

    return {
      dataUrl,
      text
    };
  }
}
