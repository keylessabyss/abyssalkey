// src/MoveGizmo.ts
import { mat4, vec3 } from "gl-matrix";
import { Actor } from "./Actor";
import { GizmoSpace } from "./GizmoManager";
export var MovePickId;
(function (MovePickId) {
    MovePickId[MovePickId["AxisX"] = 1] = "AxisX";
    MovePickId[MovePickId["AxisY"] = 2] = "AxisY";
    MovePickId[MovePickId["AxisZ"] = 3] = "AxisZ";
    MovePickId[MovePickId["PlaneXY"] = 4] = "PlaneXY";
    MovePickId[MovePickId["PlaneYZ"] = 5] = "PlaneYZ";
    MovePickId[MovePickId["PlaneZX"] = 6] = "PlaneZX";
})(MovePickId || (MovePickId = {}));
export class MoveGizmo {
    device;
    // visual pipelines
    linePipeline;
    triPipeline;
    uniformBuffer;
    lineBindGroup;
    triBindGroup;
    // shafts (lines)
    shaftVertexBuffer;
    shaftAxisBuffer;
    shaftVertexCount = 0;
    // arrowheads (triangles)
    tipVertexBuffer;
    tipAxisBuffer;
    tipVertexCount = 0;
    // plane + center outlines (lines)
    outlineVertexBuffer;
    outlineAxisBuffer;
    outlineVertexCount = 0;
    // picking geometry (faces)
    pickVertexBuffer;
    pickIdBuffer;
    pickVertexCount = 0;
    constructor(device) {
        this.device = device;
        // -----------------------------------------
        // SHAFTS (thin lines)
        // -----------------------------------------
        const L = 2.0;
        const shaftVerts = [];
        const shaftAxis = [];
        const pushLine = (a, b, axisIndex) => {
            shaftVerts.push(a[0], a[1], a[2]);
            shaftVerts.push(b[0], b[1], b[2]);
            shaftAxis.push(axisIndex, axisIndex);
        };
        pushLine(vec3.fromValues(0, 0, 0), vec3.fromValues(L, 0, 0), 0); // X
        pushLine(vec3.fromValues(0, 0, 0), vec3.fromValues(0, L, 0), 1); // Y
        pushLine(vec3.fromValues(0, 0, 0), vec3.fromValues(0, 0, L), 2); // Z
        const shaftData = new Float32Array(shaftVerts);
        const shaftAxisData = new Uint32Array(shaftAxis);
        this.shaftVertexCount = shaftAxisData.length;
        this.shaftVertexBuffer = device.createBuffer({
            size: shaftData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this.shaftVertexBuffer, 0, shaftData);
        this.shaftAxisBuffer = device.createBuffer({
            size: shaftAxisData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this.shaftAxisBuffer, 0, shaftAxisData);
        // -----------------------------------------
        // ARROWHEADS (original triangles)
        // -----------------------------------------
        const h = 0.35;
        const w = 0.12;
        const tipX = new Float32Array([
            L + h, 0, 0,
            L, w, 0,
            L, -w, w,
            L + h, 0, 0,
            L, -w, w,
            L, -w, -w,
            L + h, 0, 0,
            L, -w, -w,
            L, w, 0,
        ]);
        const tipY = new Float32Array([
            0, L + h, 0,
            w, L, 0,
            0, L, w,
            0, L + h, 0,
            0, L, w,
            -w, L, -w,
            0, L + h, 0,
            -w, L, -w,
            w, L, 0,
        ]);
        const tipZ = new Float32Array([
            0, 0, L + h,
            w, 0, L,
            0, w, L,
            0, 0, L + h,
            0, w, L,
            -w, -w, L,
            0, 0, L + h,
            -w, -w, L,
            w, 0, L,
        ]);
        const tipVerts = new Float32Array([
            ...tipX, ...tipY, ...tipZ
        ]);
        const tipAxis = new Uint32Array([
            ...new Array(tipX.length / 3).fill(0),
            ...new Array(tipY.length / 3).fill(1),
            ...new Array(tipZ.length / 3).fill(2),
        ]);
        this.tipVertexCount = tipAxis.length;
        this.tipVertexBuffer = device.createBuffer({
            size: tipVerts.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this.tipVertexBuffer, 0, tipVerts);
        this.tipAxisBuffer = device.createBuffer({
            size: tipAxis.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this.tipAxisBuffer, 0, tipAxis);
        // -----------------------------------------
        // OUTLINE SQUARES (cube back edges only)
        // -----------------------------------------
        const s = 0.8; // medium size
        const outlineVerts = [];
        const outlineAxis = [];
        const pushEdge = (a, b, axisIndex) => {
            outlineVerts.push(a[0], a[1], a[2]);
            outlineVerts.push(b[0], b[1], b[2]);
            outlineAxis.push(axisIndex, axisIndex);
        };
        // XY plane square (back edges)
        pushEdge(vec3.fromValues(0, 0, 0), vec3.fromValues(s, 0, 0), MovePickId.PlaneXY);
        pushEdge(vec3.fromValues(s, 0, 0), vec3.fromValues(s, s, 0), MovePickId.PlaneXY);
        pushEdge(vec3.fromValues(s, s, 0), vec3.fromValues(0, s, 0), MovePickId.PlaneXY);
        // YZ plane square
        pushEdge(vec3.fromValues(0, 0, 0), vec3.fromValues(0, s, 0), MovePickId.PlaneYZ);
        pushEdge(vec3.fromValues(0, s, 0), vec3.fromValues(0, s, s), MovePickId.PlaneYZ);
        pushEdge(vec3.fromValues(0, s, s), vec3.fromValues(0, 0, s), MovePickId.PlaneYZ);
        // ZX plane square
        pushEdge(vec3.fromValues(0, 0, 0), vec3.fromValues(0, 0, s), MovePickId.PlaneZX);
        pushEdge(vec3.fromValues(0, 0, s), vec3.fromValues(s, 0, s), MovePickId.PlaneZX);
        pushEdge(vec3.fromValues(s, 0, s), vec3.fromValues(s, 0, 0), MovePickId.PlaneZX);
        const outlineData = new Float32Array(outlineVerts);
        const outlineAxisData = new Uint32Array(outlineAxis);
        this.outlineVertexCount = outlineAxisData.length;
        this.outlineVertexBuffer = device.createBuffer({
            size: outlineData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this.outlineVertexBuffer, 0, outlineData);
        this.outlineAxisBuffer = device.createBuffer({
            size: outlineAxisData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this.outlineAxisBuffer, 0, outlineAxisData);
        // -----------------------------------------
        // PICKING FACES (quads → triangles)
        // -----------------------------------------
        const pickVerts = [];
        const pickIds = [];
        const pushQuad = (id, a, b, c_, d) => {
            const tri = [
                [a, b, c_],
                [a, c_, d]
            ];
            for (const [p1, p2, p3] of tri) {
                pickVerts.push(p1[0], p1[1], p1[2]);
                pickVerts.push(p2[0], p2[1], p2[2]);
                pickVerts.push(p3[0], p3[1], p3[2]);
                pickIds.push(id, id, id);
            }
        };
        // axis faces (simple thin quads along each axis)
        pushQuad(MovePickId.AxisX, vec3.fromValues(0, -0.05, -0.05), vec3.fromValues(L + 0.3, -0.05, -0.05), vec3.fromValues(L + 0.3, 0.05, 0.05), vec3.fromValues(0, 0.05, 0.05));
        pushQuad(MovePickId.AxisY, vec3.fromValues(-0.05, 0, -0.05), vec3.fromValues(-0.05, L + 0.3, -0.05), vec3.fromValues(0.05, L + 0.3, 0.05), vec3.fromValues(0.05, 0, 0.05));
        pushQuad(MovePickId.AxisZ, vec3.fromValues(-0.05, -0.05, 0), vec3.fromValues(-0.05, -0.05, L + 0.3), vec3.fromValues(0.05, 0.05, L + 0.3), vec3.fromValues(0.05, 0.05, 0));
        // plane faces
        pushQuad(MovePickId.PlaneXY, vec3.fromValues(0, 0, 0), vec3.fromValues(s, 0, 0), vec3.fromValues(s, s, 0), vec3.fromValues(0, s, 0));
        pushQuad(MovePickId.PlaneYZ, vec3.fromValues(0, 0, 0), vec3.fromValues(0, s, 0), vec3.fromValues(0, s, s), vec3.fromValues(0, 0, s));
        pushQuad(MovePickId.PlaneZX, vec3.fromValues(0, 0, 0), vec3.fromValues(0, 0, s), vec3.fromValues(s, 0, s), vec3.fromValues(s, 0, 0));
        const pickVertexData = new Float32Array(pickVerts);
        const pickIdData = new Uint32Array(pickIds);
        this.pickVertexCount = pickIds.length;
        this.pickVertexBuffer = device.createBuffer({
            size: pickVertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this.pickVertexBuffer, 0, pickVertexData);
        this.pickIdBuffer = device.createBuffer({
            size: pickIdData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this.pickIdBuffer, 0, pickIdData);
        // -----------------------------------------
        // UNIFORM BUFFER
        // -----------------------------------------
        this.uniformBuffer = device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        // -----------------------------------------
        // SHADERS + PIPELINES
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
    } else if (axis == 2u) {
        out.color = vec3<f32>(0.0, 0.0, 1.0);
    } else {
        // plane/center pickers: overlay color (white)
        out.color = vec3<f32>(1.0, 1.0, 1.0);
    }

    return out;
}

@fragment
fn fs_main(in : VSOut) -> @location(0) vec4<f32> {
    return vec4<f32>(in.color, 1.0);
}
`
        });
        // line pipeline (shafts + outlines)
        this.linePipeline = device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: shader,
                entryPoint: "vs_main",
                buffers: [
                    { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }] },
                    { arrayStride: 4, attributes: [{ shaderLocation: 1, offset: 0, format: "uint32" }] }
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
                depthCompare: "always"
            }
        });
        // triangle pipeline (arrowheads)
        this.triPipeline = device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: shader,
                entryPoint: "vs_main",
                buffers: [
                    { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }] },
                    { arrayStride: 4, attributes: [{ shaderLocation: 1, offset: 0, format: "uint32" }] }
                ]
            },
            fragment: {
                module: shader,
                entryPoint: "fs_main",
                targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }]
            },
            primitive: { topology: "triangle-list" },
            depthStencil: {
                format: "depth24plus",
                depthWriteEnabled: false,
                depthCompare: "always"
            }
        });
        this.lineBindGroup = device.createBindGroup({
            layout: this.linePipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }]
        });
        this.triBindGroup = device.createBindGroup({
            layout: this.triPipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }]
        });
    }
    // -----------------------------------------
    // DRAW (visual gizmo)
    // -----------------------------------------
    draw(pass, actor, cameraViewProj, cameraPos, space) {
        const model = mat4.create();
        mat4.translate(model, model, actor.position);
        if (space === GizmoSpace.Local) {
            const rotScale = mat4.clone(actor.modelMatrix);
            rotScale[12] = rotScale[13] = rotScale[14] = 0;
            mat4.mul(model, model, rotScale);
        }
        const dist = vec3.distance(actor.position, cameraPos);
        const scale = dist * 0.15;
        mat4.scale(model, model, vec3.fromValues(scale, scale, scale));
        const mvp = mat4.create();
        mat4.multiply(mvp, cameraViewProj, model);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, mvp);
        // shafts + outlines (lines)
        pass.setPipeline(this.linePipeline);
        pass.setBindGroup(0, this.lineBindGroup);
        pass.setVertexBuffer(0, this.shaftVertexBuffer);
        pass.setVertexBuffer(1, this.shaftAxisBuffer);
        pass.draw(this.shaftVertexCount);
        pass.setVertexBuffer(0, this.outlineVertexBuffer);
        pass.setVertexBuffer(1, this.outlineAxisBuffer);
        pass.draw(this.outlineVertexCount);
        // arrowheads (triangles)
        pass.setPipeline(this.triPipeline);
        pass.setBindGroup(0, this.triBindGroup);
        pass.setVertexBuffer(0, this.tipVertexBuffer);
        pass.setVertexBuffer(1, this.tipAxisBuffer);
        pass.draw(this.tipVertexCount);
    }
    // -----------------------------------------
    // PICKING
    // -----------------------------------------
    drawPicking(pass, actor, cameraViewProj, cameraPos, space, pickingPipeline, pickingUniformBuffer, pickingBindGroup) {
        const model = mat4.create();
        mat4.translate(model, model, actor.position);
        if (space === GizmoSpace.Local) {
            const rotScale = mat4.clone(actor.modelMatrix);
            rotScale[12] = rotScale[13] = rotScale[14] = 0;
            mat4.mul(model, model, rotScale);
        }
        const dist = vec3.distance(actor.position, cameraPos);
        const scale = dist * 0.15;
        mat4.scale(model, model, vec3.fromValues(scale, scale, scale));
        const mvp = mat4.create();
        mat4.multiply(mvp, cameraViewProj, model);
        this.device.queue.writeBuffer(pickingUniformBuffer, 0, mvp);
        pass.setPipeline(pickingPipeline);
        pass.setBindGroup(0, pickingBindGroup);
        pass.setVertexBuffer(0, this.pickVertexBuffer);
        pass.setVertexBuffer(1, this.pickIdBuffer);
        pass.draw(this.pickVertexCount);
    }
}
//# sourceMappingURL=MoveGizmo.js.map