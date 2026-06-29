// src/RotateGizmo.ts
import { mat4, vec3 } from "./gl-matrix";
import { GizmoSpace } from "./GizmoManager";
export class RotateGizmo {
    drawPicking(pass, actor, cameraViewProj, cameraPos, space, pickingPipeline, pickingUniformBuffer, pickingBindGroup) {
        // TEMP: do nothing so picking pass doesn't crash
    }
    device;
    pipeline;
    uniformBuffer;
    bindGroup;
    vertexBuffer;
    axisBuffer;
    normalBuffer;
    segmentCount;
    constructor(device) {
        this.device = device;
        const segments = 64; // smooth
        const radius = 1.5; // your choice
        this.segmentCount = segments;
        // -----------------------------------------
        // BUILD 3 RINGS IN LOCAL SPACE
        // X ring: lies in YZ plane (normal +X)
        // Y ring: lies in XZ plane (normal +Y)
        // Z ring: lies in XY plane (normal +Z)
        // -----------------------------------------
        const verts = [];
        const axes = [];
        const normals = [];
        const twoPi = Math.PI * 2.0;
        // Helper to push a ring
        const pushRing = (axisIndex, normal, plane) => {
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const angle = t * twoPi;
                const c = Math.cos(angle) * radius;
                const s = Math.sin(angle) * radius;
                let x = 0, y = 0, z = 0;
                if (plane === "YZ") {
                    // X ring: center at origin, radius in YZ
                    y = c;
                    z = s;
                }
                else if (plane === "XZ") {
                    // Y ring: radius in XZ
                    x = c;
                    z = s;
                }
                else {
                    // XY plane: Z ring
                    x = c;
                    y = s;
                }
                verts.push(x, y, z);
                axes.push(axisIndex);
                normals.push(normal[0], normal[1], normal[2]);
            }
        };
        // X-axis rotation ring (normal +X, plane YZ)
        pushRing(0, vec3.fromValues(1, 0, 0), "YZ");
        // Y-axis rotation ring (normal +Y, plane XZ)
        pushRing(1, vec3.fromValues(0, 1, 0), "XZ");
        // Z-axis rotation ring (normal +Z, plane XY)
        pushRing(2, vec3.fromValues(0, 0, 1), "XY");
        const vertexData = new Float32Array(verts);
        const axisData = new Uint32Array(axes);
        const normalData = new Float32Array(normals);
        this.vertexBuffer = device.createBuffer({
            size: vertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this.vertexBuffer, 0, vertexData);
        this.axisBuffer = device.createBuffer({
            size: axisData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this.axisBuffer, 0, axisData);
        this.normalBuffer = device.createBuffer({
            size: normalData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this.normalBuffer, 0, normalData);
        // -----------------------------------------
        // UNIFORM BUFFER
        // -----------------------------------------
        this.uniformBuffer = device.createBuffer({
            size: 64 + 16, // mvp (64) + cameraDir (vec3 + padding)
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
    @location(1) fade : f32,
};

struct Uniforms {
    mvp : mat4x4<f32>,
    cameraDir : vec3<f32>,
    pad : f32,
};

@group(0) @binding(0) var<uniform> u_data : Uniforms;

@vertex
fn vs_main(
    @location(0) pos : vec3<f32>,
    @location(1) axis : u32,
    @location(2) normal : vec3<f32>
) -> VSOut {
    var out : VSOut;
    out.Position = u_data.mvp * vec4<f32>(pos, 1.0);

    // Axis color
    if (axis == 0u) {
        out.color = vec3<f32>(1.0, 0.0, 0.0); // X red
    } else if (axis == 1u) {
        out.color = vec3<f32>(0.0, 1.0, 0.0); // Y green
    } else {
        out.color = vec3<f32>(0.0, 0.0, 1.0); // Z blue
    }

    // Backside fade: dot(normal, cameraDir)
    let d = dot(normalize(normal), normalize(u_data.cameraDir));
    // d > 0 → facing camera, d < 0 → away
    // Map to [0.15, 1.0]
    let minFade = 0.15;
    let maxFade = 1.0;
    let t = (d + 1.0) * 0.5; // [-1,1] → [0,1]
    out.fade = mix(minFade, maxFade, t);

    return out;
}

@fragment
fn fs_main(in : VSOut) -> @location(0) vec4<f32> {
    return vec4<f32>(in.color, in.fade);
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
                    },
                    {
                        arrayStride: 12,
                        attributes: [{ shaderLocation: 2, offset: 0, format: "float32x3" }]
                    }
                ]
            },
            fragment: {
                module: shader,
                entryPoint: "fs_main",
                targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }]
            },
            primitive: {
                topology: "line-strip"
            },
            depthStencil: {
                format: "depth24plus",
                depthWriteEnabled: false,
                depthCompare: "always"
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
        // Camera direction in world space (from actor to camera)
        const camDir = vec3.create();
        vec3.subtract(camDir, cameraPos, actor.position);
        // Upload uniforms: mvp + cameraDir
        const tmp = new Float32Array(16 + 4);
        tmp.set(mvp, 0);
        tmp[16] = camDir[0];
        tmp[17] = camDir[1];
        tmp[18] = camDir[2];
        tmp[19] = 0.0;
        this.device.queue.writeBuffer(this.uniformBuffer, 0, tmp);
        // Draw
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.setVertexBuffer(0, this.vertexBuffer);
        pass.setVertexBuffer(1, this.axisBuffer);
        pass.setVertexBuffer(2, this.normalBuffer);
        // We have 3 rings, each (segments + 1) verts
        const ringVerts = this.segmentCount + 1;
        const totalRings = 3;
        for (let i = 0; i < totalRings; i++) {
            const firstVertex = i * ringVerts;
            pass.draw(ringVerts, 1, firstVertex, 0);
        }
    }
}
//# sourceMappingURL=RotateGizmo.js.map