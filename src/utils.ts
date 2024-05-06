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

export function chance(percent: number): boolean {
	return Math.random() < percent
}
export function chanceInt(max: number): number {
	return Math.floor(Math.random() * max)
}

export function randRange(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1) + min)
}
