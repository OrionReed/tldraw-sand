import { StateNode } from 'tldraw'

class Sand extends StateNode { static override id = 'sand' }
class Stone extends StateNode { static override id = 'stone' }
class Air extends StateNode { static override id = 'air' }

export class SandTool extends StateNode {
  static override id = 'sand'
  static override initial = 'sand'
  static override children = () => [Sand, Stone, Air]

  override onEnter = () => {
    this.editor.setCursor({ type: 'cross' })
  }
}

