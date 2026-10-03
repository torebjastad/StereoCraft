/**
 * Export and Print Utilities for StereoCraft
 * Supports downloading full-resolution stereograms as PNG and sending formatted sheets directly to printers.
 */

export interface ExportFilenameOptions {
  patternType?: string;
  appMode?: 'studio' | 'labyrinth';
  width: number;
  height: number;
  level?: number;
  isDepthMap?: boolean;
}

export interface PrintOptions {
  dataUrl: string;
  title?: string;
  patternName?: string;
  viewingMode?: 'parallel' | 'cross-eyed';
  dimensions?: { width: number; height: number };
  includeTitle?: boolean;
  includeInstructions?: boolean;
  orientation?: 'landscape' | 'portrait';
}

export interface PrintStereogramOptions extends Omit<PrintOptions, 'dataUrl'> {
  canvas: HTMLCanvasElement;
}

/**
 * Generates standardized, descriptive download filenames
 */
export function getStereogramDownloadFilename(options: ExportFilenameOptions): string {
  const { patternType, appMode = 'studio', width, height, level, isDepthMap } = options;

  if (isDepthMap) {
    return `stereocraft-depthmap-${width}x${height}.png`;
  }

  if (appMode === 'labyrinth') {
    const lvlPart = level !== undefined ? `-level${level}` : '';
    return `stereocraft-labyrinth${lvlPart}-${width}x${height}.png`;
  }

  const patternPart = patternType ? `-${patternType}` : '';
  return `stereocraft${patternPart}-${width}x${height}.png`;
}

/**
 * Downloads a canvas element as a PNG image file
 */
export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): void {
  if (typeof canvas.toBlob === 'function') {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = filename;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }, 'image/png');
  } else {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Generates an isolated, print-optimized HTML string for the stereogram
 */
export function generatePrintHtml(options: PrintOptions): string {
  const {
    dataUrl,
    title = 'StereoCraft 3D Stereogram',
    patternName = 'Custom Pattern',
    viewingMode = 'parallel',
    dimensions,
    includeTitle = true,
    includeInstructions = true,
    orientation = 'landscape',
  } = options;

  const modeLabel = viewingMode === 'parallel' ? 'Parallel Viewing (Divergent)' : 'Cross-Eyed Viewing (Convergent)';
  const dimLabel = dimensions ? ` • ${dimensions.width}×${dimensions.height}` : '';

  const instructionsText =
    viewingMode === 'cross-eyed'
      ? "Cross your eyes slowly until the two convergence guide dots at the top duplicate and fuse into three dots. Focus your gaze steadily on the center fused dot until it becomes sharp, and the 3D scene will pop out with lifelike stereoscopic depth!"
      : "Hold this page about 30–40 cm away. Relax your vision and gaze 'through' the paper into the distance (wall-eyed divergence). The two guide dots at the top will duplicate and fuse into three dots. Focus on the central fused dot until it becomes sharp, and the 3D scene will materialize into deep perspective!";

  const hasHeader = includeTitle;
  const hasFooter = includeInstructions;
  const imgMaxHeight = hasHeader && hasFooter ? '74vh' : hasHeader || hasFooter ? '82vh' : '92vh';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    @page {
      size: ${orientation};
      margin: 8mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #ffffff !important;
      color: #0f172a !important;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: 4px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-page {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    ${
      hasHeader
        ? `
    .header-text {
      margin-bottom: 8px;
    }
    h1 {
      font-size: 16pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
    }
    .meta-text {
      font-size: 9pt;
      font-weight: 500;
      color: #64748b;
      margin-top: 2px;
    }
    `
        : ''
    }
    .image-container {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      margin: 4px 0;
    }
    img {
      max-width: 100%;
      max-height: ${imgMaxHeight};
      object-fit: contain;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    ${
      hasFooter
        ? `
    .footer-instructions {
      margin-top: 8px;
      max-width: 650px;
      font-size: 8.5pt;
      line-height: 1.4;
      color: #334155;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 12px;
    }
    .instructions-title {
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 2px;
    }
    `
        : ''
    }
  </style>
</head>
<body>
  <div class="print-page">
    ${
      hasHeader
        ? `
    <div class="header-text">
      <h1>${title}</h1>
      <p class="meta-text">${modeLabel} • ${patternName}${dimLabel}</p>
    </div>
    `
        : ''
    }
    <div class="image-container">
      <img src="${dataUrl}" alt="StereoCraft 3D Stereogram" />
    </div>
    ${
      hasFooter
        ? `
    <div class="footer-instructions">
      <div class="instructions-title">👁️ How to View this 3D Autostereogram</div>
      <div>${instructionsText}</div>
    </div>
    `
        : ''
    }
  </div>
</body>
</html>`;
}

/**
 * Sends a stereogram canvas directly to the browser print dialog using an isolated print iframe
 */
export function printStereogram(options: PrintStereogramOptions): void {
  const { canvas, orientation } = options;
  if (!canvas) return;

  // Auto-detect orientation if not explicitly provided
  const detectedOrientation = orientation || (canvas.width >= canvas.height ? 'landscape' : 'portrait');

  const dataUrl = canvas.toDataURL('image/png');
  const html = generatePrintHtml({
    ...options,
    dataUrl,
    orientation: detectedOrientation,
  });

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const img = doc.querySelector('img');
  const triggerPrint = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Failed to invoke print dialog:', err);
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 60000);
      }
    }, 250);
  };

  if (img) {
    if (img.complete) {
      triggerPrint();
    } else {
      img.onload = triggerPrint;
      img.onerror = triggerPrint;
    }
  } else {
    triggerPrint();
  }
}
