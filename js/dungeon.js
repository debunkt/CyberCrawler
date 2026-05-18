import { CONFIG, TILE } from './config.js';
import { rand, randChoice } from './utils.js';

class BSPNode {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.left = null; this.right = null; this.room = null;
  }

  split(minSize) {
    if (this.left || this.right) return false;
    let splitH = Math.random() < 0.5;
    if (this.w > this.h && this.w / this.h >= 1.25) splitH = false;
    if (this.h > this.w && this.h / this.w >= 1.25) splitH = true;
    const max = (splitH ? this.h : this.w) - minSize;
    if (max <= minSize) return false;
    const split = rand(minSize, max);
    if (splitH) {
      this.left = new BSPNode(this.x, this.y, this.w, split);
      this.right = new BSPNode(this.x, this.y + split, this.w, this.h - split);
    } else {
      this.left = new BSPNode(this.x, this.y, split, this.h);
      this.right = new BSPNode(this.x + split, this.y, this.w - split, this.h);
    }
    return true;
  }

  createRoom(minRoom, maxRoom) {
    if (this.left || this.right) {
      if (this.left) this.left.createRoom(minRoom, maxRoom);
      if (this.right) this.right.createRoom(minRoom, maxRoom);
    } else {
      const rw = rand(minRoom, Math.min(maxRoom, this.w - 3));
      const rh = rand(minRoom, Math.min(maxRoom, this.h - 3));
      const rx = this.x + rand(1, this.w - rw - 1);
      const ry = this.y + rand(1, this.h - rh - 1);
      this.room = { x: rx, y: ry, w: rw, h: rh };
    }
  }

  getRoom() {
    if (this.room) return this.room;
    const l = this.left ? this.left.getRoom() : null;
    const r = this.right ? this.right.getRoom() : null;
    if (!l) return r;
    if (!r) return l;
    return Math.random() < 0.5 ? l : r;
  }

  getLeaves() {
    if (!this.left && !this.right) return [this];
    const leaves = [];
    if (this.left) leaves.push(...this.left.getLeaves());
    if (this.right) leaves.push(...this.right.getLeaves());
    return leaves;
  }
}

export class Dungeon {
  constructor(floorNum) {
    this.floorNum = floorNum;
    this.width = CONFIG.MAP_WIDTH;
    this.height = CONFIG.MAP_HEIGHT;
    this.map = [];
    this.rooms = [];
    this.startPos = { x: 0, y: 0 };
    this.endPos = { x: 0, y: 0 };
    this.enemies = [];
    this.items = [];
  }

  generate() {
    this._initMap();
    this._bspGenerate();
    this._placeStairs();
  }

  _initMap() {
    this.map = [];
    for (let y = 0; y < this.height; y++) {
      this.map[y] = [];
      for (let x = 0; x < this.width; x++) {
        this.map[y][x] = {
          type: TILE.WALL,
          visible: false,
          explored: false,
          bloody: false,
          entity: null,
          item: null,
        };
      }
    }
  }

  _bspGenerate() {
    const root = new BSPNode(1, 1, this.width - 2, this.height - 2);
    const stack = [root];
    while (stack.length > 0) {
      const node = stack.pop();
      if (node.w > CONFIG.MIN_PARTITION_SIZE * 2 || node.h > CONFIG.MIN_PARTITION_SIZE * 2) {
        if (node.split(CONFIG.MIN_PARTITION_SIZE)) {
          stack.push(node.left, node.right);
        }
      }
    }
    root.createRoom(CONFIG.MIN_ROOM_SIZE, CONFIG.MAX_ROOM_SIZE);

    this.rooms = [];
    for (const leaf of root.getLeaves()) {
      if (leaf.room) {
        this._carveRoom(leaf.room);
        this.rooms.push(leaf.room);
      }
    }

    this._connectRooms(root);
  }

  _carveRoom(room) {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        this.map[y][x].type = TILE.FLOOR;
      }
    }
  }

  _connectRooms(node) {
    if (!node.left || !node.right) return;
    this._connectRooms(node.left);
    this._connectRooms(node.right);
    const roomA = node.left.getRoom();
    const roomB = node.right.getRoom();
    if (roomA && roomB) {
      this._createCorridor(
        Math.floor(roomA.x + roomA.w / 2),
        Math.floor(roomA.y + roomA.h / 2),
        Math.floor(roomB.x + roomB.w / 2),
        Math.floor(roomB.y + roomB.h / 2)
      );
    }
  }

  _createCorridor(x1, y1, x2, y2) {
    let cx = x1, cy = y1;
    if (Math.random() < 0.5) {
      while (cx !== x2) {
        this.map[cy][cx].type = TILE.FLOOR;
        cx += cx < x2 ? 1 : -1;
      }
      while (cy !== y2) {
        this.map[cy][cx].type = TILE.FLOOR;
        cy += cy < y2 ? 1 : -1;
      }
    } else {
      while (cy !== y2) {
        this.map[cy][cx].type = TILE.FLOOR;
        cy += cy < y2 ? 1 : -1;
      }
      while (cx !== x2) {
        this.map[cy][cx].type = TILE.FLOOR;
        cx += cx < x2 ? 1 : -1;
      }
    }
    this.map[cy][cx].type = TILE.FLOOR;
  }

  _placeStairs() {
    const first = this.rooms[0];
    const last = this.rooms[this.rooms.length - 1];
    this.startPos = {
      x: Math.floor(first.x + first.w / 2),
      y: Math.floor(first.y + first.h / 2),
    };
    this.endPos = {
      x: Math.floor(last.x + last.w / 2),
      y: Math.floor(last.y + last.h / 2),
    };
    if (this.floorNum > 1) {
      this.map[this.startPos.y][this.startPos.x].type = TILE.STAIRS_UP;
    }
    this.map[this.endPos.y][this.endPos.x].type = TILE.STAIRS_DOWN;

    // Place terminals in random rooms; one is always a shop
    const terminalRooms = [];
    for (let i = 1; i < this.rooms.length - 1; i++) {
      if (Math.random() < 0.3) {
        const r = this.rooms[i];
        const tx = rand(r.x + 1, r.x + r.w - 2);
        const ty = rand(r.y + 1, r.y + r.h - 2);
        if (this.map[ty][tx].type === TILE.FLOOR) {
          this.map[ty][tx].type = TILE.TERMINAL;
          terminalRooms.push({ x: tx, y: ty });
        }
      }
    }
    // Guarantee at least one terminal that is a shop
    if (terminalRooms.length === 0 && this.rooms.length > 2) {
      const r = this.rooms[Math.floor(this.rooms.length / 2)];
      const tx = Math.floor(r.x + r.w / 2);
      const ty = Math.floor(r.y + r.h / 2);
      if (this.map[ty][tx].type === TILE.FLOOR) {
        this.map[ty][tx].type = TILE.TERMINAL;
        terminalRooms.push({ x: tx, y: ty });
      }
    }
    // Pick one terminal to be the shop
    if (terminalRooms.length > 0) {
      const shopPos = randChoice(terminalRooms);
      this.map[shopPos.y][shopPos.x].isShop = true;
      this.shopPos = shopPos;
    }
  }

  isWalkable(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    const t = this.map[y][x].type;
    return t !== TILE.WALL;
  }

  isOpaque(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return true;
    return this.map[y][x].type === TILE.WALL;
  }

  // Recursive shadowcasting FOV
  updateFOV(px, py, radius) {
    // Reset visibility
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.map[y][x].visible = false;
      }
    }
    this.map[py][px].visible = true;
    this.map[py][px].explored = true;

    const OCTANTS = [
      [1, 0, 0, -1], [-1, 0, 0, -1], [1, 0, 0, 1], [-1, 0, 0, 1],
      [0, 1, -1, 0], [0, -1, -1, 0], [0, 1, 1, 0], [0, -1, 1, 0],
    ];

    for (const [xx, xy, yx, yy] of OCTANTS) {
      this._castLight(px, py, radius, 1, 1.0, 0.0, xx, xy, yx, yy);
    }
  }

  _castLight(cx, cy, radius, row, startSlope, endSlope, xx, xy, yx, yy) {
    if (startSlope < endSlope) return;
    let nextStartSlope = startSlope;
    for (let i = row; i <= radius; i++) {
      let blocked = false;
      for (let dx = -i; dx <= 0; dx++) {
        const dy = -i;
        const lSlope = (dx - 0.5) / (dy + 0.5);
        const rSlope = (dx + 0.5) / (dy - 0.5);
        if (startSlope < rSlope) continue;
        if (endSlope > lSlope) break;
        const sax = dx * xx + dy * xy;
        const say = dx * yx + dy * yy;
        if (Math.abs(sax) + Math.abs(say) <= radius) {
          const nx = cx + sax;
          const ny = cy + say;
          if (nx >= 0 && ny >= 0 && nx < this.width && ny < this.height) {
            this.map[ny][nx].visible = true;
            this.map[ny][nx].explored = true;
          }
        }
        if (blocked) {
          if (this.isOpaque(cx + sax, cy + say)) {
            nextStartSlope = rSlope;
            continue;
          } else {
            blocked = false;
            startSlope = nextStartSlope;
          }
        } else if (this.isOpaque(cx + sax, cy + say)) {
          blocked = true;
          nextStartSlope = rSlope;
          this._castLight(cx, cy, radius, i + 1, startSlope, lSlope, xx, xy, yx, yy);
        }
      }
      if (blocked) break;
    }
  }

  getFloorTiles() {
    const tiles = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.map[y][x].type === TILE.FLOOR) tiles.push({ x, y });
      }
    }
    return tiles;
  }

  getEmptyFloorTile(exclude = []) {
    const tiles = this.getFloorTiles().filter(t =>
      !this.map[t.y][t.x].entity &&
      !this.map[t.y][t.x].item &&
      this.map[t.y][t.x].type === TILE.FLOOR &&
      !exclude.some(e => e.x === t.x && e.y === t.y)
    );
    return randChoice(tiles);
  }
}
