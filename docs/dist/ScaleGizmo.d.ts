import { mat4, vec3 } from "gl-matrix";
import { Actor } from "./Actor";
import { GizmoSpace } from "./GizmoManager";
export declare enum ScalePickId {
    AxisX = 1,
    AxisY = 2,
    AxisZ = 3,
    PlaneXY = 4,
    PlaneYZ = 5,
    PlaneZX = 6,
    Uniform = 7
}
export declare class ScaleGizmo {
    private device;
    private linePipeline;
    private triPipeline;
    private uniformBuffer;
    private lineBindGroup;
    private triBindGroup;
    private shaftVertexBuffer;
    private shaftAxisBuffer;
    private shaftVertexCount;
    private tipVertexBuffer;
    private tipAxisBuffer;
    private tipVertexCount;
    private planeOutlineVertexBuffer;
    private planeOutlineAxisBuffer;
    private planeOutlineVertexCount;
    private uniformOutlineVertexBuffer;
    private uniformOutlineAxisBuffer;
    private uniformOutlineVertexCount;
    private pickVertexBuffer;
    private pickIdBuffer;
    private pickVertexCount;
    constructor(device: GPUDevice);
    draw(pass: GPURenderPassEncoder, actor: Actor, cameraViewProj: mat4, cameraPos: vec3, space: GizmoSpace): void;
    drawPicking(pass: GPURenderPassEncoder, actor: Actor, cameraViewProj: mat4, cameraPos: vec3, space: GizmoSpace, pickingPipeline: GPURenderPipeline, pickingUniformBuffer: GPUBuffer, pickingBindGroup: GPUBindGroup): void;
}
//# sourceMappingURL=ScaleGizmo.d.ts.map