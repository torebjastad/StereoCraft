export type ShapeType = 'circle' | 'square' | 'triangle' | 'star' | 'text';

export type DepthProfileType = 'flat' | 'dome' | 'pyramid' | 'beveled';

/** Font choices available to text shapes (resolved to CSS stacks in the browser layer). */
export type TextFontId = 'sans' | 'impact' | 'serif' | 'mono' | 'rounded';

export interface ShapeObject {
  id: string;
  type: ShapeType;
  x: number; // canvas center coordinate
  y: number;
  width: number;
  height: number;
  rotation: number; // in degrees
  depth: number; // 0.0 to 1.0 (0 = background, 1 = closest)
  profile: DepthProfileType;
  starPoints?: number; // for star shapes (default 5)
  innerRadiusRatio?: number; // for star shapes (default 0.5)
  cornerRadius?: number; // for square/rect
  text?: string; // for text shapes; '\n' separates lines
  fontFamily?: TextFontId; // for text shapes (default 'sans')
  fontBold?: boolean; // for text shapes (default true)
  fontItalic?: boolean; // for text shapes (default false)
}

export type PatternType =
  | 'color-noise'
  | 'retro-90s'
  | 'cosmic'
  | 'organic-flow'
  | 'sand'
  | 'emerald-moss'
  | 'ocean-trench'
  | 'volcanic-magma'
  | 'marble-vein'
  | 'custom';

export type EaseOfView = 'easy' | 'medium' | 'hard';

export interface StereogramConfig {
  patternType: PatternType;
  patternPeriod: number; // S: horizontal repetition in pixels (e.g. 100-140)
  maxDisparity: number; // Delta S: maximum disparity shift (e.g. 14-26)
  viewingMode: 'parallel' | 'cross-eyed';
  enableOcclusionRemoval: boolean;
  smoothingRadius: number; // anti-aliasing / edge smoothing (0-3)
  grainSize: number; // dot size: 1, 2, 3, or 4
  showGuideDots: boolean;
  guideDotColor: string;
  customImageData?: ImageData | null;
  easeOfView?: EaseOfView; // 'easy' (0.5x), 'medium' (0.75x), 'hard' (1.0x)
}

export interface CanvasDimensions {
  width: number;
  height: number;
}

export type RevealMode = 'none' | 'peek' | 'wiggle' | 'mesh3d';
