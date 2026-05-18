import { COLORS, DISTRICT_NAMES } from './config.js';
import { ITEM_TYPE } from './items.js';

const MAX_MESSAGES = 5;

export class UI {
  constructor(game) {
    this.game = game;
    this.messages = [];
    this.selectedInvItem = null;
  }

  init() {
    this._bindControls();
    this._bindMenuButtons();
    this._bindInventoryButtons();
  }

  _bindControls() {
    const g = this.game;

    // D-pad buttons
    const dirs = { N: [0,-1], S: [0,1], E: [1,0], W: [-1,0] };
    for (const [dir, [dx, dy]] of Object.entries(dirs)) {
      const btn = document.getElementById(`btn-${dir.toLowerCase()}`);
      if (btn) {
        btn.addEventListener('touchstart', e => { e.preventDefault(); g.playerAction({ type: 'MOVE', dx, dy }); }, { passive: false });
        btn.addEventListener('click', () => g.playerAction({ type: 'MOVE', dx, dy }));
      }
    }

    // Diagonal buttons
    const diagDirs = { ne: [1,-1], nw: [-1,-1], se: [1,1], sw: [-1,1] };
    for (const [dir, [dx, dy]] of Object.entries(diagDirs)) {
      const btn = document.getElementById(`btn-${dir}`);
      if (btn) {
        btn.addEventListener('touchstart', e => { e.preventDefault(); g.playerAction({ type: 'MOVE', dx, dy }); }, { passive: false });
        btn.addEventListener('click', () => g.playerAction({ type: 'MOVE', dx, dy }));
      }
    }

    const actionMap = {
      'btn-wait': { type: 'WAIT' },
      'btn-hack': { type: 'HACK' },
      'btn-shoot': { type: 'SHOOT' },
      'btn-pickup': { type: 'PICKUP' },
      'btn-stairs': { type: 'STAIRS' },
    };
    for (const [id, action] of Object.entries(actionMap)) {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('touchstart', e => { e.preventDefault(); g.playerAction(action); }, { passive: false });
        btn.addEventListener('click', () => g.playerAction(action));
      }
    }

    // Keyboard
    document.addEventListener('keydown', e => {
      const keyMap = {
        'ArrowUp': { type: 'MOVE', dx: 0, dy: -1 },
        'ArrowDown': { type: 'MOVE', dx: 0, dy: 1 },
        'ArrowLeft': { type: 'MOVE', dx: -1, dy: 0 },
        'ArrowRight': { type: 'MOVE', dx: 1, dy: 0 },
        'w': { type: 'MOVE', dx: 0, dy: -1 },
        's': { type: 'MOVE', dx: 0, dy: 1 },
        'a': { type: 'MOVE', dx: -1, dy: 0 },
        'd': { type: 'MOVE', dx: 1, dy: 0 },
        'k': { type: 'MOVE', dx: 0, dy: -1 },
        'j': { type: 'MOVE', dx: 0, dy: 1 },
        'h': { type: 'MOVE', dx: -1, dy: 0 },
        'l': { type: 'MOVE', dx: 1, dy: 0 },
        'y': { type: 'MOVE', dx: -1, dy: -1 },
        'u': { type: 'MOVE', dx: 1, dy: -1 },
        'b': { type: 'MOVE', dx: -1, dy: 1 },
        'n': { type: 'MOVE', dx: 1, dy: 1 },
        '.': { type: 'WAIT' },
        ' ': { type: 'WAIT' },
        'q': { type: 'HACK' },
        'f': { type: 'SHOOT' },
        'g': { type: 'PICKUP' },
        '>': { type: 'STAIRS' },
        'i': null, // inventory toggle
      };
      const action = keyMap[e.key];
      if (action === null) {
        e.preventDefault();
        g.toggleInventory();
      } else if (action) {
        e.preventDefault();
        g.playerAction(action);
      }
    });

    // Swipe detection on canvas
    let touchStartX, touchStartY;
    const canvas = document.getElementById('gameCanvas');
    canvas.addEventListener('touchstart', e => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    canvas.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      const minSwipe = 30;
      if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        g.playerAction({ type: 'MOVE', dx: dx > 0 ? 1 : -1, dy: 0 });
      } else {
        g.playerAction({ type: 'MOVE', dx: 0, dy: dy > 0 ? 1 : -1 });
      }
    }, { passive: true });
  }

  _bindMenuButtons() {
    const g = this.game;
    document.getElementById('start-btn')?.addEventListener('click', () => g.newGame());
    document.getElementById('continue-btn')?.addEventListener('click', () => g.continueGame());
    document.getElementById('how-btn')?.addEventListener('click', () => this.showScreen('howto-screen'));
    document.getElementById('close-howto')?.addEventListener('click', () => this.showScreen('menu-screen'));
    document.getElementById('close-shop')?.addEventListener('click', () => g.closeShop());
    document.getElementById('retry-btn')?.addEventListener('click', () => g.newGame());
    document.getElementById('play-again-btn')?.addEventListener('click', () => g.newGame());
    document.getElementById('menu-btn2')?.addEventListener('click', () => this.showScreen('menu-screen'));
  }

  _bindInventoryButtons() {
    document.getElementById('inv-btn')?.addEventListener('click', () => this.game.toggleInventory());
    document.getElementById('close-inv')?.addEventListener('click', () => this.game.toggleInventory());
  }

  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
  }

  hideAllScreens() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  }

  showHUD() {
    document.getElementById('hud').style.display = 'flex';
    document.getElementById('touch-controls').style.display = 'flex';
  }

  hideHUD() {
    document.getElementById('hud').style.display = 'none';
    document.getElementById('touch-controls').style.display = 'none';
  }

  addMessage(text, type = 'normal') {
    this.messages.push({ text, type, time: Date.now() });
    if (this.messages.length > MAX_MESSAGES) this.messages.shift();
    this._renderMessages();
  }

  _renderMessages() {
    const el = document.getElementById('msg-content');
    if (!el) return;
    const colorMap = {
      normal: COLORS.TEXT,
      cyan: COLORS.NEON_CYAN,
      orange: COLORS.NEON_ORANGE,
      red: COLORS.NEON_RED,
      green: COLORS.NEON_GREEN,
      yellow: COLORS.NEON_YELLOW,
      magenta: COLORS.NEON_MAGENTA,
    };
    el.innerHTML = this.messages.slice(-3).map(m => {
      const color = colorMap[m.type] || COLORS.TEXT;
      return `<div style="color:${color}">&gt; ${m.text}</div>`;
    }).join('');
    el.scrollTop = el.scrollHeight;
  }

  updateHUD(player, floorNum) {
    const hpPct = (player.hp / player.maxHp) * 100;
    const enPct = (player.energy / player.maxEnergy) * 100;

    const hpBar = document.getElementById('hp-bar');
    const enBar = document.getElementById('en-bar');
    const hpVal = document.getElementById('hp-val');
    const enVal = document.getElementById('en-val');
    const floorEl = document.getElementById('floor-num');
    const distEl = document.getElementById('district-name');

    if (hpBar) {
      hpBar.style.width = `${hpPct}%`;
      hpBar.style.background = hpPct > 50 ? '#ff6d00' : hpPct > 25 ? '#ffd740' : '#ff1744';
    }
    if (enBar) enBar.style.width = `${enPct}%`;
    if (hpVal) hpVal.textContent = `${player.hp}/${player.maxHp}`;
    if (enVal) enVal.textContent = `${player.energy}/${player.maxEnergy}`;
    if (floorEl) floorEl.textContent = `${floorNum}/10`;
    if (distEl) distEl.textContent = DISTRICT_NAMES[floorNum - 1] || '';

    // Update ammo display
    const ammoEl = document.getElementById('ammo-val');
    if (ammoEl) {
      const w = player.equippedWeapon;
      if (w && w.range > 1) {
        // Ranged weapon — show name and ammo as bullet pips
        const pips = w.ammo > 0
          ? '◉'.repeat(Math.min(w.ammo, 12)) + (w.ammo > 12 ? `+${w.ammo - 12}` : '')
          : '[ EMPTY ]';
        ammoEl.textContent = `${w.name.split(' ')[0].toUpperCase()} ${pips}`;
        ammoEl.style.color = w.ammo > 0 ? '#ffd740' : '#ff1744';
        ammoEl.style.display = '';
      } else {
        ammoEl.style.display = 'none';
      }
    }

    // Level display
    const lvlEl = document.getElementById('level-val');
    if (lvlEl) lvlEl.textContent = `LVL ${player.level}`;
  }

  showInventory(player) {
    const eqEl = document.getElementById('equipment-slots');
    const itemsEl = document.getElementById('items-list');
    const statsEl = document.getElementById('player-stats');

    if (eqEl) {
      const slots = [
        { label: 'WEAPON', item: player.equippedWeapon },
        { label: 'ARMOR', item: player.equippedArmor },
        { label: 'CYBER 1', item: player.cyberware1 },
        { label: 'CYBER 2', item: player.cyberware2 },
      ];
      eqEl.innerHTML = slots.map(s => `
        <div class="eq-slot">
          <span class="eq-label">${s.label}:</span>
          <span class="eq-item" style="color:${s.item ? s.item.color : '#444'}">
            ${s.item ? `${s.item.sym} ${s.item.name}` : 'Empty'}
          </span>
        </div>
      `).join('');
    }

    if (itemsEl) {
      if (player.inventory.length === 0) {
        itemsEl.innerHTML = '<div class="empty-msg">Nothing in your pack.</div>';
      } else {
        itemsEl.innerHTML = player.inventory.map((item, i) => `
          <div class="inv-item" data-idx="${i}" style="border-color:${item.color}20">
            <span class="item-sym" style="color:${item.color}">${item.sym}</span>
            <div class="item-info">
              <div class="item-name" style="color:${item.color}">${item.name}</div>
              <div class="item-desc">${this._itemDesc(item)}</div>
            </div>
            <div class="inv-btns">
              <button class="use-btn" data-idx="${i}">USE</button>
              <button class="drop-btn" data-idx="${i}">DROP</button>
            </div>
          </div>
        `).join('');
        itemsEl.querySelectorAll('.use-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            this.game.useInventoryItem(idx);
          });
        });
        itemsEl.querySelectorAll('.drop-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            this.game.dropInventoryItem(idx);
          });
        });
      }
    }

    if (statsEl) {
      statsEl.innerHTML = `
        <div class="stat-row"><span>Level</span><span>${player.level}</span></div>
        <div class="stat-row"><span>XP</span><span>${player.xp}/${player.xpNext}</span></div>
        <div class="stat-row"><span>HP</span><span>${player.hp}/${player.maxHp}</span></div>
        <div class="stat-row"><span>Energy</span><span>${player.energy}/${player.maxEnergy}</span></div>
        <div class="stat-row"><span>Attack</span><span>${player.atk}</span></div>
        <div class="stat-row"><span>Defense</span><span>${player.def}</span></div>
        <div class="stat-row"><span>Hack</span><span>${player.hack}</span></div>
        <div class="stat-row"><span>FOV</span><span>${player.effectiveFov}</span></div>
        <div class="stat-row"><span>Credits</span><span>${player.credits}¥</span></div>
        <div class="stat-row"><span>Kills</span><span>${player.kills}</span></div>
      `;
    }
  }

  _itemDesc(item) {
    if (item.type === ITEM_TYPE.WEAPON) {
      const ammo = item.ammo > 0 ? ` | Ammo: ${item.ammo}` : '';
      return `DMG ${item.minDmg}-${item.maxDmg} | Range ${item.range}${ammo}`;
    }
    if (item.type === ITEM_TYPE.ARMOR) return `DEF +${item.defense}${item.hpBonus ? ' | HP +' + item.hpBonus : ''}`;
    if (item.type === ITEM_TYPE.CONSUMABLE) {
      const parts = [];
      if (item.hpRestore) parts.push(`HP +${item.hpRestore}`);
      if (item.enRestore) parts.push(`EN +${item.enRestore}`);
      if (item.atkBuff) parts.push(`ATK +${item.atkBuff} (${item.buffTurns} turns)`);
      return parts.join(' | ');
    }
    if (item.type === ITEM_TYPE.CYBERWARE) {
      const parts = [];
      if (item.hackBonus) parts.push(`Hack ${item.hackBonus > 0 ? '+' : ''}${item.hackBonus}`);
      if (item.defBonus) parts.push(`DEF +${item.defBonus}`);
      if (item.atkBonus) parts.push(`ATK +${item.atkBonus}`);
      if (item.energyBonus) parts.push(`EN +${item.energyBonus}`);
      if (item.fovBonus) parts.push(`FOV +${item.fovBonus}`);
      return parts.join(' | ');
    }
    if (item.type === ITEM_TYPE.CREDITS) return `${item.amount}¥`;
    return item.desc || '';
  }

  showGameOver(player, floorNum, deathMsg) {
    document.getElementById('death-message').textContent = deathMsg;
    document.getElementById('final-stats').innerHTML = `
      <div class="stat-row"><span>Floor reached</span><span>${floorNum}/10</span></div>
      <div class="stat-row"><span>Level</span><span>${player.level}</span></div>
      <div class="stat-row"><span>Kills</span><span>${player.kills}</span></div>
      <div class="stat-row"><span>Credits earned</span><span>${player.credits}¥</span></div>
      <div class="stat-row"><span>Turns survived</span><span>${player.turnsAlive}</span></div>
    `;
    this.showScreen('gameover-screen');
    this.hideHUD();
  }

  showShop(player, stock) {
    document.getElementById('shop-credits').textContent = `${player.credits}¥`;
    const el = document.getElementById('shop-items');
    if (!el) return;
    if (!stock || stock.length === 0) {
      el.innerHTML = '<div class="empty-msg">Sold out. Come back next sector.</div>';
    } else {
      el.innerHTML = stock.map((item, i) => {
        const canAfford = player.credits >= item.price;
        return `
          <div class="inv-item" style="border-color:${item.color}20">
            <span class="item-sym" style="color:${item.color}">${item.sym}</span>
            <div class="item-info">
              <div class="item-name" style="color:${item.color}">${item.name}</div>
              <div class="item-desc">${this._itemDesc(item)}</div>
            </div>
            <button class="buy-btn" data-idx="${i}" style="opacity:${canAfford ? 1 : 0.4}">
              ${item.price}¥
            </button>
          </div>
        `;
      }).join('');
      el.querySelectorAll('.buy-btn').forEach(btn => {
        btn.addEventListener('click', () => this.game.buyShopItem(parseInt(btn.dataset.idx)));
      });
    }
    this.showScreen('shop-screen');
  }

  showWin(player) {
    document.getElementById('win-stats').innerHTML = `
      <div class="stat-row"><span>Level</span><span>${player.level}</span></div>
      <div class="stat-row"><span>Kills</span><span>${player.kills}</span></div>
      <div class="stat-row"><span>Credits</span><span>${player.credits}¥</span></div>
      <div class="stat-row"><span>Turns</span><span>${player.turnsAlive}</span></div>
    `;
    this.showScreen('win-screen');
    this.hideHUD();
  }

  checkContinue() {
    const save = localStorage.getItem('nightcrawl_save');
    if (save) {
      document.getElementById('continue-btn').style.display = '';
    }
  }
}
