// src/GizmoManager.ts

import { mat4, vec3 } from "gl-matrix";
import { Actor } from "./Actor";
import { MoveGizmo } from "./MoveGizmo";
import { SelectGizmo } from "./SelectGizmo";
import { RotateGizmo } from "./RotateGizmo";
import { ScaleGizmo } from "./ScaleGizmo";

export enum GizmoMode {
    None,
    Select,
    Move,
    Rotate,
    Scale
}

export enum GizmoSpace {
    World,
    Local
}

export class GizmoManager {

    // Which actor is selected in the scene
    public selectedActor: Actor | null = null;

    // Which gizmo is currently active (Move, Rotate, Scale)
    public activeGizmo: any = null;

    // Current mode
    public mode: GizmoMode = GizmoMode.None;

    // World / Local
    public space: GizmoSpace = GizmoSpace.World;

    // Gizmo instances
    private moveGizmo: MoveGizmo;
    private selectGizmo: SelectGizmo;
    private rotateGizmo: RotateGizmo;
    private scaleGizmo: ScaleGizmo;

    constructor(device: GPUDevice) {
        this.moveGizmo = new MoveGizmo(device);
        this.selectGizmo = new SelectGizmo(device);
        this.rotateGizmo = new RotateGizmo(device);
        this.scaleGizmo = new ScaleGizmo(device);
    }

    // ----------------------------------------------------
    // PUBLIC API
    // ----------------------------------------------------

    public setSelected(actor: Actor | null) {
        this.selectedActor = actor;
    }

    public setMode(mode: GizmoMode) {
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

    public toggleSpace() {
        this.space =
            this.space === GizmoSpace.World
                ? GizmoSpace.Local
                : GizmoSpace.World;
    }

    // Called by PickingPass
    public handlePick(id: number) {
        if (!this.activeGizmo) return;
        if (!this.selectedActor) return;

        this.activeGizmo.handlePick(id, this.selectedActor);
    }

    // ----------------------------------------------------
    // DRAW
    // ----------------------------------------------------
    public draw(
        pass: GPURenderPassEncoder,
        cameraViewProj: mat4,
        cameraPos: vec3
    ) {
        if (!this.selectedActor) return;

        switch (this.mode) {

            case GizmoMode.Select:
            case GizmoMode.None:
                this.selectGizmo.draw(
                    pass,
                    this.selectedActor,
                    cameraViewProj,
                    cameraPos,
                    this.space
                );
                break;

            case GizmoMode.Move:
                this.moveGizmo.draw(
                    pass,
                    this.selectedActor,
                    cameraViewProj,
                    cameraPos,
                    this.space
                );
                break;

            case GizmoMode.Rotate:
                this.rotateGizmo.draw(
                    pass,
                    this.selectedActor,
                    cameraViewProj,
                    cameraPos,
                    this.space
                );
                break;

            case GizmoMode.Scale:
                this.scaleGizmo.draw(
                    pass,
                    this.selectedActor,
                    cameraViewProj,
                    cameraPos,
                    this.space
                );
                break;
        }
    }
}
