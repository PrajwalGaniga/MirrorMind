import React, { useEffect, useRef } from 'react';

/**
 * NovaWaveVisualizer — High-Fidelity Fluid Ribbon & Laser Wave Visualizer
 *
 * Implements the organic neon ribbon wave inspired by Google/Gemini Live:
 * - Active state: Flowing harmonic sinusoidal bezier ribbons with neon cyan,
 *   electric blue, and spring green filaments (matches Image 1).
 * - Idle/Quiescent state: Glowing horizontal laser line with central light flare
 *   and gentle breathing ripple (matches Image 2).
 * - Smooth lerping for natural, cinematic response to live audio amplitudes.
 */
export default function NovaWaveVisualizer({
  active = true,
  amplitude = 0,
  speaker = 'idle', // 'user' | 'agent' | 'idle'
  height = 160,
  silenceSeconds = null,
  onEndSession = null,
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  // Smooth interpolated amplitude and phase trackers
  const smoothedAmpRef = useRef(0);
  const phaseRef = useRef(0);
  const flareIntensityRef = useRef(0.5);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    let isRunning = true;

    // Handle high DPI retina displays cleanly
    const resizeCanvas = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Main animation loop (60 FPS)
    const render = () => {
      if (!isRunning) return;

      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const h = height;
      const centerY = h / 2;

      // Smooth amplitude tracking (linear interpolation with decay)
      // Boost input amplitude nonlinearly for dramatic visual responsiveness
      const targetAmp = active ? Math.min(1.0, Math.pow(amplitude * 2.8, 0.85)) : 0;
      smoothedAmpRef.current += (targetAmp - smoothedAmpRef.current) * 0.14;
      const curAmp = smoothedAmpRef.current;

      // Progress animation phase (faster when active voice is speaking)
      const speed = 0.025 + curAmp * 0.045;
      phaseRef.current += speed;
      const phase = phaseRef.current;

      // Pulse flare intensity
      const targetFlare = 0.4 + curAmp * 0.8 + Math.sin(phase * 1.5) * 0.15;
      flareIntensityRef.current += (targetFlare - flareIntensityRef.current) * 0.1;
      const flare = flareIntensityRef.current;

      // ── Clear Canvas with subtle vignette backdrop ──
      ctx.clearRect(0, 0, width, h);

      // Deep atmospheric dark gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, 'rgba(4, 7, 18, 0.95)');
      bgGrad.addColorStop(0.5, 'rgba(2, 4, 11, 0.98)');
      bgGrad.addColorStop(1, 'rgba(4, 7, 18, 0.95)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, h);

      ctx.save();
      // Use 'screen' / 'lighter' for luminous neon layering
      ctx.globalCompositeOperation = 'screen';

      // ── 1. Quiescent Horizontal Laser Line (Image 2 style) ──
      // Subtle background glow along the baseline
      const laserGrad = ctx.createLinearGradient(0, 0, width, 0);
      laserGrad.addColorStop(0, 'rgba(37, 99, 235, 0)');
      laserGrad.addColorStop(0.2, 'rgba(37, 99, 235, 0.4)');
      laserGrad.addColorStop(0.5, 'rgba(0, 242, 254, 0.95)');
      laserGrad.addColorStop(0.8, 'rgba(37, 99, 235, 0.4)');
      laserGrad.addColorStop(1, 'rgba(37, 99, 235, 0)');

      ctx.beginPath();
      ctx.strokeStyle = laserGrad;
      ctx.lineWidth = 1.6;
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 10;
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // Laser core (ultrabright white-cyan thin center)
      const coreLaser = ctx.createLinearGradient(width * 0.25, 0, width * 0.75, 0);
      coreLaser.addColorStop(0, 'rgba(0, 242, 254, 0)');
      coreLaser.addColorStop(0.5, 'rgba(255, 255, 255, 0.85)');
      coreLaser.addColorStop(1, 'rgba(0, 242, 254, 0)');
      ctx.beginPath();
      ctx.strokeStyle = coreLaser;
      ctx.lineWidth = 0.8;
      ctx.shadowBlur = 4;
      ctx.moveTo(width * 0.2, centerY);
      ctx.lineTo(width * 0.8, centerY);
      ctx.stroke();

      // ── 2. Center Light Flare & Starburst (Image 2) ──
      const flareCenterX = width * 0.48;
      const flareRadius = 35 * flare;
      const radialFlare = ctx.createRadialGradient(
        flareCenterX, centerY, 0,
        flareCenterX, centerY, Math.max(1, flareRadius)
      );
      radialFlare.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      radialFlare.addColorStop(0.15, 'rgba(0, 242, 254, 0.85)');
      radialFlare.addColorStop(0.4, 'rgba(37, 99, 235, 0.4)');
      radialFlare.addColorStop(1, 'rgba(0, 242, 254, 0)');

      ctx.beginPath();
      ctx.fillStyle = radialFlare;
      ctx.arc(flareCenterX, centerY, flareRadius, 0, Math.PI * 2);
      ctx.fill();

      // ── 3. Fluid Sinusoidal Ribbon Waves (Image 1 style) ──
      // Define ribbon layer configurations
      // Each ribbon has multiple dense filaments for 3D silk-wave effect
      const ribbons = [
        {
          name: 'electric-blue',
          baseColor: [37, 99, 235],
          glowColor: '#3b82f6',
          filaments: 12,
          freq: 0.007,
          harmFreq: 0.016,
          ampScale: 52,
          phaseOffset: 0,
          speedMult: 1.0,
          yOffset: 0,
        },
        {
          name: 'neon-cyan',
          baseColor: [0, 242, 254],
          glowColor: '#00f2fe',
          filaments: 16,
          freq: 0.0085,
          harmFreq: 0.019,
          ampScale: 64,
          phaseOffset: 1.8,
          speedMult: 1.15,
          yOffset: -2,
        },
        {
          name: 'spring-green',
          baseColor: [0, 255, 136],
          glowColor: '#00ff88',
          filaments: 12,
          freq: 0.0065,
          harmFreq: 0.014,
          ampScale: 46,
          phaseOffset: 3.5,
          speedMult: 0.85,
          yOffset: 2,
        },
      ];

      // Minimum idle wave breathing height so wave gently ripples even in silence
      const idleWaveHeight = 4.0;
      const effectiveAmp = idleWaveHeight + curAmp * 58;

      ribbons.forEach((ribbon) => {
        ctx.shadowColor = ribbon.glowColor;
        ctx.shadowBlur = 12 + curAmp * 8;

        for (let f = 0; f < ribbon.filaments; f++) {
          const filRatio = f / ribbon.filaments;
          const spreadFactor = (filRatio - 0.5) * 2; // -1 to +1

          // Envelope alpha so outer filaments are softer
          const filamentAlpha = (0.12 + (1 - Math.abs(spreadFactor)) * 0.45) * (0.6 + curAmp * 0.4);
          const [r, g, b] = ribbon.baseColor;
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${filamentAlpha.toFixed(3)})`;
          ctx.lineWidth = 1.0 + (1 - Math.abs(spreadFactor)) * 0.8;

          ctx.beginPath();
          const step = 8; // x resolution
          const fPhase = phase * ribbon.speedMult + ribbon.phaseOffset + f * 0.065;

          for (let x = 0; x <= width; x += step) {
            // Gaussian edge damping so waves taper cleanly to baseline at left and right borders
            const normX = x / width; // 0 to 1
            const edgeDamping = Math.sin(normX * Math.PI); // 0 at edges, 1 at center

            // Harmonic combination for rich natural undulating curves
            const w1 = Math.sin(x * ribbon.freq + fPhase);
            const w2 = Math.cos(x * ribbon.harmFreq - fPhase * 0.6);
            const w3 = Math.sin(x * 0.003 + fPhase * 1.4);

            // Filament separation offset
            const filOffset = spreadFactor * (6 + curAmp * 18) * Math.sin(x * 0.005 + fPhase);

            // Compute y position
            const waveY =
              centerY +
              ribbon.yOffset +
              (w1 * 0.65 + w2 * 0.25 + w3 * 0.1) * effectiveAmp * edgeDamping +
              filOffset * edgeDamping;

            if (x === 0) {
              ctx.moveTo(x, waveY);
            } else {
              ctx.lineTo(x, waveY);
            }
          }
          ctx.stroke();
        }
      });

      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [active, amplitude, speaker, height]);

  // Determine user-friendly state indicator
  let stateLabel = 'Nova Live · Ready';
  let badgeColor = '#00f2fe';
  if (speaker === 'agent') {
    stateLabel = 'Nova is speaking…';
    badgeColor = '#00ff88';
  } else if (speaker === 'user' && amplitude > 0.02) {
    stateLabel = 'Listening to you…';
    badgeColor = '#60a5fa';
  } else if (active) {
    stateLabel = 'Hands-Free Active · Speak anytime';
    badgeColor = '#00f2fe';
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: 14,
        overflow: 'hidden',
        background: '#040712',
        border: '1.5px solid rgba(0, 242, 254, 0.3)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(0, 242, 254, 0.12)',
        marginBottom: 18,
      }}
    >
      {/* Top Status Header */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 16,
          right: 16,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: badgeColor,
              boxShadow: `0 0 10px ${badgeColor}`,
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: '#f8fafc',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            }}
          >
            {stateLabel}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'auto' }}>
          {silenceSeconds !== null && silenceSeconds < 60 && (
            <span
              style={{
                fontSize: 11,
                color: silenceSeconds <= 15 ? '#f87171' : 'rgba(255, 255, 255, 0.65)',
                fontWeight: 600,
                background: 'rgba(0,0,0,0.4)',
                padding: '2px 8px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              Sleep in {silenceSeconds}s
            </span>
          )}

          {onEndSession && (
            <button
              onClick={onEndSession}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#fca5a5',
                borderRadius: 8,
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
              }}
            >
              End Call
            </button>
          )}
        </div>
      </div>

      {/* HTML5 Canvas Rendering Wave Ribbons */}
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: `${height}px`,
        }}
      />
    </div>
  );
}
