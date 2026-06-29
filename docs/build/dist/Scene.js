// src/Scene.ts
// Simple scene container: owns actor list and updates them.
// Rendering is performed by the renderer (main.ts) which iterates actors.
export class Scene {
    actors = [];
    add(actor) {
        this.actors.push(actor);
    }
    remove(actor) {
        const i = this.actors.indexOf(actor);
        if (i >= 0)
            this.actors.splice(i, 1);
    }
    update(dt) {
        for (const a of this.actors)
            a.update(dt);
    }
}
//# sourceMappingURL=Scene.js.map