import p5 from "p5";
import { FallingSand } from "./FallingSand";

abstract class Particle {
  position: p5.Vector;
  gridSize: number;
  grid: (Particle | null)[];
  sandEnv: FallingSand;
  abstract color: p5.Color;

  constructor(public p5: p5, x: number, y: number, gridSize: number, grid: (Particle | null)[], sandEnv: FallingSand) {
    this.position = p5.createVector(x, y);
    this.gridSize = gridSize;
    this.grid = grid;
    this.sandEnv = sandEnv;
  }

  abstract update(): void;

  protected canMoveTo(index: number): boolean {
    return !this.grid[index]
  }

  protected delete() {
    this.grid[this.position.y * this.gridSize + this.position.x] = null;
  }

  protected moveParticle(newX: number, newY: number) {
    // Calculate current and new chunk indices
    const currentChunkX = Math.floor(this.position.x / this.gridSize);
    const currentChunkY = Math.floor(this.position.y / this.gridSize);
    const newChunkX = Math.floor(newX / this.gridSize);
    const newChunkY = Math.floor(newY / this.gridSize);

    // Check if the particle is moving to a different chunk
    if (currentChunkX !== newChunkX || currentChunkY !== newChunkY) {
      // Remove particle from current chunk
      this.grid[this.position.y * this.gridSize + this.position.x] = null;

      // Get new chunk and update particle position
      const newChunk = this.sandEnv.getChunk(newChunkX, newChunkY);
      this.position.x = newX % this.gridSize; // Local position within the new chunk
      this.position.y = newY % this.gridSize; // Local position within the new chunk

      // Add particle to new chunk
      newChunk.particles[this.position.y * newChunk.chunkSize + this.position.x] = this;
    } else {
      // Move within the same chunk
      this.grid[this.position.y * this.gridSize + this.position.x] = null;
      this.position.x = newX;
      this.position.y = newY;
      this.grid[newY * this.gridSize + newX] = this;
    }
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
    if (this.canMoveTo(below)) {
      this.moveParticle(x, y + 1);
    } else if (this.canMoveTo(belowRight)) {
      this.moveParticle(x + 1, y + 1);
    } else if (this.canMoveTo(belowLeft)) {
      this.moveParticle(x - 1, y + 1);
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
    if (this.canMoveTo(below)) {
      this.moveParticle(x, y + 1);
      return
    }
    const canMoveRight = this.canMoveTo(right);
    const canMoveLeft = this.canMoveTo(left);

    if (canMoveRight && canMoveLeft) {
      const random = this.p5.random(0, 1);
      if (random < 0.5) {
        this.moveParticle(x + 1, y);
      } else {
        this.moveParticle(x - 1, y);
      }
    } else if (canMoveRight) {
      this.moveParticle(x + 1, y);
    } else if (canMoveLeft) {
      this.moveParticle(x - 1, y);
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
  color = this.p5.color('#e8e8e8');
  update() {
    // Intentionally left empty
  }
}
class Air extends Particle {
  color = this.p5.color('red');
  update() {
    this.delete();
  }
}

export const particles = {
  sand: Sand,
  stone: Stone,
  water: Water,
  geo: Geo,
  air: Air,
}

export { Particle, Sand, Stone, Water, Geo, Air }
