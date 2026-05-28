import { TILE, COLORS, CONFIG } from './config.js';

const GLYPH = {
  [TILE.WALL]: '█',
  [TILE.FLOOR]: '·',
  [TILE.STAIRS_DOWN]: '>',
  [TILE.STAIRS_UP]: '<',
  [TILE.TERMINAL]: '▣',
  [TILE.WATER]: '≈',
  [TILE.DOOR]: '+',
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tileSize = 32;
    this.offsetX = 0;
    this.offsetY = 0;
    this.animFrame = 0;
    this.flashAlpha = 0;
    this.flashColor = '#ff1744';
    this.vignetteAlpha = 0;
    this.vignetteColor = '255,23,68';
    this.particles = [];
    this.resize();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    // Tile size: fit ~11 tiles across width
    this.tileSize = Math.floor(window.innerWidth / CONFIG.VIEWPORT_TILES_W);
    this.tileSize = Math.max(24, Math.min(48, this.tileSize));
  }

  get viewW() { return Math.ceil(this.canvas.width / this.tileSize) + 2; }
  get viewH() { return Math.ceil(this.canvas.height / this.tileSize) + 2; }

  render(dungeon, player) {
    this.animFrame++;
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.BG;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const ts = this.tileSize;
    const halfW = Math.floor(this.viewW / 2);
    const halfH = Math.floor(this.viewH / 2);
    const camX = player.x - halfW + 1;
    const camY = player.y - halfH + 1;

    const startX = Math.max(0, camX);
    const startY = Math.max(0, camY);
    const endX = Math.min(dungeon.width, camX + this.viewW + 1);
    const endY = Math.min(dungeon.height, camY + this.viewH + 1);

    ctx.font = `bold ${ts - 4}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const cell = dungeon.map[y][x];
        if (!cell.explored && !cell.visible) continue;

        const sx = (x - camX) * ts;
        const sy = (y - camY) * ts;

        this._drawTile(ctx, cell, x, y, sx, sy, ts);
      }
    }

    // Draw items (visible = full colour, explored-only = dimmed)
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const cell = dungeon.map[y][x];
        if (!cell.explored || !cell.item) continue;
        const sx = (x - camX) * ts;
        const sy = (y - camY) * ts;
        this._drawItem(ctx, cell.item, sx, sy, ts, cell.visible);
      }
    }

    // Draw enemies
    for (const enemy of dungeon.enemies) {
      const cell = dungeon.map[enemy.y]?.[enemy.x];
      if (!cell?.visible) continue;
      const sx = (enemy.x - camX) * ts;
      const sy = (enemy.y - camY) * ts;
      this._drawEntity(ctx, enemy, sx, sy, ts);
    }

    // Draw player
    const psx = (player.x - camX) * ts;
    const psy = (player.y - camY) * ts;
    this._drawPlayer(ctx, player, psx, psy, ts);

    // Draw particles
    this._updateParticles(ctx, camX, camY, ts);

    // Damage flash (full screen)
    if (this.flashAlpha > 0) {
      ctx.globalAlpha = this.flashAlpha;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.globalAlpha = 1;
      this.flashAlpha = Math.max(0, this.flashAlpha - 0.05);
    }

    // Damage vignette (edge glow — more visible than full-screen flash)
    if (this.vignetteAlpha > 0) {
      const cx = this.canvas.width / 2;
      const cy = this.canvas.height / 2;
      const r = Math.max(cx, cy);
      const grad = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r * 1.1);
      grad.addColorStop(0, `rgba(${this.vignetteColor},0)`);
      grad.addColorStop(1, `rgba(${this.vignetteColor},${(this.vignetteAlpha * 0.75).toFixed(2)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.vignetteAlpha = Math.max(0, this.vignetteAlpha - 0.035);
    }

    // Subtle scanlines
    this._drawScanlines(ctx);
  }

  _drawTile(ctx, cell, x, y, sx, sy, ts) {
    const visible = cell.visible;
    const explored = cell.explored;
    const type = cell.type;

    // Background
    if (visible) {
      if (type === TILE.WALL) {
        ctx.fillStyle = COLORS.WALL;
        ctx.fillRect(sx, sy, ts, ts);
        // Edge glow
        ctx.fillStyle = COLORS.WALL_EDGE;
        ctx.fillRect(sx, sy, ts, 3);
        ctx.fillRect(sx, sy, 3, ts);
      } else if (type === TILE.WATER) {
        const pulse = Math.sin(this.animFrame * 0.05 + x * 0.3 + y * 0.2) * 0.3 + 0.7;
        ctx.fillStyle = COLORS.FLOOR;
        ctx.fillRect(sx, sy, ts, ts);
        ctx.globalAlpha = pulse * 0.6;
        ctx.fillStyle = COLORS.WATER;
        ctx.fillRect(sx + 2, sy + 2, ts - 4, ts - 4);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = x % 2 === y % 2 ? COLORS.FLOOR : COLORS.FLOOR_ALT;
        ctx.fillRect(sx, sy, ts, ts);
        if (cell.bloody) {
          ctx.globalAlpha = 0.4;
          ctx.fillStyle = COLORS.BLOOD;
          ctx.fillRect(sx + 4, sy + 4, ts - 8, ts - 8);
          ctx.globalAlpha = 1;
        }
      }
    } else if (explored) {
      ctx.fillStyle = type === TILE.WALL ? COLORS.EXPLORED_WALL : COLORS.EXPLORED_FLOOR;
      ctx.fillRect(sx, sy, ts, ts);
    }

    if (!explored) return;

    // Special tile glyphs
    if (type === TILE.STAIRS_DOWN || type === TILE.STAIRS_UP) {
      const color = COLORS.STAIRS;
      const glow = visible ? 12 : 0;
      ctx.shadowBlur = glow;
      ctx.shadowColor = color;
      ctx.fillStyle = visible ? color : '#6b5020';
      ctx.fillText(GLYPH[type], sx + ts / 2, sy + ts / 2);
      ctx.shadowBlur = 0;
    } else if (type === TILE.RIPPERDOC) {
      const pulse = visible ? Math.sin(this.animFrame * 0.1) * 6 + 8 : 0;
      ctx.shadowBlur = pulse;
      ctx.shadowColor = '#ff4081';
      ctx.fillStyle = visible ? '#ff4081' : '#3a0010';
      ctx.fillText('R', sx + ts / 2, sy + ts / 2);
      ctx.shadowBlur = 0;
    } else if (type === TILE.TELEPORTER) {
      const pulse = visible ? Math.sin(this.animFrame * 0.15) * 8 + 10 : 0;
      ctx.shadowBlur = pulse;
      ctx.shadowColor = COLORS.NEON_MAGENTA;
      ctx.fillStyle = visible ? COLORS.NEON_MAGENTA : '#2a0040';
      ctx.fillText('Ω', sx + ts / 2, sy + ts / 2);
      ctx.shadowBlur = 0;
    } else if (type === TILE.TERMINAL) {
      const isShop = cell.isShop;
      const tColor = isShop ? COLORS.NEON_YELLOW : COLORS.TERMINAL;
      const tDim   = isShop ? '#6b5500' : '#1a4020';
      const pulse = visible ? Math.sin(this.animFrame * 0.08) * 6 + 8 : 0;
      ctx.shadowBlur = pulse;
      ctx.shadowColor = tColor;
      ctx.fillStyle = visible ? tColor : tDim;
      // Shop terminals show ¥ glyph, regular show ▣
      ctx.fillText(isShop ? '¥' : GLYPH[type], sx + ts / 2, sy + ts / 2);
      ctx.shadowBlur = 0;
    }
  }

  _drawItem(ctx, item, sx, sy, ts, visible = true) {
    ctx.globalAlpha = visible ? 1 : 0.45;
    ctx.shadowBlur = visible ? 8 : 0;
    ctx.shadowColor = item.color;
    ctx.fillStyle = item.color;
    ctx.font = `bold ${ts - 8}px monospace`;
    ctx.fillText(item.sym, sx + ts / 2, sy + ts / 2);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.font = `bold ${ts - 4}px monospace`;
  }

  _drawEntity(ctx, entity, sx, sy, ts) {
    const pulse = Math.sin(this.animFrame * 0.1 + entity.id) * 4 + 6;
    ctx.shadowBlur = pulse;
    ctx.shadowColor = entity.glow;
    ctx.fillStyle = entity.color;
    ctx.fillText(entity.sym, sx + ts / 2, sy + ts / 2);
    ctx.shadowBlur = 0;

    // HP bar under enemy
    if (entity.hp < entity.maxHp) {
      const pct = entity.hp / entity.maxHp;
      ctx.fillStyle = '#330000';
      ctx.fillRect(sx + 2, sy + ts - 5, ts - 4, 4);
      ctx.fillStyle = pct > 0.5 ? '#ff6d00' : '#ff1744';
      ctx.fillRect(sx + 2, sy + ts - 5, Math.floor((ts - 4) * pct), 4);
    }
  }

  _drawPlayer(ctx, player, sx, sy, ts) {
    const pulse = Math.sin(this.animFrame * 0.12) * 8 + 12;
    ctx.shadowBlur = pulse;
    ctx.shadowColor = COLORS.PLAYER;
    ctx.fillStyle = COLORS.PLAYER;
    ctx.fillText('@', sx + ts / 2, sy + ts / 2);
    ctx.shadowBlur = 0;
  }

  _drawScanlines(ctx) {
    ctx.globalAlpha = 0.03;
    ctx.fillStyle = '#000';
    for (let y = 0; y < this.canvas.height; y += 4) {
      ctx.fillRect(0, y, this.canvas.width, 2);
    }
    ctx.globalAlpha = 1;
  }

  _updateParticles(ctx, camX, camY, ts) {
    this.particles = this.particles.filter(p => p.life > 0);
    for (const p of this.particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life--;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 4;
      ctx.shadowColor = p.color;
      const sx = (p.x - camX) * ts;
      const sy = (p.y - camY) * ts;
      ctx.fillRect(sx, sy, p.size, p.size);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  spawnParticles(worldX, worldY, color, count = 6) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: worldX + 0.5,
        y: worldY + 0.5,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -(Math.random() * 0.3 + 0.1),
        life: 20 + Math.random() * 20,
        maxLife: 40,
        color,
        size: 3,
      });
    }
  }

  flash(color = '#ff1744', alpha = 0.25) {
    this.flashColor = color;
    this.flashAlpha = alpha;
  }

  damageVignette(type = 'physical') {
    if (type === 'hack') {
      this.vignetteColor = '224,64,251'; // magenta for hack damage
    } else {
      this.vignetteColor = '255,23,68';  // red for physical
    }
    this.vignetteAlpha = Math.min(1, this.vignetteAlpha + 0.9);
  }

  renderMenu(canvas) {
    // Handled by HTML overlay
  }
}
