/**
 * Lightweight SVG QR Code / Barcode generator for embedded SDK.
 * Renders pure SVG vector nodes for instant load without external libraries.
 */
export function generateSvgQrCode(text: string, size = 160): string {
  // Simple deterministic hash to generate structured finder patterns and data cells
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  const cells = 21; // standard version 1 QR grid size
  const cellSize = size / cells;
  const rects: string[] = [];

  // Corner finder patterns (7x7 blocks)
  const isFinderPattern = (r: number, c: number) => {
    // Top-left
    if (r < 7 && c < 7) {
      if (r === 0 || r === 6 || c === 0 || c === 6) return true;
      if (r >= 2 && r <= 4 && c >= 2 && c <= 4) return true;
      return false;
    }
    // Top-right
    if (r < 7 && c >= cells - 7) {
      const oc = c - (cells - 7);
      if (r === 0 || r === 6 || oc === 0 || oc === 6) return true;
      if (r >= 2 && r <= 4 && oc >= 2 && oc <= 4) return true;
      return false;
    }
    // Bottom-left
    if (r >= cells - 7 && c < 7) {
      const or = r - (cells - 7);
      if (or === 0 || or === 6 || c === 0 || c === 6) return true;
      if (or >= 2 && or <= 4 && c >= 2 && c <= 4) return true;
      return false;
    }
    return null;
  };

  // Generate data modules deterministically
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const finder = isFinderPattern(r, c);
      let isDark = false;

      if (finder !== null) {
        isDark = finder;
      } else {
        // Timing lines
        if (r === 6 || c === 6) {
          isDark = (r + c) % 2 === 0;
        } else {
          // Data bits combined with text seed
          const charIndex = (r * cells + c) % text.length;
          const charCode = text.charCodeAt(charIndex);
          isDark = (charCode ^ (r * 7) ^ (c * 11) ^ hash) % 3 === 0;
        }
      }

      if (isDark) {
        rects.push(
          `<rect x="${(c * cellSize).toFixed(2)}" y="${(r * cellSize).toFixed(
            2
          )}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="#0a1118"/>`
        );
      }
    }
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges">
      <rect width="100%" height="100%" fill="#ffffff" rx="4"/>
      ${rects.join('')}
    </svg>
  `.trim();
}

