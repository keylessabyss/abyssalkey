// src/SelectGizmo.ts
import { mat4, vec3, quat } from "./gl-matrix.js";

import { GizmoSpace } from "./GizmoManager";
export class SelectGizmo {
    device;
    pipeline;
    vertexBuffer;
    axisBuffer;
    uniformBuffer;
    bindGroup;
    constructor(device) {
        this.device = device;
        // -----------------------------------------
        // SIMPLE 3-AXIS LINES
        // -----------------------------------------
        const vertices = new Float32Array([
            // X axis
            0, 0, 0,
            1.5, 0, 0,
            // Y axis
            0, 0, 0,
            0, 1.5, 0,
            // Z axis
            0, 0, 0,
            0, 0, 1.5,
        ]);
        this.vertexBuffer = device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this.vertexBuffer, 0, vertices);
        // Axis index (0=X, 1=Y, 2=Z)
        const axisData = new Uint32Array([
            0, 0,
            1, 1,
            2, 2
        ]);
        this.axisBuffer = device.createBuffer({
            size: axisData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this.axisBuffer, 0, axisData);
        // -----------------------------------------
        // UNIFORM BUFFER
        // -----------------------------------------
        this.uniformBuffer = device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        // -----------------------------------------
        // SHADER
        // -----------------------------------------
        const shader = device.createShaderModule({
            code: `
struct VSOut {
    @builtin(position) Position : vec4<f32>,
    @location(0) color : vec3<f32>,
};

@group(0) @binding(0) var<uniform> u_mvp : mat4x4<f32>;

@vertex
fn vs_main(
    @location(0) pos : vec3<f32>,
    @location(1) axis : u32
) -> VSOut {
    var out : VSOut;
    out.Position = u_mvp * vec4<f32>(pos, 1.0);

    if (axis == 0u) {
        out.color = vec3<f32>(1.0, 0.0, 0.0);
    } else if (axis == 1u) {
        out.color = vec3<f32>(0.0, 1.0, 0.0);
    } else {
        out.color = vec3<f32>(0.0, 0.0, 1.0);
    }

    return out;
}

@fragment
fn fs_main(in : VSOut) -> @location(0) vec4<f32> {
    return vec4<f32>(in.color, 1.0);
}
`
        });
        // -----------------------------------------
        // PIPELINE
        // -----------------------------------------
        this.pipeline = device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: shader,
                entryPoint: "vs_main",
                buffers: [
                    {
                        arrayStride: 12,
                        attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }]
                    },
                    {
                        arrayStride: 4,
                        attributes: [{ shaderLocation: 1, offset: 0, format: "uint32" }]
                    }
                ]
            },
            fragment: {
                module: shader,
                entryPoint: "fs_main",
                targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }]
            },
            primitive: { topology: "line-list" },
            depthStencil: {
                format: "depth24plus",
                depthWriteEnabled: false,
                depthCompare: "always" // always draw on top
            }
        });
        this.bindGroup = device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }]
        });
    }
    // -----------------------------------------
    // DRAW
    // -----------------------------------------
    draw(pass, actor, cameraViewProj, cameraPos, space) {
        const model = mat4.create();
        // Position at actor origin
        mat4.translate(model, model, actor.position);
        // Local or world orientation
        if (space === GizmoSpace.Local) {
            const rotScale = mat4.clone(actor.modelMatrix);
            rotScale[12] = rotScale[13] = rotScale[14] = 0;
            mat4.mul(model, model, rotScale);
        }
        // Constant screen size
        const dist = vec3.distance(actor.position, cameraPos);
        const scale = dist * 0.15;
        mat4.scale(model, model, vec3.fromValues(scale, scale, scale));
        // MVP
        const mvp = mat4.create();
        mat4.multiply(mvp, cameraViewProj, model);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, mvp);
        // Draw
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.setVertexBuffer(0, this.vertexBuffer);
        pass.setVertexBuffer(1, this.axisBuffer);
        pass.draw(6);
    }
}
//# sourceMappingURL=SelectGizmo.js.map