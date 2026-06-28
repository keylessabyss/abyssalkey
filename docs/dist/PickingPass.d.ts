import { mat4 } from "gl-matrix";
export declare class PickingPass {
    device: GPUDevice;
    texture: GPUTexture;
    view: GPUTextureView;
    depth: GPUTexture;
    depthView: GPUTextureView;
    pipeline: GPURenderPipeline;
    uniformBuffer: GPUBuffer;
    bindGroup: GPUBindGroup;
    size: number;
    constructor(device: GPUDevice);
    render(commandEncoder: GPUCommandEncoder, gizmo: any, // MoveGizmo, RotateGizmo, ScaleGizmo
    actor: any, cameraViewProj: mat4, cameraPos: any, space: any): void;
    readPixel(x: number, y: number): Promise<number>;
}
//# sourceMappingURL=PickingPass.d.ts.map