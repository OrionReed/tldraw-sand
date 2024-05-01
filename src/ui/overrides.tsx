import { TLUiOverrides } from "tldraw";

export const uiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools.sand = {
      id: 'sand',
      icon: 'color',
      label: 'Sand',
      kbd: 's',
      readonlyOk: false,
      onSelect: () => {
        editor.setCurrentTool('sand')
      },
    }
    return tools
  },
}

