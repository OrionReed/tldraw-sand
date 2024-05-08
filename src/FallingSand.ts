import { Editor, TLCamera } from "tldraw"
import { Air, Geo, Sand, particles } from "./sand/particles"
import { chance } from "./sand/utils"
import { ParticleConstructor } from "./sand/types"
import { World } from "./sand/World"
import { Chunk } from "./sand/Chunk"

export class FallingSand {
	DEBUG = {
		CHUNK_OUTLINE: true,
		DIRTY_RECT: true,
		DIRTY_CELLS: false,
	}
	BRUSH_RADIUS = 10
	BRUSH_CHANCE = 0.3
	PARTICLE_TYPES = particles
	previousPointer: { x: number; y: number } | null = { x: 0, y: 0 }

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

		const { ctx, offscreenCtx } = this.createCanvas(
			this.viewWidth,
			this.viewHeight,
		)

		this.offscreenCtx = offscreenCtx
		this.ctx = ctx

		editor.store.onAfterCreate = (next, _) => {
			if (next.typeName !== "shape") return
			this.updateSolidShapes()
		}
		editor.store.onAfterChange = (_, next, __) => {
			if (next.typeName !== "shape") return
			this.updateSolidShapes()
		}
		editor.store.onAfterDelete = (prev, _) => {
			if (prev.typeName !== "shape") return
			this.updateSolidShapes()
		}

		this.TEST_SAND()

		requestAnimationFrame(() => this.tick())
	}

	tick() {
		this.isTickFrame = !this.isTickFrame

		this.handleInputs()
		for (const chunk of this.world.getChunks()) {
			this.updateChunk(chunk)
			this.drawChunk(chunk)
		}

		this.drawMainCanvas()

		requestAnimationFrame(() => this.tick())
	}

	private updateChunk(chunk: Chunk) {
		if (chunk.dirtyIndices.size > 0) {
			chunk.update(this.isTickFrame)
		}
	}

	private drawChunk(chunk: Chunk) {
		const imageData = this.offscreenCtx.getImageData(
			0,
			0,
			Chunk.SIZE,
			Chunk.SIZE,
		)
		// Clear the buffer and main canvas
		if (chunk.dirtyIndices.size > 0) {
			this.offscreenCtx.clearRect(0, 0, Chunk.SIZE, Chunk.SIZE)
			const data = imageData.data
			for (const cell of chunk.cells) {
				const index =
					(cell.particle.position.y * Chunk.SIZE + cell.particle.position.x) * 4

				// TODO: remove this
				if (this.DEBUG.DIRTY_CELLS && cell.dirty) {
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
				const color = cell.particle.color
				data[index] = color.r
				data[index + 1] = color.g
				data[index + 2] = color.b
				data[index + 3] = 255
			}
		}
		this.offscreenCtx.putImageData(imageData, 0, 0)
	}

	private drawMainCanvas() {
		this.ctx.clearRect(0, 0, this.viewWidth, this.viewHeight)
		const cam = this.editor.getCamera()
		this.ctx.drawImage(
			this.offscreenCtx.canvas,
			0,
			0, // source X, Y
			Chunk.SIZE,
			Chunk.SIZE, // source width and height
			cam.x * cam.z,
			cam.y * cam.z, // destination X, Y
			Chunk.SIZE * Chunk.CELL_SIZE * cam.z, // destination width
			Chunk.SIZE * Chunk.CELL_SIZE * cam.z, // destination height
		)

		this.drawDebugOverlays(cam)
	}

	private TEST_SAND() {
		const chunk = this.world.getChunk(0, 0)
		for (let i = 0; i < 500; i++) {
			const x = Math.floor(Math.random() * Chunk.SIZE)
			const y = Math.floor(Math.random() * Chunk.SIZE)
			const sand = new Sand(x, y, chunk.cells)
			chunk.setParticle(x, y, sand)
		}
	}

	private updateSolidShapes() {
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
						let y = Math.floor(minY / Chunk.CELL_SIZE);
						y <= Math.floor(maxY / Chunk.CELL_SIZE);
						y++
					) {
						const intersections: number[] = []
						for (let i = 0; i < rotatedVertices.length; i++) {
							const v1 = rotatedVertices[i]
							const v2 = rotatedVertices[(i + 1) % rotatedVertices.length]
							if (
								(v1.y < y * Chunk.CELL_SIZE && v2.y >= y * Chunk.CELL_SIZE) ||
								(v2.y < y * Chunk.CELL_SIZE && v1.y >= y * Chunk.CELL_SIZE)
							) {
								const x =
									v1.x +
									((y * Chunk.CELL_SIZE - v1.y) / (v2.y - v1.y)) * (v2.x - v1.x)
								intersections.push(x)
							}
						}
						intersections.sort((a, b) => a - b)
						for (let i = 0; i < intersections.length; i += 2) {
							const startX = Math.floor(intersections[i] / Chunk.CELL_SIZE)
							const endX = Math.floor(intersections[i + 1] / Chunk.CELL_SIZE)
							for (let x = startX; x <= endX; x++) {
								this.createParticlePageSpace(
									x * Chunk.CELL_SIZE,
									y * Chunk.CELL_SIZE,
									Geo,
								)
							}
						}
					}
				} else {
					for (let i = 0; i < rotatedVertices.length - 1; i++) {
						const v1 = rotatedVertices[i]
						const v2 = rotatedVertices[i + 1]
						const x2 = Math.floor(v2.x / Chunk.CELL_SIZE)
						const y2 = Math.floor(v2.y / Chunk.CELL_SIZE)
						let x1 = Math.floor(v1.x / Chunk.CELL_SIZE)
						let y1 = Math.floor(v1.y / Chunk.CELL_SIZE)

						const dx = Math.abs(x2 - x1)
						const dy = Math.abs(y2 - y1)
						const sx = x1 < x2 ? 1 : -1
						const sy = y1 < y2 ? 1 : -1
						let err = (dx > dy ? dx : -dy) / 2
						let e2

						while (true) {
							this.createParticlePageSpace(
								x1 * Chunk.CELL_SIZE,
								y1 * Chunk.CELL_SIZE,
								Geo,
							)
							if (x1 === x2 && y1 === y2) break
							e2 = err
							if (e2 > -dx) {
								err -= dy
								x1 += sx
							}
							if (e2 < dy) {
								err += dx
								y1 += sy
							}
							// Fill in the potential gap when moving diagonally
							if (dx > 0 && dy > 0) {
								this.createParticlePageSpace(
									x1 * Chunk.CELL_SIZE,
									(y1 - sy) * Chunk.CELL_SIZE,
									Geo,
								)
							}
						}
					}
				}
			}
		}
	}

	handleInputs() {
		const addParticlesInCircle = (
			particle: ParticleConstructor,
			point: { x: number; y: number },
		) => {
			const { x: pointerX, y: pointerY } = point
			const radius = this.BRUSH_RADIUS

			const pointerGridX = Math.floor(pointerX / Chunk.CELL_SIZE)
			const pointerGridY = Math.floor(pointerY / Chunk.CELL_SIZE)

			for (let y = pointerGridY - radius; y < pointerGridY + radius; y++) {
				for (let x = pointerGridX - radius; x < pointerGridX + radius; x++) {
					const distance = Math.sqrt(
						(x - pointerGridX) ** 2 + (y - pointerGridY) ** 2,
					)
					if (distance < radius && chance(this.BRUSH_CHANCE)) {
						this.world.createParticle(x, y, particle)
					}
				}
			}
		}
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
					const steps = Math.max(1, Math.floor(distance / Chunk.CELL_SIZE))
					for (let i = 0; i < steps; i++) {
						const x = this.previousPointer.x + (dx * i) / steps
						const y = this.previousPointer.y + (dy * i) / steps
						addParticlesInCircle(type, { x, y })
					}
				}
			}
			if (type) {
				addParticlesInCircle(type, currentPointer)
			}
			this.previousPointer = { x: currentPointer.x, y: currentPointer.y }
		} else {
			this.previousPointer = null
		}
	}

	private createParticlePageSpace(
		x: number,
		y: number,
		particle: ParticleConstructor,
	) {
		const gridX = Math.floor(x / Chunk.CELL_SIZE)
		const gridY = Math.floor(y / Chunk.CELL_SIZE)
		this.world.createParticle(gridX, gridY, particle)
	}

	private createCanvas(width: number, height: number) {
		const canvas = document.createElement("canvas")
		const offscreenCanvas = document.createElement("canvas")
		offscreenCanvas.width = Chunk.SIZE
		offscreenCanvas.height = Chunk.SIZE
		canvas.width = width
		canvas.height = height
		const offscreenCtx = offscreenCanvas.getContext("2d", {
			willReadFrequently: true,
		})
		const ctx = canvas.getContext("2d")
		if (!ctx || !offscreenCtx) throw new Error("Could not get context")
		ctx.imageSmoothingEnabled = false
		document.body.appendChild(canvas)
		return { ctx, offscreenCtx }
	}

	private drawDebugOverlays(cam: TLCamera) {
		for (const chunk of this.world.getChunks()) {
			if (this.DEBUG.DIRTY_RECT && chunk.dirtyRect) {
				this.ctx.strokeStyle = "blue"
				this.ctx.strokeRect(
					(chunk.dirtyRect.minX * Chunk.CELL_SIZE + cam.x) * cam.z,
					(chunk.dirtyRect.minY * Chunk.CELL_SIZE + cam.y) * cam.z,
					(chunk.dirtyRect.maxX - chunk.dirtyRect.minX + 1) *
						Chunk.CELL_SIZE *
						cam.z,
					(chunk.dirtyRect.maxY - chunk.dirtyRect.minY + 1) *
						Chunk.CELL_SIZE *
						cam.z,
				)
			}

			if (this.DEBUG.CHUNK_OUTLINE) {
				this.ctx.strokeStyle = chunk.dirtyIndices.size > 0 ? "red" : "green"
				this.ctx.strokeRect(
					chunk.globalX + cam.x * cam.z,
					chunk.globalY + cam.y * cam.z,
					Chunk.SIZE * Chunk.CELL_SIZE * cam.z,
					Chunk.SIZE * Chunk.CELL_SIZE * cam.z,
				)
			}
		}
	}
}
