import { mat4, vec3 } from "gl-matrix";
import { Actor } from "./Actor";
import { GizmoSpace } from "./GizmoManager";
export declare class RotateGizmo {
    drawPicking(pass: GPURenderPassEncoder, actor: Actor, cameraViewProj: mat4, cameraPos: vec3, space: GizmoSpace, pickingPipeline: GPURenderPipeline, pickingUniformBuffer: GPUBuffer, pickingBindGroup: GPUBindGroup): void;
    private device;
    private pipeline;
    private uniformBuffer;
    private bindGroup;
    private vertexBuffer;
    private axisBuffer;
    private normalBuffer;
    private segmentCount;
    constructor(device: GPUDevice);
    draw(pass: GPURenderPassEncoder, actor: Actor, cameraViewProj: mat4, cameraPos: vec3, space: GizmoSpace): void;
}
//# sourceMappingURL=RotateGizmo.d.ts.map