import { Editor } from "tldraw"
import { Geo, Particle, Sand, particles } from "./particles"

type ParticleConstructor = new (
	p5: p5,
	x: number,
	y: number,
	worldSize: number,
	world: (Particle | null)[],
) => Particle

export class FallingSand {
	editor: Editor
	canvas: HTMLCanvasElement
	ctx: CanvasRenderingContext2D
	width: number
	height: number
	buffer: p5.Graphics | null = null
	cellSize = 5
	worldSize = 200
	world: (Particle | null)[]
	particleTypes = particles

	constructor(editor: Editor) {
		this.editor = editor
		this.width = window.innerWidth
		this.height = window.innerHeight
		this.world = new Array(this.worldSize * this.worldSize).fill(null)

		/** We mirror tldraw geometry to the particle world */
		editor.store.onAfterChange = (_, next, __) => {
			if (next.typeName !== "shape") return
			this.updateSolidShapes()
		}
		editor.store.onAfterDelete = (prev, _) => {
			if (prev.typeName !== "shape") return
			this.updateSolidShapes()
		}

		this.p5 = new p5((sketch: p5) => {
			sketch.setup = () => {
				sketch.createCanvas(this.width, this.height)
				this.buffer = sketch.createGraphics(this.width, this.height)

				this.createRandomSand(sketch)
			}
			sketch.draw = () => {
				if (!this.buffer) return

				this.buffer.push()
				this.buffer.clear()
				this.buffer.background("white")

				// Align buffer with tldraw camera/scene
				const cam = this.editor.getCamera()
				this.buffer.scale(cam.z)
				this.buffer.translate(cam.x, cam.y)

				// draw debug outline
				this.buffer.rect(
					0,
					0,
					this.worldSize * this.cellSize,
					this.worldSize * this.cellSize,
				)

				this.handleInputs()
				this.updateParticles()
				this.drawParticles(this.buffer)
				this.buffer.pop()
				sketch.image(this.buffer, 0, 0)
			}
		})
	}

	handleInputs() {
		// Check if mouse is down and add particles
		if (
			this.editor.getCurrentToolId() === "sand" &&
			this.editor.inputs.isPointing
		) {
			const path = this.editor.getPath() as keyof typeof this.particleTypes
			const parts = path.split(".")
			const leaf = parts[parts.length - 1]
			const type = this.particleTypes[leaf as keyof typeof this.particleTypes]

			if (type) {
				this.addParticleAtPointer(type)
			}
		}
	}

	updateParticles() {
		// Update particles
		for (let y = this.worldSize - 1; y >= 0; y--) {
			if (y % 2 === 0) {
				for (let x = 0; x < this.worldSize; x++) {
					const particle = this.world[y * this.worldSize + x]
					if (particle) particle.update()
				}
			} else {
				for (let x = this.worldSize - 1; x >= 0; x--) {
					const particle = this.world[y * this.worldSize + x]
					if (particle) particle.update()
				}
			}
		}
	}

	drawParticles(buffer: p5.Graphics) {
		buffer.noStroke()
		for (const cell of this.world) {
			if (cell) {
				buffer.fill(cell.color)
				buffer.rect(
					cell.position.x * this.cellSize,
					cell.position.y * this.cellSize,
					this.cellSize,
					this.cellSize,
				)
			}
		}
	}

	createRandomSand(sketch: p5) {
		for (let i = 0; i < 500; i++) {
			const x = Math.floor(sketch.random(this.worldSize))
			const y = Math.floor(sketch.random(this.worldSize))
			const sand = new Sand(sketch, x, y, this.worldSize, this.world)
			this.world[this.worldIndex(x, y)] = sand
		}
	}

	updateSolidShapes() {
		// Clear existing Geo particles
		for (let i = 0; i < this.world.length; i++) {
			if (this.world[i] && this.world[i] instanceof Geo) {
				this.world[i] = null
			}
		}

		const shapes = this.editor.getCurrentPageShapes()
		for (const shape of shapes) {
			const shapeGeo = this.editor.getShapeGeometry(shape)
			const vertices = shapeGeo.vertices
			const isClosed = shapeGeo.isClosed && shape.type !== "arrow"

			// Apply rotation to the vertices
			const rotatedVertices = vertices.map((vertex) => {
				const cosAngle = Math.cos(shape.rotation)
				const sinAngle = Math.sin(shape.rotation)
				const rotatedX = vertex.x * cosAngle - vertex.y * sinAngle
				const rotatedY = vertex.x * sinAngle + vertex.y * cosAngle
				return { x: rotatedX + shape.x, y: rotatedY + shape.y }
			})

			if (isClosed) {
				// Find the bounding box of the rotated shape
				let minX = Infinity
				let maxX = -Infinity
				let minY = Infinity
				let maxY = -Infinity
				for (const vertex of rotatedVertices) {
					minX = Math.min(minX, vertex.x)
					maxX = Math.max(maxX, vertex.x)
					minY = Math.min(minY, vertex.y)
					maxY = Math.max(maxY, vertex.y)
				}

				// Iterate over the bounding box and fill the shape
				for (
					let y = Math.floor(minY / this.cellSize);
					y <= Math.floor(maxY / this.cellSize);
					y++
				) {
					const intersections: number[] = []
					for (let i = 0; i < rotatedVertices.length; i++) {
						const v1 = rotatedVertices[i]
						const v2 = rotatedVertices[(i + 1) % rotatedVertices.length]
						if (
							(v1.y < y * this.cellSize && v2.y >= y * this.cellSize) ||
							(v2.y < y * this.cellSize && v1.y >= y * this.cellSize)
						) {
							const x =
								v1.x +
								((y * this.cellSize - v1.y) / (v2.y - v1.y)) * (v2.x - v1.x)
							intersections.push(x)
						}
					}
					intersections.sort((a, b) => a - b)
					for (let i = 0; i < intersections.length; i += 2) {
						const startX = Math.floor(intersections[i] / this.cellSize)
						const endX = Math.floor(intersections[i + 1] / this.cellSize)
						for (let x = startX; x <= endX; x++) {
							this.setParticleInPageSpace(
								x * this.cellSize,
								y * this.cellSize,
								Geo,
							)
						}
					}
				}
			} else {
				// Follow the outline of the open curve
				for (let i = 0; i < rotatedVertices.length - 1; i++) {
					const v1 = rotatedVertices[i]
					const v2 = rotatedVertices[i + 1]
					const dx = v2.x - v1.x
					const dy = v2.y - v1.y
					const steps = Math.max(Math.abs(dx), Math.abs(dy)) / this.cellSize
					for (let t = 0; t <= steps; t++) {
						const x = v1.x + (dx * t) / steps
						const y = v1.y + (dy * t) / steps
						this.setParticleInPageSpace(x, y, Geo)
					}
				}
			}
		}
	}

	worldIndex(x: number, y: number) {
		return y * this.worldSize + x
	}

	setParticleInPageSpace(x: number, y: number, particle: ParticleConstructor) {
		const gridX = Math.floor(x / this.cellSize)
		const gridY = Math.floor(y / this.cellSize)
		if (
			gridX >= 0 &&
			gridX < this.worldSize &&
			gridY >= 0 &&
			gridY < this.worldSize
		) {
			const p = new particle(this.p5, gridX, gridY, this.worldSize, this.world)
			this.world[this.worldIndex(gridX, gridY)] = p
		}
	}

	addParticleAtPointer(particle: ParticleConstructor) {
		const { x: pointerX, y: pointerY } = this.editor.inputs.currentPagePoint
		const radius = 50

		for (let i = 0; i < radius; i++) {
			const angle = (i / radius) * 2 * Math.PI
			const particleX = pointerX + radius * Math.cos(angle)
			const particleY = pointerY + radius * Math.sin(angle)
			const gridX = Math.floor(particleX / this.cellSize)
			const gridY = Math.floor(particleY / this.cellSize)

			if (
				gridX >= 0 &&
				gridX < this.worldSize &&
				gridY >= 0 &&
				gridY < this.worldSize
			) {
				const p = new particle(
					this.p5,
					gridX,
					gridY,
					this.worldSize,
					this.world,
				)
				this.world[this.worldIndex(gridX, gridY)] = p
			}
		}
	}
}
