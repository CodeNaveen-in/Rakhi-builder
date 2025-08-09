
import React from 'react';
import { RakhiShape, RakhiText } from '../types';
import { Icon } from './Icon';

interface LayersPanelProps {
  elements: Array<RakhiShape | RakhiText>;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onDeleteElement: (id: string) => void;
  onReorderElement: (id: string, direction: 'up' | 'down') => void;
}

const getElementInfo = (element: RakhiShape | RakhiText) => {
  if ('type' in element) { // is RakhiShape
    switch(element.type) {
      case 'circle':
        return { iconPath: "M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z", label: "Circle" };
      case 'rect':
        return { iconPath: "M4 4h16v16H4z", label: "Rectangle" };
    }
  } else { // is RakhiText
    return { iconPath: "M9.91,15.5H14.09L15,12.75H9ZM12,3,8.75,11.25H15.25ZM10.5,6.5,12,3.4,13.5,6.5ZM7.25,21,3,12.75H6.5Z", label: element.content.substring(0, 15) + (element.content.length > 15 ? '...' : '') };
  }
};

export const LayersPanel: React.FC<LayersPanelProps> = ({
  elements,
  selectedElementId,
  onSelectElement,
  onDeleteElement,
  onReorderElement,
}) => {
  // Render in reverse order so top-most element is at the top of the list
  const reversedElements = [...elements].reverse();

  return (
    <div className="p-3 space-y-1">
      {reversedElements.length === 0 ? (
         <p className="text-xs text-gray-500 p-2">Add an element to start.</p>
      ) : (
        reversedElements.map((el, revIndex) => {
            const isSelected = el.id === selectedElementId;
            const originalIndex = elements.length - 1 - revIndex;
            const info = getElementInfo(el);

            return (
                <div
                    key={el.id}
                    onClick={() => onSelectElement(el.id)}
                    className={`flex items-center justify-between p-2 rounded cursor-pointer ${isSelected ? 'bg-blue-100 ring-1 ring-blue-300' : 'hover:bg-gray-100'}`}
                >
                    <div className="flex items-center space-x-2 truncate">
                        <Icon path={info.iconPath} className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="text-sm truncate font-medium">{info.label}</span>
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0">
                       <button
                           onClick={(e) => { e.stopPropagation(); onReorderElement(el.id, 'up'); }}
                           disabled={originalIndex === elements.length - 1}
                           className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                           aria-label="Move Up"
                        >
                           <Icon path="M4.5 15.75l7.5-7.5 7.5 7.5" className="w-4 h-4" />
                       </button>
                       <button
                           onClick={(e) => { e.stopPropagation(); onReorderElement(el.id, 'down'); }}
                           disabled={originalIndex === 0}
                           className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                           aria-label="Move Down"
                        >
                           <Icon path="M19.5 8.25l-7.5 7.5-7.5-7.5" className="w-4 h-4" />
                       </button>
                        <button
                           onClick={(e) => { e.stopPropagation(); onDeleteElement(el.id); }}
                           className="p-1 rounded hover:bg-red-200"
                           aria-label="Delete Element"
                        >
                           <Icon path="M14.74,8l-1-1L12,8.74,10.26,7,9.26,8,11,9.74,9.26,11.5,10.26,12.5,12,10.76,13.74,12.5,14.74,11.5,13,9.74ZM12,2A10,10,0,1,0,22,12,10,10,0,0,0,12,2Zm0,18a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" className="w-4 h-4 text-red-600" />
                       </button>
                    </div>
                </div>
            )
        })
      )}
    </div>
  );
};
