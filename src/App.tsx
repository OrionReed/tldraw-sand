import ReactDOM from "react-dom/client";
import { Tldraw, Editor } from "tldraw";
import { FallingSand } from "./FallingSand";
import "tldraw/tldraw.css";
import "./css/index.css";

const root = document.getElementById("root");
if (root) {
	ReactDOM.createRoot(root).render(
		<div className="tldraw__editor">
			<Tldraw
				// persistenceKey="fuzzy-canvas"
				onMount={(editor: Editor) => {
					new FallingSand(editor);
				}}
			/>
		</div>
	);
}