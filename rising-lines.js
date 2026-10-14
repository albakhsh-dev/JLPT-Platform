/**
 * Rising Lines Component (React Bits Pro inspired)
 *
 * "Lines of light rising from a glowing horizon"
 *
 * Features:
 * - Radiant perspective horizon with multi-stop atmospheric glow
 * - Dynamic ascending lines of light with white-hot heads and tapered neon gradient tails
 * - Floating ember sparks drifting upwards with gentle sine-wave sway
 * - 3D depth layering (deep background, mid-ground, foreground)
 * - Interactive hover updraft (accelerates and gathers lines under cursor)
 * - Interactive click volley (launches a vibrant burst of rising lines and sparks)
 * - Multi-theme harmony (Slate Dark, Shinobi Stealth, Sakura Light, Tatami Light)
 * - Zero interference with clicks, selections, quizzes, or existing website features
 */

(function () {
  'use strict';

  // Prevent multiple instances
  if (window.RisingLinesInstance) {
    return;
  }

  // Theme-tailored color palettes
  const THEME_PALETTES = {
    dark: {
      name: 'dark',
      horizonCore: 'rgba(255, 255, 255, 0.98)',
      horizonMid: 'rgba(168, 85, 247, 0.55)', // Radiant purple
      horizonOuter: 'rgba(236, 72, 153, 0.28)', // Magenta
      horizonLine: 'rgba(192, 132, 252, 0.85)',
      lineHead: '#ffffff',
      lineGlow: 'rgba(255, 255, 255, 0.9)',
      lineColors: [
        ['#e879f9', '#a855f7', 'rgba(168, 85, 247, 0)'], // Violet/Purple
        ['#f472b6', '#ec4899', 'rgba(236, 72, 153, 0)'], // Pink/Magenta
        ['#38bdf8', '#0284c7', 'rgba(2, 132, 199, 0)'],  // Cyan/Sky
        ['#fb7185', '#ff4e50', 'rgba(255, 78, 80, 0)'],  // Crimson/Coral
        ['#c084fc', '#7c3aed', 'rgba(124, 58, 237, 0)'], // Deep Indigo
      ],
      sparks: ['#ffffff', '#f472b6', '#c084fc', '#38bdf8', '#fbbf24', '#e879f9'],
    },
    stealth: {
      name: 'stealth',
      horizonCore: 'rgba(255, 255, 255, 0.98)',
      horizonMid: 'rgba(239, 68, 68, 0.60)', // Shinobi Red
      horizonOuter: 'rgba(249, 115, 22, 0.32)', // Fire Orange
      horizonLine: 'rgba(248, 113, 113, 0.90)',
      lineHead: '#ffffff',
      lineGlow: 'rgba(255, 255, 255, 0.9)',
      lineColors: [
        ['#fb7185', '#e11d48', 'rgba(225, 29, 72, 0)'], // Crimson
        ['#fb923c', '#ea580c', 'rgba(234, 88, 12, 0)'], // Amber Orange
        ['#facc15', '#eab308', 'rgba(234, 179, 8, 0)'], // Radiant Gold
        ['#f43f5e', '#be123c', 'rgba(190, 18, 60, 0)'], // Ruby
        ['#f87171', '#dc2626', 'rgba(220, 38, 38, 0)'], // Pure Red
      ],
      sparks: ['#ffffff', '#fbbf24', '#f87171', '#fb923c', '#fed7aa'],
    },
    sakura: {
      name: 'sakura',
      horizonCore: 'rgba(255, 255, 255, 0.95)',
      horizonMid: 'rgba(244, 114, 182, 0.60)', // Sakura Pink
      horizonOuter: 'rgba(251, 113, 133, 0.30)', // Soft Rose
      horizonLine: 'rgba(236, 72, 153, 0.85)',
      lineHead: '#ffffff',
      lineGlow: 'rgba(255, 255, 255, 0.9)',
      lineColors: [
        ['#f472b6', '#db2777', 'rgba(219, 39, 119, 0)'], // Sakura Pink
        ['#fb7185', '#e11d48', 'rgba(225, 29, 72, 0)'],  // Rose Red
        ['#e879f9', '#c026d3', 'rgba(192, 38, 211, 0)'], // Petal Lilac
        ['#fda4af', '#f43f5e', 'rgba(244, 63, 94, 0)'],  // Coral Blush
      ],
      sparks: ['#ffffff', '#f472b6', '#fbcfe8', '#fda4af', '#f43f5e'],
    },
    light: {
      name: 'light',
      horizonCore: 'rgba(255, 255, 255, 0.95)',
      horizonMid: 'rgba(99, 102, 241, 0.45)', // Indigo
      horizonOuter: 'rgba(14, 165, 233, 0.25)', // Sky
      horizonLine: 'rgba(79, 70, 229, 0.75)',
      lineHead: '#ffffff',
      lineGlow: 'rgba(255, 255, 255, 0.85)',
      lineColors: [
        ['#818cf8', '#4f46e5', 'rgba(79, 70, 229, 0)'], // Indigo
        ['#38bdf8', '#0284c7', 'rgba(2, 132, 199, 0)'],  // Azure
        ['#a78bfa', '#7c3aed', 'rgba(124, 58, 237, 0)'], // Purple
        ['#fb7185', '#e11d48', 'rgba(225, 29, 72, 0)'],  // Coral
      ],
      sparks: ['#ffffff', '#818cf8', '#38bdf8', '#c7d2fe'],
    },
  };

  class RisingLinesEngine {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.container = null;
      this.width = 0;
      this.height = 0;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);

      this.lines = [];
      this.sparks = [];

      this.animationFrameId = null;
      this.lastTime = performance.now();
      this.isPaused = false;

      // Configuration
      this.density = 64; // High density for vibrant ambiance
      this.sparkCount = 45; // Ember sparks
      this.speedMultiplier = 1.0;
      this.horizonHeight = 0.94; // Bottom horizon level

      // Pointer tracking for interactive Updraft
      this.pointer = {
        x: -9999,
        y: -9999,
        vx: 0,
        vy: 0,
        active: false,
        lastSeen: 0,
        updraftRadius: 260,
      };

      // Detect theme and set palette
      this.currentTheme = this.detectCurrentTheme();
      this.palette = THEME_PALETTES[this.currentTheme] || THEME_PALETTES.dark;

      this.init();
    }

    detectCurrentTheme() {
      const body = document.body;
      if (!body) return 'dark';
      if (body.classList.contains('theme-stealth')) return 'stealth';
      if (body.classList.contains('theme-sakura')) return 'sakura';
      if (body.classList.contains('light-mode') || body.classList.contains('theme-light')) return 'light';
      return 'dark';
    }

    init() {
      // Find or create container
      this.container = document.getElementById('rising-lines-root');
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'rising-lines-root';
        this.container.className = 'rising-lines-layer';
        this.container.setAttribute('aria-hidden', 'true');
        document.body.appendChild(this.container);
      }

      // Explicit inline styles guaranteeing fixed viewport coverage regardless of CSS cache
      this.container.style.cssText = [
        'position: fixed !important',
        'top: 0 !important',
        'left: 0 !important',
        'width: 100vw !important',
        'height: 100vh !important',
        'pointer-events: none !important',
        'z-index: 50 !important',
        'mix-blend-mode: screen !important',
        'overflow: hidden !important',
        'margin: 0 !important',
        'padding: 0 !important',
      ].join(';');

      this.canvas = document.getElementById('rising-lines-canvas');
      if (!this.canvas) {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'rising-lines-canvas';
        this.container.appendChild(this.canvas);
      }

      this.canvas.style.cssText = [
        'position: absolute !important',
        'top: 0 !important',
        'left: 0 !important',
        'width: 100% !important',
        'height: 100% !important',
        'display: block !important',
        'pointer-events: none !important',
      ].join(';');

      this.ctx = this.canvas.getContext('2d', { alpha: true });

      // Resize canvas to match window
      this.resize();

      // Populate lines and sparks
      this.populate();

      // Setup event listeners
      this.bindEvents();

      // Start loop
      this.animate = this.animate.bind(this);
      this.animationFrameId = requestAnimationFrame(this.animate);
    }

    resize() {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);

      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;

      if (this.ctx) {
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      }
    }

    populate() {
      this.lines = [];
      this.sparks = [];

      for (let i = 0; i < this.density; i++) {
        this.lines.push(this.createLine(true));
      }

      for (let i = 0; i < this.sparkCount; i++) {
        this.sparks.push(this.createSpark(true));
      }
    }

    createLine(scatterInitial = false) {
      const horizonY = this.height * this.horizonHeight;
      const layer = Math.random();

      let speed, width, length, maxOpacity;
      if (layer < 0.35) {
        // Deep background layer: fine, ethereal
        speed = 1.0 + Math.random() * 0.9;
        width = 1.2 + Math.random() * 0.8;
        length = 80 + Math.random() * 100;
        maxOpacity = 0.45 + Math.random() * 0.25;
      } else if (layer < 0.75) {
        // Mid layer: balanced body
        speed = 1.8 + Math.random() * 1.5;
        width = 1.8 + Math.random() * 1.2;
        length = 130 + Math.random() * 140;
        maxOpacity = 0.70 + Math.random() * 0.25;
      } else {
        // Foreground layer: fast, bold, brilliant
        speed = 2.8 + Math.random() * 2.2;
        width = 2.6 + Math.random() * 1.6;
        length = 180 + Math.random() * 180;
        maxOpacity = 0.90 + Math.random() * 0.10;
      }

      const colorSet = this.palette.lineColors[Math.floor(Math.random() * this.palette.lineColors.length)];
      const x = Math.random() * this.width;
      const y = scatterInitial
        ? horizonY - Math.random() * (horizonY + length)
        : horizonY + Math.random() * 25;

      return {
        x,
        baseX: x,
        y,
        speed,
        baseSpeed: speed,
        width,
        length,
        maxOpacity,
        opacity: scatterInitial ? maxOpacity : 0,
        colorSet,
        layer,
        phase: Math.random() * Math.PI * 2,
        swaySpeed: 0.01 + Math.random() * 0.02,
        swayAmp: 1.0 + Math.random() * 2.5,
        isVolley: false,
      };
    }

    createSpark(scatterInitial = false) {
      const horizonY = this.height * this.horizonHeight;
      const x = Math.random() * this.width;
      const y = scatterInitial
        ? horizonY - Math.random() * horizonY
        : horizonY + Math.random() * 20;

      const colors = this.palette.sparks;
      const color = colors[Math.floor(Math.random() * colors.length)];

      return {
        x,
        y,
        radius: 1.0 + Math.random() * 1.8,
        speedY: 0.8 + Math.random() * 1.6,
        speedX: (Math.random() - 0.5) * 0.6,
        color,
        opacity: 0.4 + Math.random() * 0.6,
        pulseSpeed: 0.03 + Math.random() * 0.05,
        pulsePhase: Math.random() * Math.PI * 2,
      };
    }

    bindEvents() {
      // Debounced resize
      let resizeTimer;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => this.resize(), 100);
      }, { passive: true });

      // Hover updraft tracking
      const onMove = (e) => {
        const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : null);
        const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : null);
        if (clientX === null || clientY === null) return;

        if (this.pointer.x > -1000) {
          this.pointer.vx = clientX - this.pointer.x;
          this.pointer.vy = clientY - this.pointer.y;
        }

        this.pointer.x = clientX;
        this.pointer.y = clientY;
        this.pointer.active = true;
        this.pointer.lastSeen = performance.now();
      };

      window.addEventListener('mousemove', onMove, { passive: true });
      window.addEventListener('touchmove', onMove, { passive: true });

      window.addEventListener('mouseleave', () => {
        this.pointer.active = false;
      }, { passive: true });

      // Click volley launch
      const onClick = (e) => {
        const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : this.width / 2);
        this.launchVolley(clientX, 1.0);
      };

      window.addEventListener('click', onClick, { passive: true });
      window.addEventListener('touchend', (e) => {
        if (e.changedTouches && e.changedTouches[0]) {
          this.launchVolley(e.changedTouches[0].clientX, 1.0);
        }
      }, { passive: true });

      // Dynamic theme change watcher
      const observer = new MutationObserver(() => {
        const detected = this.detectCurrentTheme();
        if (detected !== this.currentTheme) {
          this.currentTheme = detected;
          this.palette = THEME_PALETTES[detected] || THEME_PALETTES.dark;
          this.lines.forEach((line) => {
            line.colorSet = this.palette.lineColors[Math.floor(Math.random() * this.palette.lineColors.length)];
          });
          this.sparks.forEach((spark) => {
            spark.color = this.palette.sparks[Math.floor(Math.random() * this.palette.sparks.length)];
          });
        }
      });
      observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

      // Auto-pause when tab is hidden
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.isPaused = true;
        } else {
          this.isPaused = false;
          this.lastTime = performance.now();
          if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(this.animate);
          }
        }
      });
    }

    launchVolley(x, strength = 1.0) {
      const horizonY = this.height * this.horizonHeight;
      const count = Math.floor(22 * strength);

      for (let i = 0; i < count; i++) {
        const spread = (Math.random() - 0.5) * 320 * strength;
        const lineX = Math.max(15, Math.min(this.width - 15, x + spread));
        const colorSet = this.palette.lineColors[Math.floor(Math.random() * this.palette.lineColors.length)];

        this.lines.push({
          x: lineX,
          baseX: lineX,
          y: horizonY + Math.random() * 20,
          speed: (4.0 + Math.random() * 4.5) * strength,
          baseSpeed: 4.0,
          width: 2.2 + Math.random() * 2.2,
          length: 180 + Math.random() * 260,
          maxOpacity: 0.98,
          opacity: 0.98,
          colorSet,
          layer: 2,
          phase: Math.random() * Math.PI * 2,
          swaySpeed: 0.02,
          swayAmp: 1.2,
          isVolley: true,
        });
      }

      // Add accompanying sparks
      for (let s = 0; s < 16; s++) {
        const sparkSpread = (Math.random() - 0.5) * 260 * strength;
        this.sparks.push({
          x: Math.max(15, Math.min(this.width - 15, x + sparkSpread)),
          y: horizonY + Math.random() * 20,
          radius: 1.6 + Math.random() * 2.2,
          speedY: (2.0 + Math.random() * 3.0) * strength,
          speedX: (Math.random() - 0.5) * 1.8,
          color: '#ffffff',
          opacity: 1.0,
          pulseSpeed: 0.06,
          pulsePhase: Math.random() * Math.PI,
        });
      }
    }

    update(deltaFactor) {
      const horizonY = this.height * this.horizonHeight;
      const now = performance.now();
      const pointerActive = this.pointer.active && (now - this.pointer.lastSeen < 2500);

      this.pointer.vx *= 0.92;
      this.pointer.vy *= 0.92;

      // Update Lines
      for (let i = this.lines.length - 1; i >= 0; i--) {
        const line = this.lines[i];

        let currentSpeed = line.speed;
        let lateralPull = 0;

        if (pointerActive) {
          const dx = line.x - this.pointer.x;
          const dist = Math.abs(dx);
          if (dist < this.pointer.updraftRadius) {
            const factor = Math.pow(1 - dist / this.pointer.updraftRadius, 1.5);
            currentSpeed += line.baseSpeed * 2.2 * factor;
            lateralPull = Math.sign(dx) * -0.8 * factor + (this.pointer.vx * 0.06 * factor);
          }
        }

        line.y -= currentSpeed * deltaFactor * this.speedMultiplier;
        line.phase += line.swaySpeed * deltaFactor;
        line.x = line.baseX + Math.sin(line.phase) * line.swayAmp + lateralPull;

        // Fade in emerging from horizon
        if (line.y > horizonY - 120) {
          const dist = horizonY - line.y;
          line.opacity = Math.min(line.maxOpacity, Math.max(0, dist / 80) * line.maxOpacity);
        }
        // Fade out gracefully near top edge
        else if (line.y < 160) {
          line.opacity = Math.max(0, (line.y / 160) * line.maxOpacity);
        } else {
          line.opacity = line.maxOpacity;
        }

        // Recycle or cleanup
        if (line.y + line.length < -50 || (line.opacity <= 0.01 && line.y < 80)) {
          if (line.isVolley) {
            this.lines.splice(i, 1);
          } else {
            Object.assign(line, this.createLine(false));
          }
        }
      }

      // Update Sparks
      for (let s = this.sparks.length - 1; s >= 0; s--) {
        const spark = this.sparks[s];

        let speedY = spark.speedY;
        if (pointerActive) {
          const dx = spark.x - this.pointer.x;
          if (Math.abs(dx) < this.pointer.updraftRadius) {
            const factor = 1 - Math.abs(dx) / this.pointer.updraftRadius;
            speedY += spark.speedY * 2.4 * factor;
          }
        }

        spark.y -= speedY * deltaFactor * this.speedMultiplier;
        spark.x += spark.speedX * deltaFactor;
        spark.pulsePhase += spark.pulseSpeed * deltaFactor;

        if (spark.y < -30) {
          if (this.sparks.length > this.sparkCount) {
            this.sparks.splice(s, 1);
          } else {
            Object.assign(spark, this.createSpark(false));
          }
        }
      }
    }

    draw() {
      const ctx = this.ctx;
      if (!ctx) return;

      ctx.clearRect(0, 0, this.width, this.height);

      const horizonY = this.height * this.horizonHeight;
      const palette = this.palette;

      // 1. Draw Glowing Perspective Horizon
      ctx.save();

      // Atmospheric broad wash along bottom
      const broadHalo = ctx.createRadialGradient(
        this.width * 0.5, horizonY + 80, 40,
        this.width * 0.5, horizonY + 20, Math.max(this.width * 0.75, 600)
      );
      broadHalo.addColorStop(0.0, palette.horizonMid);
      broadHalo.addColorStop(0.5, palette.horizonOuter);
      broadHalo.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = broadHalo;
      ctx.beginPath();
      ctx.ellipse(this.width * 0.5, horizonY + 40, this.width * 0.85, 220, 0, 0, Math.PI * 2);
      ctx.fill();

      // Sharp central horizon core
      const coreHalo = ctx.createRadialGradient(
        this.width * 0.5, horizonY, 5,
        this.width * 0.5, horizonY, Math.min(this.width * 0.55, 480)
      );
      coreHalo.addColorStop(0.0, palette.horizonCore);
      coreHalo.addColorStop(0.25, palette.horizonMid);
      coreHalo.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = coreHalo;
      ctx.beginPath();
      ctx.ellipse(this.width * 0.5, horizonY, this.width * 0.6, 60, 0, 0, Math.PI * 2);
      ctx.fill();

      // Glowing horizon accent line
      const horizonLineGrad = ctx.createLinearGradient(0, horizonY, this.width, horizonY);
      horizonLineGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0)');
      horizonLineGrad.addColorStop(0.15, palette.horizonOuter);
      horizonLineGrad.addColorStop(0.5, palette.horizonLine);
      horizonLineGrad.addColorStop(0.85, palette.horizonOuter);
      horizonLineGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

      ctx.strokeStyle = horizonLineGrad;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      ctx.lineTo(this.width, horizonY);
      ctx.stroke();

      ctx.restore();

      // 2. Draw Rising Lines of Light
      const sortedLines = [...this.lines].sort((a, b) => a.layer - b.layer);

      for (let i = 0; i < sortedLines.length; i++) {
        const line = sortedLines[i];
        if (line.opacity <= 0.01) continue;

        const headX = line.x;
        const headY = line.y;
        const tailY = line.y + line.length;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, line.opacity));

        // Linear gradient along streak from white-hot head to tapered tail
        const gradient = ctx.createLinearGradient(headX, headY, headX, tailY);
        gradient.addColorStop(0.0, palette.lineHead);
        gradient.addColorStop(0.12, line.colorSet[0]);
        gradient.addColorStop(0.50, line.colorSet[1]);
        gradient.addColorStop(1.0, line.colorSet[2]);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = line.width;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(headX, tailY);
        ctx.lineTo(headX, headY);
        ctx.stroke();

        // White-hot luminous head bloom
        const glowRadius = line.width * 2.8;
        const headGlow = ctx.createRadialGradient(headX, headY, 0, headX, headY, glowRadius);
        headGlow.addColorStop(0.0, 'rgba(255, 255, 255, 1)');
        headGlow.addColorStop(0.4, line.colorSet[0]);
        headGlow.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = headGlow;
        ctx.beginPath();
        ctx.arc(headX, headY, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // 3. Draw Fine Ascending Sparks
      ctx.save();
      for (let s = 0; s < this.sparks.length; s++) {
        const spark = this.sparks[s];
        const pulse = 0.6 + 0.4 * Math.sin(spark.pulsePhase);
        const alpha = Math.max(0, Math.min(1, spark.opacity * pulse));

        ctx.globalAlpha = alpha;
        ctx.fillStyle = spark.color;

        ctx.beginPath();
        ctx.arc(spark.x, spark.y, spark.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    animate(timestamp) {
      if (this.isPaused) {
        this.animationFrameId = null;
        return;
      }

      const elapsed = timestamp - this.lastTime;
      this.lastTime = timestamp;
      const deltaFactor = Math.min(elapsed / 16.67, 3.0);

      this.update(deltaFactor);
      this.draw();

      this.animationFrameId = requestAnimationFrame(this.animate);
    }

    launch(x, strength = 1.0) {
      this.launchVolley(x, strength);
    }

    setSpeed(speed) {
      this.speedMultiplier = Math.max(0.1, speed);
    }

    setDensity(density) {
      this.density = Math.max(10, Math.min(150, density));
      this.populate();
    }

    destroy() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
    }
  }

  function startEngine() {
    if (!window.RisingLinesInstance) {
      window.RisingLinesInstance = new RisingLinesEngine();
      window.RisingLines = {
        launch: (x, s) => window.RisingLinesInstance.launch(x, s),
        setSpeed: (s) => window.RisingLinesInstance.setSpeed(s),
        setDensity: (d) => window.RisingLinesInstance.setDensity(d),
        getInstance: () => window.RisingLinesInstance,
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startEngine);
  } else {
    startEngine();
  }
})();
