import { Dungeon } from './dungeon.js';
import { Player, createEnemy, FLOOR_ENEMY_POOLS, getEnemyCountForFloor } from './entities.js';
import { generateFloorItems, generateStarterItems, generateShopStock, getSellPrice, ITEM_TYPE, AMMO_DEFS, makeSecretLoot } from './items.js';
import { Combat } from './combat.js';
import { Renderer } from './renderer.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { DISTRICT_NAMES, COLORS, TILE } from './config.js';
import { rand, randChoice, dist } from './utils.js';

const STATE = { MENU: 'MENU', PLAYING: 'PLAYING', INVENTORY: 'INVENTORY', MAP: 'MAP', RIPPERDOC: 'RIPPERDOC', GAMEOVER: 'GAMEOVER', WIN: 'WIN' };

class Game {
  constructor() {
    this.state = STATE.MENU;
    this.floor = 1;
    this.player = null;
    this.dungeon = null;
    this.renderer = null;
    this.ui = null;
    this.audio = null;
    this._rafId = null;
    this._prevState = null;
  }

  init() {
    const canvas = document.getElementById('gameCanvas');
    this.renderer = new Renderer(canvas);
    this.audio = new Audio();
    this.ui = new UI(this);
    this.ui.init();
    this.ui.checkContinue();

    window.addEventListener('resize', () => {
      this.renderer.resize();
      if (this.state === STATE.PLAYING) this._render();
    });

    this._loop();
  }

  _loop() {
    this._rafId = requestAnimationFrame(() => this._loop());
    if (this.state === STATE.PLAYING || this.state === STATE.INVENTORY) {
      if (this.dungeon && this.player) this._render();
    }
  }

  _render() {
    this.renderer.render(this.dungeon, this.player);
  }

  newGame() {
    this.floor = 1;
    this.player = new Player();
    const starters = generateStarterItems();
    for (const item of starters) this.player.addItem(item);
    this.player.equippedWeapon = this.player.inventory.find(i => i.type === ITEM_TYPE.WEAPON);
    if (this.player.equippedWeapon) this.player.removeItem(this.player.equippedWeapon);

    this._generateFloor();
    this.state = STATE.PLAYING;
    this.ui.hideAllScreens();
    this.ui.showHUD();
    this.ui.addMessage('You jack in. Night City swallows you whole.', 'cyan');
    this.ui.addMessage(`Sector: ${DISTRICT_NAMES[0]}. Find the stairs.`, 'yellow');
    this.ui.updateHUD(this.player, this.floor);
  }

  continueGame() {
    try {
      const save = JSON.parse(localStorage.getItem('nightcrawl_save'));
      if (!save) { this.newGame(); return; }
      this.floor = save.floor;
      this.player = Object.assign(new Player(), save.player);
      this._generateFloor();
      this.state = STATE.PLAYING;
      this.ui.hideAllScreens();
      this.ui.showHUD();
      this.ui.addMessage('Resuming from save...', 'cyan');
      this.ui.updateHUD(this.player, this.floor);
    } catch (e) {
      this.newGame();
    }
  }

  _save() {
    try {
      localStorage.setItem('nightcrawl_save', JSON.stringify({
        floor: this.floor,
        player: {
          hp: this.player.hp, maxHp: this.player.maxHp,
          energy: this.player.energy, maxEnergy: this.player.maxEnergy,
          baseAtk: this.player.baseAtk, baseDef: this.player.baseDef, baseHack: this.player.baseHack,
          level: this.player.level, xp: this.player.xp, xpNext: this.player.xpNext,
          credits: this.player.credits, kills: this.player.kills, turnsAlive: this.player.turnsAlive,
          inventory: this.player.inventory,
          equippedWeapon: this.player.equippedWeapon,
          equippedArmor: this.player.equippedArmor,
          cyberware1: this.player.cyberware1, cyberware2: this.player.cyberware2,
        },
      }));
    } catch (e) { /* storage full */ }
  }

  _generateFloor() {
    this.dungeon = new Dungeon(this.floor);
    this.dungeon.generate();

    const start = this.dungeon.startPos;
    this.player.x = start.x;
    this.player.y = start.y;
    this.dungeon.map[start.y][start.x].entity = this.player;
    this.dungeon.updateFOV(this.player.x, this.player.y, this.player.effectiveFov);

    // Place enemies
    const pool = FLOOR_ENEMY_POOLS[Math.min(this.floor - 1, FLOOR_ENEMY_POOLS.length - 1)];
    const count = getEnemyCountForFloor(this.floor);
    this.dungeon.enemies = [];

    const excludeStart = [start, this.dungeon.endPos];
    for (let i = 0; i < count; i++) {
      const type = randChoice(pool);
      const enemy = createEnemy(type);
      const pos = this.dungeon.getEmptyFloorTile(excludeStart);
      if (!pos) continue;
      enemy.x = pos.x;
      enemy.y = pos.y;
      enemy.spawnX = pos.x;
      enemy.spawnY = pos.y;
      this.dungeon.map[pos.y][pos.x].entity = enemy;
      this.dungeon.enemies.push(enemy);
      excludeStart.push(pos);
    }

    // Place items
    const floorItems = generateFloorItems(this.floor);
    for (const item of floorItems) {
      const pos = this.dungeon.getEmptyFloorTile(excludeStart);
      if (!pos) continue;
      this.dungeon.map[pos.y][pos.x].item = item;
      excludeStart.push(pos);
    }

    // Bonus loot in sealed secret rooms
    for (const room of (this.dungeon.secretRooms || [])) {
      const loot = makeSecretLoot(this.floor);
      for (const item of loot) {
        // Place within the secret room bounds
        const candidates = [];
        for (let y = room.y; y < room.y + room.h; y++)
          for (let x = room.x; x < room.x + room.w; x++) {
            const cell = this.dungeon.map[y][x];
            if (cell.type === TILE.FLOOR && !cell.item && !cell.entity)
              candidates.push({ x, y });
          }
        if (candidates.length === 0) continue;
        const pos = randChoice(candidates);
        this.dungeon.map[pos.y][pos.x].item = item;
      }
    }
  }

  playerAction(action) {
    if (this.state !== STATE.PLAYING) return;
    let acted = false;
    let extraTurn = false;

    switch (action.type) {
      case 'MOVE': acted = this._handleMove(action.dx, action.dy); break;
      case 'WAIT':  acted = true; this.ui.addMessage('You wait...', 'normal'); break;
      case 'HACK':  acted = this._handleHack(); break;
      case 'SHOOT': acted = this._handleShoot(); break;
      case 'PICKUP': acted = this._handlePickup(); break;
      case 'STAIRS': acted = this._handleStairs(); break;
    }

    if (acted) {
      this._enemyTurn();
      this.dungeon.updateFOV(this.player.x, this.player.y, this.player.effectiveFov);
      extraTurn = this.player.tick();
      this.ui.updateHUD(this.player, this.floor);

      if (this.player.isDead()) {
        this._gameOver('You were flatlined in Night City.');
        return;
      }

      // Level-up messages
      // (leveling is done in gainXP and messages returned)

      this._save();
    }
  }

  _handleMove(dx, dy) {
    const nx = this.player.x + dx;
    const ny = this.player.y + dy;
    if (!this.dungeon.isWalkable(nx, ny)) {
      return false;
    }
    const cell = this.dungeon.map[ny][nx];
    if (cell.entity && !cell.entity.isPlayer) {
      const enemy = cell.entity;
      const result = Combat.meleeAttack(this.player, enemy);
      this.ui.addMessage(result.message, 'orange');
      this.audio.playHit();
      this.renderer.spawnParticles(nx, ny, COLORS.NEON_RED, 8);
      this.renderer.flash('#ff4400', 0.1);
      if (result.killed) this._killEnemy(enemy);
      return true;
    }
    // Move
    this.dungeon.map[this.player.y][this.player.x].entity = null;
    this.player.x = nx;
    this.player.y = ny;
    this.dungeon.map[ny][nx].entity = this.player;
    // Auto-pickup credits
    if (cell.item?.type === ITEM_TYPE.CREDITS) {
      this._pickupItemAt(nx, ny);
    }
    // Tile hints
    if (cell.type === TILE.TELEPORTER) {
      this.ui.addMessage('Ω Teleporter — HACK to activate.', 'magenta');
    } else if (cell.type === TILE.RIPPERDOC) {
      this.ui.addMessage('R Ripperdoc — HACK to open clinic.', 'normal');
    }
    return true;
  }

  _handleHack() {
    // Priority: check tile player is standing on
    const cell = this.dungeon.map[this.player.y][this.player.x];
    if (cell.type === TILE.TERMINAL) {
      return this._hackTerminal();
    }
    if (cell.type === TILE.TELEPORTER) {
      return this._useTeleporter();
    }
    if (cell.type === TILE.RIPPERDOC) {
      this._openRipperdoc();
      return true;
    }

    // Otherwise quickhack nearest visible enemy
    const hackRange = 10;
    let target = null;
    let minD = Infinity;
    for (const enemy of this.dungeon.enemies) {
      const ecell = this.dungeon.map[enemy.y]?.[enemy.x];
      if (!ecell?.visible) continue;
      const d = dist(this.player.x, this.player.y, enemy.x, enemy.y);
      if (d <= hackRange && d < minD) { minD = d; target = enemy; }
    }
    if (!target) {
      this.ui.addMessage('No targets in hack range. Stand on ▣ to hack a terminal.', 'red');
      return false;
    }
    const result = Combat.hackAttack(this.player, target);
    if (result.failed) { this.ui.addMessage(result.message, 'red'); return false; }
    this.ui.addMessage(result.message, 'magenta');
    this.audio.playHack();
    this.renderer.spawnParticles(target.x, target.y, COLORS.NEON_MAGENTA, 10);
    if (result.killed) this._killEnemy(target);
    this.ui.updateHUD(this.player, this.floor);
    return true;
  }

  _useTeleporter() {
    const key = `${this.player.x},${this.player.y}`;
    const dest = this.dungeon.teleporterLinks?.get(key);
    if (!dest) {
      this.ui.addMessage('Teleporter offline.', 'red');
      return false;
    }
    this.dungeon.map[this.player.y][this.player.x].entity = null;
    this.player.x = dest.x;
    this.player.y = dest.y;
    this.dungeon.map[dest.y][dest.x].entity = this.player;
    this.dungeon.updateFOV(this.player.x, this.player.y, this.player.effectiveFov);
    this.audio.playStairs();
    this.renderer.spawnParticles(dest.x, dest.y, COLORS.NEON_MAGENTA, 14);
    this.renderer.flash('#e040fb', 0.2);
    this.ui.addMessage('Teleported across the sector.', 'magenta');
    return true;
  }

  _hackTerminal() {
    const cell = this.dungeon.map[this.player.y][this.player.x];

    // Shop terminal — no energy cost, open market
    if (cell.isShop) {
      this._openShop();
      return true;
    }

    const hackCost = 10;
    if (this.player.energy < hackCost) {
      this.ui.addMessage('Not enough energy to jack in. Need 10 EN.', 'red');
      return false;
    }
    this.player.energy -= hackCost;

    // Mark terminal as used (becomes floor)
    this.dungeon.map[this.player.y][this.player.x].type = TILE.FLOOR;
    cell.isShop = false;

    this.audio.playHack();
    this.renderer.spawnParticles(this.player.x, this.player.y, COLORS.NEON_GREEN, 14);

    // Random terminal effect — sector map is rare (~12%)
    const roll = Math.random();
    const effect = roll < 0.12 ? 0 : roll < 0.45 ? 1 : roll < 0.75 ? 2 : 3;
    switch (effect) {
      case 0:
        // Reveal entire floor map including walls
        for (let y = 0; y < this.dungeon.height; y++)
          for (let x = 0; x < this.dungeon.width; x++)
            this.dungeon.map[y][x].explored = true;
        this.ui.addMessage('Terminal: full sector map downloaded.', 'green');
        break;
      case 1:
        // Credits transfer
        const credits = rand(40, 150) * this.floor;
        this.player.credits += credits;
        this.ui.addMessage(`Terminal: siphoned ${credits}¥ from corps.`, 'yellow');
        break;
      case 2:
        // Energy restore
        const enGain = this.player.restoreEnergy(40);
        this.ui.addMessage(`Terminal: neural sync — +${enGain} EN.`, 'cyan');
        break;
      case 3:
        // Reveal all item locations on this floor
        for (let y = 0; y < this.dungeon.height; y++)
          for (let x = 0; x < this.dungeon.width; x++)
            if (this.dungeon.map[y][x].item) this.dungeon.map[y][x].explored = true;
        this.ui.addMessage('Terminal: contraband flagged on HUD.', 'green');
        break;
    }

    this.ui.updateHUD(this.player, this.floor);
    return true;
  }

  _handleShoot() {
    // Find nearest visible enemy in weapon range
    const w = this.player.equippedWeapon;
    if (!w || w.range <= 1) {
      this.ui.addMessage('Equip a ranged weapon first.', 'red');
      return false;
    }
    if (w.ammo === 0) {
      this.ui.addMessage('Out of ammo!', 'red');
      return false;
    }
    let target = null;
    let minD = Infinity;
    for (const enemy of this.dungeon.enemies) {
      const cell = this.dungeon.map[enemy.y]?.[enemy.x];
      if (!cell?.visible) continue;
      const d = dist(this.player.x, this.player.y, enemy.x, enemy.y);
      if (d <= w.range && d < minD) { minD = d; target = enemy; }
    }
    if (!target) {
      this.ui.addMessage('No targets in range.', 'red');
      return false;
    }
    const result = Combat.rangedAttack(this.player, target, this.dungeon.map);
    if (result.failed) { this.ui.addMessage(result.message, 'red'); return false; }
    this.ui.addMessage(result.message, 'yellow');
    this.audio.playShoot();
    this.renderer.spawnParticles(target.x, target.y, COLORS.NEON_YELLOW, 6);
    if (result.killed) this._killEnemy(target);
    return true;
  }

  _handlePickup() {
    const cell = this.dungeon.map[this.player.y][this.player.x];
    if (!cell.item) {
      this.ui.addMessage('Nothing here to take.', 'normal');
      return false;
    }
    return this._pickupItemAt(this.player.x, this.player.y);
  }

  _pickupItemAt(x, y) {
    const cell = this.dungeon.map[y][x];
    const item = cell.item;
    if (!item) return false;

    if (item.type === ITEM_TYPE.CREDITS) {
      this.player.credits += item.amount;
      cell.item = null;
      this.ui.addMessage(`Picked up ${item.amount}¥.`, 'yellow');
      this.audio.playPickup();
      return true;
    }

    if (this.player.inventory.length >= this.player.maxInventory) {
      this.ui.addMessage('Inventory full!', 'red');
      return false;
    }

    this.player.addItem(item);
    cell.item = null;
    this.ui.addMessage(`Picked up: ${item.name}.`, 'green');
    this.audio.playPickup();

    // Auto-equip if nothing in slot
    if (item.type === ITEM_TYPE.WEAPON && !this.player.equippedWeapon) {
      this.player.equipItem(item);
      this.ui.addMessage(`${item.name} equipped.`, 'cyan');
    } else if (item.type === ITEM_TYPE.ARMOR && !this.player.equippedArmor) {
      this.player.equipItem(item);
      this.ui.addMessage(`${item.name} equipped.`, 'cyan');
    } else if (item.type === ITEM_TYPE.CYBERWARE && (!this.player.cyberware1 || !this.player.cyberware2)) {
      this.player.equipItem(item);
      this.ui.addMessage(`${item.name} installed.`, 'cyan');
    }
    return true;
  }

  _handleStairs() {
    const cell = this.dungeon.map[this.player.y][this.player.x];
    if (cell.type !== TILE.STAIRS_DOWN) {
      this.ui.addMessage('No stairs here. Find the > symbol.', 'normal');
      return false;
    }
    if (this.floor >= 10) {
      this._win();
      return true;
    }
    this.floor++;
    this.audio.playStairs();
    this.ui.addMessage(`Descending to ${DISTRICT_NAMES[this.floor - 1]}...`, 'cyan');
    this._generateFloor();
    this.dungeon.updateFOV(this.player.x, this.player.y, this.player.effectiveFov);
    this.ui.updateHUD(this.player, this.floor);
    this._save();
    return true;
  }

  _killEnemy(enemy) {
    this.dungeon.map[enemy.y][enemy.x].entity = null;
    this.dungeon.map[enemy.y][enemy.x].bloody = true;
    this.dungeon.enemies = this.dungeon.enemies.filter(e => e !== enemy);
    this.player.kills++;
    const msgs = this.player.gainXP(enemy.xp);
    for (const m of msgs) {
      this.ui.addMessage(m, 'yellow');
      this.audio.playLevelUp();
    }
    this.audio.playEnemyDie();

    // Drop loot
    if (!this.dungeon.map[enemy.y][enemy.x].item) {
      const roll = Math.random();
      if (roll < 0.35) {
        this.dungeon.map[enemy.y][enemy.x].item = {
          id: Date.now(), type: ITEM_TYPE.CREDITS, name: 'Credits', sym: '$',
          color: COLORS.NEON_YELLOW, amount: rand(10, 35) * this.floor, desc: 'Cash.',
        };
      } else if (roll < 0.50 && enemy.rangeAtk) {
        // Ranged enemies drop ammo clips ~15% of the time
        const def = randChoice(AMMO_DEFS.filter(a => a.floor <= this.floor));
        this.dungeon.map[enemy.y][enemy.x].item = {
          id: Date.now() + 1, type: ITEM_TYPE.CONSUMABLE, ...def,
        };
      }
    }
  }

  _enemyTurn() {
    const p = this.player;
    for (const enemy of [...this.dungeon.enemies]) {
      if (enemy.hp <= 0) continue;

      // Status effect: stunned
      if (enemy.statusEffects?.stunned > 0) {
        enemy.statusEffects.stunned--;
        continue;
      }

      const canSee = Combat.enemyCanSeePlayer(enemy, p, this.dungeon);
      if (canSee) enemy.alerted = true;

      if (!enemy.alerted) continue;

      const d = dist(enemy.x, enemy.y, p.x, p.y);

      // Netrunner: hack at range (with reload)
      if (enemy.hackPower > 0 && d <= (enemy.hackRange || 6) && canSee) {
        if (enemy.reloadCooldown > 0) {
          enemy.reloadCooldown--;
        } else {
          const result = Combat.hackAttack(enemy, p);
          this.ui.addMessage(result.message, 'red');
          this.renderer.flash('#8800ff', 0.15);
          this.audio.playHit();
          enemy.reloadCooldown = enemy.reloadMax;
          if (p.isDead()) return;
        }
        continue;
      }

      // Ranged attack (with reload cooldown + distance-based miss)
      if (enemy.rangeAtk && d <= enemy.atkRange && d > 1.5 && canSee) {
        if (enemy.reloadCooldown > 0) {
          enemy.reloadCooldown--;
          // Still move closer while reloading
        } else {
          // Miss chance: 10% at close range, up to 45% at max range
          const missChance = 0.1 + (d / enemy.atkRange) * 0.35;
          if (Math.random() < missChance) {
            this.ui.addMessage(`${enemy.name} shoots and misses.`, 'normal');
          } else {
            const result = Combat.rangedAttack(enemy, p, this.dungeon.map);
            if (!result.outOfRange && !result.noAmmo) {
              this.ui.addMessage(result.message, 'red');
              this.renderer.flash('#ff1744', 0.12);
              this.audio.playHit();
              if (p.isDead()) return;
            }
          }
          enemy.reloadCooldown = enemy.reloadMax;
          continue;
        }
      }

      // Melee attack
      if (d <= 1.5) {
        const result = Combat.meleeAttack(enemy, p);
        this.ui.addMessage(result.message, 'red');
        this.renderer.flash('#ff1744', 0.15);
        this.audio.playHit();
        if (p.isDead()) return;
        continue;
      }

      // Move toward player
      if (canSee || enemy.alerted) {
        const next = Combat.findPath(enemy, p.x, p.y, this.dungeon);
        if (next) {
          this.dungeon.map[enemy.y][enemy.x].entity = null;
          enemy.x = next.x;
          enemy.y = next.y;
          this.dungeon.map[next.y][next.x].entity = enemy;
        }
      }
    }
  }

  toggleMap() {
    if (this.state === STATE.PLAYING) {
      this.state = STATE.MAP;
      this.ui.showMap(this.dungeon, this.player);
      this.ui.showScreen('map-screen');
    } else if (this.state === STATE.MAP) {
      this.state = STATE.PLAYING;
      this.ui.hideAllScreens();
    }
  }

  toggleInventory() {
    if (this.state === STATE.PLAYING) {
      this.state = STATE.INVENTORY;
      this.ui.showInventory(this.player);
      this.ui.showScreen('inventory-screen');
    } else if (this.state === STATE.INVENTORY) {
      this.state = STATE.PLAYING;
      this.ui.hideAllScreens();
    }
  }

  useInventoryItem(idx) {
    const item = this.player.inventory[idx];
    if (!item) return;

    if (item.type === ITEM_TYPE.CONSUMABLE) {
      if (item.ammoRestore) {
        // Collect all ranged weapons that aren't already full
        const ranged = [];
        if (this.player.equippedWeapon?.ammo >= 0) ranged.push(this.player.equippedWeapon);
        this.player.inventory
          .filter(i => i !== item && i.type === ITEM_TYPE.WEAPON && i.ammo >= 0)
          .forEach(w => ranged.push(w));
        const needsReload = ranged.filter(w => w.ammo < (w.currentAmmo || 1));
        if (needsReload.length === 0) {
          this.ui.addMessage(ranged.length === 0 ? 'No ranged weapon to reload.' : 'All weapons already full.', 'red');
          this.ui.updateHUD(this.player, this.floor);
          this.ui.showInventory(this.player);
          return;
        }
        needsReload.sort((a, b) => a.ammo - b.ammo);
        const target = needsReload[0];
        const maxAmmo = target.currentAmmo || item.ammoRestore;
        const before = target.ammo;
        target.ammo = Math.min(target.ammo + item.ammoRestore, maxAmmo);
        const gained = target.ammo - before;
        this.ui.addMessage(`Reloaded ${target.name}: ${target.ammo}/${maxAmmo} ammo.`, 'yellow');
      }
      if (item.hpRestore) {
        const healed = this.player.heal(item.hpRestore);
        this.ui.addMessage(`Used ${item.name}: +${healed} HP.`, 'green');
      }
      if (item.enRestore) {
        const restored = this.player.restoreEnergy(item.enRestore);
        this.ui.addMessage(`Energy restored: +${restored} EN.`, 'cyan');
      }
      if (item.atkBuff && item.buffTurns) {
        this.player.atkBuff = item.atkBuff;
        this.player.atkBuffTurns = item.buffTurns;
        this.ui.addMessage(`Stim active: ATK +${item.atkBuff} for ${item.buffTurns} turns.`, 'yellow');
      }
      this.player.removeItem(item);
      this.audio.playPickup();
    } else if (item.type === ITEM_TYPE.WEAPON || item.type === ITEM_TYPE.ARMOR || item.type === ITEM_TYPE.CYBERWARE) {
      this.player.equipItem(item);
      this.ui.addMessage(`${item.name} equipped/installed.`, 'cyan');
      if (item.type === ITEM_TYPE.CYBERWARE && item.name === 'Sandevistan') {
        this.player.hasSandevistan = true;
      }
    }

    this.ui.updateHUD(this.player, this.floor);
    this.ui.showInventory(this.player);
  }

  _openShop() {
    if (!this._shopStock) {
      this._shopStock = generateShopStock(this.floor);
    }
    this.state = STATE.INVENTORY; // pause enemies
    this.ui.showShop(this.player, this._shopStock);
  }

  _openRipperdoc() {
    const f = this.floor;
    this._ripperdocServices = [
      { name: 'Quick Patch',     desc: 'Restore 50 HP.',           hp: 50,  en: 0,            price: 80 * f  },
      { name: 'Full Treatment',  desc: 'Restore to full HP.',      hp: 9999, en: 0,           price: 200 * f },
      { name: 'Neural Flush',    desc: 'Full HP + full EN.',       hp: 9999, en: 9999,        price: 350 * f },
    ];
    this.state = STATE.RIPPERDOC;
    this.ui.showRipperdoc(this.player, this._ripperdocServices);
  }

  buyRipperdocService(idx) {
    const svc = this._ripperdocServices?.[idx];
    if (!svc) return;
    if (this.player.credits < svc.price) {
      this.ui.addMessage(`Need ${svc.price}¥ — you only have ${this.player.credits}¥.`, 'red');
      this.ui.showRipperdoc(this.player, this._ripperdocServices);
      return;
    }
    this.player.credits -= svc.price;
    const healed = this.player.heal(svc.hp);
    const energized = svc.en > 0 ? this.player.restoreEnergy(svc.en) : 0;
    let msg = `Ripperdoc: +${healed} HP`;
    if (energized > 0) msg += `, +${energized} EN`;
    msg += `.`;
    this.ui.addMessage(msg, 'green');
    this.audio.playPickup();
    this.ui.updateHUD(this.player, this.floor);
    this.ui.showRipperdoc(this.player, this._ripperdocServices);
  }

  closeRipperdoc() {
    this._ripperdocServices = null;
    this.state = STATE.PLAYING;
    this.ui.hideAllScreens();
  }

  closeShop() {
    this._shopStock = null;
    this.state = STATE.PLAYING;
    this.ui.hideAllScreens();
  }

  sellShopItem(idx, fromEquipped = false) {
    let item;
    if (fromEquipped) {
      const slots = ['equippedWeapon', 'equippedArmor', 'cyberware1', 'cyberware2'];
      const slot = slots[idx];
      item = this.player[slot];
      if (!item) return;
      this.player[slot] = null;
    } else {
      item = this.player.inventory[idx];
      if (!item) return;
      this.player.removeItem(item);
    }
    const price = getSellPrice(item);
    this.player.credits += price;
    this.ui.addMessage(`Sold ${item.name} for ${price}¥.`, 'green');
    this.ui.updateHUD(this.player, this.floor);
    this.ui.showShop(this.player, this._shopStock);
  }

  buyShopItem(idx) {
    const item = this._shopStock?.[idx];
    if (!item) return;
    if (this.player.credits < item.price) {
      this.ui.addMessage(`Need ${item.price}¥ — you only have ${this.player.credits}¥.`, 'red');
      this.ui.showShop(this.player, this._shopStock);
      return;
    }
    if (this.player.inventory.length >= this.player.maxInventory) {
      this.ui.addMessage('Inventory full — drop something first.', 'red');
      this.ui.showShop(this.player, this._shopStock);
      return;
    }
    this.player.credits -= item.price;
    this.player.addItem(item);
    this._shopStock.splice(idx, 1);
    this.ui.addMessage(`Bought ${item.name} for ${item.price}¥.`, 'yellow');
    this.ui.updateHUD(this.player, this.floor);
    this.ui.showShop(this.player, this._shopStock);
  }

  dropInventoryItem(idx) {
    const item = this.player.inventory[idx];
    if (!item) return;

    // Find a tile to drop on — player's tile if empty, otherwise adjacent
    const candidates = [
      { x: this.player.x, y: this.player.y },
      { x: this.player.x + 1, y: this.player.y },
      { x: this.player.x - 1, y: this.player.y },
      { x: this.player.x, y: this.player.y + 1 },
      { x: this.player.x, y: this.player.y - 1 },
    ];
    const spot = candidates.find(c => {
      const cell = this.dungeon.map[c.y]?.[c.x];
      return cell && !cell.item && cell.type !== 0; // not a wall
    });

    if (!spot) {
      this.ui.addMessage('No room to drop item here.', 'red');
      return;
    }

    this.player.removeItem(item);
    this.dungeon.map[spot.y][spot.x].item = item;
    this.ui.addMessage(`Dropped ${item.name}.`, 'normal');
    this.ui.updateHUD(this.player, this.floor);
    this.ui.showInventory(this.player);
  }

  _gameOver(msg) {
    this.state = STATE.GAMEOVER;
    this.audio.playDeath();
    localStorage.removeItem('nightcrawl_save');
    setTimeout(() => this.ui.showGameOver(this.player, this.floor, msg), 500);
  }

  _win() {
    this.state = STATE.WIN;
    localStorage.removeItem('nightcrawl_save');
    this.ui.addMessage('You cracked the Arasaka vault. Legend.', 'cyan');
    setTimeout(() => this.ui.showWin(this.player), 1000);
  }
}

// Boot
const game = new Game();
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => game.init());
} else {
  game.init();
}
