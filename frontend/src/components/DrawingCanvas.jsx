import { useRef, useEffect, useState, useCallback } from 'react';
import useGraffitiSocket from '../hooks/useGraffitiSocket';

const DrawingCanvas = () => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState('#00FFFF'); // Cyan
  const [brushSize, setBrushSize] = useState(3);
  const [currentStroke, setCurrentStroke] = useState([]);

  // WebSocket for real-time functionality
  const {
    isConnected,
    activeUsers,
    liveCursors,
    drawingHistory,
    sendDrawingStroke,
    sendCursorPosition,
    sendClearCanvas
  } = useGraffitiSocket();

  // Neon color palette
  const neonColors = [
    '#00FFFF', // Cyan
    '#FF00FF', // Magenta
    '#00FF00', // Lime Green
    '#FF0080', // Hot Pink
    '#8000FF', // Purple
    '#FFA500', // Orange
    '#FFFF00', // Yellow
    '#FF0000', // Red
  ];

  // Initialize canvas (runs once)
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Dark background with subtle grid
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid pattern
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;

    const gridSize = 20;
    for (let x = 0; x <= canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.stroke();
    }

    for (let y = 0; y <= canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }, []);

  // Load drawing history when it changes (separate from active drawing)
  useEffect(() => {
    if (drawingHistory.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Clear everything
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Redraw grid
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;

    const gridSize = 20;
    for (let x = 0; x <= canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    for (let y = 0; y <= canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw historical strokes
    drawingHistory.forEach(stroke => {
      if (stroke.points && stroke.points.length > 1) {
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.brushSize || 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Add glow effect
        ctx.shadowColor = stroke.color;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }

        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    });
  }, [drawingHistory]);

  // Get mouse/touch position relative to canvas
  const getCanvasPosition = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  // Drawing functions
  const startDrawing = useCallback((e) => {
    e.preventDefault();
    setIsDrawing(true);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const pos = getCanvasPosition(e);

    // Start new stroke
    setCurrentStroke([pos]);

    // Draw initial point
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, brushSize / 2, 0, 2 * Math.PI);
    ctx.fillStyle = currentColor;
    ctx.fill();

    // Add glow effect
    ctx.shadowColor = currentColor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, brushSize / 2, 0, 2 * Math.PI);
    ctx.fillStyle = currentColor;
    ctx.fill();
    ctx.shadowBlur = 0;
  }, [currentColor, brushSize, getCanvasPosition]);

  const draw = useCallback((e) => {
    e.preventDefault();
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const pos = getCanvasPosition(e);

    // Add point to current stroke
    setCurrentStroke(prev => [...prev, pos]);

    // Draw line segment
    const prevPos = currentStroke[currentStroke.length - 1];

    // Add glow effect
    ctx.shadowColor = currentColor;
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = currentColor;

    ctx.moveTo(prevPos.x, prevPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Send cursor position for live cursor display
    sendCursorPosition(pos.x, pos.y, currentColor);
  }, [isDrawing, currentColor, brushSize, getCanvasPosition, currentStroke, sendCursorPosition]);

  const stopDrawing = useCallback((e) => {
    e.preventDefault();
    if (!isDrawing || currentStroke.length === 0) return;

    setIsDrawing(false);

    // Send completed stroke to server
    const strokeData = {
      points: currentStroke,
      color: currentColor,
      brushSize,
      timestamp: Date.now()
    };

    sendDrawingStroke(strokeData);
    setCurrentStroke([]);
  }, [isDrawing, currentStroke, currentColor, brushSize, sendDrawingStroke]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="border-2 border-cyan-500 rounded-lg cursor-crosshair bg-gray-900"
          style={{
            maxWidth: '100%',
            height: '400px',
            touchAction: 'none'
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        {/* Connection status and user count */}
        <div className="absolute top-2 right-2 flex gap-2">
          <div className={`px-2 py-1 rounded text-xs ${isConnected ? 'bg-green-600' : 'bg-red-600'}`}>
            {isConnected ? '🟢' : '🔴'}
          </div>
          <div className="px-2 py-1 bg-gray-800 rounded text-xs text-cyan-400">
            👥 {activeUsers}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
        {/* Color Palette */}
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 text-sm font-medium">Colors:</span>
          <div className="flex gap-1">
            {neonColors.map((color) => (
              <button
                key={color}
                onClick={() => setCurrentColor(color)}
                className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                  currentColor === color
                    ? 'border-white shadow-lg shadow-current'
                    : 'border-gray-600'
                }`}
                style={{ backgroundColor: color }}
                title={`Select ${color}`}
              />
            ))}
          </div>
        </div>

        {/* Brush Size */}
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 text-sm font-medium">Size:</span>
          <input
            type="range"
            min="1"
            max="20"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-20 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
          />
          <span className="text-gray-400 text-sm w-8">{brushSize}px</span>
        </div>
      </div>

      {/* Instructions */}
      <p className="text-gray-400 text-sm text-center max-w-md">
        Draw with neon colors! Your strokes become part of the permanent graffiti wall.
        {Object.keys(liveCursors).length > 0 && (
          <span className="block mt-1 text-cyan-400">
            👀 {Object.keys(liveCursors).length} other artist{Object.keys(liveCursors).length > 1 ? 's' : ''} drawing now
          </span>
        )}
      </p>
    </div>
  );
};

export default DrawingCanvas;
