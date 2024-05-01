import { Editor, createShapeId } from "tldraw";
import p5 from "p5";
import { SandTool } from "./ui/SandTool";
import { Geo, Particle, Sand, particles } from "./particles";

type ParticleConstructor = new (p5: p5, x: number, y: number, worldSize: number, world: (Particle | null)[]) => Particle;

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
  particleTypes = particles

  constructor(editor: Editor) {
    this.editor = editor
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.world = new Array(this.worldSize * this.worldSize).fill(null);
    SandTool.children

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

        // draw debug outline
        this.buffer.rect(0, 0, this.worldSize * this.cellSize, this.worldSize * this.cellSize);

        // Check if mouse is down and add particles
        if (this.editor.getCurrentToolId() === 'sand' && this.editor.inputs.isPointing) {
          const path = this.editor.getPath() as keyof typeof this.particleTypes;
          const parts = path.split('.')
          const leaf = parts[parts.length - 1]
          const type = this.particleTypes[leaf as keyof typeof this.particleTypes]

          if (type) {
            this.addParticleAtPointer(type)
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

  setParticleInPageSpace(x: number, y: number, particle: ParticleConstructor) {
    const gridX = Math.floor(x / this.cellSize);
    const gridY = Math.floor(y / this.cellSize);
    const index = gridY * this.worldSize + gridX;
    if (gridX >= 0 && gridX < this.worldSize && gridY >= 0 && gridY < this.worldSize && !this.world[index]) {
      const p = new particle(this.p5, gridX, gridY, this.worldSize, this.world)
      this.particles.push(p);
      this.world[index] = p;
    }
  }

  addParticleAtPointer(particle: ParticleConstructor) {
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
