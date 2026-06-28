// src/CubeActor.ts
// A simple mesh actor that owns vertex/index buffers and issues draw calls.
// It does NOT own pipeline, bind groups, or uniform buffers.
import { Actor } from "./Actor";
export class CubeActor extends Actor {
    vertexBuffer;
    indexBuffer;
    indexCount;
    constructor(device, name = "CubeActor") {
        super(name);
        // 8 positions (we use 12 triangles via indices)
        const vertices = new Float32Array([
            -1, -1, 1,
            1, -1, 1,
            1, 1, 1,
            -1, 1, 1,
            -1, -1, -1,
            1, -1, -1,
            1, 1, -1,
            -1, 1, -1,
        ]);
        const indices = new Uint16Array([
            0, 1, 2, 0, 2, 3,
            4, 6, 5, 4, 7, 6,
            4, 5, 1, 4, 1, 0,
            3, 2, 6, 3, 6, 7,
            1, 5, 6, 1, 6, 2,
            4, 0, 3, 4, 3, 7
        ]);
        this.indexCount = indices.length;
        this.vertexBuffer = device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this.vertexBuffer, 0, vertices);
        this.indexBuffer = device.createBuffer({
            size: indices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this.indexBuffer, 0, indices);
    }
    // Draw only binds mesh buffers and issues drawIndexed.
    // Pipeline and bind groups are set by the renderer before calling this.
    draw(pass) {
        pass.setVertexBuffer(0, this.vertexBuffer);
        pass.setIndexBuffer(this.indexBuffer, "uint16");
        pass.drawIndexed(this.indexCount, 1, 0, 0, 0);
    }
}
//# sourceMappingURL=CubeActor.js.map