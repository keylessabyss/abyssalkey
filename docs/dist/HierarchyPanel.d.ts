import { Scene } from "./Scene";
import { SelectionManager } from "./SelectionManager";
export declare class HierarchyPanel {
    private container;
    private scene;
    private selection;
    private onSelectionChanged;
    constructor(containerId: string, scene: Scene, selection: SelectionManager, onSelectionChanged: () => void);
    render(): void;
}
//# sourceMappingURL=HierarchyPanel.d.ts.map