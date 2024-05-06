function randRange(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1) + min)
}

export { type Cell, Particle, Sand, Stone, Water, Geo, Air }

type Cell = {
	particle: Particle
	changed: boolean
}

abstract class Particle {
	position: { x: number; y: number }
	worldSize: number
	world: Cell[]

	abstract color: string

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
			particle: new Air(
				this.position.x,
				this.position.y,
				this.worldSize,
				this.world,
			),
		}
	}

	protected moveParticle(xOffset: number, yOffset: number) {
		this.world[this.position.y * this.worldSize + this.position.x] = {
			changed: true,
			particle: new Air(
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
}

class Sand extends Particle {
	color = `hsl(${randRange(40, 45)}, ${randRange(50, 60)}%, ${randRange(
		70,
		80,
	)}%)`

	update() {
		if (this.canMoveTo(0, 1)) {
			this.moveParticle(0, 1)
		} else if (this.canMoveTo(1, 1)) {
			this.moveParticle(1, 1)
		} else if (this.canMoveTo(-1, 1)) {
			this.moveParticle(-1, 1)
		}
	}
}
class Water extends Particle {
	color = `hsl(${randRange(205, 215)}, ${randRange(80, 90)}%, 40%)`

	update() {
		if (this.canMoveTo(0, 1)) {
			this.moveParticle(0, 1)
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
}

class Stone extends Particle {
	color = "grey"
	update() {}
}
class Geo extends Particle {
	color = "#e8e8e8"
	update() {}
}
class Air extends Particle {
	color = "white"
	update() {}
}

export const particles = {
	sand: Sand,
	stone: Stone,
	water: Water,
	geo: Geo,
	air: Air,
}
