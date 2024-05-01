import { useState } from "react";
import {
  DefaultToolbar,
  TLComponents,
  TldrawUiMenuItem,
  useIsToolSelected,
  DefaultToolbarContent,
  useTools,
  DefaultStylePanel,
  DefaultStylePanelContent,
  TLUiStylePanelProps,
  TldrawUiButton,
  TldrawUiButtonLabel,
  useRelevantStyles,
  useEditor
} from "tldraw";

function DefaultPanel(props: TLUiStylePanelProps) {
  return <DefaultStylePanel {...props} />
}


function CustomStylePanel(props: TLUiStylePanelProps) {
  const tools = useTools()
  const isSandSelected = useIsToolSelected(tools.sand)
  const editor = useEditor()
  const currentTool = editor.getCurrentTool()
  const styles = useRelevantStyles()
  const [currentPath, setCurrentPath] = useState(editor.getPath())

  function SandButton({ name }: { name: string }) {
    const path = `sand.${name}`
    const isSelected = editor.getPath() === path
    return <TldrawUiButton
      type="normal"
      onClick={() => {
        editor.setCurrentTool(path)
        setCurrentPath(path)
      }}
      style={{ color: isSelected ? 'green' : 'black' }}>
      <TldrawUiButtonLabel>{capitalizeFirstLetter(name)}</TldrawUiButtonLabel>
    </TldrawUiButton>
  }
  return (
    <DefaultStylePanel {...props}>
      {isSandSelected && currentTool.children && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
          {Object.keys(currentTool.children).map((key) => {
            return <SandButton key={key} name={key} />
          })
          }
        </div>
      )}
      <DefaultStylePanelContent styles={styles} />
    </DefaultStylePanel>
  )
}

export const uiComponents: TLComponents = {
  StylePanel: CustomStylePanel,
  Toolbar: (props) => {
    const tools = useTools()
    const isSandSelected = useIsToolSelected(tools.sand)
    return (
      <DefaultToolbar {...props}>
        <TldrawUiMenuItem {...tools.sand} isSelected={isSandSelected} />
        <DefaultToolbarContent />
      </DefaultToolbar>
    )
  }
}

function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}