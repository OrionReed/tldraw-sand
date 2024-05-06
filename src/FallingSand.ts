import { Editor, TLCamera } from "tldraw"
import {
	Air,
	Cell,
	Geo,
	ParticleConstructor,
	Sand,
	particles,
} from "./particles"
import { chance } from "./utils"

export class FallingSand {
	CELL_SIZE = 2
	WORLD_SIZE = 500
	BRUSH_RADIUS = 10
	BRUSH_CHANCE = 0.3
	DEBUG = {
		outline: true,
		dirtyCells: false,
	}

	editor: Editor
	ctx: CanvasRenderingContext2D
	offscreenCtx: CanvasRenderingContext2D
	width: number
	height: number
	world: Cell[]
	particleTypes = particles
	shuffledIndices: number[]
	isTickFrame = false
	dirtyIndices: Set<number> = new Set()

	constructor(editor: Editor) {
		this.editor = editor
		this.width = window.innerWidth
		this.height = window.innerHeight
		this.world = new Array(this.WORLD_SIZE * this.WORLD_SIZE)
		this.shuffledIndices = this.generateShuffledIndices()

		for (let i = 0; i < this.world.length; i++) {
			const x = i % this.WORLD_SIZE
			const y = Math.floor(i / this.WORLD_SIZE)
			this.world[i] = {
				particle: new Air(x, y, this.world),
				dirty: false,
			}
		}

		const canvas = document.createElement("canvas")
		const offscreenCanvas = document.createElement("canvas")
		offscreenCanvas.width = this.WORLD_SIZE
		offscreenCanvas.height = this.WORLD_SIZE
		canvas.width = this.width
		canvas.height = this.height
		const offscreenCtx = offscreenCanvas.getContext("2d", {
			willReadFrequently: true,
		})
		const ctx = canvas.getContext("2d")
		if (!ctx || !offscreenCtx) throw new Error("Could not get context")
		ctx.imageSmoothingEnabled = false
		document.body.appendChild(canvas)
		this.offscreenCtx = offscreenCtx
		this.ctx = ctx

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
		requestAnimationFrame(() => this.tick())
	}

	tick() {
		this.isTickFrame = !this.isTickFrame
		if (!this.offscreenCtx) return

		// Clear the buffer and main canvas
		this.offscreenCtx.clearRect(0, 0, this.WORLD_SIZE, this.WORLD_SIZE)
		this.ctx.clearRect(0, 0, this.width, this.height)

		this.handleInputs()
		this.updateParticles()
		this.drawParticles()

		const cam = this.editor.getCamera()
		this.ctx.drawImage(
			this.offscreenCtx.canvas,
			0,
			0, // source X, Y
			this.WORLD_SIZE,
			this.WORLD_SIZE, // source width and height
			cam.x * cam.z,
			cam.y * cam.z, // destination X, Y
			this.WORLD_SIZE * this.CELL_SIZE * cam.z, // destination width
			this.WORLD_SIZE * this.CELL_SIZE * cam.z, // destination height
		)

		if (this.DEBUG.outline) this.debugOutline(cam)

		requestAnimationFrame(() => this.tick())
	}

	debugOutline(cam: TLCamera) {
		this.ctx.strokeStyle = this.dirtyIndices.size > 0 ? "red" : "green"
		this.ctx.strokeRect(
			cam.x * cam.z,
			cam.y * cam.z,
			this.WORLD_SIZE * this.CELL_SIZE * cam.z,
			this.WORLD_SIZE * this.CELL_SIZE * cam.z,
		)
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
		if (
			this.editor.getCurrentToolId() === "sand" &&
			this.editor.inputs.isPointing &&
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
		this.dirtyIndices.clear()
		for (const index of this.shuffledIndices) {
			const cell = this.world[index]
			if (cell.particle.isTickCycle !== this.isTickFrame) {
				cell.dirty = false
				cell.particle.update()
				if (this.world[index].dirty) {
					this.dirtyIndices.add(index)
				}
				cell.particle.isTickCycle = this.isTickFrame
			}
		}
	}

	drawParticles() {
		const imageData = this.offscreenCtx.getImageData(
			0,
			0,
			this.WORLD_SIZE,
			this.WORLD_SIZE,
		)
		const data = imageData.data

		for (const cell of this.world) {
			// if (!cell.dirty) continue
			const index =
				(cell.particle.position.y * this.WORLD_SIZE +
					cell.particle.position.x) *
				4
			if (this.DEBUG.dirtyCells && cell.dirty) {
				data[index] = 200
				data[index + 1] = 0
				data[index + 2] = 0
				data[index + 3] = 200
				continue
			}
			if (cell.particle instanceof Air) {
				data[index] = 255
				data[index + 1] = 255
				data[index + 2] = 255
				data[index + 3] = 255
				continue
			}
			const color = cell.particle.colorRGB
			data[index] = color.r
			data[index + 1] = color.g
			data[index + 2] = color.b
			data[index + 3] = 255
		}

		this.offscreenCtx.putImageData(imageData, 0, 0)
	}

	createRandomDebugSand() {
		for (let i = 0; i < 500; i++) {
			const x = Math.floor(Math.random() * this.WORLD_SIZE)
			const y = Math.floor(Math.random() * this.WORLD_SIZE)
			const sand = new Sand(x, y, this.world)
			this.world[this.worldIndex(x, y)] = {
				particle: sand,
				dirty: true,
			}
		}
	}

	updateSolidShapes() {
		// Clear existing Geo particles
		for (let i = 0; i < this.world.length; i++) {
			const cell = this.world[i]
			const { particle } = cell
			if (particle && particle instanceof Geo) {
				cell.particle = new Air(
					particle.position.x,
					particle.position.y,
					this.world,
				)
				cell.dirty = true
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
		if (x < 0 || x >= this.WORLD_SIZE || y < 0 || y >= this.WORLD_SIZE) {
			return
		}
		const p = new particle(x, y, this.world)
		this.world[this.worldIndex(x, y)] = {
			particle: p,
			dirty: true,
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
				if (distance < radius && chance(this.BRUSH_CHANCE)) {
					this.setParticleInSandSpace(x, y, particle)
				}
			}
		}
	}
}
