import { StateNode } from 'tldraw'
import { Particle, particles } from '../particles'

const createParticleNodeClass = (name: string, ParticleClass: typeof Particle) => {
  return class extends StateNode {
    static override id = name
  }
}

const particleNodeClasses = Object.entries(particles).map(([name, ParticleClass]) => createParticleNodeClass(name, ParticleClass))


export class SandTool extends StateNode {
  static override id = 'sand'
  static override initial = 'sand'
  static override children = () => particleNodeClasses

  override onEnter = () => {
    this.editor.setCursor({ type: 'cross' })
  }
}

