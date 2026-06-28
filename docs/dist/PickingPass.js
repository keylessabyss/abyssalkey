// src/PickingPass.ts
import { mat4 } from "gl-matrix";
export class PickingPass {
    device;
    texture;
    view;
    depth;
    depthView;
    pipeline;
    uniformBuffer;
    bindGroup;
    size = 256;
    constructor(device) {
        this.device = device;
        // ---------- picking texture ----------
        this.texture = device.createTexture({
            size: [this.size, this.size],
            format: "rgba8unorm",
            usage: GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.COPY_SRC,
        });
        this.view = this.texture.createView();
        // ---------- depth ----------
        this.depth = device.createTexture({
            size: [this.size, this.size],
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.depthView = this.depth.createView();
        // ---------- uniform buffer ----------
        this.uniformBuffer = device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        // ---------- shader ----------
        const shader = device.createShaderModule({
            code: `
struct VSOut {
    @builtin(position) Position : vec4<f32>,
    @location(0) idColor : vec3<f32>,
};

struct Uniforms {
    mvp : mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> u_data : Uniforms;

@vertex
fn vs_main(
    @location(0) pos : vec3<f32>,
    @location(1) id : u32
) -> VSOut {
    var out : VSOut;
    out.Position = u_data.mvp * vec4<f32>(pos, 1.0);

    // encode ID as RGB (1–255)
    let r = f32((id >> 16u) & 255u) / 255.0;
    let g = f32((id >> 8u) & 255u) / 255.0;
    let b = f32(id & 255u) / 255.0;

    out.idColor = vec3<f32>(r, g, b);
    return out;
}

@fragment
fn fs_main(in : VSOut) -> @location(0) vec4<f32> {
    return vec4<f32>(in.idColor, 1.0);
}
`
        });
        // ---------- pipeline ----------
        this.pipeline = device.createRenderPipeline({
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
                targets: [{ format: "rgba8unorm" }],
            },
            primitive: { topology: "triangle-list" },
            depthStencil: {
                format: "depth24plus",
                depthWriteEnabled: true,
                depthCompare: "less",
            },
        });
        this.bindGroup = device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
        });
    }
    // ---------- render picking geometry ----------
    render(commandEncoder, gizmo, // MoveGizmo, RotateGizmo, ScaleGizmo
    actor, cameraViewProj, cameraPos, space) {
        const pass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: this.view,
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
            depthStencilAttachment: {
                view: this.depthView,
                depthClearValue: 1.0,
                depthLoadOp: "clear",
                depthStoreOp: "store",
            },
        });
        // gizmo draws its picking faces here
        gizmo.drawPicking(pass, actor, cameraViewProj, cameraPos, space, this.pipeline, this.uniformBuffer, this.bindGroup);
        pass.end();
    }
    // ---------- read pixel under mouse ----------
    async readPixel(x, y) {
        const readBuffer = this.device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyTextureToBuffer({ texture: this.texture, origin: { x, y } }, { buffer: readBuffer, bytesPerRow: 4 }, { width: 1, height: 1 });
        this.device.queue.submit([commandEncoder.finish()]);
        await readBuffer.mapAsync(GPUMapMode.READ);
        const data = new Uint8Array(readBuffer.getMappedRange());
        const [r, g, b] = data;
        readBuffer.unmap();
        // decode ID
        return (r << 16) | (g << 8) | b;
    }
}
//# sourceMappingURL=PickingPass.js.map