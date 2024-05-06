function randRange(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1) + min)
}

abstract class Particle {
	position: { x: number; y: number }
	gridSize: number
	grid: (Particle | null)[]
	abstract color: string

	constructor(
		x: number,
		y: number,
		gridSize: number,
		grid: (Particle | null)[],
	) {
		this.position = { x, y }
		this.gridSize = gridSize
		this.grid = grid
	}

	abstract update(): void

	/** Get the index relative to this particle */
	protected idx(xOffset: number, yOffset: number): number {
		return (
			(this.position.y + yOffset) * this.gridSize + (this.position.x + xOffset)
		)
	}

	protected canMoveTo(index: number): boolean {
		return !this.grid[index]
	}

	protected delete() {
		this.grid[this.position.y * this.gridSize + this.position.x] = null
	}

	protected moveParticle(newX: number, newY: number) {
		this.grid[this.position.y * this.gridSize + this.position.x] = null
		this.position.x = newX
		this.position.y = newY
		this.grid[newY * this.gridSize + newX] = this
	}
}

class Sand extends Particle {
	color = `hsl(${randRange(40, 45)}, ${randRange(50, 60)}%, ${randRange(
		70,
		80,
	)}%)`

	update() {
		const x = this.position.x
		const y = this.position.y
		const below = this.idx(0, 1)
		const belowRight = this.idx(1, 1)
		const belowLeft = this.idx(-1, 1)

		// Check and move to the new position if possible
		if (y + 1 < this.gridSize && this.canMoveTo(below)) {
			this.moveParticle(x, y + 1)
		} else if (
			y + 1 < this.gridSize &&
			x + 1 < this.gridSize &&
			this.canMoveTo(belowRight)
		) {
			this.moveParticle(x + 1, y + 1)
		} else if (
			y + 1 < this.gridSize &&
			x - 1 >= 0 &&
			this.canMoveTo(belowLeft)
		) {
			this.moveParticle(x - 1, y + 1)
		}
	}
}
class Water extends Particle {
	color = `hsl(${randRange(205, 215)}, ${randRange(80, 90)}%, 40%)`

	update() {
		const x = this.position.x
		const y = this.position.y
		const below = (y + 1) * this.gridSize + x
		const belowRight = (y + 1) * this.gridSize + (x + 1)
		const belowLeft = (y + 1) * this.gridSize + (x - 1)
		const right = y * this.gridSize + (x + 1)
		const left = y * this.gridSize + (x - 1)

		// Check and move to the new position if possible
		if (y + 1 < this.gridSize && this.canMoveTo(below)) {
			this.moveParticle(x, y + 1, below)
			return
		}
		if (
			y + 1 < this.gridSize &&
			x + 1 < this.gridSize &&
			this.canMoveTo(belowRight)
		) {
			this.moveParticle(x + 1, y + 1, belowRight)
			return
		}
		if (y + 1 < this.gridSize && x - 1 >= 0 && this.canMoveTo(belowLeft)) {
			this.moveParticle(x - 1, y + 1, belowLeft)
			return
		}

		const canMoveRight = x + 1 < this.gridSize && this.canMoveTo(right)
		const canMoveLeft = x - 1 >= 0 && this.canMoveTo(left)

		if (canMoveRight && canMoveLeft) {
			const random = Math.random()
			if (random < 0.5) {
				this.moveParticle(x + 1, y, right)
			} else {
				this.moveParticle(x - 1, y, left)
			}
		} else if (canMoveRight) {
			this.moveParticle(x + 1, y, right)
		} else if (canMoveLeft) {
			this.moveParticle(x - 1, y, left)
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
