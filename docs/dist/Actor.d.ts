import { mat4, vec3 } from "gl-matrix";
export declare class Actor {
    name: string;
    position: vec3;
    rotation: vec3;
    scale: vec3;
    modelMatrix: mat4;
    constructor(name?: string);
    updateModelMatrix(): void;
    update(_dt: number): void;
    draw(_pass: GPURenderPassEncoder): void;
    getBounds(): {
        min: number[];
        max: number[];
    };
}
//# sourceMappingURL=Actor.d.ts.map