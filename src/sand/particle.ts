import p5 from "p5";

export abstract class Particle {

  offset: number;
  position: { x: number, y: number };
  colorOffset: number;
  sketch: p5;


  constructor(options: { offset: number, position: { x: number, y: number }, sketch: p5, grid, displayImage }) {

    this.sketch = options.sketch;
    this.offset = options.offset;
    this.position = options.position;
    this.colorOffset = Math.floor(this.sketch.noise(this.sketch.frameCount * 0.1) * 100);
  }

  update() {

    const newPos = this.findNewPosition(
      this.position.x,
      this.position.y
    );

    if (newPos) {

      this.replaceCurrentPosition();
      this.moveToNewPosition(newPos);

    }

    this.display();

  }

  replaceCurrentPosition() {

    grid[this.offset] = 0;
    displayImage.pixels[this.offset * 4 + 0] = 0;
    displayImage.pixels[this.offset * 4 + 1] = 0;
    displayImage.pixels[this.offset * 4 + 2] = 0;

  }

  moveToNewPosition(newPos) {

    this.position.x = newPos.x;
    this.position.y = newPos.y;
    this.offset = newPos.offset;
    grid[this.offset] = this;

  }

  display() {

    displayImage.pixels[this.offset * 4 + 0] = this.color[0];
    displayImage.pixels[this.offset * 4 + 1] = this.color[1];
    displayImage.pixels[this.offset * 4 + 2] = this.color[2];
    displayImage.pixels[this.offset * 4 + 3] = 255;

  }

  remove() {
    this.replaceCurrentPosition();
    particles.splice(particles.indexOf(this), 1);
  }

  abstract findNewPosition(x: number, y: number): { x: number, y: number, offset: number } | undefined;
}







export class Sand extends Particle {

  constructor(options) {

    super(options);
    this.name = 'Sand';
    this.value = 255;
    this.color = [149, 113, 95];
    this.wet = false;

  }

  findNewPosition(x, y) {

    let p1, p2, p3;
    if (y + 1 < gridSize) p1 = (((y + 1) * gridSize) + x);
    if (y + 1 < gridSize && x + 1 < gridSize) p2 = (((y + 1) * gridSize) + x + 1);
    if (y + 1 < gridSize && x - 1 >= 0) p3 = (((y + 1) * gridSize) + x - 1);

    if (p1 && (!grid[p1] || grid[p1].name == "Water")) {

      return { x: x, y: y + 1, offset: p1 };

    } else if (p2 && (!grid[p2] || grid[p2].name == "Water")) {

      return { x: x + 1, y: y + 1, offset: p2 };

    } else if (p3 && (!grid[p3] || grid[p3].name == "Water")) {

      return { x: x - 1, y: y + 1, offset: p3 };

    }

  }

  replaceCurrentPosition(newPos) {

    if (newPos && grid[newPos.offset] && grid[newPos.offset].name == 'Water') {

      grid[newPos.offset].position.x = this.position.x;
      grid[newPos.offset].position.y = this.position.y;
      grid[newPos.offset].offset = this.offset;

      grid[this.offset] = grid[newPos.offset]
      grid[this.offset].display();

      return;

    }

    super.replaceCurrentPosition();

  }

  display() {

    super.display();

    displayImage.pixels[this.offset * 4 + 0] -= this.colorOffset * 0.5;
    displayImage.pixels[this.offset * 4 + 1] -= this.colorOffset * 0.5;
    displayImage.pixels[this.offset * 4 + 2] -= this.colorOffset * 0.5;

    let darkerWet = (this.wet) ? 0.65 : 1.0;
    displayImage.pixels[this.offset * 4 + 0] *= darkerWet;
    displayImage.pixels[this.offset * 4 + 1] *= darkerWet;
    displayImage.pixels[this.offset * 4 + 2] *= darkerWet;

  }
}








// export class Water extends Particle {

//   constructor(options) {

//     super(options);
//     this.name = 'Water';
//     this.value = 254;
//     this.color = [10, 10, 250];

//   }

//   update() {

//     super.update();

//     for (let y = this.position.y + 1; y < gridSize; y++) {

//       let offset = (gridSize * y) + this.position.x;

//       if (grid[offset] && grid[offset].name == "Sand") {

//         if (grid[offset].wet != true && random() > 0.99) {

//           // let newPos = {x: this.position.x, y: y, offset: offset};
//           grid[offset].wet = true;
//           super.remove();
//           break;

//         }

//       } else {

//         break;

//       }

//     }

//   }

//   findNewPosition(x, y) {

//     let p1, p2, p3, p4, p5;
//     if (y + 1 < gridSize) p1 = (((y + 1) * gridSize) + x);
//     if (y + 1 < gridSize && x + 1 < gridSize) p2 = (((y + 1) * gridSize) + x + 1);
//     if (y + 1 < gridSize && x - 1 >= 0) p3 = (((y + 1) * gridSize) + x - 1);
//     if (x + 1 < gridSize) p4 = ((y * gridSize) + x + 1);
//     if (x - 1 >= 0) p5 = ((y * gridSize) + x - 1);


//     if (p1 && !grid[p1]) {

//       return { x: x, y: y + 1, offset: p1 };

//     } else if (p2 && !grid[p2]) {

//       return { x: x + 1, y: y + 1, offset: p2 };

//     } else if (p3 && !grid[p3]) {

//       return { x: x - 1, y: y + 1, offset: p3 };

//     } else if (p4 && !grid[p4]) {

//       return { x: x + 1, y: y, offset: p4 };

//     } else if (p5 && !grid[p5]) {

//       return { x: x - 1, y: y, offset: p5 };

//     }


//   }

//   display() {

//     super.display();
//     displayImage.pixels[this.offset * 4 + 2] -= this.colorOffset;

//   }

// }







// export class Stone extends Particle {

//   constructor(options) {

//     super(options);
//     this.name = 'Fixed';
//     this.value = 253;
//     this.color = [125, 125, 125];
//     // noise( frameCount * 0.4)
//     this.colorOffset = Math.floor((Math.random() * 2 - 1) * 50);

//   }

//   findNewPosition(x, y) {

//     return undefined;

//   }

//   display() {

//     super.display();
//     displayImage.pixels[this.offset * 4 + 0] += this.colorOffset;
//     displayImage.pixels[this.offset * 4 + 1] += this.colorOffset;
//     displayImage.pixels[this.offset * 4 + 2] += this.colorOffset;

//   }

// }


