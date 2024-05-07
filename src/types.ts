import { Particle } from "./particles"

export type Cell = {
	particle: Particle
	dirty: boolean
	neighbours: {
		upLeft: Cell
		up: Cell
		upRight: Cell
		left: Cell
		right: Cell
		downLeft: Cell
		down: Cell
		downRight: Cell
	}
}

export type ParticleConstructor = new (
	x: number,
	y: number,
	world: Cell[],
) => Particle
