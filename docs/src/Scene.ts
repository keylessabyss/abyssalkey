// src/Scene.ts
// Simple scene container: owns actor list and updates them.
// Rendering is performed by the renderer (main.ts) which iterates actors.

import { Actor } from "./Actor";

export class Scene {
  actors: Actor[] = [];

  add(actor: Actor) {
    this.actors.push(actor);
  }

  remove(actor: Actor) {
    const i = this.actors.indexOf(actor);
    if (i >= 0) this.actors.splice(i, 1);
  }

  update(dt: number) {
    for (const a of this.actors) a.update(dt);
  }
}
