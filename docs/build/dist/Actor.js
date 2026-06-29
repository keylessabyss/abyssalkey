// src/Actor.ts
// Base Actor: owns transform and modelMatrix computation only.
// No GPU resources here — renderer manages GPU state.
import { mat4, vec3 } from "gl-matrix";
export class Actor {
    name;
    position = vec3.fromValues(0, 0, 0);
    rotation = vec3.fromValues(0, 0, 0); // Euler: [pitch, yaw, roll] or your chosen convention
    scale = vec3.fromValues(1, 1, 1);
    modelMatrix = mat4.create();
    constructor(name = "Actor") {
        this.name = name;
    }
    // Build model matrix from position/rotation/scale
    updateModelMatrix() {
        mat4.identity(this.modelMatrix);
        mat4.translate(this.modelMatrix, this.modelMatrix, this.position);
        // rotation order: yaw (Y), pitch (X), roll (Z)
        mat4.rotateY(this.modelMatrix, this.modelMatrix, this.rotation[1]);
        mat4.rotateX(this.modelMatrix, this.modelMatrix, this.rotation[0]);
        mat4.rotateZ(this.modelMatrix, this.modelMatrix, this.rotation[2]);
        mat4.scale(this.modelMatrix, this.modelMatrix, this.scale);
    }
    // Called by Scene each frame
    update(_dt) {
        this.updateModelMatrix();
    }
    // Called by renderer during draw(pass)
    // Subclasses override to bind vertex/index buffers and issue draw calls
    draw(_pass) {
        // no-op in base class
    }
    getBounds() {
        // simple unit cube bounds centered at origin
        return {
            min: [-1, -1, -1],
            max: [1, 1, 1]
        };
    }
}
//# sourceMappingURL=Actor.js.map