import { mat4, vec3 } from "gl-matrix";
import { Actor } from "./Actor";
import { GizmoSpace } from "./GizmoManager";
export declare class SelectGizmo {
    private device;
    private pipeline;
    private vertexBuffer;
    private axisBuffer;
    private uniformBuffer;
    private bindGroup;
    constructor(device: GPUDevice);
    draw(pass: GPURenderPassEncoder, actor: Actor, cameraViewProj: mat4, cameraPos: vec3, space: GizmoSpace): void;
}
//# sourceMappingURL=SelectGizmo.d.ts.map