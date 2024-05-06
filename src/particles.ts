function randRange(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1) + min)
}

abstract class Particle {
	position: { x: number; y: number }
	worldSize: number
	grid: (Particle | null)[]
	abstract color: string

	constructor(
		x: number,
		y: number,
		worldSize: number,
		world: (Particle | null)[],
	) {
		this.position = { x, y }
		this.worldSize = worldSize
		this.grid = world
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
			newX > this.worldSize ||
			newY < 0 ||
			newY >= this.worldSize
		) {
			return false
		}
		return !this.grid[newY * this.worldSize + newX]
	}

	protected delete() {
		this.grid[this.position.y * this.worldSize + this.position.x] = null
	}

	protected moveParticle(xOffset: number, yOffset: number) {
		this.grid[this.position.y * this.worldSize + this.position.x] = null
		this.position.x = this.position.x + xOffset
		this.position.y = this.position.y + yOffset
		this.grid[this.position.y * this.worldSize + this.position.x] = this
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
	update() {
		// Intentionally left empty
	}
}
class Geo extends Particle {
	color = "#e8e8e8"
	update() {
		// Intentionally left empty
	}
}
class Air extends Particle {
	color = "red"
	update() {
		this.delete()
	}
}

export const particles = {
	sand: Sand,
	stone: Stone,
	water: Water,
	geo: Geo,
	air: Air,
}

export { Particle, Sand, Stone, Water, Geo, Air }
