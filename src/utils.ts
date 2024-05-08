export function hslToRgb(hsl: string): { r: number; g: number; b: number } {
	let [h, s, l] = hsl.match(/\d+/g)?.map(Number) ?? [0, 0, 0]
	l /= 100
	const a = (s * Math.min(l, 1 - l)) / 100
	const f = (n: number) => {
		const k = (n + h / 30) % 12
		const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
		return Math.round(255 * color)
	}
	return { r: f(0), g: f(8), b: f(4) }
}

class Random {
	randoms: number[] = Array.from({ length: 256 }, () => Math.random())
	index = 0
	next() {
		return this.randoms[this.index++ % 256]
	}
}

const random = new Random()

export function chance(percent: number): boolean {
	return random.next() < percent
}
export function chanceInt(max: number): number {
	return Math.floor(random.next() * max)
}

export function randRange(min: number, max: number): number {
	return Math.floor(random.next() * (max - min + 1) + min)
}
