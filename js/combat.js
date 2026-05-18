import { rand, dist, clamp } from './utils.js';
import { ITEM_TYPE } from './items.js';

export class Combat {
  static meleeAttack(attacker, defender) {
    const rawDmg = attacker.equippedWeapon
      ? rand(attacker.equippedWeapon.minDmg, attacker.equippedWeapon.maxDmg) + attacker.baseAtk
      : attacker.atk + rand(-3, 3);
    const dmg = Math.max(1, rawDmg - defender.def + rand(-2, 2));
    defender.hp -= dmg;

    const hit = rand(0, 2) === 0;
    const adjective = dmg >= 25 ? 'CRITICAL' : dmg >= 15 ? 'hard' : 'for';
    const isPlayer = attacker.isPlayer;
    const atkName = isPlayer ? 'You strike' : `${attacker.name} strikes`;
    const defName = isPlayer ? defender.name : 'you';
    const msg = `${atkName} ${defName} ${adjective} (${dmg} dmg).`;

    return { dmg, killed: defender.hp <= 0, message: msg };
  }

  static rangedAttack(attacker, defender, map) {
    if (attacker.isPlayer) {
      const weapon = attacker.equippedWeapon;
      if (!weapon || weapon.range <= 1 || weapon.ammo === 0) {
        return { dmg: 0, killed: false, message: 'No ranged weapon or out of ammo!', failed: true };
      }
      const d = dist(attacker.x, attacker.y, defender.x, defender.y);
      if (d > weapon.range) {
        return { dmg: 0, killed: false, message: `${defender.name} is out of range.`, failed: true };
      }
      if (weapon.ammo > 0) weapon.ammo--;
      const rawDmg = rand(weapon.minDmg, weapon.maxDmg) + attacker.baseAtk * 0.5;
      const dmg = Math.max(1, Math.floor(rawDmg) - defender.def + rand(-3, 3));
      defender.hp -= dmg;
      return {
        dmg, killed: defender.hp <= 0,
        message: `You shoot ${defender.name} for ${dmg} damage. (${weapon.ammo} ammo left)`,
      };
    } else {
      // Enemy ranged attack on player
      const d = dist(attacker.x, attacker.y, defender.x, defender.y);
      if (d > attacker.atkRange) return { dmg: 0, killed: false, outOfRange: true };
      if (attacker.ammo !== undefined) {
        if (attacker.ammo <= 0) return { dmg: 0, killed: false, noAmmo: true };
        attacker.ammo--;
      }
      const dmg = Math.max(1, attacker.atk + rand(-4, 4) - defender.def);
      defender.hp = Math.max(0, defender.hp - dmg);
      return { dmg, killed: defender.hp <= 0, message: `${attacker.name} shoots you for ${dmg}.` };
    }
  }

  static hackAttack(attacker, defender) {
    if (attacker.isPlayer) {
      const hackCost = 15;
      if (attacker.energy < hackCost) {
        return { dmg: 0, killed: false, message: 'Not enough energy to hack!', failed: true };
      }
      attacker.energy -= hackCost;
      const hackDmg = Math.max(1, attacker.hack + rand(-5, 5) - Math.floor(defender.hackDef / 2));
      defender.hp -= hackDmg;
      const effect = rand(0, 2) === 0 ? ' Enemy stunned!' : '';
      if (effect) defender.statusEffects = { stunned: 2, ...defender.statusEffects };
      return { dmg: hackDmg, killed: defender.hp <= 0, message: `Quickhack hits ${defender.name} for ${hackDmg} neural damage.${effect}` };
    } else {
      // Enemy netrunner hacks player
      const hackDmg = Math.max(1, attacker.hackPower + rand(-5, 5));
      const energyDrain = clamp(rand(10, 20), 0, defender.energy);
      defender.energy -= energyDrain;
      defender.hp -= Math.floor(hackDmg * 0.5);
      return {
        dmg: hackDmg,
        killed: defender.hp <= 0,
        message: `${attacker.name} hacks you! -${energyDrain} EN, -${Math.floor(hackDmg * 0.5)} HP.`,
      };
    }
  }

  static enemyCanSeePlayer(enemy, player, dungeon) {
    const d = dist(enemy.x, enemy.y, player.x, player.y);
    if (d > enemy.sight) return false;
    // All enemies — including flying drones — can only act when their tile
    // is within the player's FOV (player has line of sight to them)
    const cell = dungeon.map[enemy.y]?.[enemy.x];
    return cell?.visible === true;
  }

  static findPath(enemy, targetX, targetY, dungeon) {
    // Simple greedy pathfinding toward target
    const dx = targetX - enemy.x;
    const dy = targetY - enemy.y;
    const steps = [];

    // Try direct axis moves
    if (Math.abs(dx) >= Math.abs(dy)) {
      steps.push({ x: enemy.x + Math.sign(dx), y: enemy.y });
      steps.push({ x: enemy.x, y: enemy.y + Math.sign(dy) });
      steps.push({ x: enemy.x - Math.sign(dx), y: enemy.y });
      steps.push({ x: enemy.x, y: enemy.y - Math.sign(dy) });
    } else {
      steps.push({ x: enemy.x, y: enemy.y + Math.sign(dy) });
      steps.push({ x: enemy.x + Math.sign(dx), y: enemy.y });
      steps.push({ x: enemy.x, y: enemy.y - Math.sign(dy) });
      steps.push({ x: enemy.x - Math.sign(dx), y: enemy.y });
    }

    for (const s of steps) {
      if (dungeon.isWalkable(s.x, s.y) && !(dungeon.map[s.y]?.[s.x]?.entity)) {
        return s;
      }
      if (enemy.flying && s.x >= 0 && s.y >= 0 && s.x < dungeon.width && s.y < dungeon.height
        && !(dungeon.map[s.y]?.[s.x]?.entity)) {
        return s;
      }
    }
    return null;
  }
}
