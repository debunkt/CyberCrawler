import { CONFIG, COLORS } from './config.js';
import { rand, clamp, dist } from './utils.js';
import { ITEM_TYPE } from './items.js';

export class Player {
  constructor() {
    this.x = 0; this.y = 0;
    this.hp = 100; this.maxHp = 100;
    this.energy = 60; this.maxEnergy = 60;
    this.baseAtk = 10;
    this.baseDef = 0;
    this.baseHack = 20;
    this.fovRadius = CONFIG.FOV_RADIUS;
    this.level = 1;
    this.xp = 0;
    this.xpNext = 50;
    this.credits = 0;
    this.kills = 0;
    this.turnsAlive = 0;
    this.inventory = [];
    this.maxInventory = 10;
    this.equippedWeapon = null;
    this.equippedArmor = null;
    this.cyberware1 = null;
    this.cyberware2 = null;
    this.atkBuff = 0;
    this.atkBuffTurns = 0;
    this.hasSandevistan = false;
    this.isPlayer = true;
    this.sym = '@';
    this.color = COLORS.PLAYER;
    this.glow = COLORS.PLAYER;
    this.name = 'V';
  }

  get atk() {
    let a = this.baseAtk;
    if (this.equippedWeapon) a += Math.floor((this.equippedWeapon.minDmg + this.equippedWeapon.maxDmg) / 2);
    if (this.cyberware1?.atkBonus) a += this.cyberware1.atkBonus;
    if (this.cyberware2?.atkBonus) a += this.cyberware2.atkBonus;
    if (this.atkBuffTurns > 0) a += this.atkBuff;
    return a;
  }

  get def() {
    let d = this.baseDef;
    if (this.equippedArmor) d += this.equippedArmor.defense;
    if (this.cyberware1?.defBonus) d += this.cyberware1.defBonus;
    if (this.cyberware2?.defBonus) d += this.cyberware2.defBonus;
    return d;
  }

  get hack() {
    let h = this.baseHack;
    if (this.equippedWeapon?.hackMod) h += this.equippedWeapon.hackMod;
    if (this.equippedArmor?.hackMod) h += this.equippedArmor.hackMod;
    if (this.cyberware1?.hackBonus) h += this.cyberware1.hackBonus;
    if (this.cyberware2?.hackBonus) h += this.cyberware2.hackBonus;
    return h;
  }

  get effectiveFov() {
    let r = this.fovRadius;
    if (this.cyberware1?.fovBonus) r += this.cyberware1.fovBonus;
    if (this.cyberware2?.fovBonus) r += this.cyberware2.fovBonus;
    return r;
  }

  gainXP(amount) {
    this.xp += amount;
    const msgs = [];
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = Math.floor(this.xpNext * 1.5);
      this.maxHp += 15;
      this.hp = Math.min(this.hp + 15, this.maxHp);
      this.maxEnergy += 10;
      this.energy = Math.min(this.energy + 10, this.maxEnergy);
      this.baseAtk += 2;
      this.baseHack += 3;
      msgs.push(`Level up! Now level ${this.level}. HP+15, EN+10, ATK+2.`);
    }
    return msgs;
  }

  takeDamage(amount) {
    const actual = Math.max(1, amount - this.def + rand(-2, 2));
    this.hp = Math.max(0, this.hp - actual);
    return actual;
  }

  heal(amount) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - before;
  }

  restoreEnergy(amount) {
    const before = this.energy;
    this.energy = Math.min(this.maxEnergy, this.energy + amount);
    return this.energy - before;
  }

  addItem(item) {
    if (this.inventory.length >= this.maxInventory) return false;
    this.inventory.push(item);
    return true;
  }

  removeItem(item) {
    const idx = this.inventory.indexOf(item);
    if (idx >= 0) this.inventory.splice(idx, 1);
  }

  equipItem(item) {
    if (item.type === ITEM_TYPE.WEAPON) {
      if (this.equippedWeapon) this.inventory.push(this.equippedWeapon);
      this.equippedWeapon = item;
      this.removeItem(item);
    } else if (item.type === ITEM_TYPE.ARMOR) {
      if (this.equippedArmor) this.inventory.push(this.equippedArmor);
      this.equippedArmor = item;
      this.removeItem(item);
    } else if (item.type === ITEM_TYPE.CYBERWARE) {
      if (!this.cyberware1) {
        this.cyberware1 = item;
      } else if (!this.cyberware2) {
        this.cyberware2 = item;
      } else {
        this.inventory.push(this.cyberware1);
        this.cyberware1 = item;
      }
      this.removeItem(item);
    }
  }

  tick() {
    this.turnsAlive++;
    if (this.atkBuffTurns > 0) this.atkBuffTurns--;
    // Slow energy regen
    if (this.turnsAlive % 5 === 0) {
      this.energy = Math.min(this.maxEnergy, this.energy + 2);
    }
    // Sandevistan: sometimes act twice
    if (this.hasSandevistan && Math.random() < 0.15) return true;
    return false;
  }

  isDead() { return this.hp <= 0; }
}

const ENEMY_CONFIGS = {
  gangster: {
    name: 'Maelstrom Ganger', sym: 'G', color: COLORS.ENEMY_GANG, glow: COLORS.ENEMY_GANG,
    hp: 22, atk: 10, def: 0, hackDef: 5, xp: 10, rangeAtk: false, hackPower: 0,
    atkRange: 1, sight: 6, reload: 0, desc: 'Melee aggressor.',
  },
  ncpd: {
    name: 'NCPD Officer', sym: 'N', color: COLORS.ENEMY_NCPD, glow: COLORS.ENEMY_NCPD,
    hp: 30, atk: 12, def: 2, hackDef: 8, xp: 15, rangeAtk: true, hackPower: 0,
    atkRange: 5, sight: 7, ammo: 12, reload: 2, desc: 'Ranged officer.',
  },
  drone: {
    name: 'Security Drone', sym: 'D', color: COLORS.ENEMY_DRONE, glow: COLORS.ENEMY_DRONE,
    hp: 25, atk: 10, def: 3, hackDef: 15, xp: 20, rangeAtk: true, hackPower: 0,
    atkRange: 6, sight: 8, ammo: 20, flying: true, reload: 2, desc: 'Aerial combat unit.',
  },
  netrunner: {
    name: 'Netrunner', sym: 'R', color: COLORS.ENEMY_RUNNER, glow: COLORS.ENEMY_RUNNER,
    hp: 20, atk: 5, def: 0, hackDef: 20, xp: 25, rangeAtk: false, hackPower: 20,
    atkRange: 1, hackRange: 6, sight: 8, reload: 3, desc: 'Remote hacker. Drains energy.',
  },
  corp: {
    name: 'Corp Soldier', sym: 'S', color: COLORS.ENEMY_CORP, glow: COLORS.ENEMY_CORP,
    hp: 55, atk: 16, def: 5, hackDef: 10, xp: 30, rangeAtk: true, hackPower: 0,
    atkRange: 6, sight: 8, ammo: 15, reload: 2, desc: 'Militech mercenary.',
  },
  maxtac: {
    name: 'MaxTac Elite', sym: 'M', color: COLORS.ENEMY_MAXTAC, glow: COLORS.ENEMY_MAXTAC,
    hp: 85, atk: 24, def: 10, hackDef: 20, xp: 50, rangeAtk: true, hackPower: 0,
    atkRange: 5, sight: 9, ammo: 20, reload: 1, desc: 'Special police cyborg.',
  },
  boss: {
    name: 'Arasaka Operative', sym: 'B', color: COLORS.ENEMY_BOSS, glow: COLORS.ENEMY_BOSS,
    hp: 220, atk: 30, def: 15, hackDef: 30, xp: 200, rangeAtk: true, hackPower: 25,
    atkRange: 7, hackRange: 6, sight: 10, ammo: 30, reload: 1, desc: 'Elite corporate assassin.',
  },
};

export const FLOOR_ENEMY_POOLS = [
  ['gangster', 'gangster', 'gangster', 'gangster', 'ncpd'],
  ['gangster', 'gangster', 'gangster', 'ncpd', 'ncpd'],
  ['gangster', 'gangster', 'ncpd', 'ncpd', 'drone'],
  ['gangster', 'ncpd', 'ncpd', 'drone', 'drone'],
  ['ncpd', 'ncpd', 'drone', 'drone', 'netrunner'],
  ['ncpd', 'drone', 'drone', 'netrunner', 'netrunner'],
  ['corp', 'corp', 'corp', 'drone', 'netrunner'],
  ['corp', 'corp', 'corp', 'corp', 'maxtac'],
  ['corp', 'corp', 'maxtac', 'maxtac', 'netrunner'],
  ['corp', 'maxtac', 'maxtac', 'netrunner', 'boss'],
];

let _enemyId = 0;

export function createEnemy(type) {
  const cfg = { ...ENEMY_CONFIGS[type] };
  return {
    id: ++_enemyId,
    type,
    x: 0, y: 0,
    hp: cfg.hp + rand(-5, 5),
    maxHp: cfg.hp,
    atk: cfg.atk + rand(-2, 2),
    def: cfg.def,
    hackDef: cfg.hackDef,
    hackPower: cfg.hackPower || 0,
    xp: cfg.xp,
    rangeAtk: cfg.rangeAtk || false,
    hackRange: cfg.hackRange || 0,
    atkRange: cfg.atkRange || 1,
    sight: cfg.sight || 6,
    ammo: cfg.ammo || 0,
    flying: cfg.flying || false,
    reloadMax: cfg.reload || 0,
    reloadCooldown: 0,
    name: cfg.name,
    sym: cfg.sym,
    color: cfg.color,
    glow: cfg.glow,
    desc: cfg.desc,
    alerted: false,
    spawnX: 0, spawnY: 0,
    isPlayer: false,
    statusEffects: {},
  };
}

export function getEnemyCountForFloor(floorNum) {
  return 4 + Math.floor(floorNum * 1.5);
}
