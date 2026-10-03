import { describe, it, expect } from 'vitest';
import {
  getStereogramDownloadFilename,
  generatePrintHtml,
} from '../exportUtils.ts';

describe('exportUtils', () => {
  describe('getStereogramDownloadFilename', () => {
    it('generates correct filename for studio stereogram', () => {
      const filename = getStereogramDownloadFilename({
        patternType: 'sand',
        appMode: 'studio',
        width: 1200,
        height: 900,
      });
      expect(filename).toBe('stereocraft-sand-1200x900.png');
    });

    it('generates correct filename for depth map export', () => {
      const filename = getStereogramDownloadFilename({
        appMode: 'studio',
        width: 800,
        height: 600,
        isDepthMap: true,
      });
      expect(filename).toBe('stereocraft-depthmap-800x600.png');
    });

    it('generates correct filename for labyrinth stereogram', () => {
      const filename = getStereogramDownloadFilename({
        patternType: 'granite',
        appMode: 'labyrinth',
        width: 1920,
        height: 1080,
        level: 3,
      });
      expect(filename).toBe('stereocraft-labyrinth-level3-1920x1080.png');
    });
  });

  describe('generatePrintHtml', () => {
    it('generates valid print document with landscape orientation and instructions', () => {
      const html = generatePrintHtml({
        dataUrl: 'data:image/png;base64,mockImageData',
        title: 'StereoCraft 3D Stereogram',
        patternName: 'Desert Sand',
        viewingMode: 'parallel',
        dimensions: { width: 1200, height: 900 },
        includeTitle: true,
        includeInstructions: true,
        orientation: 'landscape',
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('size: landscape');
      expect(html).toContain('data:image/png;base64,mockImageData');
      expect(html).toContain('StereoCraft 3D Stereogram');
      expect(html).toContain('Desert Sand');
      expect(html).toContain('1200×900');
      expect(html).toContain('wall-eyed divergence');
    });

    it('adapts viewing instructions for cross-eyed convergent mode', () => {
      const html = generatePrintHtml({
        dataUrl: 'data:image/png;base64,mockImageData',
        patternName: 'Neon Confetti',
        viewingMode: 'cross-eyed',
        includeTitle: true,
        includeInstructions: true,
        orientation: 'portrait',
      });

      expect(html).toContain('size: portrait');
      expect(html).toContain('Cross your eyes');
    });

    it('omits title and instructions when toggled off', () => {
      const html = generatePrintHtml({
        dataUrl: 'data:image/png;base64,mockImageData',
        includeTitle: false,
        includeInstructions: false,
        orientation: 'landscape',
      });

      expect(html).not.toContain('header-text');
      expect(html).not.toContain('footer-instructions');
      expect(html).toContain('data:image/png;base64,mockImageData');
    });
  });
});
