import { Chunk } from "./Chunk"
import { Particle } from "./particles"
import { ParticleConstructor } from "./types"

export class World {
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
	createParticle(x: number, y: number, particle: ParticleConstructor): void {
		// TEMP
		if (x < 0 || x >= Chunk.SIZE || y < 0 || y >= Chunk.SIZE) {
			return
		}
		const chunk = this.getChunk(x, y)
		const p = new particle(x, y, chunk.cells)
		chunk.setParticle(x, y, p)
	}
}
