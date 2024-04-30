import { Editor, createShapeId } from "tldraw";
import p5 from "p5";

export class FallingSand {
  editor: Editor
  p5: p5
  width: number
  height: number
  buffer: p5.Graphics | null = null
  cellSize = 10;
  worldSize = 100;
  particles: Particle[] = [];
  world: (Particle | null)[];

  constructor(editor: Editor) {
    this.editor = editor
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.world = new Array(this.worldSize * this.worldSize).fill(null);

    editor.store.onAfterChange = (_, next, __) => {
      if (next.typeName !== 'shape') return;
      this.setShapesToStone()
    }

    this.editor.createShape({
      id: createShapeId(),
      type: 'geo',
      x: 0,
      y: 0,
      props: {
        w: 100,
        h: 100,
        fill: 'solid',
      },
    })
    this.p5 = new p5((sketch: p5) => {
      sketch.setup = () => {
        sketch.createCanvas(this.width, this.height);
        this.buffer = sketch.createGraphics(this.width, this.height);

        for (let i = 0; i < 500; i++) {
          const x = Math.floor(sketch.random(this.worldSize));
          const y = Math.floor(sketch.random(this.worldSize));
          const sand = new Sand(sketch, x, y, this.worldSize, this.world);
          this.particles.push(sand);
          this.world[y * this.worldSize + x] = sand;
        }
      };
      sketch.draw = () => {
        if (!this.buffer) return;

        this.buffer.push();
        this.buffer.clear();
        this.buffer.background('white');

        // Align buffer with tldraw camera/scene
        const cam = this.editor.getCamera();
        this.buffer.scale(cam.z);
        this.buffer.translate(cam.x, cam.y);

        this.buffer.rect(0, 0, this.worldSize * this.cellSize, this.worldSize * this.cellSize);
        // Check if mouse is down and add particles
        if (this.editor.inputs.isPointing) {
          if (this.editor.inputs.altKey) {
            this.addParticleAtPointer(Stone)
          }
          else {
            this.addParticleAtPointer(Sand)
          }
        }

        // Update particles
        for (const particle of this.particles) {
          particle.update();
        }

        // Draw particles
        this.buffer.noStroke();
        for (const particle of this.particles) {
          this.buffer.fill(particle.color);
          this.buffer.rect(particle.position.x * this.cellSize, particle.position.y * this.cellSize, this.cellSize, this.cellSize);
        }
        this.buffer.pop();
        sketch.image(this.buffer, 0, 0);
      };
    });
  }

  setShapesToStone() {
    const shapes = this.editor.getCurrentPageShapes();
    for (const shape of shapes) {
      const shapeGeo = this.editor.getShapeGeometry(shape)
      const vertices = shapeGeo.vertices
      for (const vertex of vertices) {
        this.setParticleInPageSpace(shape.x + vertex.x, shape.y + vertex.y, Geo)
      }
    }
  }

  setParticleInPageSpace(x: number, y: number, particle: new (...args: any[]) => Particle) {
    const gridX = Math.floor(x / this.cellSize);
    const gridY = Math.floor(y / this.cellSize);
    const index = gridY * this.worldSize + gridX;
    if (gridX >= 0 && gridX < this.worldSize && gridY >= 0 && gridY < this.worldSize && !this.world[index]) {
      const p = new particle(this.p5, gridX, gridY, this.worldSize, this.world)
      this.particles.push(p);
      this.world[index] = p;
    }
  }

  addParticleAtPointer<T extends Particle>(particle: new (...args: any[]) => T) {
    const { x: pointerX, y: pointerY } = this.editor.inputs.currentPagePoint
    const numParticles = 10;
    const radius = 10;

    for (let i = 0; i < numParticles; i++) {
      const angle = (i / numParticles) * 2 * Math.PI;
      const particleX = pointerX + radius * Math.cos(angle);
      const particleY = pointerY + radius * Math.sin(angle);
      const gridX = Math.floor(particleX / this.cellSize);
      const gridY = Math.floor(particleY / this.cellSize);
      const index = gridY * this.worldSize + gridX;

      if (gridX >= 0 && gridX < this.worldSize && gridY >= 0 && gridY < this.worldSize && !this.world[index]) {
        const p = new particle(this.p5, gridX, gridY, this.worldSize, this.world)
        this.particles.push(p);
        this.world[index] = p;
      }
    }
  }
}

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

  canMoveTo(index: number): boolean {
    return !this.grid[index]
  }

  moveParticle(newX: number, newY: number, newIndex: number) {
    // Update grid references
    this.grid[this.position.y * this.gridSize + this.position.x] = null;
    this.position.x = newX;
    this.position.y = newY;
    this.grid[newIndex] = this;
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