export class HierarchyPanel {
    container;
    scene;
    selection;
    onSelectionChanged;
    constructor(containerId, scene, selection, onSelectionChanged) {
        this.container = document.getElementById(containerId);
        this.scene = scene;
        this.selection = selection;
        this.onSelectionChanged = onSelectionChanged;
    }
    render() {
        this.container.innerHTML = "<h3>Hierarchy</h3>";
        for (const actor of this.scene.actors) {
            const entry = document.createElement("div");
            entry.textContent = actor.name;
            entry.style.padding = "4px 8px";
            entry.style.cursor = "pointer";
            // highlight selected
            if (this.selection.isSelected(actor)) {
                entry.style.background = "#3a3f55";
            }
            entry.onclick = () => {
                this.selection.select(actor);
                this.render(); // refresh highlight
                this.onSelectionChanged(); // update details panel
            };
            this.container.appendChild(entry);
        }
    }
}
//# sourceMappingURL=HierarchyPanel.js.map