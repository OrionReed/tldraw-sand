import { Editor, createShapeId } from "@tldraw/tldraw";
import p5 from "p5";

export class Underlay {
  editor: Editor
  p5: p5
  width: number
  height: number
  buffer: p5.Graphics | null = null
  cellSize = 10;
  gridSize = 100;
  particles: Particle[] = [];
  grid: (Particle | null)[];

  constructor(editor: Editor) {
    this.editor = editor
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.grid = new Array(this.gridSize * this.gridSize).fill(null);

    this.editor.createShape({
      id: createShapeId(),
      type: 'geo',
      x: 0,
      y: 0,
      props: {
        w: 100,
        h: 100,
      },
    })
    this.p5 = new p5((sketch: p5) => {
      sketch.setup = () => {
        sketch.createCanvas(this.width, this.height);
        this.buffer = sketch.createGraphics(this.width, this.height);

        for (let i = 0; i < 100; i++) {
          let x = Math.floor(sketch.random(this.gridSize));
          let y = Math.floor(sketch.random(this.gridSize));
          let sand = new Sand(sketch, x, y, sketch.color(194, 178, 128), this.cellSize, this.grid);
          this.particles.push(sand);
          this.grid[y * this.cellSize + x] = sand;
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

        // for (let i = 0; i < 100; i++) {
        //   for (let j = 0; j < 100; j++) {
        //     this.buffer.fill(this.p5.color(this.p5.random(255), this.p5.random(255), this.p5.random(255)));
        //     this.buffer.square(i * this.gridSize, j * this.gridSize, this.gridSize);
        //   }
        // }
        // Update particles
        for (const particle of this.particles) {
          particle.update();
        }

        // Draw particles
        this.buffer.fill('orange');
        this.buffer.noStroke();
        for (const particle of this.particles) {
          this.buffer.rect(particle.position.x * this.cellSize, particle.position.y * this.cellSize, this.cellSize, this.cellSize);
        }
        this.buffer.pop();
        sketch.image(this.buffer, 0, 0);
      };
    });
  }
}

abstract class Particle {
  position: p5.Vector;
  color: p5.Color;
  gridSize: number;
  grid: (Particle | null)[];

  constructor(public p5: p5, x: number, y: number, color: p5.Color, gridSize: number, grid: (Particle | null)[]) {
    this.position = p5.createVector(x, y);
    this.color = color;
    this.gridSize = gridSize;
    this.grid = grid;
  }

  abstract update(): void;
}

class Sand extends Particle {
  update() {
    const x = this.position.x;
    const y = this.position.y;
    const below = (y + 1) * this.gridSize + x;
    const belowRight = (y + 1) * this.gridSize + (x + 1);
    const belowLeft = (y + 1) * this.gridSize + (x - 1);

    if (y + 1 < this.gridSize && !this.grid[below]) {
      this.position.y += 1;
    } else if (y + 1 < this.gridSize && x + 1 < this.gridSize && !this.grid[belowRight]) {
      this.position.x += 1;
      this.position.y += 1;
    } else if (y + 1 < this.gridSize && x - 1 >= 0 && !this.grid[belowLeft]) {
      this.position.x -= 1;
      this.position.y += 1;
    }
  }
}