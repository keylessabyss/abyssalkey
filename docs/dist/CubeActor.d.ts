import { Actor } from "./Actor";
export declare class CubeActor extends Actor {
    vertexBuffer: GPUBuffer;
    indexBuffer: GPUBuffer;
    indexCount: number;
    constructor(device: GPUDevice, name?: string);
    draw(pass: GPURenderPassEncoder): void;
}
//# sourceMappingURL=CubeActor.d.ts.map