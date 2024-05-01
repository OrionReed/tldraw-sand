import p5 from "p5";

abstract class Particle {
  position: p5.Vector;
  gridSize: number;
  grid: (Particle | null)[];
  abstract color: p5.Color;

  constructor(public p5: p5, x: number, y: number, gridSize: number, grid: (Particle | null)[]) {
    this.position = p5.createVector(x, y);
    this.gridSize = gridSize;
    this.grid = grid;
  }

  abstract update(): void;

  protected canMoveTo(index: number): boolean {
    return !this.grid[index]
  }

  protected moveParticle(newX: number, newY: number, newIndex: number) {
    // Update grid references
    this.grid[this.position.y * this.gridSize + this.position.x] = null;
    this.position.x = newX;
    this.position.y = newY;
    this.grid[newIndex] = this;
  }
}

class Sand extends Particle {
  color = this.p5.color(this.p5.random(220, 240), this.p5.random(170, 180), this.p5.random(50, 70));
  update() {
    const x = this.position.x;
    const y = this.position.y;
    const below = (y + 1) * this.gridSize + x;
    const belowRight = (y + 1) * this.gridSize + (x + 1);
    const belowLeft = (y + 1) * this.gridSize + (x - 1);

    // Check and move to the new position if possible
    if (y + 1 < this.gridSize && this.canMoveTo(below)) {
      this.moveParticle(x, y + 1, below);
    } else if (y + 1 < this.gridSize && x + 1 < this.gridSize && this.canMoveTo(belowRight)) {
      this.moveParticle(x + 1, y + 1, belowRight);
    } else if (y + 1 < this.gridSize && x - 1 >= 0 && this.canMoveTo(belowLeft)) {
      this.moveParticle(x - 1, y + 1, belowLeft);
    }
  }
}
class Water extends Particle {
  color = this.p5.color(0, 0, this.p5.random(100, 255));

  update() {
    const x = this.position.x;
    const y = this.position.y;
    const below = (y + 1) * this.gridSize + x;
    const right = y * this.gridSize + (x + 1);
    const left = y * this.gridSize + (x - 1);

    // Check and move to the new position if possible
    if (y + 1 < this.gridSize && this.canMoveTo(below)) {
      this.moveParticle(x, y + 1, below);
    } else if (x + 1 < this.gridSize && this.canMoveTo(right)) {
      this.moveParticle(x + 1, y, right);
    } else if (x - 1 >= 0 && this.canMoveTo(left)) {
      this.moveParticle(x - 1, y, left);
    }
  }
}

class Stone extends Particle {
  color = this.p5.color('grey');
  update() {
    // Intentionally left empty
  }
}
class Geo extends Particle {
  color = this.p5.color('black');
  update() {
    // Intentionally left empty
  }
}

export const particles = {
  sand: Sand,
  stone: Stone,
  water: Water,
  geo: Geo,
}

export { Particle, Sand, Stone, Water, Geo }
