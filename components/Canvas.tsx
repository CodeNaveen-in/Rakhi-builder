
import React from 'react';
import { RakhiDesign, RakhiShape, RakhiText, SvgPattern, RopeStyle } from '../types';

interface CanvasProps {
  design: RakhiDesign;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onElementMouseDown: (elementId: string, e: React.MouseEvent) => void;
  onResizeHandleMouseDown: (elementId: string, handle: string, e: React.MouseEvent) => void;
}

const renderRope = (rope: RopeStyle, width: number, height: number) => {
  const midY = height / 2;
  const controlX = width / 2;
  const controlY = midY + rope.curvature;
  const ropePath = `M0,${midY} Q${controlX},${controlY} ${width},${midY}`;
  const endSize = 15;

  let strokeDasharray: string | undefined;
  if (rope.type === 'chain') {
    strokeDasharray = '10 5';
  } else if (rope.type === 'beads') {
    strokeDasharray = '2 8';
  }

  return (
    <g>
      <path d={ropePath} stroke={rope.color} strokeWidth={rope.type === 'beads' ? 6 : 4} strokeLinecap={rope.type === 'beads' ? 'round' : 'butt'} strokeDasharray={strokeDasharray} fill="none" />
      {rope.endType === 'tassel' && (
        <>
          <path d={`M${endSize},${midY - endSize} L0,${midY} L${endSize},${midY + endSize}`} stroke={rope.color} strokeWidth="2" fill="none" />
          <path d={`M${width - endSize},${midY - endSize} L${width},${midY} L${width - endSize},${midY + endSize}`} stroke={rope.color} strokeWidth="2" fill="none" />
        </>
      )}
      {rope.endType === 'metal-lock' && (
        <>
          <rect x="0" y={midY - 5} width="10" height="10" fill="silver" stroke="gray" />
          <circle cx={width - 5} cy={midY} r="5" fill="silver" stroke="gray" />
        </>
      )}
    </g>
  );
};

const ResizeHandles = ({ element, onResizeHandleMouseDown }: { element: RakhiShape, onResizeHandleMouseDown: (elementId: string, handle: string, e: React.MouseEvent) => void }) => {
    if (element.rotation !== 0) {
        // To keep it simple, we don't show resize handles for rotated objects for now.
        // Implementing rotated resize is significantly more complex.
        return null;
    }

    const { x, y, width, height, id } = element;
    const handleSize = 8;
    const hS2 = handleSize / 2;

    const handles = [
        { id: 'tl', x: x - hS2, y: y - hS2, cursor: 'nwse-resize' },
        { id: 't', x: x + width / 2 - hS2, y: y - hS2, cursor: 'ns-resize' },
        { id: 'tr', x: x + width - hS2, y: y - hS2, cursor: 'nesw-resize' },
        { id: 'l', x: x - hS2, y: y + height / 2 - hS2, cursor: 'ew-resize' },
        { id: 'r', x: x + width - hS2, y: y + height / 2 - hS2, cursor: 'ew-resize' },
        { id: 'bl', x: x - hS2, y: y + height - hS2, cursor: 'nesw-resize' },
        { id: 'b', x: x + width / 2 - hS2, y: y + height - hS2, cursor: 'ns-resize' },
        { id: 'br', x: x + width - hS2, y: y + height - hS2, cursor: 'nwse-resize' },
    ];
    
    return (
        <g>
            <rect x={x} y={y} width={width} height={height} fill="none" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="3 3" />
            {handles.map(handle => (
                <rect
                    key={handle.id}
                    x={handle.x}
                    y={handle.y}
                    width={handleSize}
                    height={handleSize}
                    fill="#0ea5e9"
                    stroke="white"
                    strokeWidth="1"
                    style={{ cursor: handle.cursor }}
                    onMouseDown={(e) => { e.stopPropagation(); onResizeHandleMouseDown(id, handle.id, e); }}
                />
            ))}
        </g>
    );
}


export const Canvas: React.FC<CanvasProps> = ({ design, selectedElementId, onSelectElement, onElementMouseDown, onResizeHandleMouseDown }) => {
  const { elements, rope, patterns, canvasWidth, canvasHeight } = design;

  return (
    <div 
        id="rakhi-canvas-container" 
        className="w-full h-full flex items-center justify-center p-4 bg-gray-200"
        onClick={(e) => {
            if (e.target === e.currentTarget || e.target === e.currentTarget.firstChild) {
                onSelectElement(null);
            }
        }}
    >
      <div id="rakhi-canvas" className="bg-white shadow-lg relative" style={{ width: canvasWidth, height: canvasHeight }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} onClick={(e) => e.stopPropagation()}>
          <defs>
            {patterns.map((p: SvgPattern) => (
              <g key={p.id} dangerouslySetInnerHTML={{ __html: p.svgString }} />
            ))}
          </defs>
          
          {renderRope(rope, canvasWidth, canvasHeight)}

          {elements.map(el => {
            if ('type' in el) { // It's a RakhiShape
              const shape = el as RakhiShape;
              const transform = `translate(${shape.x}, ${shape.y}) rotate(${shape.rotation})`;
              const commonProps = {
                id: shape.id,
                transform,
                fill: shape.fill,
                stroke: shape.stroke,
                strokeWidth: shape.strokeWidth,
                onMouseDown: (e: React.MouseEvent) => { e.stopPropagation(); onElementMouseDown(shape.id, e); },
                onClick: (e: React.MouseEvent) => { e.stopPropagation(); onSelectElement(shape.id); },
                style: { cursor: 'move' },
              };

              if (shape.type === 'circle') {
                return <circle key={shape.id} cx={shape.width/2} cy={shape.height/2} r={Math.min(shape.width, shape.height)/2} {...commonProps} />;
              }
              if (shape.type === 'rect') {
                return <rect key={shape.id} width={shape.width} height={shape.height} {...commonProps} />;
              }
            } else { // It's a RakhiText
              const text = el as RakhiText;
              const textProps = {
                id: text.id,
                x: text.x,
                y: text.y,
                fill: text.fill,
                fontSize: text.fontSize,
                fontFamily: text.fontFamily,
                textAnchor: "middle",
                dominantBaseline: "middle",
                onMouseDown: (e: React.MouseEvent) => { e.stopPropagation(); onElementMouseDown(text.id, e); },
                onClick: (e: React.MouseEvent) => { e.stopPropagation(); onSelectElement(text.id); },
                style: { cursor: 'move' },
              };
              return (
                <text key={text.id} {...textProps}>{text.content}</text>
              );
            }
            return null;
          })}

          {/* Selection Handles */}
          {selectedElementId && (() => {
            const selected = elements.find(e => e.id === selectedElementId);
            if (selected && 'type' in selected) { // is a shape
                return <ResizeHandles element={selected as RakhiShape} onResizeHandleMouseDown={onResizeHandleMouseDown} />;
            }
            if(selected && !('type' in selected)) { // is text
                 const textEl = document.getElementById(selected.id) as unknown as SVGGraphicsElement | null;
                 if (!textEl || typeof textEl.getBBox !== 'function') return null;
                 const bbox = textEl.getBBox();
                 return <rect x={bbox.x} y={bbox.y} width={bbox.width} height={bbox.height} fill="none" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="3 3" />
            }
            return null;
          })()}
        </svg>
      </div>
    </div>
  );
};
