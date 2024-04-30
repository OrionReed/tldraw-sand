import { Editor, createShapeId } from "@tldraw/tldraw";
import p5 from "p5";

export class Underlay {
  editor: Editor
  p5: p5
  width: number
  height: number
  buffer: p5.Graphics | null = null
  gridSize = 10;

  constructor(editor: Editor) {
    this.editor = editor
    this.width = window.innerWidth;
    this.height = window.innerHeight;
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

        for (let i = 0; i < 100; i++) {
          for (let j = 0; j < 100; j++) {
            this.buffer.fill(this.p5.color(this.p5.random(255), this.p5.random(255), this.p5.random(255)));
            this.buffer.square(i * this.gridSize, j * this.gridSize, this.gridSize);
          }
        }
        this.buffer.pop();
        sketch.image(this.buffer, 0, 0);
      };
    });
  }
}