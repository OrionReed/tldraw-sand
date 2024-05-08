import { StateNode } from "tldraw"
import { particles } from "../sand/particles"

const createParticleNodeClass = (name: string) => {
	return class extends StateNode {
		static override id = name
	}
}

const particleNodeClasses = Object.keys(particles).map((name) =>
	createParticleNodeClass(name),
)

export class SandTool extends StateNode {
	static override id = "sand"
	static override initial = "sand"
	static override children = () => particleNodeClasses

	override onEnter = () => {
		this.editor.setCursor({ type: "cross" })
	}
}
