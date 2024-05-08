import { Air, Particle } from "./particles"
import { Cell } from "./types"

export class Chunk {
	static SIZE = 500
	static CELL_SIZE = 2
	public readonly globalX: number
	public readonly globalY: number
	public dirtyRect: {
		minX: number
		maxX: number
		minY: number
		maxY: number
	} = {
		minX: 0,
		maxX: Chunk.SIZE,
		minY: 0,
		maxY: Chunk.SIZE,
	}
	public shuffledIndices: number[] = this.generateShuffledIndices()
	public cells: Cell[] = new Array(Chunk.SIZE * Chunk.SIZE)
	public get isDirty(): boolean {
		return this.dirtyRect.minX !== Infinity
	}

	constructor(globalX: number, globalY: number) {
		this.globalX = globalX
		this.globalY = globalY
		this.initCells()
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
		const ind = this.indexOf(localX, localY)
		this.cells[ind].particle = particle
		this.cells[ind].dirty = true
		this.growDirtyRect(localX, localY)
	}

	update(isTickFrame: boolean) {
		// this.dirtyIndices.clear()
		this.dirtyRect.minX = Infinity
		this.dirtyRect.maxX = -Infinity
		this.dirtyRect.minY = Infinity
		this.dirtyRect.maxY = -Infinity
		for (const index of this.shuffledIndices) {
			const cell = this.cells[index]
			if (cell.particle.isTickFrame !== isTickFrame) {
				cell.dirty = false
				cell.particle.update()
				if (this.cells[index].dirty) {
					this.growDirtyRect(cell.particle.position.x, cell.particle.position.y)
				}
				cell.particle.isTickFrame = isTickFrame
			}
		}
	}

	growDirtyRect(x: number, y: number) {
		this.dirtyRect.minX = Math.min(this.dirtyRect.minX, x)
		this.dirtyRect.maxX = Math.max(this.dirtyRect.maxX, x)
		this.dirtyRect.minY = Math.min(this.dirtyRect.minY, y)
		this.dirtyRect.maxY = Math.max(this.dirtyRect.maxY, y)
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

	private initCells() {
		for (let i = 0; i < Chunk.SIZE * Chunk.SIZE; i++) {
			const x = i % Chunk.SIZE
			const y = Math.floor(i / Chunk.SIZE)
			this.cells[i] = {
				particle: new Air(x, y, this.cells),
				dirty: false,
				neighbours: {
					upLeft: this.cells[this.indexOf(x - 1, y - 1)],
					up: this.cells[this.indexOf(x, y - 1)],
					upRight: this.cells[this.indexOf(x + 1, y - 1)],
					left: this.cells[this.indexOf(x - 1, y)],
					right: this.cells[this.indexOf(x + 1, y)],
					downLeft: this.cells[this.indexOf(x - 1, y + 1)],
					down: this.cells[this.indexOf(x, y + 1)],
					downRight: this.cells[this.indexOf(x + 1, y + 1)],
				},
			}
		}
	}
}
