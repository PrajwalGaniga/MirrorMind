import React, { useEffect, useRef } from 'react';

/**
 * NovaAvatar3D — Interactive Holographic Assistant Avatar
 * Renders an interactive 3D orb with orbital particle rings, inner glowing core,
 * and ambient aura reacting to assistant states (idle, listening, processing, speaking).
 */
export default function NovaAvatar3D({
  state = 'idle', // 'idle' | 'listening' | 'processing' | 'speaking'
  size = 180,
  onClick,
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let isRunning = true;
    let angle = 0;
    let pulse = 0;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    // Generate fixed particle sphere points
    const particleCount = 42;
    const particles = [];
    for (let i = 0; i < particleCount; i++) {
      const theta = Math.acos(2 * (i / particleCount) - 1);
      const phi = Math.sqrt(particleCount * Math.PI) * theta;
      particles.push({
        x: Math.sin(theta) * Math.cos(phi),
        y: Math.sin(theta) * Math.sin(phi),
        z: Math.cos(theta),
        baseRadius: 36 + (i % 5) * 4,
        speed: 0.008 + (i % 3) * 0.004,
      });
    }

    const render = () => {
      if (!isRunning) return;

      const currentState = stateRef.current;
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;

      // Speed and glow based on state
      let speedMult = 1.0;
      let glowColor = 'rgba(37, 99, 235, 0.25)'; // Royal Blue
      let coreColor = 'rgba(59, 130, 246, 0.85)';

      if (currentState === 'listening') {
        speedMult = 1.6;
        glowColor = 'rgba(16, 185, 129, 0.35)'; // Emerald/Cyan
        coreColor = 'rgba(52, 211, 153, 0.95)';
      } else if (currentState === 'processing') {
        speedMult = 2.4;
        glowColor = 'rgba(147, 51, 234, 0.35)'; // Purple shimmer
        coreColor = 'rgba(168, 85, 247, 0.95)';
      } else if (currentState === 'speaking') {
        speedMult = 1.8;
        glowColor = 'rgba(56, 189, 248, 0.40)'; // Electric Sky Blue
        coreColor = 'rgba(14, 165, 233, 0.95)';
      }

      angle += 0.012 * speedMult;
      pulse += 0.035 * speedMult;

      const pulseScale = 1.0 + Math.sin(pulse) * 0.06;

      // 1. Outer ambient radial glow
      const bgGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, size * 0.48);
      bgGrad.addColorStop(0, glowColor);
      bgGrad.addColorStop(0.7, glowColor.replace(/[\d\.]+\)$/, '0.08)'));
      bgGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.48, 0, Math.PI * 2);
      ctx.fill();

      // 2. Orbital rings (3D tilted perspective)
      ctx.save();
      ctx.translate(cx, cy);

      const rings = [
        { rx: 50 * pulseScale, ry: 20 * pulseScale, rot: angle * 0.8, color: 'rgba(37, 99, 235, 0.4)' },
        { rx: 56 * pulseScale, ry: 24 * pulseScale, rot: -angle * 0.6 + 0.8, color: 'rgba(56, 189, 248, 0.35)' },
        { rx: 62 * pulseScale, ry: 18 * pulseScale, rot: angle * 0.4 + 1.6, color: 'rgba(99, 102, 241, 0.3)' },
      ];

      rings.forEach((r) => {
        ctx.save();
        ctx.rotate(r.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, r.rx, r.ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      });

      // 3. Central pulsing glowing core
      const coreGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 28 * pulseScale);
      coreGrad.addColorStop(0, '#FFFFFF');
      coreGrad.addColorStop(0.35, coreColor);
      coreGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 28 * pulseScale, 0, Math.PI * 2);
      ctx.fill();

      // 4. Rotating constellation particles
      particles.forEach((p, idx) => {
        const rad = p.baseRadius * pulseScale;
        const currentAngle = angle * (idx % 2 === 0 ? 1 : -1) + (idx * Math.PI) / (particleCount / 2);
        const px = Math.cos(currentAngle) * rad * p.x;
        const py = Math.sin(currentAngle) * (rad * 0.6) * p.y;
        const pSize = 1.8 + (Math.sin(angle + idx) + 1) * 0.8;

        ctx.fillStyle = idx % 3 === 0 ? '#FFFFFF' : 'rgba(191, 219, 254, 0.9)';
        ctx.beginPath();
        ctx.arc(px, py, pSize, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [size]);

  return (
    <div
      onClick={onClick}
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: size,
          height: size,
        }}
      />
    </div>
  );
}
