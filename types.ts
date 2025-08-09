export interface RakhiElement {
  id: string;
  x: number;
  y: number;
}

export interface RakhiShape extends RakhiElement {
  type: 'circle' | 'rect';
  width: number;
  height: number;
  fill: string; // Can be a color or a pattern url e.g., 'url(#patternId)'
  stroke: string;
  strokeWidth: number;
  rotation: number;
}

export interface RakhiText extends RakhiElement {
  content: string;
  fill: string;
  fontSize: number;
  fontFamily: string;
}

export type RopeType = 'thread' | 'chain' | 'beads';
export type RopeEndType = 'tassel' | 'metal-lock';

export interface RopeStyle {
  type: RopeType;
  color: string;
  endType: RopeEndType;
  curvature: number;
}

export interface SvgPattern {
  id:string;
  svgString: string;
}

export interface RakhiDesign {
  elements: Array<RakhiShape | RakhiText>;
  rope: RopeStyle;
  patterns: SvgPattern[];
  canvasWidth: number;
  canvasHeight: number;
}