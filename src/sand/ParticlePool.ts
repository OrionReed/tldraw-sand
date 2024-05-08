import { Particle } from "./particles"
import { Cell } from "./types"

export class ParticlePool<T extends Particle> {
	private pool: T[] = []
	private factory: (x: number, y: number, world: Cell[]) => T

	constructor(factory: (x: number, y: number, world: Cell[]) => T) {
		this.factory = factory
	}

	get(x: number, y: number, world: Cell[]): T {
		if (this.pool.length > 0) {
			const particle = this.pool.pop()
			if (!particle) return this.factory(x, y, world)
			particle.position.x = x
			particle.position.y = y
			return particle
		}
		return this.factory(x, y, world)
	}

	release(particle: T) {
		this.pool.push(particle)
	}
}
