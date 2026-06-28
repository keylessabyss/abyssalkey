// src/GizmoManager.ts
import { mat4, vec3 } from "gl-matrix";
import { Actor } from "./Actor";
import { MoveGizmo } from "./MoveGizmo";
import { SelectGizmo } from "./SelectGizmo";
import { RotateGizmo } from "./RotateGizmo";
import { ScaleGizmo } from "./ScaleGizmo";
export var GizmoMode;
(function (GizmoMode) {
    GizmoMode[GizmoMode["None"] = 0] = "None";
    GizmoMode[GizmoMode["Select"] = 1] = "Select";
    GizmoMode[GizmoMode["Move"] = 2] = "Move";
    GizmoMode[GizmoMode["Rotate"] = 3] = "Rotate";
    GizmoMode[GizmoMode["Scale"] = 4] = "Scale";
})(GizmoMode || (GizmoMode = {}));
export var GizmoSpace;
(function (GizmoSpace) {
    GizmoSpace[GizmoSpace["World"] = 0] = "World";
    GizmoSpace[GizmoSpace["Local"] = 1] = "Local";
})(GizmoSpace || (GizmoSpace = {}));
export class GizmoManager {
    // Which actor is selected in the scene
    selectedActor = null;
    // Which gizmo is currently active (Move, Rotate, Scale)
    activeGizmo = null;
    // Current mode
    mode = GizmoMode.None;
    // World / Local
    space = GizmoSpace.World;
    // Gizmo instances
    moveGizmo;
    selectGizmo;
    rotateGizmo;
    scaleGizmo;
    constructor(device) {
        this.moveGizmo = new MoveGizmo(device);
        this.selectGizmo = new SelectGizmo(device);
        this.rotateGizmo = new RotateGizmo(device);
        this.scaleGizmo = new ScaleGizmo(device);
    }
    // ----------------------------------------------------
    // PUBLIC API
    // ----------------------------------------------------
    setSelected(actor) {
        this.selectedActor = actor;
    }
    setMode(mode) {
        this.mode = mode;
        switch (mode) {
            case GizmoMode.Move:
                this.activeGizmo = this.moveGizmo;
                break;
            case GizmoMode.Rotate:
                this.activeGizmo = this.rotateGizmo;
                break;
            case GizmoMode.Scale:
                this.activeGizmo = this.scaleGizmo;
                break;
            case GizmoMode.Select:
            case GizmoMode.None:
            default:
                this.activeGizmo = null;
                break;
        }
    }
    toggleSpace() {
        this.space =
            this.space === GizmoSpace.World
                ? GizmoSpace.Local
                : GizmoSpace.World;
    }
    // Called by PickingPass
    handlePick(id) {
        if (!this.activeGizmo)
            return;
        if (!this.selectedActor)
            return;
        this.activeGizmo.handlePick(id, this.selectedActor);
    }
    // ----------------------------------------------------
    // DRAW
    // ----------------------------------------------------
    draw(pass, cameraViewProj, cameraPos) {
        if (!this.selectedActor)
            return;
        switch (this.mode) {
            case GizmoMode.Select:
            case GizmoMode.None:
                this.selectGizmo.draw(pass, this.selectedActor, cameraViewProj, cameraPos, this.space);
                break;
            case GizmoMode.Move:
                this.moveGizmo.draw(pass, this.selectedActor, cameraViewProj, cameraPos, this.space);
                break;
            case GizmoMode.Rotate:
                this.rotateGizmo.draw(pass, this.selectedActor, cameraViewProj, cameraPos, this.space);
                break;
            case GizmoMode.Scale:
                this.scaleGizmo.draw(pass, this.selectedActor, cameraViewProj, cameraPos, this.space);
                break;
        }
    }
}
//# sourceMappingURL=GizmoManager.js.map