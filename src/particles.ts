function randRange(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1) + min)
}

export { type Cell, Particle, Sand, Stone, Water, Geo, Air }

class AirPool {
	private airPool: Air[] = []

	getAir(x: number, y: number, worldSize: number, world: Cell[]): Air {
		if (this.airPool.length > 0) {
			const air = this.airPool.pop()
			if (!air) return new Air(x, y, worldSize, world)
			air.position.x = x
			air.position.y = y
			air.worldSize = worldSize
			air.world = world
			return air
		}
		return new Air(x, y, worldSize, world)
	}

	releaseAir(air: Air) {
		this.airPool.push(air)
	}
}

type Cell = {
	particle: Particle
	changed: boolean
}

abstract class Particle {
	static airPool = new AirPool()
	position: { x: number; y: number }
	worldSize: number
	world: Cell[]

	abstract colorHSL: string
	private _colorRGB?: { r: number; g: number; b: number }
	isTickCycle = false

	get colorRGB(): { r: number; g: number; b: number } {
		if (!this._colorRGB) {
			this._colorRGB = this.hslToRgb(this.colorHSL)
		}
		return this._colorRGB
	}

	private hslToRgb(hsl: string): { r: number; g: number; b: number } {
		let [h, s, l] = hsl.match(/\d+/g).map(Number)
		l /= 100
		const a = (s * Math.min(l, 1 - l)) / 100
		const f = (n: number) => {
			const k = (n + h / 30) % 12
			const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
			return Math.round(255 * color)
		}
		return { r: f(0), g: f(8), b: f(4) }
	}

	constructor(x: number, y: number, worldSize: number, world: Cell[]) {
		this.position = { x, y }
		this.worldSize = worldSize
		this.world = world
	}

	abstract update(): void

	/** Get the index relative to this particle */
	protected idx(xOffset: number, yOffset: number): number {
		return (
			(this.position.y + yOffset) * this.worldSize + (this.position.x + xOffset)
		)
	}

	/** Check if the new position is valid, relative to current position */
	protected canMoveTo(x: number, y: number): boolean {
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

	protected delete() {
		this.world[this.position.y * this.worldSize + this.position.x] = {
			changed: true,
			particle: Particle.airPool.getAir(
				this.position.x,
				this.position.y,
				this.worldSize,
				this.world,
			),
		}
	}

	protected chance(percent: number): boolean {
		return Math.random() < percent
	}

	protected moveParticle(xOffset: number, yOffset: number) {
		this.world[this.position.y * this.worldSize + this.position.x] = {
			changed: true,
			particle: Particle.airPool.getAir(
				this.position.x,
				this.position.y,
				this.worldSize,
				this.world,
			),
		}
		this.position.x = this.position.x + xOffset
		this.position.y = this.position.y + yOffset
		this.world[this.position.y * this.worldSize + this.position.x] = {
			particle: this,
			changed: true,
		}
	}

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
			changed: true,
		}
		this.position.x = newPosition.x
		this.position.y = newPosition.y
		this.world[this.idx(0, 0)] = {
			particle: this,
			changed: true,
		}
	}
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
				this.worldSize,
				this.world,
			),
			changed: true,
		}
		this.position.x = newPosition.x
		this.position.y = newPosition.y
		this.world[this.idx(0, 0)] = {
			particle: this,
			changed: true,
		}
	}
}

class Acid extends Particle {
	colorHSL = `hsl(${randRange(70, 110)}, 60%, 50%)`

	update() {
		if (this.canMoveTo(0, 1)) {
			this.moveParticle(0, 1)
		} else if (this.canMoveTo(1, 1)) {
			this.swapParticle(1, 1)
		} else if (this.canMoveTo(-1, 1)) {
			this.swapParticle(-1, 1)
		} else if (this.canSwapWith(0, 1)) {
			if (this.chance(0.1)) {
				if (this.chance(0.1)) {
					this.replaceParticle(0, 1)
				} else {
					this.swapParticle(0, 1)
				}
			}
		}
		if (this.chance(0.01)) {
			this.dissolveNearby()
		}
	}

	canSwapWith(offsetX: number, offsetY: number): boolean {
		return this.world[this.idx(offsetX, offsetY)]?.particle instanceof Water
	}

	dissolveNearby() {
		for (const [dx, dy] of [
			[1, 0],
			[-1, 0],
			[0, -1],
			[0, 1],
		]) {
			if (this.canDissolve(dx, dy)) {
				this.world[this.idx(dx, dy)] = {
					changed: true,
					particle: Particle.airPool.getAir(
						this.position.x + dx,
						this.position.y + dy,
						this.worldSize,
						this.world,
					),
				}
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
		if (this.canMoveTo(0, 1)) {
			this.moveParticle(0, 1)
		} else if (this.canMoveTo(1, 1)) {
			this.swapParticle(1, 1)
		} else if (this.canMoveTo(-1, 1)) {
			this.swapParticle(-1, 1)
		} else if (this.canSwapWith(0, 1)) {
			if (this.chance(0.3)) {
				this.swapParticle(0, 1)
			}
		}
	}
}
class Water extends Particle {
	colorHSL = `hsl(${randRange(205, 215)}, ${randRange(80, 90)}%, 40%)`

	update() {
		if (this.canMoveTo(0, 1)) {
			this.moveParticle(0, 1)
		} else if (this.canSwapWith(0, 1)) {
			this.swapParticle(0, 1)
		} else if (this.canMoveTo(1, 1)) {
			this.moveParticle(1, 1)
		} else if (this.canMoveTo(-1, 1)) {
			this.moveParticle(-1, 1)
		} else if (this.canMoveTo(-1, 0)) {
			this.moveParticle(-1, 0)
		} else if (this.canMoveTo(1, 0)) {
			this.moveParticle(1, 0)
		}
	}
	canSwapWith(offsetX: number, offsetY: number): boolean {
		return this.world[this.idx(offsetX, offsetY)]?.particle instanceof Steam
	}
}

class Steam extends Particle {
	colorHSL = "hsl(0, 0%, 90%)"

	update() {
		if (this.chance(0.001)) {
			// Chance to condense back into water
			this.condense()
		} else if (this.canMoveTo(0, -1)) {
			this.moveParticle(0, -1)
		} else {
			this.disperse()
		}
	}

	condense() {
		this.world[this.position.y * this.worldSize + this.position.x] = {
			changed: true,
			particle: new Water(
				this.position.x,
				this.position.y,
				this.worldSize,
				this.world,
			),
		}
	}

	disperse() {
		for (const [dx, dy] of [
			[1, 0],
			[-1, 0],
		]) {
			if (this.canMoveTo(dx, dy)) {
				this.moveParticle(dx, dy)
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

export const particles = {
	sand: Sand,
	stone: Stone,
	water: Water,
	air: Air,
	acid: Acid,
	steam: Steam,
}
