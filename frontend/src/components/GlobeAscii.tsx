import { useEffect, useRef } from 'react';

// ASCII shade palettes keyed by z-depth index (0=edge, 7=centre-face)
const LAND_CHARS  = [',', '.', ':', ';', '+', '*', '#', '@'];
const OCEAN_CHARS = [' ', ' ', ' ', '.', '.', ',', ',', ';'];

interface Props {
  cols?:  number;
  rows?:  number;
  speed?: number; // radians per frame
}

export default function GlobeAscii({ cols = 48, rows = 24, speed = 0.004 }: Props) {
  const preRef    = useRef<HTMLPreElement>(null);
  const thetaRef  = useRef(0);
  const rafRef    = useRef<number>(0);
  // Will hold the rasterised land-mask after the image loads
  const maskRef   = useRef<Uint8ClampedArray | null>(null);
  const maskW     = useRef(0);
  const maskH     = useRef(0);

  // ── Load world map image → offscreen canvas → pixel buffer ──────────────
  useEffect(() => {
    const img = new Image();
    img.src = '/world_mask.png';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      maskRef.current = data;       // RGBA array
      maskW.current   = width;
      maskH.current   = height;
    };
  }, []);

  // ── Pixel lookup: is (latDeg, lngDeg) land? ─────────────────────────────
  const isLand = (latDeg: number, lngDeg: number): boolean => {
    const data = maskRef.current;
    if (!data) return false;

    const w = maskW.current;
    const h = maskH.current;

    // Normalise lng to [0, 360)
    const lng = ((lngDeg % 360) + 360) % 360;
    // Equirectangular: x = lng/360 * w,  y = (90-lat)/180 * h
    const x = Math.floor((lng / 360) * w) % w;
    const y = Math.floor(((90 - latDeg) / 180) * h);
    const cy = Math.max(0, Math.min(h - 1, y));

    const idx = (cy * w + x) * 4; // RGBA offset
    // Image is white-land / black-ocean; check the red channel
    return data[idx] > 128;
  };

  // ── Render loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    const render = () => {
      const theta = thetaRef.current;
      const lines: string[] = [];

      for (let row = 0; row < rows; row++) {
        let line = '';
        // cy ∈ [+1 (top=90N) .. -1 (bottom=90S)]
        const cy = 1 - (2 * (row + 0.5)) / rows;

        for (let col = 0; col < cols; col++) {
          const cx = -1 + (2 * (col + 0.5)) / cols;
          const r2 = cx * cx + cy * cy;

          if (r2 > 1) { line += ' '; continue; }

          // Front-face depth [0..1] (0=limb, 1=dead centre)
          const cz = Math.sqrt(1 - r2);

          // Back-project to geographic coords
          // Sphere convention: x=cosφ·cosλ, y=sinφ, z=cosφ·sinλ
          // Screen maps: screenX←x, screenY←−y, depth←z
          const phi    = Math.asin(Math.max(-1, Math.min(1, -cy)));
          const lambda = Math.atan2(cz, cx) - theta;

          const latDeg = phi    * (180 / Math.PI);
          const lngDeg = lambda * (180 / Math.PI);

          const land = isLand(latDeg, lngDeg);
          const idx  = Math.floor(cz * (LAND_CHARS.length - 1));
          line += land ? LAND_CHARS[idx] : OCEAN_CHARS[idx];
        }
        lines.push(line);
      }

      if (preRef.current) preRef.current.textContent = lines.join('\n');
      thetaRef.current += speed;
      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cols, rows, speed]);

  return (
    <pre
      ref={preRef}
      aria-hidden
      style={{
        fontFamily:    '"JetBrains Mono", "Courier New", monospace',
        fontSize:      11,
        lineHeight:    '13px',
        letterSpacing: '0.05em',
        color:         'var(--text-muted)',
        userSelect:    'none',
        whiteSpace:    'pre',
        opacity:       0.9,
      }}
    />
  );
}
