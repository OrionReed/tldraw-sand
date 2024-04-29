import { Editor, TLCamera, TLRecord, TLShape, TLShapeId, VecLike } from "@tldraw/tldraw";
import p5 from "p5";
import { Particle, Sand, Water, Stone } from './sand/particle'



export class SandSim {
  editor: Editor
  p5: p5
  width: number
  height: number

  brushSize = 6;
  paused = false;
  gridSize = 300;
  frameRates = [];

  displayImage: any;
  particles: Particle[] = [];
  grid = new Array(this.gridSize * this.gridSize).fill(null);

  particleTypes = [
    { name: 'Sand', particle: Sand },
    // { name: 'Water', particle: Water },
    // { name: 'Stone', particle: Stone }
  ];
  selectedType = 0;
  // histories: CircularBufferDict<TLShapeId, TLShape>;

  constructor(editor: Editor) {
    this.editor = editor
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.p5 = new p5((sketch: p5) => {
      sketch.setup = () => {

        const size = sketch.min(this.width * 0.9, this.height);
        const cnv = sketch.createCanvas(size, size);
        cnv.style('marginLeft', `${sketch.max(this.width * 0.1, this.width * 0.5 - size * 0.5)}px`);
        cnv.style('marginTop', `${this.height * 0.5 - size * 0.5}px`);

        this.displayImage = sketch.createImage(this.gridSize, this.gridSize);
        this.displayImage.loadPixels();

        // const particleSelect = sketch.select('#particleSelect');
        // particleSelect.style('right', `${sketch.min(this.width * 0.9 + 5, this.width * 0.5 + size * 0.5 + 5)}px`);

        // this.particleTypes.map((type, i) => {

        //   let t = new type.particle({ offset: 0, position: { x: 0, y: 0 } });
        //   let d = createElement('div');
        //   let p = createElement('p', type.name);

        //   if (i == selectedType) d.class('selected');
        //   d.style('background', `rgb(${t.color[0]}, ${t.color[1]}, ${t.color[2]} )`);
        //   p.parent(d);
        //   d.parent(particleSelect);
        //   d.mouseClicked(() => {

        //     selectedType = i;

        //     for (let i = 0; i < d.elt.parentElement.children.length; i++) {
        //       let elt = d.elt.parentElement.children[i];
        //       elt.className = '';
        //       if (i == selectedType) elt.className = 'selected';
        //     }

        //   })

        // });
      };
      sketch.draw = () => {

        sketch.background(0);

        //add new particles
        if (sketch.mouseIsPressed) {
          this.addParticles();
        }

        //simulate (twice, to speed things up a bit)
        this.simulate();
        this.simulate();


        //display simulation
        this.displayImage.updatePixels();
        sketch.image(this.displayImage, 0, 0, this.width, this.height);

        //display mouse
        sketch.stroke(255);
        sketch.noFill();
        sketch.circle(sketch.mouseX, sketch.mouseY, this.brushSize * this.brushSize + 1);

        //display info
        // sketch.noStroke();
        // sketch.fill(255);
        // sketch.text((this.paused) ? 'PAUSED' : 'Playing', this.width * 0.48, 15);
        // text('Fps: ' + meanFps(), 5, 15);
        // text('Particles: ' + particles.length, 5, 30);
        // text('Brush size: ' + (brushSize + 1), 5, 45);

      };
    });
  }


  simulate() {

    for (let i = this.particles.length - 1; i >= 0; i--) {

      this.particles[i].update();

    }
  }

  addParticles() {

    if (this.p5.mouseX < 0 || this.p5.mouseX > this.width || this.p5.mouseY < 0 || this.p5.mouseY > this.height) return;

    const x = this.p5.floor((this.p5.mouseX / this.width) * (this.gridSize));
    const y = this.p5.floor((this.p5.mouseY / this.height) * (this.gridSize));
    const bR = this.p5.map(this.brushSize, 0, 8, 0.5, 0.1);

    if (this.p5.mouseButton === this.p5.LEFT) {

      for (let y1 = -this.brushSize; y1 <= this.brushSize; y1++) {

        for (let x1 = -this.brushSize; x1 <= this.brushSize; x1++) {

          if ((this.selectedType !== 2 && Math.random() > bR) ||
            x1 * x1 + y1 * y1 > this.brushSize * this.brushSize ||
            x + x1 >= this.gridSize || x + x1 < 0 ||
            y + y1 >= this.gridSize || y + y1 < 0) {
            continue;
          }

          const offset = (((y + y1) * this.gridSize) + (x + x1));

          if (!this.grid[offset]) {


            const newParticle = new this.particleTypes[this.selectedType].particle({
              offset: offset,
              position: { x: x + x1, y: y + y1 }
            });

            newParticle.display();
            this.grid[offset] = newParticle;
            this.particles.push(newParticle);

          }

        }
      }

    } else if (this.p5.mouseButton === this.p5.RIGHT) {

      for (let i = this.particles.length - 1; i >= 0; i--) {

        const p = this.particles[i];
        const dx = p.position.x - x
        const dy = p.position.y - y;
        if (dx * dx + dy * dy < this.brushSize * this.brushSize) {

          this.displayImage.pixels[p.offset * 4 + 0] = 0;
          this.displayImage.pixels[p.offset * 4 + 1] = 0;
          this.displayImage.pixels[p.offset * 4 + 2] = 0;
          this.grid[p.offset] = undefined;
          this.particles.splice(i, 1);
        }

      }

    }

  }
}