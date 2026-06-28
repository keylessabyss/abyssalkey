import { mat4, vec3 } from "gl-matrix";
import { Actor } from "./Actor";
export declare enum GizmoMode {
    None = 0,
    Select = 1,
    Move = 2,
    Rotate = 3,
    Scale = 4
}
export declare enum GizmoSpace {
    World = 0,
    Local = 1
}
export declare class GizmoManager {
    selectedActor: Actor | null;
    activeGizmo: any;
    mode: GizmoMode;
    space: GizmoSpace;
    private moveGizmo;
    private selectGizmo;
    private rotateGizmo;
    private scaleGizmo;
    constructor(device: GPUDevice);
    setSelected(actor: Actor | null): void;
    setMode(mode: GizmoMode): void;
    toggleSpace(): void;
    handlePick(id: number): void;
    draw(pass: GPURenderPassEncoder, cameraViewProj: mat4, cameraPos: vec3): void;
}
//# sourceMappingURL=GizmoManager.d.ts.map