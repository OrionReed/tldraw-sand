import { Editor } from "tldraw"
import { Geo, Particle, Sand, particles } from "./particles"

type ParticleConstructor = new (
	x: number,
	y: number,
	worldSize: number,
	world: (Particle | null)[],
) => Particle

export class FallingSand {
	CELL_SIZE = 5
	WORLD_SIZE = 200
	BRUSH_RADIUS = 5

	editor: Editor
	canvas: HTMLCanvasElement
	ctx: CanvasRenderingContext2D
	buffer: CanvasRenderingContext2D
	width: number
	height: number
	world: (Particle | null)[]
	particleTypes = particles
	shuffledIndices: number[]

	constructor(editor: Editor) {
		this.editor = editor
		this.width = window.innerWidth
		this.height = window.innerHeight
		this.world = new Array(this.WORLD_SIZE * this.WORLD_SIZE).fill(null)
		this.shuffledIndices = this.generateShuffledIndices()

		this.canvas = document.createElement("canvas")
		const offscreenCanvas = document.createElement("canvas")
		offscreenCanvas.width = this.width
		offscreenCanvas.height = this.height
		this.canvas.width = this.width
		this.canvas.height = this.height
		const offscreenCtx = offscreenCanvas.getContext("2d")
		const ctx = this.canvas.getContext("2d")
		if (!ctx || !offscreenCtx) throw new Error("Could not get context")
		this.buffer = offscreenCtx
		this.ctx = ctx

		if (this.ctx) {
			document.body.appendChild(this.canvas)
		}

		/** We mirror tldraw geometry to the particle world */
		editor.store.onAfterChange = (_, next, __) => {
			if (next.typeName !== "shape") return
			this.updateSolidShapes()
		}
		editor.store.onAfterDelete = (prev, _) => {
			if (prev.typeName !== "shape") return
			this.updateSolidShapes()
		}

		this.createRandomDebugSand()
		requestAnimationFrame(() => this.draw())
	}

	draw() {
		if (!this.buffer) return

		// Clear the buffer and main canvas
		this.buffer.clearRect(0, 0, this.width, this.height)
		this.ctx.clearRect(0, 0, this.width, this.height)

		// Align buffer with tldraw camera/scene
		const cam = this.editor.getCamera()
		this.buffer.scale(cam.z, cam.z)
		this.buffer.translate(cam.x, cam.y)

		// Draw debug outline
		this.buffer.strokeStyle = "black"
		this.buffer.strokeRect(
			0,
			0,
			this.WORLD_SIZE * this.CELL_SIZE,
			this.WORLD_SIZE * this.CELL_SIZE,
		)

		this.handleInputs()
		this.updateParticles()
		this.drawParticles()

		// Reset transformations for main canvas
		this.ctx.setTransform(1, 0, 0, 1, 0, 0)
		this.buffer.setTransform(1, 0, 0, 1, 0, 0)
		this.ctx.drawImage(this.buffer.canvas, 0, 0)
		requestAnimationFrame(() => this.draw())
	}

	generateShuffledIndices() {
		const shuffledIndices: number[] = []
		// Helper method to shuffle an array in-place using Fisher-Yates algorithm
		function shuffleArray(array: number[]) {
			for (let i = array.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1))
				;[array[i], array[j]] = [array[j], array[i]]
			}
		}
		// Pre-generate shuffled indices for the entire world
		for (let y = this.WORLD_SIZE - 1; y >= 0; y--) {
			const rowIndices = Array.from(
				{ length: this.WORLD_SIZE },
				(_, i) => y * this.WORLD_SIZE + i,
			)
			shuffleArray(rowIndices)
			shuffledIndices.push(...rowIndices)
		}
		return shuffledIndices
	}

	previousPointer: { x: number; y: number } | null = { x: 0, y: 0 }

	handleInputs() {
		// Check if mouse is down and add particles
		if (
			this.editor.getCurrentToolId() === "sand" &&
			this.editor.inputs.isPointing &&
			// only left click though!
			this.editor.inputs.buttons.has(0)
		) {
			const path = this.editor.getPath() as keyof typeof this.particleTypes
			const parts = path.split(".")
			const leaf = parts[parts.length - 1]
			const type = this.particleTypes[leaf as keyof typeof this.particleTypes]

			const currentPointer = this.editor.inputs.currentPagePoint
			if (this.previousPointer) {
				if (
					currentPointer.x !== this.previousPointer.x ||
					currentPointer.y !== this.previousPointer.y
				) {
					const dx = currentPointer.x - this.previousPointer.x
					const dy = currentPointer.y - this.previousPointer.y
					const distance = Math.sqrt(dx ** 2 + dy ** 2)
					const steps = Math.max(1, Math.floor(distance / this.CELL_SIZE))
					for (let i = 0; i < steps; i++) {
						const x = this.previousPointer.x + (dx * i) / steps
						const y = this.previousPointer.y + (dy * i) / steps
						this.addBrushParticles(type, { x, y })
					}
				}
			}
			if (type) {
				this.addBrushParticles(type, currentPointer)
			}
			this.previousPointer = { x: currentPointer.x, y: currentPointer.y }
		} else {
			this.previousPointer = null
		}
	}

	updateParticles() {
		// Update particles in the shuffled order
		for (const index of this.shuffledIndices) {
			const particle = this.world[index]
			if (particle) particle.update()
		}
	}

	drawParticles() {
		if (!this.buffer) return
		for (const cell of this.world) {
			if (cell) {
				this.buffer.fillStyle = cell.color
				this.buffer.fillRect(
					cell.position.x * this.CELL_SIZE,
					cell.position.y * this.CELL_SIZE,
					this.CELL_SIZE,
					this.CELL_SIZE,
				)
			}
		}
	}

	createRandomDebugSand() {
		for (let i = 0; i < 500; i++) {
			const x = Math.floor(Math.random() * this.WORLD_SIZE)
			const y = Math.floor(Math.random() * this.WORLD_SIZE)
			const sand = new Sand(x, y, this.WORLD_SIZE, this.world)
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
					let y = Math.floor(minY / this.CELL_SIZE);
					y <= Math.floor(maxY / this.CELL_SIZE);
					y++
				) {
					const intersections: number[] = []
					for (let i = 0; i < rotatedVertices.length; i++) {
						const v1 = rotatedVertices[i]
						const v2 = rotatedVertices[(i + 1) % rotatedVertices.length]
						if (
							(v1.y < y * this.CELL_SIZE && v2.y >= y * this.CELL_SIZE) ||
							(v2.y < y * this.CELL_SIZE && v1.y >= y * this.CELL_SIZE)
						) {
							const x =
								v1.x +
								((y * this.CELL_SIZE - v1.y) / (v2.y - v1.y)) * (v2.x - v1.x)
							intersections.push(x)
						}
					}
					intersections.sort((a, b) => a - b)
					for (let i = 0; i < intersections.length; i += 2) {
						const startX = Math.floor(intersections[i] / this.CELL_SIZE)
						const endX = Math.floor(intersections[i + 1] / this.CELL_SIZE)
						for (let x = startX; x <= endX; x++) {
							this.setParticleInPageSpace(
								x * this.CELL_SIZE,
								y * this.CELL_SIZE,
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
					const steps = Math.max(Math.abs(dx), Math.abs(dy)) / this.CELL_SIZE
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
		return y * this.WORLD_SIZE + x
	}

	setParticleInPageSpace(x: number, y: number, particle: ParticleConstructor) {
		const gridX = Math.floor(x / this.CELL_SIZE)
		const gridY = Math.floor(y / this.CELL_SIZE)
		this.setParticleInSandSpace(gridX, gridY, particle)
	}

	setParticleInSandSpace(x: number, y: number, particle: ParticleConstructor) {
		if (x >= 0 && x < this.WORLD_SIZE && y >= 0 && y < this.WORLD_SIZE) {
			const p = new particle(x, y, this.WORLD_SIZE, this.world)
			this.world[this.worldIndex(x, y)] = p
		}
	}

	addBrushParticles(
		particle: ParticleConstructor,
		point: { x: number; y: number },
	) {
		const { x: pointerX, y: pointerY } = point
		const radius = this.BRUSH_RADIUS

		const pointerGridX = Math.floor(pointerX / this.CELL_SIZE)
		const pointerGridY = Math.floor(pointerY / this.CELL_SIZE)

		for (let y = pointerGridY - radius; y < pointerGridY + radius; y++) {
			for (let x = pointerGridX - radius; x < pointerGridX + radius; x++) {
				const distance = Math.sqrt(
					(x - pointerGridX) ** 2 + (y - pointerGridY) ** 2,
				)
				if (distance < radius) {
					this.setParticleInSandSpace(x, y, particle)
				}
			}
		}
	}
}
