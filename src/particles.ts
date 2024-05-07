import { hslToRgb, randRange, chance, chanceInt } from "./utils"

class AirPool {
	private airPool: Air[] = []

	getAir(x: number, y: number, world: Cell[]): Air {
		if (this.airPool.length > 0) {
			const air = this.airPool.pop()
			if (!air) return new Air(x, y, world)
			air.position.x = x
			air.position.y = y
			return air
		}
		return new Air(x, y, world)
	}

	releaseAir(air: Air) {
		this.airPool.push(air)
	}
}

type Cell = {
	particle: Particle
	dirty: boolean
}

type ParticleConstructor = new (x: number, y: number, world: Cell[]) => Particle

abstract class Particle {
	static airPool = new AirPool()

	abstract colorHSL: string
	abstract update(): void

	readonly world: Cell[]
	readonly worldSize: number

	position: { x: number; y: number }
	isTickCycle = false

	private _colorRGB?: { r: number; g: number; b: number }

	constructor(x: number, y: number, world: Cell[]) {
		this.position = { x, y }
		this.worldSize = Math.sqrt(world.length)
		this.world = world
	}

	protected getParticleAtIndex(index: number): Particle {
		return this.world[index].particle
	}
	protected setParticleAtIndex(index: number, particle: Particle) {
		this.world[index].particle = particle
		this.world[index].dirty = true
	}

	get colorRGB(): { r: number; g: number; b: number } {
		if (!this._colorRGB) {
			this._colorRGB = hslToRgb(this.colorHSL)
		}
		return this._colorRGB
	}

	/** Get the index relative to this particle */
	protected idx(xOffset: number, yOffset: number): number {
		return (
			(this.position.y + yOffset) * this.worldSize + (this.position.x + xOffset)
		)
	}

	/** Check if the new position is valid, relative to current position */
	protected isEmpty(x: number, y: number): boolean {
		const newX = this.position.x + x
		const newY = this.position.y + y
		if (
			newX < 0 ||
			newX >= this.worldSize ||
			newY < 0 ||
			newY >= this.worldSize
		) {
			return false
		}
		return this.world[newY * this.worldSize + newX].particle instanceof Air
	}

	protected swapIfEmpty(xOffset: number, yOffset: number): boolean {
		if (this.isEmpty(xOffset, yOffset)) {
			this.swapParticle(xOffset, yOffset)
			return true
		}
		return false
	}

	/** Returns number of adjacent cells which are not air (num between 0-9) */
	protected adjacent(xOffset: number, yOffset: number): number {
		let count = 0
		for (const dx of [-1, 0, 1]) {
			for (const dy of [-1, 0, 1]) {
				if (dx === 0 && dy === 0) continue
				const idx = this.idx(xOffset + dx, yOffset + dy)
				if (this.world[idx] && !(this.world[idx].particle instanceof Air)) {
					count++
				}
			}
		}
		return count
	}

	/** Swap target with this, and current with target */
	protected swapParticle(xOffset: number, yOffset: number) {
		const newPosition = {
			x: this.position.x + xOffset,
			y: this.position.y + yOffset,
		}
		const nextCell = this.world[this.idx(xOffset, yOffset)]
		nextCell.particle.position.x = this.position.x
		nextCell.particle.position.y = this.position.y
		this.world[this.idx(0, 0)] = {
			particle: nextCell.particle,
			dirty: true,
		}
		this.position.x = newPosition.x
		this.position.y = newPosition.y
		this.world[this.idx(0, 0)] = {
			particle: this,
			dirty: true,
		}
	}
	/** Replace target with this, and current with air */
	protected replaceParticle(xOffset: number, yOffset: number) {
		const newPosition = {
			x: this.position.x + xOffset,
			y: this.position.y + yOffset,
		}
		const nextCell = this.world[this.idx(xOffset, yOffset)]
		nextCell.particle.position.x = this.position.x
		nextCell.particle.position.y = this.position.y
		this.world[this.idx(0, 0)] = {
			particle: Particle.airPool.getAir(
				this.position.x,
				this.position.y,
				this.world,
			),
			dirty: true,
		}
		this.position.x = newPosition.x
		this.position.y = newPosition.y
		this.world[this.idx(0, 0)] = {
			particle: this,
			dirty: true,
		}
	}
}

// ---------- Particles ----------

class Acid extends Particle {
	colorHSL = `hsl(${randRange(70, 110)}, 60%, 50%)`

	update() {
		// Attempt to move down or diagonally down if the spot is empty
		if (
			this.swapIfEmpty(0, 1) ||
			this.swapIfEmpty(1, 1) ||
			this.swapIfEmpty(-1, 1)
		) {
			return
		}

		// If the spot is not empty, maybe swap or replace
		if (this.canSwapWith(0, 1)) {
			if (chance(0.1)) {
				if (chance(0.2)) {
					this.replaceParticle(0, 1)
				} else {
					this.swapParticle(0, 1)
				}
			}
		}

		// Attempt to move horizontally if the spot is empty
		if (this.swapIfEmpty(-1, 0) || this.swapIfEmpty(1, 0)) {
			return
		}
		if (chance(0.01)) {
			this.dissolveNearby()
		}
	}

	canSwapWith(offsetX: number, offsetY: number): boolean {
		const target = this.world[this.idx(offsetX, offsetY)]
		return target?.particle instanceof Water
	}

	dissolveNearby() {
		for (const [dx, dy] of [
			[1, 0],
			[-1, 0],
			[0, -1],
			[0, 1],
		]) {
			if (this.canDissolve(dx, dy)) {
				this.setParticleAtIndex(
					this.idx(dx, dy),
					Particle.airPool.getAir(
						this.position.x + dx,
						this.position.y + dy,
						this.world,
					),
				)
			}
		}
	}

	canDissolve(dx: number, dy: number): boolean {
		const target = this.world[this.idx(dx, dy)]
		if (!target) return false
		return target.particle instanceof Stone || target.particle instanceof Sand
	}
}

class Sand extends Particle {
	colorHSL = `hsl(${randRange(40, 45)}, ${randRange(50, 60)}%, ${randRange(
		70,
		80,
	)}%)`

	canSwapWith(offsetX: number, offsetY: number): boolean {
		return this.world[this.idx(offsetX, offsetY)]?.particle instanceof Water
	}

	update() {
		if (this.isEmpty(0, 1)) {
			this.swapParticle(0, 1)
		} else if (this.isEmpty(1, 1)) {
			this.swapParticle(1, 1)
		} else if (this.isEmpty(-1, 1)) {
			this.swapParticle(-1, 1)
		} else if (this.canSwapWith(0, 1)) {
			if (chance(0.3)) {
				this.swapParticle(0, 1)
			}
		}
	}
}

class Water extends Particle {
	colorHSL = `hsl(${randRange(205, 215)}, ${randRange(80, 90)}%, 40%)`

	update() {
		if (this.swapIfEmpty(0, 1)) {
			return
		}
		if (this.canSwapWith(0, 1)) {
			this.swapParticle(0, 1)
		}
		this.swapIfEmpty(1, 1) ||
			this.swapIfEmpty(-1, 1) ||
			this.swapIfEmpty(-1, 0) ||
			this.swapIfEmpty(1, 0)
	}
	canSwapWith(offsetX: number, offsetY: number): boolean {
		return this.world[this.idx(offsetX, offsetY)]?.particle instanceof Steam
	}
}

class Plant extends Particle {
	private energy = 15
	colorHSL = `hsl(${randRange(100, 140)}, ${randRange(30, 50)}%, ${randRange(
		40,
		60,
	)}%)`

	update() {
		if (chance(0.15)) {
			const rand = chanceInt(5)
			if (rand === 0) {
				this.tryGrow(0, -1) // up
			} else if (rand === 1) {
				this.tryGrow(1, -1) // up-right
			} else if (rand === 2) {
				this.tryGrow(-1, -1) // up-left
			} else if (rand === 3) {
				this.tryGrow(1, -1) // up-right
			} else if (rand === 4) {
				this.tryGrow(-1, 0) // left
			} else if (rand === 5) {
				this.tryGrow(1, 0) // right
			}
		}
		if (chance(0.02)) {
			this.absorb()
		}
	}

	tryGrow(x: number, y: number) {
		if (this.energy <= 0) {
			return
		}
		const adjacent = this.adjacent(x, y)
		if (adjacent > 2) {
			if (chance(0.5)) {
				return
			}
		}
		if (adjacent > 3) {
			return
		}
		this.energy--
		const newPlant = new Plant(
			this.position.x + x,
			this.position.y + y,
			this.world,
		)
		newPlant.energy = this.energy
		this.setParticleAtIndex(this.idx(x, y), newPlant)
	}

	// Plants absorb water to grow
	canAbsorb(dx: number, dy: number): boolean {
		const target = this.world[this.idx(dx, dy)]
		return target.particle instanceof Water
	}

	absorb() {
		const directions = [
			[0, 1],
			[0, -1],
			[1, 0],
			[-1, 0],
		]
		for (const [dx, dy] of directions) {
			if (this.canAbsorb(dx, dy)) {
				this.energy++
				this.setParticleAtIndex(
					this.idx(dx, dy),
					Particle.airPool.getAir(
						this.position.x + dx,
						this.position.y + dy,
						this.world,
					),
				)
			}
		}
	}
}

class Steam extends Particle {
	colorHSL = "hsl(0, 0%, 90%)"

	update() {
		if (chance(0.001)) {
			// Chance to condense back into water
			this.condense()
		} else if (this.isEmpty(0, -1)) {
			this.swapParticle(0, -1)
		} else {
			this.disperse()
		}
	}

	condense() {
		this.setParticleAtIndex(
			this.position.y * this.worldSize + this.position.x,
			new Water(this.position.x, this.position.y, this.world),
		)
	}

	disperse() {
		for (const [dx, dy] of [
			[1, 0],
			[-1, 0],
		]) {
			if (this.isEmpty(dx, dy)) {
				this.swapParticle(dx, dy)
				break
			}
		}
	}
}

class Stone extends Particle {
	colorHSL = "hsl(0, 0%, 50%)"
	update() {}
}
class Geo extends Particle {
	colorHSL = "hsl(0, 0%, 80%)"
	update() {}
}
class Air extends Particle {
	colorHSL = "hsl(0, 0%, 100%)"
	update() {}
}

const particles = {
	sand: Sand,
	stone: Stone,
	water: Water,
	air: Air,
	acid: Acid,
	steam: Steam,
	plant: Plant,
}

export {
	type Cell,
	type ParticleConstructor,
	Particle,
	Sand,
	Stone,
	Water,
	Geo,
	Air,
	particles,
}
