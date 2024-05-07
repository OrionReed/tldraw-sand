import { Editor, TLCamera } from "tldraw"
import {
	Air,
	Cell,
	Geo,
	Particle,
	ParticleConstructor,
	Sand,
	particles,
} from "./particles"
import { chance } from "./utils"

class Chunk {
	static SIZE = 500
	public readonly globalX: number
	public readonly globalY: number
	public dirtyIndices: Set<number> = new Set()
	public shuffledIndices: number[] = this.generateShuffledIndices()
	public cells: Cell[] = new Array(Chunk.SIZE * Chunk.SIZE)

	constructor(globalX: number, globalY: number) {
		this.globalX = globalX
		this.globalY = globalY
		this.fillWithAir()
	}

	/** Check if a worldspace point is in the chunk */
	isInChunk(globalX: number, globalY: number): boolean {
		return (
			globalX >= this.globalX &&
			globalX < this.globalX + Chunk.SIZE &&
			globalY >= this.globalY &&
			globalY < this.globalY + Chunk.SIZE
		)
	}

	/** Get a particle in worldspace */
	getParticle(globalX: number, globalY: number): Particle {
		const localX = globalX - this.globalX
		const localY = globalY - this.globalY
		return this.cells[this.indexOf(localX, localY)].particle
	}

	/** Set a particle in worldspace */
	setParticle(globalX: number, globalY: number, particle: Particle): void {
		const localX = globalX - this.globalX
		const localY = globalY - this.globalY
		this.cells[this.indexOf(localX, localY)] = {
			particle,
			dirty: true,
		}
	}

	update(tickFrame: boolean) {
		// TODO: WRONG, TEMP, NO REALLY
		this.dirtyIndices.clear()
		for (const index of this.shuffledIndices) {
			const cell = this.cells[index]
			if (cell.particle.isTickCycle !== tickFrame) {
				cell.dirty = false
				cell.particle.update()
				if (this.cells[index].dirty) {
					this.dirtyIndices.add(index)
				}
				cell.particle.isTickCycle = tickFrame
			}
		}
	}

	private indexOf(x: number, y: number): number {
		return y * Chunk.SIZE + x
	}

	private generateShuffledIndices() {
		const shuffledIndices: number[] = []
		// Helper method to shuffle an array in-place using Fisher-Yates algorithm
		function shuffleArray(array: number[]) {
			for (let i = array.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1))
				;[array[i], array[j]] = [array[j], array[i]]
			}
		}
		// Pre-generate shuffled indices for the entire world
		for (let y = Chunk.SIZE - 1; y >= 0; y--) {
			const rowIndices = Array.from(
				{ length: Chunk.SIZE },
				(_, i) => y * Chunk.SIZE + i,
			)
			shuffleArray(rowIndices)
			shuffledIndices.push(...rowIndices)
		}
		return shuffledIndices
	}

	private fillWithAir() {
		for (let i = 0; i < Chunk.SIZE * Chunk.SIZE; i++) {
			const x = i % Chunk.SIZE
			const y = Math.floor(i / Chunk.SIZE)
			this.cells[i] = {
				particle: new Air(x, y, this.cells),
				dirty: false,
			}
		}
	}
}

class World {
	private chunks: Map<string, Chunk>

	constructor() {
		this.chunks = new Map()
	}

	private getChunkKey(x: number, y: number): string {
		const chunkX = Math.floor(x / Chunk.SIZE)
		const chunkY = Math.floor(y / Chunk.SIZE)
		return `${chunkX}_${chunkY}`
	}

	*getChunks() {
		for (const chunk of this.chunks.values()) {
			yield chunk
		}
	}

	/** Get a chunk in worldspace */
	getChunk(x: number, y: number): Chunk {
		const key = this.getChunkKey(x, y)
		if (!this.chunks.has(key)) {
			const globalX = Math.floor(x / Chunk.SIZE) * Chunk.SIZE
			const globalY = Math.floor(y / Chunk.SIZE) * Chunk.SIZE
			const newChunk = new Chunk(globalX, globalY)
			this.chunks.set(key, newChunk)
			return newChunk
		}
		return this.chunks.get(key) as Chunk
	}

	/** Get a particle in worldspace */
	getParticle(x: number, y: number): Particle {
		const chunk = this.getChunk(x, y)
		return chunk.getParticle(x, y)
	}

	/** Set a particle in worldspace */
	setParticle(x: number, y: number, particle: Particle): void {
		const chunk = this.getChunk(x, y)
		chunk.setParticle(x, y, particle)
	}
}

export class FallingSand {
	DEBUG = {
		outline: true,
		dirtyCells: false,
	}
	CELL_SIZE = 2
	BRUSH_RADIUS = 10
	BRUSH_CHANCE = 0.3
	PARTICLE_TYPES = particles

	editor: Editor
	ctx: CanvasRenderingContext2D
	offscreenCtx: CanvasRenderingContext2D
	viewWidth: number
	viewHeight: number
	world: World
	isTickFrame = false

	constructor(editor: Editor) {
		this.editor = editor
		this.viewWidth = window.innerWidth
		this.viewHeight = window.innerHeight
		this.world = new World()
		this.world.getChunk(0, 0)
		const canvas = document.createElement("canvas")
		const offscreenCanvas = document.createElement("canvas")
		offscreenCanvas.width = Chunk.SIZE
		offscreenCanvas.height = Chunk.SIZE
		canvas.width = this.viewWidth
		canvas.height = this.viewHeight
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
		this.offscreenCtx.clearRect(0, 0, Chunk.SIZE, Chunk.SIZE)
		this.ctx.clearRect(0, 0, this.viewWidth, this.viewHeight)

		this.handleInputs()
		this.updateParticles()
		this.drawParticles()

		const cam = this.editor.getCamera()
		this.ctx.drawImage(
			this.offscreenCtx.canvas,
			0,
			0, // source X, Y
			Chunk.SIZE,
			Chunk.SIZE, // source width and height
			cam.x * cam.z,
			cam.y * cam.z, // destination X, Y
			Chunk.SIZE * this.CELL_SIZE * cam.z, // destination width
			Chunk.SIZE * this.CELL_SIZE * cam.z, // destination height
		)

		if (this.DEBUG.outline) this.debugOutlines(cam)

		requestAnimationFrame(() => this.tick())
	}

	debugOutlines(cam: TLCamera) {
		for (const chunk of this.world.getChunks()) {
			this.ctx.strokeStyle = chunk.dirtyIndices.size > 0 ? "red" : "green"

			this.ctx.strokeRect(
				chunk.globalX + cam.x * cam.z,
				chunk.globalY + cam.y * cam.z,
				Chunk.SIZE * this.CELL_SIZE * cam.z,
				Chunk.SIZE * this.CELL_SIZE * cam.z,
			)
		}
	}

	previousPointer: { x: number; y: number } | null = { x: 0, y: 0 }

	handleInputs() {
		if (
			this.editor.getCurrentToolId() === "sand" &&
			this.editor.inputs.isPointing &&
			this.editor.inputs.buttons.has(0)
		) {
			const path = this.editor.getPath() as keyof typeof this.PARTICLE_TYPES
			const parts = path.split(".")
			const leaf = parts[parts.length - 1]
			const type = this.PARTICLE_TYPES[leaf as keyof typeof this.PARTICLE_TYPES]

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
		for (const chunk of this.world.getChunks()) {
			chunk.update(this.isTickFrame)
		}
	}

	drawParticles() {
		for (const chunk of this.world.getChunks()) {
			const imageData = this.offscreenCtx.getImageData(
				0,
				0,
				Chunk.SIZE,
				Chunk.SIZE,
			)
			const data = imageData.data
			for (const cell of chunk.cells) {
				// if (!cell.dirty) continue
				const index =
					(cell.particle.position.y * Chunk.SIZE + cell.particle.position.x) * 4
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
	}

	createRandomDebugSand() {
		for (const chunk of this.world.getChunks()) {
			for (let i = 0; i < 500; i++) {
				const x = Math.floor(Math.random() * Chunk.SIZE)
				const y = Math.floor(Math.random() * Chunk.SIZE)
				const sand = new Sand(x, y, chunk.cells)
				chunk.setParticle(x, y, sand)
			}
		}
	}

	updateSolidShapes() {
		for (const chunk of this.world.getChunks()) {
			for (const cell of chunk.cells) {
				const { particle } = cell
				if (particle && particle instanceof Geo) {
					cell.particle = new Air(
						particle.position.x,
						particle.position.y,
						chunk.cells,
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
	}

	worldIndex(x: number, y: number) {
		return y * Chunk.SIZE + x
	}

	setParticleInPageSpace(x: number, y: number, particle: ParticleConstructor) {
		const gridX = Math.floor(x / this.CELL_SIZE)
		const gridY = Math.floor(y / this.CELL_SIZE)
		this.setParticleInSandSpace(gridX, gridY, particle)
	}

	setParticleInSandSpace(x: number, y: number, particle: ParticleConstructor) {
		if (x < 0 || x >= Chunk.SIZE || y < 0 || y >= Chunk.SIZE) {
			return
		}
		const chunk = this.world.getChunk(x, y)
		const p = new particle(x, y, chunk.cells)
		chunk.setParticle(x, y, p)
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
