export class DetailsPanel {
    container;
    selection;
    constructor(containerId, selection) {
        this.container = document.getElementById(containerId);
        this.selection = selection;
    }
    render() {
        this.container.innerHTML = "<h3>Details</h3>";
        const actor = this.selection.selected;
        if (!actor) {
            this.container.innerHTML += "<p>No actor selected</p>";
            return;
        }
        // Display actor transform
        this.container.innerHTML += `
        <p><strong>Name:</strong> ${actor.name}</p>
        <p><strong>Position:</strong> ${Array.from(actor.position).join(", ")}</p>
        <p><strong>Rotation:</strong> ${Array.from(actor.rotation).join(", ")}</p>
        <p><strong>Scale:</strong> ${Array.from(actor.scale).join(", ")}</p>
`;
    }
}
//# sourceMappingURL=DetailsPanel.js.map