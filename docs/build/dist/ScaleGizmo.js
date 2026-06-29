// src/ScaleGizmo.ts
// ScaleGizmo (origin-anchored squares) — follows MoveGizmo style exactly
// - Outer square: sOuter = 0.5 (anchored at origin 0..sOuter)
// - Inner square: sInner = 0.15 (anchored at origin 0..sInner)
// - Outlines drawn as line-list edges (back, right, top faces only) using origin-based coordinates
// - Picking geometry uses quads -> triangles (axis quads + outer plane quads + inner uniform quad)
// - Picking IDs: 1..7 (AxisX, AxisY, AxisZ, PlaneXY, PlaneYZ, PlaneZX, Uniform)
import { mat4, vec3, quat } from "gl-matrix";
import { GizmoSpace } from "./GizmoManager";
export var ScalePickId;
(function (ScalePickId) {
    ScalePickId[ScalePickId["AxisX"] = 1] = "AxisX";
    ScalePickId[ScalePickId["AxisY"] = 2] = "AxisY";
    ScalePickId[ScalePickId["AxisZ"] = 3] = "AxisZ";
    ScalePickId[ScalePickId["PlaneXY"] = 4] = "PlaneXY";
    ScalePickId[ScalePickId["PlaneYZ"] = 5] = "PlaneYZ";
    ScalePickId[ScalePickId["PlaneZX"] = 6] = "PlaneZX";
    ScalePickId[ScalePickId["Uniform"] = 7] = "Uniform";
})(ScalePickId || (ScalePickId = {}));
export class ScaleGizmo {
    device;
    // pipelines + bind groups
    linePipeline;
    triPipeline;
    uniformBuffer;
    lineBindGroup;
    triBindGroup;
    // shafts
    shaftVertexBuffer;
    shaftAxisBuffer;
    shaftVertexCount = 0;
    // arrowheads
    tipVertexBuffer;
    tipAxisBuffer;
    tipVertexCount = 0;
    // outlines (outer and inner)
    planeOutlineVertexBuffer;
    planeOutlineAxisBuffer;
    planeOutlineVertexCount = 0;
    uniformOutlineVertexBuffer;
    uniformOutlineAxisBuffer;
    uniformOutlineVertexCount = 0;
    // picking
    pickVertexBuffer;
    pickIdBuffer;
    pickVertexCount = 0;
    constructor(device) {
        this.device = device;
        // -----------------------------------------
        // SHAFTS (thin lines) - same as MoveGizmo
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
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(this.shaftVertexBuffer, 0, shaftData);
        this.shaftAxisBuffer = device.createBuffer({
            size: shaftAxisData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(this.shaftAxisBuffer, 0, shaftAxisData);
        // -----------------------------------------
        // ARROWHEADS (triangles) - same as MoveGizmo
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
        const tipVerts = new Float32Array([...tipX, ...tipY, ...tipZ]);
        const tipAxis = new Uint32Array([
            ...new Array(tipX.length / 3).fill(0),
            ...new Array(tipY.length / 3).fill(1),
            ...new Array(tipZ.length / 3).fill(2),
        ]);
        this.tipVertexCount = tipAxis.length;
        this.tipVertexBuffer = device.createBuffer({
            size: tipVerts.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(this.tipVertexBuffer, 0, tipVerts);
        this.tipAxisBuffer = device.createBuffer({
            size: tipAxis.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(this.tipAxisBuffer, 0, tipAxis);
        // -----------------------------------------
        // OUTLINES + PICKING (MoveGizmo style, origin-anchored squares)
        // -----------------------------------------
        const pushEdgeArr = (verts, axes, a, b, id) => {
            verts.push(a[0], a[1], a[2]);
            verts.push(b[0], b[1], b[2]);
            axes.push(id, id);
        };
        const pushQuad = (pickVertsArr, pickIdsArr, id, a, b, c_, d) => {
            const tri = [
                [a, b, c_],
                [a, c_, d]
            ];
            for (const [p1, p2, p3] of tri) {
                pickVertsArr.push(p1[0], p1[1], p1[2]);
                pickVertsArr.push(p2[0], p2[1], p2[2]);
                pickVertsArr.push(p3[0], p3[1], p3[2]);
                pickIdsArr.push(id, id, id);
            }
        };
        // sizes (origin anchored)
        const sOuter = 0.5;
        const sInner = 0.15;
        // outer corners (origin anchored: 0..sOuter)
        const o000 = vec3.fromValues(0, 0, 0);
        const o100 = vec3.fromValues(sOuter, 0, 0);
        const o110 = vec3.fromValues(sOuter, sOuter, 0);
        const o010 = vec3.fromValues(0, sOuter, 0);
        const o101 = vec3.fromValues(sOuter, 0, sOuter);
        const o111 = vec3.fromValues(sOuter, sOuter, sOuter);
        const o011 = vec3.fromValues(0, sOuter, sOuter);
        const o001 = vec3.fromValues(0, 0, sOuter);
        // outer outline edges (back, right, top faces only) — same pattern as MoveGizmo but anchored at origin
        const outerOutlineVerts = [];
        const outerOutlineAxis = [];
        // XY plane square (back edges)
        pushEdgeArr(outerOutlineVerts, outerOutlineAxis, o000, o100, ScalePickId.PlaneXY);
        pushEdgeArr(outerOutlineVerts, outerOutlineAxis, o100, o110, ScalePickId.PlaneXY);
        pushEdgeArr(outerOutlineVerts, outerOutlineAxis, o110, o010, ScalePickId.PlaneXY);
        pushEdgeArr(outerOutlineVerts, outerOutlineAxis, o010, o000, ScalePickId.PlaneXY);
        // YZ plane square
        pushEdgeArr(outerOutlineVerts, outerOutlineAxis, o000, o010, ScalePickId.PlaneYZ);
        pushEdgeArr(outerOutlineVerts, outerOutlineAxis, o010, o011, ScalePickId.PlaneYZ);
        pushEdgeArr(outerOutlineVerts, outerOutlineAxis, o011, o001, ScalePickId.PlaneYZ);
        pushEdgeArr(outerOutlineVerts, outerOutlineAxis, o001, o000, ScalePickId.PlaneYZ);
        // ZX plane square
        pushEdgeArr(outerOutlineVerts, outerOutlineAxis, o000, o001, ScalePickId.PlaneZX);
        pushEdgeArr(outerOutlineVerts, outerOutlineAxis, o001, o101, ScalePickId.PlaneZX);
        pushEdgeArr(outerOutlineVerts, outerOutlineAxis, o101, o100, ScalePickId.PlaneZX);
        pushEdgeArr(outerOutlineVerts, outerOutlineAxis, o100, o000, ScalePickId.PlaneZX);
        const outerOutlineData = new Float32Array(outerOutlineVerts);
        const outerOutlineAxisData = new Uint32Array(outerOutlineAxis);
        this.planeOutlineVertexCount = outerOutlineAxisData.length;
        this.planeOutlineVertexBuffer = device.createBuffer({
            size: outerOutlineData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(this.planeOutlineVertexBuffer, 0, outerOutlineData);
        this.planeOutlineAxisBuffer = device.createBuffer({
            size: outerOutlineAxisData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(this.planeOutlineAxisBuffer, 0, outerOutlineAxisData);
        // inner corners (origin anchored: 0..sInner)
        const i000 = vec3.fromValues(0, 0, 0);
        const i100 = vec3.fromValues(sInner, 0, 0);
        const i110 = vec3.fromValues(sInner, sInner, 0);
        const i010 = vec3.fromValues(0, sInner, 0);
        const i101 = vec3.fromValues(sInner, 0, sInner);
        const i111 = vec3.fromValues(sInner, sInner, sInner);
        const i011 = vec3.fromValues(0, sInner, sInner);
        const i001 = vec3.fromValues(0, 0, sInner);
        // inner outline edges (same faces)
        const innerOutlineVerts = [];
        const innerOutlineAxis = [];
        // Back face (z = 0 plane) -> Uniform
        pushEdgeArr(innerOutlineVerts, innerOutlineAxis, i000, i100, ScalePickId.Uniform);
        pushEdgeArr(innerOutlineVerts, innerOutlineAxis, i100, i110, ScalePickId.Uniform);
        pushEdgeArr(innerOutlineVerts, innerOutlineAxis, i110, i010, ScalePickId.Uniform);
        pushEdgeArr(innerOutlineVerts, innerOutlineAxis, i010, i000, ScalePickId.Uniform);
        // YZ face
        pushEdgeArr(innerOutlineVerts, innerOutlineAxis, i000, i010, ScalePickId.Uniform);
        pushEdgeArr(innerOutlineVerts, innerOutlineAxis, i010, i011, ScalePickId.Uniform);
        pushEdgeArr(innerOutlineVerts, innerOutlineAxis, i011, i001, ScalePickId.Uniform);
        pushEdgeArr(innerOutlineVerts, innerOutlineAxis, i001, i000, ScalePickId.Uniform);
        // ZX face
        pushEdgeArr(innerOutlineVerts, innerOutlineAxis, i000, i001, ScalePickId.Uniform);
        pushEdgeArr(innerOutlineVerts, innerOutlineAxis, i001, i101, ScalePickId.Uniform);
        pushEdgeArr(innerOutlineVerts, innerOutlineAxis, i101, i100, ScalePickId.Uniform);
        pushEdgeArr(innerOutlineVerts, innerOutlineAxis, i100, i000, ScalePickId.Uniform);
        const innerOutlineData = new Float32Array(innerOutlineVerts);
        const innerOutlineAxisData = new Uint32Array(innerOutlineAxis);
        this.uniformOutlineVertexCount = innerOutlineAxisData.length;
        this.uniformOutlineVertexBuffer = device.createBuffer({
            size: innerOutlineData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(this.uniformOutlineVertexBuffer, 0, innerOutlineData);
        this.uniformOutlineAxisBuffer = device.createBuffer({
            size: innerOutlineAxisData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(this.uniformOutlineAxisBuffer, 0, innerOutlineAxisData);
        // ---------- PICKING (axis quads + outer plane quads + inner uniform quad) ----------
        const pickVerts = [];
        const pickIds = [];
        // axis quads -> triangles (same as MoveGizmo)
        pushQuad(pickVerts, pickIds, ScalePickId.AxisX, vec3.fromValues(0, -0.05, -0.05), vec3.fromValues(L + 0.3, -0.05, -0.05), vec3.fromValues(L + 0.3, 0.05, 0.05), vec3.fromValues(0, 0.05, 0.05));
        pushQuad(pickVerts, pickIds, ScalePickId.AxisY, vec3.fromValues(-0.05, 0, -0.05), vec3.fromValues(-0.05, L + 0.3, -0.05), vec3.fromValues(0.05, L + 0.3, 0.05), vec3.fromValues(0.05, 0, 0.05));
        pushQuad(pickVerts, pickIds, ScalePickId.AxisZ, vec3.fromValues(-0.05, -0.05, 0), vec3.fromValues(-0.05, -0.05, L + 0.3), vec3.fromValues(0.05, 0.05, L + 0.3), vec3.fromValues(0.05, 0.05, 0));
        // outer plane quads (origin anchored)
        pushQuad(pickVerts, pickIds, ScalePickId.PlaneXY, o000, o100, o110, o010);
        pushQuad(pickVerts, pickIds, ScalePickId.PlaneYZ, o000, o010, o011, o001);
        pushQuad(pickVerts, pickIds, ScalePickId.PlaneZX, o000, o001, o101, o100);
        // inner uniform quad (back face anchored)
        pushQuad(pickVerts, pickIds, ScalePickId.Uniform, i000, i100, i110, i010);
        const pickVertexData = new Float32Array(pickVerts);
        const pickIdData = new Uint32Array(pickIds);
        this.pickVertexCount = pickIds.length;
        this.pickVertexBuffer = device.createBuffer({
            size: pickVertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(this.pickVertexBuffer, 0, pickVertexData);
        this.pickIdBuffer = device.createBuffer({
            size: pickIdData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(this.pickIdBuffer, 0, pickIdData);
        // -----------------------------------------
        // UNIFORM BUFFER
        // -----------------------------------------
        this.uniformBuffer = device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        // -----------------------------------------
        // SHADERS + PIPELINES (same as MoveGizmo)
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
    out.color = vec3<f32>(1.0, 1.0, 1.0);
  }

  return out;
}

@fragment
fn fs_main(in : VSOut) -> @location(0) vec4<f32> {
  return vec4<f32>(in.color, 1.0);
}
`,
        });
        // line pipeline
        this.linePipeline = device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: shader,
                entryPoint: "vs_main",
                buffers: [
                    { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }] },
                    { arrayStride: 4, attributes: [{ shaderLocation: 1, offset: 0, format: "uint32" }] },
                ],
            },
            fragment: {
                module: shader,
                entryPoint: "fs_main",
                targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
            },
            primitive: { topology: "line-list" },
            depthStencil: {
                format: "depth24plus",
                depthWriteEnabled: false,
                depthCompare: "always",
            },
        });
        // triangle pipeline
        this.triPipeline = device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: shader,
                entryPoint: "vs_main",
                buffers: [
                    { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }] },
                    { arrayStride: 4, attributes: [{ shaderLocation: 1, offset: 0, format: "uint32" }] },
                ],
            },
            fragment: {
                module: shader,
                entryPoint: "fs_main",
                targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
            },
            primitive: { topology: "triangle-list" },
            depthStencil: {
                format: "depth24plus",
                depthWriteEnabled: false,
                depthCompare: "always",
            },
        });
        this.lineBindGroup = device.createBindGroup({
            layout: this.linePipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
        });
        this.triBindGroup = device.createBindGroup({
            layout: this.triPipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
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
        // shafts + outlines
        pass.setPipeline(this.linePipeline);
        pass.setBindGroup(0, this.lineBindGroup);
        pass.setVertexBuffer(0, this.shaftVertexBuffer);
        pass.setVertexBuffer(1, this.shaftAxisBuffer);
        pass.draw(this.shaftVertexCount);
        pass.setVertexBuffer(0, this.planeOutlineVertexBuffer);
        pass.setVertexBuffer(1, this.planeOutlineAxisBuffer);
        pass.draw(this.planeOutlineVertexCount);
        pass.setVertexBuffer(0, this.uniformOutlineVertexBuffer);
        pass.setVertexBuffer(1, this.uniformOutlineAxisBuffer);
        pass.draw(this.uniformOutlineVertexCount);
        // arrowheads
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
//# sourceMappingURL=ScaleGizmo.js.map