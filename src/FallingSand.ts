import { Editor, VecLike } from "tldraw";
import p5 from "p5";
import { Geo, Particle, Sand, particles } from "./particles";

type ParticleConstructor = new (p5: p5, x: number, y: number, worldSize: number, world: (Particle | null)[], sandEnv: FallingSand) => Particle;

class Chunk {
  particles: (Particle | null)[];
  x: number;
  y: number;
  chunkSize: number;

  constructor(x: number, y: number, chunkSize: number) {
    this.x = x;
    this.y = y;
    this.chunkSize = chunkSize;
    this.particles = new Array(chunkSize * chunkSize).fill(null);
  }

  getParticle(x: number, y: number): Particle | null {
    const index = y * this.chunkSize + x;
    return this.particles[index];
  }

  setParticle(x: number, y: number, particle: Particle): void {
    const index = y * this.chunkSize + x;
    this.particles[index] = particle;
  }
}

export class FallingSand {
  editor: Editor
  p5: p5
  width: number
  height: number
  buffer: p5.Graphics | null = null
  /** The size of each cell in page space */
  cellSize = 10;
  /** The size of each chunk in cells */
  chunkSize = 100;
  /** The chunks of the world, all coordinates are in cell space */
  chunks: Map<string, Chunk>;
  particleTypes = particles;

  constructor(editor: Editor) {
    this.editor = editor
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.chunks = new Map();

    /** We mirror tldraw geometry to the particle world */
    editor.store.onAfterChange = (_, next, __) => {
      if (next.typeName !== 'shape') return;
      this.updateSolidShapes()
    }
    editor.store.onAfterDelete = (prev, _) => {
      if (prev.typeName !== 'shape') return;
      this.updateSolidShapes()
    }

    this.p5 = new p5((sketch: p5) => {
      sketch.setup = () => {
        sketch.createCanvas(this.width, this.height);
        this.buffer = sketch.createGraphics(this.width, this.height);
        sketch.frameRate(1000);
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

        // draw debug outline
        for (const chunk of this.chunkValues()) {
          const x = chunk.x * this.chunkSize * this.cellSize;
          const y = chunk.y * this.chunkSize * this.cellSize;
          const width = this.chunkSize * this.cellSize;
          const height = this.chunkSize * this.cellSize;
          this.buffer.rect(x, y, width, height);
        }

        this.handleInputs()
        this.updateParticles()
        this.drawParticles(this.buffer)
        this.buffer.pop();
        sketch.image(this.buffer, 0, 0);
      };
    });
  }

  *chunkValues() {
    for (const chunk of this.chunks.values()) {
      yield chunk;
    }
  }

  pageToCell(x: number, y: number): VecLike {
    return { x: Math.floor(x / this.cellSize), y: Math.floor(y / this.cellSize) };
  }

  cellToPage(x: number, y: number): VecLike {
    return { x: x * this.cellSize, y: y * this.cellSize };
  }

  /** takes coords in cell space */
  getChunk(x: number, y: number): Chunk {
    const chunkX = Math.floor(x / this.chunkSize);
    const chunkY = Math.floor(y / this.chunkSize);
    const key = `${chunkX},${chunkY}`;

    if (!this.chunks.has(key)) {
      this.chunks.set(key, new Chunk(chunkX, chunkY, this.chunkSize));
    }

    return this.chunks.get(key) as Chunk;
  }


  /** takes coords in cell space */
  setParticle(x: number, y: number, particleConstructor: ParticleConstructor) {
    const chunk = this.getChunk(x, y);
    // const localX = x % this.chunkSize;
    // const localY = y % this.chunkSize;
    chunk.setParticle(x, y, new particleConstructor(this.p5, x, y, this.chunkSize, chunk.particles, this));
  }

  /** takes coords in cell space */
  getParticle(x: number, y: number): Particle | null {
    const chunk = this.getChunk(x, y);
    const localX = x % this.chunkSize;
    const localY = y % this.chunkSize;
    return chunk.getParticle(localX, localY);
  }

  handleInputs() {
    // Check if mouse is down and add particles
    if (this.editor.getCurrentToolId() === 'sand' && this.editor.inputs.isPointing) {
      const path = this.editor.getPath() as keyof typeof this.particleTypes;
      const parts = path.split('.')
      const leaf = parts[parts.length - 1]
      const type = this.particleTypes[leaf as keyof typeof this.particleTypes]

      if (type) {
        this.addParticlesAtPointer(type)
      }
    }
  }

  updateParticles() {
    // Iterate over each chunk in the world map
    for (const chunk of this.chunkValues()) {
      // Update particles
      for (let y = this.chunkSize - 1; y >= 0; y--) {
        if (y % 2 === 0) {
          for (let x = 0; x < this.chunkSize; x++) {
            const particle = chunk.particles[y * this.chunkSize + x];
            if (particle) particle.update();
          }
        } else {
          for (let x = this.chunkSize - 1; x >= 0; x--) {
            const particle = chunk.particles[y * this.chunkSize + x];
            if (particle) particle.update();
          }
        }
      }
    }
  }

  drawParticles(buffer: p5.Graphics) {
    buffer.noStroke();
    for (const chunk of this.chunkValues()) {
      for (const cell of chunk.particles) {
        if (cell) {
          buffer.fill(cell.color);
          buffer.rect(cell.position.x * this.cellSize, cell.position.y * this.cellSize, this.cellSize, this.cellSize);
        }
      }
    }
  }

  updateSolidShapes() {
    // Clear existing Geo particles
    for (const chunk of this.chunkValues()) {
      for (let i = 0; i < chunk.particles.length; i++) {
        if (chunk.particles[i] && chunk.particles[i] instanceof Geo) {
          chunk.particles[i] = null;
        }
      }
    }

    const shapes = this.editor.getCurrentPageShapes();
    for (const shape of shapes) {
      const shapeGeo = this.editor.getShapeGeometry(shape);
      const vertices = shapeGeo.vertices;
      const isClosed = shapeGeo.isClosed && shape.type !== 'arrow';

      // Apply rotation to the vertices
      const rotatedVertices = vertices.map(vertex => {
        const cosAngle = Math.cos(shape.rotation);
        const sinAngle = Math.sin(shape.rotation);
        const rotatedX = vertex.x * cosAngle - vertex.y * sinAngle;
        const rotatedY = vertex.x * sinAngle + vertex.y * cosAngle;
        return { x: rotatedX + shape.x, y: rotatedY + shape.y };
      });

      if (isClosed) {
        // Find the bounding box of the rotated shape
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const vertex of rotatedVertices) {
          minX = Math.min(minX, vertex.x);
          maxX = Math.max(maxX, vertex.x);
          minY = Math.min(minY, vertex.y);
          maxY = Math.max(maxY, vertex.y);
        }

        // Iterate over the bounding box and fill the shape
        for (let y = Math.floor(minY / this.cellSize); y <= Math.floor(maxY / this.cellSize); y++) {
          const intersections: number[] = [];
          for (let i = 0; i < rotatedVertices.length; i++) {
            const v1 = rotatedVertices[i];
            const v2 = rotatedVertices[(i + 1) % rotatedVertices.length];
            if ((v1.y < y * this.cellSize && v2.y >= y * this.cellSize) || (v2.y < y * this.cellSize && v1.y >= y * this.cellSize)) {
              const x = v1.x + ((y * this.cellSize - v1.y) / (v2.y - v1.y)) * (v2.x - v1.x);
              intersections.push(x);
            }
          }
          intersections.sort((a, b) => a - b);
          for (let i = 0; i < intersections.length; i += 2) {
            const startX = Math.floor(intersections[i] / this.cellSize);
            const endX = Math.floor(intersections[i + 1] / this.cellSize);
            for (let x = startX; x <= endX; x++) {
              this.setParticleInPageSpace(x * this.cellSize, y * this.cellSize, Geo);
            }
          }
        }
      } else {
        // Follow the outline of the open curve
        for (let i = 0; i < rotatedVertices.length - 1; i++) {
          const v1 = rotatedVertices[i];
          const v2 = rotatedVertices[i + 1];
          const dx = v2.x - v1.x;
          const dy = v2.y - v1.y;
          const steps = Math.max(Math.abs(dx), Math.abs(dy)) / this.cellSize;
          for (let t = 0; t <= steps; t++) {
            const x = v1.x + (dx * t) / steps;
            const y = v1.y + (dy * t) / steps;
            this.setParticleInPageSpace(x, y, Geo);
          }
        }
      }
    }
  }

  setParticleInPageSpace(x: number, y: number, particle: ParticleConstructor) {
    const cellCoord = this.pageToCell(x, y)
    this.setParticle(cellCoord.x, cellCoord.y, particle)
  }

  addParticlesAtPointer(particle: ParticleConstructor) {
    const { x: pointerX, y: pointerY } = this.editor.inputs.currentPagePoint
    const radius = 50;

    for (let i = 0; i < radius; i++) {
      const angle = (i / radius) * 2 * Math.PI;
      const particleX = pointerX + radius * Math.cos(angle);
      const particleY = pointerY + radius * Math.sin(angle);
      const cellCoord = this.pageToCell(particleX, particleY)
      this.setParticle(cellCoord.x, cellCoord.y, particle)
    }
  }
}
