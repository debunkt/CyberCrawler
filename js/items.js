import { rand, randChoice, weightedRand } from './utils.js';

export const ITEM_TYPE = {
  WEAPON: 'weapon',
  ARMOR: 'armor',
  CONSUMABLE: 'consumable',
  CYBERWARE: 'cyberware',
  CREDITS: 'credits',
};

let _itemId = 0;
function makeId() { return ++_itemId; }

export const WEAPON_DEFS = [
  { name: 'Combat Knife',   sym: '/', color: '#ff6d00', minDmg: 8,  maxDmg: 12, range: 1,  ammo: -1, floor: 1, hackMod: 0,  desc: 'Fast, quiet.' },
  { name: 'Maelstrom Club', sym: '/', color: '#ff1744', minDmg: 12, maxDmg: 18, range: 1,  ammo: -1, floor: 1, hackMod: 0,  desc: 'Heavy blunt force.' },
  { name: 'Pistol',         sym: '!', color: '#ffd740', minDmg: 14, maxDmg: 20, range: 8,  ammo: 12, floor: 1, hackMod: 0,  desc: '9mm standard issue.' },
  { name: 'Tech Crossbow',  sym: '!', color: '#69ff47', minDmg: 16, maxDmg: 24, range: 10, ammo: 6,  floor: 2, hackMod: 5,  desc: 'Fires smart bolts.' },
  { name: 'Shotgun',        sym: '!', color: '#ff6d00', minDmg: 24, maxDmg: 36, range: 4,  ammo: 8,  floor: 3, hackMod: 0,  desc: 'Close-range devastation.' },
  { name: 'Monowire',       sym: '/', color: '#00e5ff', minDmg: 18, maxDmg: 28, range: 2,  ammo: -1, floor: 4, hackMod: 10, desc: 'Phased monofilament wire.' },
  { name: 'Mantis Blades',  sym: '/', color: '#e040fb', minDmg: 22, maxDmg: 32, range: 1,  ammo: -1, floor: 5, hackMod: 0,  desc: 'Retractable arm blades.' },
  { name: 'Smart SMG',      sym: '!', color: '#ffd740', minDmg: 20, maxDmg: 30, range: 12, ammo: 20, floor: 6, hackMod: 5,  desc: 'AI-guided projectiles.' },
  { name: 'Tech Rifle',     sym: '!', color: '#69ff47', minDmg: 28, maxDmg: 40, range: 15, ammo: 10, floor: 7, hackMod: 0,  desc: 'Charged plasma rounds.' },
  { name: 'Malorian Arms',  sym: '!', color: '#ff6d00', minDmg: 35, maxDmg: 50, range: 12, ammo: 8,  floor: 8, hackMod: 0,  desc: "Johnny Silverhand's gun." },
];

export const ARMOR_DEFS = [
  { name: 'Leather Jacket',    sym: ']', color: '#448aff', defense: 2,  hpBonus: 0,   floor: 1, hackMod: 0,   desc: 'Better than nothing.' },
  { name: 'Tech Vest',         sym: ']', color: '#448aff', defense: 4,  hpBonus: 0,   floor: 2, hackMod: 0,   desc: 'Kevlar composite.' },
  { name: 'Netrunner Suit',    sym: ']', color: '#e040fb', defense: 3,  hpBonus: 0,   floor: 3, hackMod: 15,  desc: 'Shielded for quickhacks.' },
  { name: 'Corporate Armor',   sym: ']', color: '#b0bec5', defense: 6,  hpBonus: 20,  floor: 4, hackMod: 0,   desc: 'Militech mil-spec.' },
  { name: 'Arasaka Chassis',   sym: ']', color: '#ff6d00', defense: 9,  hpBonus: 40,  floor: 7, hackMod: 0,   desc: 'Reinforced exoframe.' },
  { name: 'Sandevistan Suit',  sym: ']', color: '#ff1744', defense: 7,  hpBonus: 20,  floor: 8, hackMod: 5,   desc: 'Reflex booster integrated.' },
];

export const CYBERWARE_DEFS = [
  { name: 'Neural Interface', sym: '*', color: '#00e5ff', hackBonus: 15, energyBonus: 20, defBonus: 0, atkBonus: 0, fovBonus: 0, floor: 2, desc: 'Boost quickhack power.' },
  { name: 'Subdermal Armor',  sym: '*', color: '#b0bec5', hackBonus: 0,  energyBonus: 0,  defBonus: 4, atkBonus: 0, fovBonus: 0, floor: 2, desc: 'Micro-mesh under skin.' },
  { name: 'Kiroshi Optics',   sym: '*', color: '#ffd740', hackBonus: 0,  energyBonus: 0,  defBonus: 0, atkBonus: 0, fovBonus: 3, floor: 3, desc: 'Extended sensor range.' },
  { name: 'Gorilla Arms',     sym: '*', color: '#ff6d00', hackBonus: -5, energyBonus: 0,  defBonus: 0, atkBonus: 8, fovBonus: 0, floor: 3, desc: 'Hydraulic limb augment.' },
  { name: 'Sandevistan',      sym: '*', color: '#ff1744', hackBonus: 0,  energyBonus: 0,  defBonus: 0, atkBonus: 5, fovBonus: 0, floor: 5, desc: 'Reflex booster. Sometimes double-acts.' },
  { name: 'Optical Camo',     sym: '*', color: '#e040fb', hackBonus: 0,  energyBonus: 10, defBonus: 2, atkBonus: 0, fovBonus: 0, floor: 6, desc: 'Stealth holographic skin.' },
];

export const CONSUMABLE_DEFS = [
  { name: 'Medkit',        sym: '+', color: '#69ff47', hpRestore: 40,  enRestore: 0,  atkBuff: 0, buffTurns: 0, floor: 1, desc: 'Restore 40 HP.' },
  { name: 'Trauma Kit',    sym: '+', color: '#ff1744', hpRestore: 100, enRestore: 0,  atkBuff: 0, buffTurns: 0, floor: 3, desc: 'Restore 100 HP.' },
  { name: 'Energy Cell',   sym: '+', color: '#00e5ff', hpRestore: 0,   enRestore: 30, atkBuff: 0, buffTurns: 0, floor: 1, desc: 'Restore 30 energy.' },
  { name: 'RAM Upgrade',   sym: '+', color: '#e040fb', hpRestore: 0,   enRestore: 99, atkBuff: 0, buffTurns: 0, floor: 4, desc: 'Restore all energy.' },
  { name: 'Stim Pack',     sym: '+', color: '#ffd740', hpRestore: 15,  enRestore: 0,  atkBuff: 8, buffTurns: 10, floor: 2, desc: '+8 ATK for 10 turns.' },
  { name: 'MaxDoc',        sym: '+', color: '#69ff47', hpRestore: 60,  enRestore: 20, atkBuff: 0, buffTurns: 0, floor: 5, desc: 'Restore 60 HP + 20 EN.' },
];

function makeWeapon(def) {
  return { id: makeId(), type: ITEM_TYPE.WEAPON, ...def, currentAmmo: def.ammo };
}

function makeArmor(def) {
  return { id: makeId(), type: ITEM_TYPE.ARMOR, ...def };
}

function makeCyberware(def) {
  return { id: makeId(), type: ITEM_TYPE.CYBERWARE, ...def };
}

function makeConsumable(def) {
  return { id: makeId(), type: ITEM_TYPE.CONSUMABLE, ...def };
}

function makeCredits(amount) {
  return { id: makeId(), type: ITEM_TYPE.CREDITS, name: 'Credits', sym: '$', color: '#ffd740', amount, desc: `${amount}¥ cash.` };
}

export function generateFloorItems(floorNum) {
  const items = [];

  // 1-2 weapons (weighted toward current floor level)
  const numWeapons = rand(1, 2);
  for (let i = 0; i < numWeapons; i++) {
    const eligible = WEAPON_DEFS.filter(w => w.floor <= floorNum);
    const weights = eligible.map(w => ({ value: w, weight: w.floor }));
    const def = weightedRand(weights);
    items.push(makeWeapon(def));
  }

  // 1 armor
  const eligibleArmor = ARMOR_DEFS.filter(a => a.floor <= floorNum);
  if (eligibleArmor.length > 0) {
    items.push(makeArmor(randChoice(eligibleArmor)));
  }

  // 2-3 consumables
  const numConsumables = rand(2, 3);
  for (let i = 0; i < numConsumables; i++) {
    const eligible = CONSUMABLE_DEFS.filter(c => c.floor <= floorNum);
    items.push(makeConsumable(randChoice(eligible)));
  }

  // 0-1 cyberware
  if (Math.random() < 0.4) {
    const eligible = CYBERWARE_DEFS.filter(c => c.floor <= floorNum);
    if (eligible.length > 0) {
      items.push(makeCyberware(randChoice(eligible)));
    }
  }

  // 2-4 credit piles
  const numCredits = rand(2, 4);
  for (let i = 0; i < numCredits; i++) {
    items.push(makeCredits(rand(50 * floorNum, 200 * floorNum)));
  }

  return items;
}

const floorScale = (floorNum) => 1 + floorNum * 0.05;

export function generateShopStock(floorNum) {
  const stock = [];

  // 2 weapons
  const eligibleW = WEAPON_DEFS.filter(w => w.floor <= floorNum + 1);
  for (let i = 0; i < 2; i++) {
    const weights = eligibleW.map(w => ({ value: w, weight: w.floor }));
    const def = weightedRand(weights);
    const item = makeWeapon(def);
    item.price = Math.floor((def.minDmg + def.maxDmg) * 6 * floorScale(floorNum));
    stock.push(item);
  }

  // 1 armor
  const eligibleA = ARMOR_DEFS.filter(a => a.floor <= floorNum + 1);
  if (eligibleA.length) {
    const def = randChoice(eligibleA);
    const item = makeArmor(def);
    item.price = Math.floor((def.defense * 40 + (def.hpBonus || 0) * 3) * floorScale(floorNum));
    stock.push(item);
  }

  // 2 consumables
  const eligibleC = CONSUMABLE_DEFS.filter(c => c.floor <= floorNum + 1);
  for (let i = 0; i < 2; i++) {
    const def = randChoice(eligibleC);
    const item = makeConsumable(def);
    item.price = Math.floor((def.hpRestore || 0) * 3 + (def.enRestore || 0) * 4 + (def.atkBuff || 0) * 20);
    stock.push(item);
  }

  // 1 cyberware
  const eligibleCy = CYBERWARE_DEFS.filter(c => c.floor <= floorNum + 1);
  if (eligibleCy.length) {
    const def = randChoice(eligibleCy);
    const item = makeCyberware(def);
    item.price = 200 + floorNum * 50;
    stock.push(item);
  }

  return stock;
}

export function getSellPrice(item) {
  if (item.type === ITEM_TYPE.CREDITS) return 0;
  if (item.type === ITEM_TYPE.WEAPON)
    return Math.max(10, Math.floor((item.minDmg + item.maxDmg) * 3));
  if (item.type === ITEM_TYPE.ARMOR)
    return Math.max(10, Math.floor(item.defense * 20 + (item.hpBonus || 0) * 2));
  if (item.type === ITEM_TYPE.CONSUMABLE)
    return Math.max(10, Math.floor((item.hpRestore || 0) * 1.5 + (item.enRestore || 0) * 2 + (item.atkBuff || 0) * 10));
  if (item.type === ITEM_TYPE.CYBERWARE)
    return Math.max(50, Math.floor(((item.hackBonus || 0) + (item.defBonus || 0) + (item.atkBonus || 0)) * 15 + (item.energyBonus || 0) * 5 + (item.fovBonus || 0) * 20 + 80));
  return 10;
}

export function generateStarterItems() {
  return [
    makeWeapon(WEAPON_DEFS[0]), // Combat Knife
    makeConsumable(CONSUMABLE_DEFS[0]), // Medkit
    makeConsumable(CONSUMABLE_DEFS[2]), // Energy Cell
  ];
}
