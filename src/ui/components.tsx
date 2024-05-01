import {
  DefaultToolbar,
  TLComponents,
  TldrawUiMenuItem,
  useIsToolSelected,
  DefaultToolbarContent,
  useTools,
} from "tldraw";

export const uiComponents: TLComponents = {
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