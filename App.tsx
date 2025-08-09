
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Canvas } from './components/Canvas';
import { SidebarSection } from './components/SidebarSection';
import { Icon } from './components/Icon';
import { LayersPanel } from './components/LayersPanel';
import { generateAiImage } from './services/geminiService';
import { RakhiDesign, RakhiShape, RakhiText, RopeType, RopeEndType, SvgPattern, RakhiElement } from './types';

// html-to-image is loaded from index.html
declare const htmlToImage: any;

const INITIAL_DESIGN: RakhiDesign = {
  elements: [
    { id: 'shape-1', type: 'circle', x: 225, y: 75, width: 150, height: 150, fill: '#fde047', stroke: '#f59e0b', strokeWidth: 4, rotation: 0 },
  ],
  rope: {
    type: 'thread',
    color: '#dc2626',
    endType: 'tassel',
    curvature: 0,
  },
  patterns: [],
  canvasWidth: 600,
  canvasHeight: 300,
};

type InteractionState = 
  | { type: 'drag'; elementId: string; startX: number; startY: number; elementStartX: number; elementStartY: number; }
  | { type: 'resize'; elementId: string; handle: string; startX: number; startY: number; elementStartRect: {x:number, y:number, width:number, height:number, rotation: number} }
  | null;

const App: React.FC = () => {
  const [history, setHistory] = useState<RakhiDesign[]>([INITIAL_DESIGN]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>('shape-1');
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [interaction, setInteraction] = useState<InteractionState>(null);

  const currentDesign = history[historyIndex];
  
  const updateDesign = useCallback((newDesign: RakhiDesign, keepSelection: boolean = false) => {
    const newHistory = history.slice(0, historyIndex + 1);
    setHistory([...newHistory, newDesign]);
    setHistoryIndex(newHistory.length);
    setError(null);
    if (!keepSelection && !newDesign.elements.find(e => e.id === selectedElementId)) {
        setSelectedElementId(null);
    }
  }, [history, historyIndex, selectedElementId]);
  
  const undo = () => {
    if (historyIndex > 0) setHistoryIndex(historyIndex - 1);
  };

  const redo = () => {
    if (historyIndex < history.length - 1) setHistoryIndex(historyIndex + 1);
  };
  
  const selectedElement = useMemo(() => 
    currentDesign.elements.find(el => el.id === selectedElementId),
    [currentDesign, selectedElementId]
  );
  
  const updateElement = useCallback((id: string, updates: Partial<RakhiShape & RakhiText>) => {
    const newElements = currentDesign.elements.map(el =>
      el.id === id ? { ...el, ...updates } : el
    ) as Array<RakhiShape | RakhiText>;
    // This updates the current view without creating a new history entry.
    // The history gets a new entry only when the interaction is finished.
    const newHistory = [...history];
    newHistory[historyIndex] = { ...currentDesign, elements: newElements };
    setHistory(newHistory);
  }, [currentDesign, history, historyIndex]);

  const commitChanges = useCallback(() => {
    const newHistory = history.slice(0, historyIndex);
    setHistory([...newHistory, currentDesign]);
    setHistoryIndex(newHistory.length);
  }, [currentDesign, history, historyIndex]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!interaction) return;

      const canvasRect = document.getElementById('rakhi-canvas')?.getBoundingClientRect();
      if (!canvasRect) return;

      const mouseX = e.clientX - canvasRect.left;
      const mouseY = e.clientY - canvasRect.top;
      const deltaX = mouseX - interaction.startX;
      const deltaY = mouseY - interaction.startY;

      if (interaction.type === 'drag') {
        updateElement(interaction.elementId, { 
          x: interaction.elementStartX + deltaX,
          y: interaction.elementStartY + deltaY
        });
      } else if (interaction.type === 'resize') {
        const { elementId, handle, elementStartRect } = interaction;
        let { x, y, width, height } = elementStartRect;
        
        // Horizontal resizing
        if (handle.includes('l')) {
          width -= deltaX;
          x += deltaX;
        } else if (handle.includes('r')) {
          width += deltaX;
        }

        // Vertical resizing
        if (handle.includes('t')) {
          height -= deltaY;
          y += deltaY;
        } else if (handle.includes('b')) {
          height += deltaY;
        }
        
        // Prevent shape inversion
        width = Math.max(10, width);
        height = Math.max(10, height);

        updateElement(elementId, { x, y, width, height });
      }
    };

    const handleMouseUp = () => {
      if(interaction) {
        commitChanges(); // Add the final state to history
        setInteraction(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [interaction, updateElement, commitChanges]);


  const handleMouseDownOnElement = (elementId: string, e: React.MouseEvent) => {
    const element = currentDesign.elements.find(el => el.id === elementId);
    if (!element) return;
    
    const canvasRect = document.getElementById('rakhi-canvas')?.getBoundingClientRect();
    if (!canvasRect) return;

    setInteraction({
      type: 'drag',
      elementId,
      startX: e.clientX - canvasRect.left,
      startY: e.clientY - canvasRect.top,
      elementStartX: element.x,
      elementStartY: element.y
    });
  };
  
  const handleMouseDownOnResizeHandle = (elementId: string, handle: string, e: React.MouseEvent) => {
      const element = currentDesign.elements.find(el => el.id === elementId) as RakhiShape;
      if (!element || !('width' in element)) return;

      const canvasRect = document.getElementById('rakhi-canvas')?.getBoundingClientRect();
      if (!canvasRect) return;

      setInteraction({
        type: 'resize',
        elementId,
        handle,
        startX: e.clientX - canvasRect.left,
        startY: e.clientY - canvasRect.top,
        elementStartRect: { x: element.x, y: element.y, width: element.width, height: element.height, rotation: element.rotation }
      });
  };

  const addElement = (type: 'circle' | 'rect' | 'text') => {
    const newId = `${type}-${Date.now()}`;
    let newElement: RakhiShape | RakhiText;
    if(type === 'text') {
       newElement = {
        id: newId, content: 'Happy Rakhi!', x: 300, y: 50, fill: '#be185d', fontSize: 24, fontFamily: 'Georgia'
      };
    } else {
       newElement = {
        id: newId, type, x: 250, y: 100, width: 100, height: 100, fill: '#86efac', stroke: '#16a34a', strokeWidth: 2, rotation: 0
      };
    }
    updateDesign({ ...currentDesign, elements: [...currentDesign.elements, newElement] });
    setSelectedElementId(newId);
  };
  
  const deleteElement = (idToDelete: string) => {
    const newElements = currentDesign.elements.filter(el => el.id !== idToDelete);
    updateDesign({ ...currentDesign, elements: newElements });
  };

  const reorderElement = (idToMove: string, direction: 'up' | 'down') => {
    const elements = [...currentDesign.elements];
    const index = elements.findIndex(el => el.id === idToMove);
    if (index === -1) return;
    const newIndex = direction === 'up' ? index + 1 : index - 1;
    if (newIndex < 0 || newIndex >= elements.length) return;
    const [movedElement] = elements.splice(index, 1);
    elements.splice(newIndex, 0, movedElement);
    updateDesign({ ...currentDesign, elements }, true);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedElementId) {
      setError("Please select a shape first to apply the texture.");
      return;
    }
    const targetElement = currentDesign.elements.find(el => el.id === selectedElementId && 'type' in el);
    if (!targetElement) {
      setError("Textures can only be applied to shapes.");
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        setError("Could not read image file.");
        return;
      }
      const patternId = `pattern-img-${Date.now()}`;
      const patternSvg = `
        <pattern id="${patternId}" patternContentUnits="objectBoundingBox" width="1" height="1">
          <image href="${dataUrl}" x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid slice" />
        </pattern>
      `;
      const newPattern: SvgPattern = { id: patternId, svgString: patternSvg };

      const newElements = currentDesign.elements.map(el =>
        el.id === selectedElementId ? { ...el, fill: `url(#${patternId})` } : el
      ) as Array<RakhiShape|RakhiText>;

      updateDesign({
          ...currentDesign,
          elements: newElements,
          patterns: [...currentDesign.patterns, newPattern],
      }, true);
    };
    reader.onerror = () => setError("Failed to read image.");
    reader.readAsDataURL(file);
    
    if(event.target) event.target.value = '';
  };

  const handleAiImageApply = async (objectName: string) => {
    if (!selectedElementId) {
        setError("Please select a shape first to apply the image.");
        return;
    }
    const targetElement = currentDesign.elements.find(el => el.id === selectedElementId && 'type' in el) as RakhiShape;
    if (!targetElement) {
        setError("AI Images can only be applied to shapes.");
        return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
        const base64Image = await generateAiImage(objectName);
        const dataUrl = `data:image/png;base64,${base64Image}`;
        
        const patternId = `pattern-ai-${Date.now()}`;
        const patternSvg = `
          <pattern id="${patternId}" patternContentUnits="objectBoundingBox" width="1" height="1">
            <image href="${dataUrl}" x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid slice" />
          </pattern>
        `;
        const newPattern: SvgPattern = { id: patternId, svgString: patternSvg };

        const newElements = currentDesign.elements.map(el =>
            el.id === selectedElementId ? { ...el, fill: `url(#${patternId})` } : el
        ) as Array<RakhiShape|RakhiText>;

        updateDesign({
            ...currentDesign,
            elements: newElements,
            patterns: [...currentDesign.patterns, newPattern],
        }, true);

    } catch (e: any) {
        setError(e.message || 'An unknown error occurred.');
    } finally {
        setIsLoading(false);
    }
  };

  const handleDownloadClick = async () => {
    setError(null);
    setIsDownloading(true);

    // Deselect element to hide handles and wait for the DOM to update
    setSelectedElementId(null);
    await new Promise(resolve => setTimeout(resolve, 50));

    const canvasElement = document.getElementById('rakhi-canvas');
    if (!canvasElement) {
        setError("Canvas element not found.");
        setIsDownloading(false);
        return;
    }

    try {
        const dataUrl = await htmlToImage.toPng(canvasElement, { quality: 1, pixelRatio: 2 });
        const link = document.createElement('a');
        link.download = 'my-rakhi-design.png';
        link.href = dataUrl;
        link.click();
    } catch (err: any) {
        setError('Could not download image. Please try again.');
        console.error('Download error:', err);
    } finally {
        setIsDownloading(false);
    }
};
  
  const renderSelectedElementControls = () => {
    if (!selectedElement) return <p className="text-xs text-gray-500 p-3">Select a layer to edit its properties.</p>;
    const isShape = 'type' in selectedElement;

    // Use a function to commit changes to history for input fields
    const commitFieldUpdate = (id: string, updates: Partial<RakhiShape & RakhiText>) => {
       const newElements = currentDesign.elements.map(el =>
        el.id === id ? { ...el, ...updates } : el
      ) as Array<RakhiShape | RakhiText>;
      updateDesign({ ...currentDesign, elements: newElements }, true);
    }

    return (
        <div className="p-3 space-y-3">
            {isShape && (
                <>
                <label className="block text-xs font-medium text-gray-600">Size (WxH)</label>
                <div className="flex space-x-2">
                    <input type="number" value={Math.round((selectedElement as RakhiShape).width)} onChange={e => updateElement(selectedElement.id, { width: +e.target.value })} onBlur={e => commitFieldUpdate(selectedElement.id, { width: +e.target.value })} className="w-full p-1 border rounded" />
                    <input type="number" value={Math.round((selectedElement as RakhiShape).height)} onChange={e => updateElement(selectedElement.id, { height: +e.target.value })} onBlur={e => commitFieldUpdate(selectedElement.id, { height: +e.target.value })} className="w-full p-1 border rounded" />
                </div>
                <label className="block text-xs font-medium text-gray-600">Rotation</label>
                 <input type="range" min="0" max="360" value={(selectedElement as RakhiShape).rotation} onChange={e => updateElement(selectedElement.id, { rotation: +e.target.value })} onMouseUp={() => commitChanges()} className="w-full" />
                </>
            )}
             {!isShape && (
                <>
                <label className="block text-xs font-medium text-gray-600">Text</label>
                <input type="text" value={(selectedElement as RakhiText).content} onChange={e => updateElement(selectedElement.id, { content: e.target.value })} onBlur={() => commitChanges()} className="w-full p-1 border rounded" />
                <label className="block text-xs font-medium text-gray-600">Font Size</label>
                <input type="number" value={(selectedElement as RakhiText).fontSize} onChange={e => updateElement(selectedElement.id, { fontSize: +e.target.value })} onBlur={() => commitChanges()} className="w-full p-1 border rounded" />
                </>
            )}
            <label className="block text-xs font-medium text-gray-600">Fill Color</label>
            <input type="color" value={(selectedElement).fill.startsWith('url') ? '#ffffff' : selectedElement.fill} onChange={e => updateElement(selectedElement.id, { fill: e.target.value })} onBlur={() => commitChanges()} className="w-full h-8 p-0 border-none rounded cursor-pointer" />
        </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen font-sans bg-gray-100 text-gray-900">
        <main className="flex-1 flex min-h-0 order-1 md:order-2">
            <Canvas 
              design={currentDesign} 
              selectedElementId={selectedElementId} 
              onSelectElement={setSelectedElementId} 
              onElementMouseDown={handleMouseDownOnElement}
              onResizeHandleMouseDown={handleMouseDownOnResizeHandle}
            />
        </main>
        <aside className="w-full md:w-80 md:h-full bg-white shadow-lg flex flex-col md:border-r border-gray-200 order-2 md:order-1">
            <div className="p-4 border-b flex justify-between items-center flex-shrink-0">
                <h1 className="text-xl font-bold text-pink-600">Rakhi Studio</h1>
                <div className="flex space-x-1">
                     <button onClick={undo} disabled={historyIndex === 0} className="p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200" aria-label="Undo"><Icon path="M10.89,7.22a1,1,0,0,0-1.78,0l-3,4A1,1,0,0,0,7,13H8v4a1,1,0,0,0,2,0V13h1a1,1,0,0,0,.89-1.45Z M18.49,12.3A6.5,6.5,0,0,0,8.37,9.52L9.12,8.3A8.5,8.5,0,1,1,6,12a8.41,8.41,0,0,1,.8-3.51L6,7.52A8.5,8.5,0,0,1,5.51,12a6.5,6.5,0,1,0,13-4.82Z" className="w-5 h-5" /></button>
                     <button onClick={redo} disabled={historyIndex === history.length - 1} className="p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200" aria-label="Redo"><Icon path="M21,11a1,1,0,0,0-1,1v4a1,1,0,0,0,2,0V12A1,1,0,0,0,21,11ZM17,12a1,1,0,0,0-1,1v4a1,1,0,0,0,2,0V13A1,1,0,0,0,17,12ZM14.11,6.55A1,1,0,0,0,13,8.09V12a1,1,0,0,0,2,0V8.09A1,1,0,0,0,14.11,6.55ZM10.88,8.3,8.37,9.52A6.5,6.5,0,1,0,18.49,12.3a1,1,0,1,0-1.94-.48,4.5,4.5,0,1,1-7.42-3.83l.88,1.17a1,1,0,0,0,1.78-.9Z" className="w-5 h-5" /></button>
                </div>
            </div>
            
            <div className="flex-grow overflow-y-auto">
                {(isLoading || isDownloading) && <div className="m-3 p-3 bg-blue-100 text-blue-700 text-sm rounded">{isDownloading ? 'Preparing download...' : 'Generating AI Image...'}</div>}
                {error && <div className="m-3 p-3 bg-red-100 text-red-700 text-sm rounded">{error}</div>}

                <SidebarSection title="Layers" defaultOpen>
                   <LayersPanel
                        elements={currentDesign.elements}
                        selectedElementId={selectedElementId}
                        onSelectElement={setSelectedElementId}
                        onDeleteElement={deleteElement}
                        onReorderElement={reorderElement}
                   />
                </SidebarSection>
                <SidebarSection title="Add Elements">
                    <div className="p-3 grid grid-cols-3 gap-2">
                        <button onClick={() => addElement('circle')} className="flex flex-col items-center p-2 space-y-1 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
                            <Icon path="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" className="w-8 h-8 text-indigo-500" />
                            <span>Circle</span>
                        </button>
                        <button onClick={() => addElement('rect')} className="flex flex-col items-center p-2 space-y-1 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
                             <Icon path="M4 4h16v16H4z" className="w-8 h-8 text-green-500" />
                            <span>Square</span>
                        </button>
                        <button onClick={() => addElement('text')} className="flex flex-col items-center p-2 space-y-1 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
                            <Icon path="M9.91,15.5H14.09L15,12.75H9ZM12,3,8.75,11.25H15.25ZM10.5,6.5,12,3.4,13.5,6.5ZM7.25,21,3,12.75H6.5Z" className="w-8 h-8 text-teal-500" />
                            <span>Text</span>
                        </button>
                    </div>
                </SidebarSection>
                <SidebarSection title="Edit Selection" defaultOpen>
                    {renderSelectedElementControls()}
                </SidebarSection>
                <SidebarSection title="AI Pictures (for shapes)">
                    <div className="p-3">
                        <p className="text-xs text-gray-500 mb-2">Select a shape, then pick an object to generate a happy, cartoon-style image for it.</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <button onClick={() => handleAiImageApply("peacock")} className="p-2 bg-green-100 rounded hover:bg-green-200">🦚 Peacock</button>
                            <button onClick={() => handleAiImageApply("lotus flower")} className="p-2 bg-pink-100 rounded hover:bg-pink-200">🌸 Flower</button>
                            <button onClick={() => handleAiImageApply("elephant")} className="p-2 bg-blue-100 rounded hover:bg-blue-200">🐘 Elephant</button>
                            <button onClick={() => handleAiImageApply("diya oil lamp")} className="p-2 bg-yellow-100 rounded hover:bg-yellow-200">🪔 Diya</button>
                        </div>
                        <button onClick={() => fileInputRef.current?.click()} className="mt-3 w-full p-2 bg-gray-200 text-gray-800 text-sm rounded hover:bg-gray-300">Upload Your Own</button>
                    </div>
                </SidebarSection>
                <SidebarSection title="Rope & Ends">
                    <div className="p-3 space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-600">Rope Style</label>
                            <select value={currentDesign.rope.type} onChange={e => updateDesign({...currentDesign, rope: {...currentDesign.rope, type: e.target.value as RopeType}})} className="w-full p-1 mt-1 border rounded text-sm">
                                <option value="thread">Thread</option>
                                <option value="chain">Chain</option>
                                <option value="beads">Beads</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600">Rope Color</label>
                            <input type="color" value={currentDesign.rope.color} onChange={e => updateDesign({...currentDesign, rope: {...currentDesign.rope, color: e.target.value}})} className="w-full h-8 p-0 border-none rounded cursor-pointer" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600">End Style</label>
                            <select value={currentDesign.rope.endType} onChange={e => updateDesign({...currentDesign, rope: {...currentDesign.rope, endType: e.target.value as RopeEndType}})} className="w-full p-1 mt-1 border rounded text-sm">
                                <option value="tassel">Tassel</option>
                                <option value="metal-lock">Metal Lock</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600">Rope Curvature</label>
                            <input type="range" min="-50" max="50" value={currentDesign.rope.curvature} onChange={e => {
                                const newHistory = [...history];
                                newHistory[historyIndex] = {
                                    ...currentDesign,
                                    rope: { ...currentDesign.rope, curvature: +e.target.value }
                                };
                                setHistory(newHistory);
                            }} onMouseUp={() => commitChanges()} className="w-full" />
                        </div>
                    </div>
                </SidebarSection>
            </div>

            <div className="p-3 border-t flex-shrink-0">
                <button onClick={handleDownloadClick} disabled={isDownloading} className="w-full bg-pink-600 text-white px-4 py-2 rounded-md font-semibold text-sm hover:bg-pink-700 transition-colors flex items-center justify-center space-x-2 disabled:bg-pink-400 disabled:cursor-wait">
                    <Icon path="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" className="w-5 h-5" />
                    <span>Download PNG</span>
                </button>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" aria-hidden="true" />
        </aside>
    </div>
  );
};

export default App;
