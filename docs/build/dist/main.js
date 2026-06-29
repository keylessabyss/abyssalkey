// src/main.ts
// Central bootstrap + renderer orchestration.
// - Creates GPU device, pipeline, and per-actor uniform/bind groups
// - Owns render loop and uploads per-actor model matrix + shared viewProj
// - Scene holds actors; actors own transforms and mesh buffers only
//
// Requires: npm install gl-matrix
// Build/run: your normal dev server (Vite/webpack/etc.)
import "./styles.css";
import { mat4, vec3 } from "./gl-matrix.js";
import { Scene } from "./Scene.js";
import { CubeActor } from "./CubeActor.js";
import { SelectionManager } from "./SelectionManager.js";
import { raycastActors } from "./Raycast.js";
import { HierarchyPanel } from "./HierarchyPanel.js";
import { DetailsPanel } from "./DetailsPanel.js";
import { GizmoManager, GizmoMode, GizmoSpace } from "./GizmoManager.js";
import { PickingPass } from "./PickingPass.js";
async function main() {
    // -------------------------
    // DOM + HUD
    // -------------------------
    const canvas = document.querySelector("canvas#viewport");
    const hud = document.querySelector("#hud");
    function showError(msg) {
        console.error(msg);
        try {
            hud.textContent = `Error: ${msg}`;
        }
        catch { }
    }
    try {
        // -------------------------
        // WebGPU init
        // -------------------------
        if (!navigator.gpu)
            throw new Error("WebGPU not supported in this browser");
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter)
            throw new Error("No GPU adapter found");
        const device = await adapter.requestDevice();
        const context = canvas.getContext("webgpu");
        const format = navigator.gpu.getPreferredCanvasFormat();
        const pickingPass = new PickingPass(device);
        let clickStartTime = 0;
        let clickIsValid = true;
        const CLICK_THRESHOLD = 0.5; // half a second
        // -------------------------
        // Camera (simple)
        // -------------------------
        class Camera {
            position = vec3.fromValues(0, 0, 6);
            target = vec3.fromValues(0, 0, 0);
            up = vec3.fromValues(0, 1, 0);
            fov = 60 * Math.PI / 180;
            near = 0.1;
            far = 100.0;
            projection = mat4.create();
            view = mat4.create();
            viewProj = mat4.create();
            getRight(out = vec3.create()) {
                const forward = vec3.create();
                vec3.subtract(forward, this.target, this.position);
                vec3.normalize(forward, forward);
                vec3.cross(out, forward, this.up);
                vec3.normalize(out, out);
                return out;
            }
            updateProjection(aspect) {
                mat4.perspective(this.projection, this.fov, aspect, this.near, this.far);
            }
            updateView() {
                mat4.lookAt(this.view, this.position, this.target, this.up);
            }
            updateViewProj(aspect) {
                this.updateProjection(aspect);
                this.updateView();
                mat4.multiply(this.viewProj, this.projection, this.view);
            }
        }
        const camera = new Camera();
        // -------------------------
        // Swapchain + depth helpers
        // -------------------------
        function configureContext() {
            context.configure({ device, format, alphaMode: "opaque" });
        }
        function createDepthTexture(w, h) {
            return device.createTexture({
                size: [Math.max(1, w), Math.max(1, h)],
                format: "depth24plus",
                usage: GPUTextureUsage.RENDER_ATTACHMENT
            });
        }
        let depthTexture = null;
        function resizeCanvas() {
            const rect = canvas.getBoundingClientRect();
            const dpr = Math.max(1, window.devicePixelRatio || 1);
            const width = Math.max(1, Math.floor(rect.width * dpr));
            const height = Math.max(1, Math.floor(rect.height * dpr));
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
                configureContext();
                depthTexture?.destroy?.();
                depthTexture = createDepthTexture(width, height);
                camera.updateProjection(rect.width / rect.height);
            }
        }
        configureContext();
        resizeCanvas();
        if (!depthTexture)
            depthTexture = createDepthTexture(canvas.width, canvas.height);
        new ResizeObserver(resizeCanvas).observe(canvas);
        window.addEventListener("resize", resizeCanvas);
        // -------------------------
        // Shader + pipeline
        // - Uniform layout: binding(0) Uniforms { model : mat4, viewProj : mat4 }
        // -------------------------
        const shaderModule = device.createShaderModule({
            code: `
struct Uniforms { model : mat4x4<f32>, viewProj : mat4x4<f32> };
@group(0) @binding(0) var<uniform> uniforms : Uniforms;

struct VSOut { @builtin(position) Position : vec4<f32>, @location(0) color : vec3<f32> };

@vertex fn vs_main(@location(0) pos : vec3<f32>) -> VSOut {
  var out : VSOut;
  out.Position = uniforms.viewProj * uniforms.model * vec4<f32>(pos, 1.0);
  out.color = (pos + vec3<f32>(1.0)) * 0.5;
  return out;
}

@fragment fn fs_main(in : VSOut) -> @location(0) vec4<f32> {
  return vec4<f32>(in.color, 1.0);
}`
        });
        // Optional: print shader messages
        try {
            const info = await shaderModule.getCompilationInfo();
            if (info.messages.length > 0) {
                console.group("Shader messages");
                info.messages.forEach(m => console.log(m.type, m.lineNum, m.message));
                console.groupEnd();
                hud.textContent = `Shader: ${info.messages[0].message}`;
            }
        }
        catch { }
        const pipeline = device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: shaderModule,
                entryPoint: "vs_main",
                buffers: [{ arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }] }]
            },
            fragment: { module: shaderModule, entryPoint: "fs_main", targets: [{ format }] },
            primitive: { topology: "triangle-list", cullMode: "back", frontFace: "ccw" },
            depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare: "always" }
        });
        // We'll use the pipeline's bind group layout for per-actor uniform bind groups
        const actorBindGroupLayout = pipeline.getBindGroupLayout(0);
        // -------------------------
        // Scene + Actors (create scene here)
        // -------------------------
        const scene = new Scene();
        // Create a cube actor and add to scene (CubeActor owns its own vertex/index buffers)
        const cube = new CubeActor(device, "Cube");
        cube.position = vec3.fromValues(0, 0, 0);
        scene.add(cube);
        // -------------------------
        // Gizmo Manager
        // -------------------------
        const gizmos = new GizmoManager(device);
        // Default: no gizmo until something is selected
        gizmos.setMode(GizmoMode.None);
        gizmos.space = GizmoSpace.Local;
        // -------------------------
        // Selection + UI Panels
        // -------------------------
        const selection = new SelectionManager();
        selection.onChange = (actor) => {
            gizmos.setSelected(actor);
        };
        const hierarchyPanel = new HierarchyPanel("leftPanel", scene, selection, () => detailsPanel.render());
        const detailsPanel = new DetailsPanel("rightPanel", selection);
        // Initial UI render
        hierarchyPanel.render();
        detailsPanel.render();
        const actorGPUMap = new Map();
        function registerActor(actor) {
            // uniform buffer holds model (offset 0) and viewProj (offset 64) => 128 bytes
            const ub = device.createBuffer({
                size: 64 * 2,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            const bg = device.createBindGroup({
                layout: actorBindGroupLayout,
                entries: [{ binding: 0, resource: { buffer: ub } }]
            });
            actorGPUMap.set(actor, { uniformBuffer: ub, bindGroup: bg, actor });
        }
        // register existing actors
        for (const a of scene.actors)
            registerActor(a);
        // If you later add actors at runtime, call registerActor(newActor)
        // -------------------------
        // Camera + input (Drag Look + Middle Pan)
        // -------------------------
        const keys = new Set();
        let isPointerDown = false;
        let activeButton = null;
        let lastX = 0;
        let lastY = 0;
        let yaw = 0;
        let pitch = 0;
        const lookSensitivity = 0.0035;
        const panBase = 0.002;
        const moveSpeed = 4.0;
        const verticalSpeed = 4.0;
        // init yaw/pitch from camera forward
        (function initYawPitch() {
            const f = vec3.create();
            vec3.subtract(f, camera.target, camera.position);
            vec3.normalize(f, f);
            yaw = Math.atan2(f[0], f[2]);
            pitch = Math.asin(f[1]);
        })();
        canvas.addEventListener("contextmenu", (e) => e.preventDefault());
        window.addEventListener("keydown", (e) => keys.add(e.code));
        window.addEventListener("keyup", (e) => keys.delete(e.code));
        window.addEventListener("keydown", (e) => {
            if (e.code === "Digit1")
                gizmos.setMode(GizmoMode.None);
            if (e.code === "Digit2")
                gizmos.setMode(GizmoMode.Move);
            if (e.code === "Digit3")
                gizmos.setMode(GizmoMode.Rotate);
            if (e.code === "Digit4")
                gizmos.setMode(GizmoMode.Scale);
            if (e.code === "Backquote")
                gizmos.toggleSpace();
        });
        // ------------------------------
        // Viewport selection (raycast)
        // ------------------------------
        canvas.addEventListener("mousedown", (e) => {
            if (e.button !== 0)
                return; // left click only
            clickStartTime = performance.now();
            clickIsValid = true;
            const rect = canvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left) / rect.width * pickingPass.size);
            const y = Math.floor((rect.height - (e.clientY - rect.top)) / rect.height * pickingPass.size);
            pickingPass.readPixel(x, y).then(id => {
                gizmos.handlePick(id);
            });
        });
        canvas.addEventListener("mouseup", (e) => {
            if (e.button !== 0)
                return;
            // If held too long → treat as camera drag, not a click
            const heldTime = (performance.now() - clickStartTime) / 1000;
            if (heldTime > CLICK_THRESHOLD) {
                clickIsValid = false;
            }
            if (!clickIsValid)
                return;
            // ------------------------------
            // Perform selection
            // ------------------------------
            const rect = canvas.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const y = ((e.clientY - rect.top) / rect.height) * -2 + 1;
            // Build ray
            const invViewProj = mat4.create();
            mat4.invert(invViewProj, camera.viewProj);
            const nearPoint = vec3.fromValues(x, y, 0);
            const farPoint = vec3.fromValues(x, y, 1);
            const worldNear = vec3.transformMat4(vec3.create(), nearPoint, invViewProj);
            const worldFar = vec3.transformMat4(vec3.create(), farPoint, invViewProj);
            const rayDir = vec3.subtract(vec3.create(), worldFar, worldNear);
            vec3.normalize(rayDir, rayDir);
            const hit = raycastActors(scene.actors, camera.position, rayDir);
            if (hit) {
                selection.select(hit);
            }
            else {
                selection.select(null);
            }
            hierarchyPanel.render();
            detailsPanel.render();
        });
        canvas.addEventListener("pointerdown", (e) => {
            if (e.button !== 0 && e.button !== 1)
                return;
            isPointerDown = true;
            activeButton = e.button;
            lastX = e.clientX;
            lastY = e.clientY;
            canvas.setPointerCapture(e.pointerId);
        });
        canvas.addEventListener("pointerup", (e) => {
            if (e.button !== 0 && e.button !== 1)
                return;
            isPointerDown = false;
            activeButton = null;
            try {
                canvas.releasePointerCapture(e.pointerId);
            }
            catch { }
        });
        canvas.addEventListener("pointermove", (e) => {
            if (!isPointerDown || activeButton === null)
                return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;
            if (activeButton === 0) {
                // LOOK: update yaw/pitch and set camera.target = position + forward
                yaw -= dx * lookSensitivity;
                pitch -= dy * lookSensitivity;
                const maxPitch = Math.PI / 2 - 0.001;
                pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));
                const forward = vec3.fromValues(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
                vec3.normalize(forward, forward);
                vec3.add(camera.target, camera.position, forward);
            }
            else if (activeButton === 1) {
                // PAN
                const panSpeed = panBase * vec3.distance(camera.position, camera.target);
                const right = camera.getRight ? camera.getRight() : (() => { const r = vec3.create(); vec3.cross(r, vec3.subtract(vec3.create(), camera.target, camera.position), camera.up); vec3.normalize(r, r); return r; })();
                const up = vec3.clone(camera.up);
                vec3.scale(right, right, -dx * panSpeed);
                vec3.scale(up, up, dy * panSpeed);
                const delta = vec3.create();
                vec3.add(delta, right, up);
                vec3.add(camera.position, camera.position, delta);
                vec3.add(camera.target, camera.target, delta);
            }
        });
        canvas.addEventListener("wheel", (e) => {
            e.preventDefault();
            const dir = vec3.create();
            vec3.subtract(dir, camera.target, camera.position);
            const len = vec3.length(dir);
            if (len <= 0.001)
                return;
            vec3.normalize(dir, dir);
            const delta = Math.sign(e.deltaY);
            const zoomSpeed = Math.max(0.05, len * 0.05);
            vec3.scaleAndAdd(camera.position, camera.position, dir, delta * zoomSpeed);
            // keep target at position + forward
            const forward = vec3.create();
            vec3.subtract(forward, camera.target, camera.position);
            vec3.normalize(forward, forward);
            vec3.add(camera.target, camera.position, forward);
        }, { passive: false });
        function applyMovement(dt) {
            const forward = vec3.create();
            vec3.subtract(forward, camera.target, camera.position);
            vec3.normalize(forward, forward);
            const right = (() => { const r = vec3.create(); vec3.cross(r, forward, camera.up); vec3.normalize(r, r); return r; })();
            const up = vec3.fromValues(0, 1, 0);
            const move = vec3.create();
            if (keys.has("KeyW"))
                vec3.scaleAndAdd(move, move, forward, moveSpeed * dt);
            if (keys.has("KeyS"))
                vec3.scaleAndAdd(move, move, forward, -moveSpeed * dt);
            if (keys.has("KeyA"))
                vec3.scaleAndAdd(move, move, right, -moveSpeed * dt);
            if (keys.has("KeyD"))
                vec3.scaleAndAdd(move, move, right, moveSpeed * dt);
            if (keys.has("KeyE"))
                vec3.scaleAndAdd(move, move, up, verticalSpeed * dt);
            if (keys.has("KeyQ"))
                vec3.scaleAndAdd(move, move, up, -verticalSpeed * dt);
            if (vec3.length(move) > 0.00001) {
                vec3.add(camera.position, camera.position, move);
                vec3.add(camera.target, camera.target, move);
            }
        }
        // -------------------------
        // Render loop
        // - For each actor:
        //    * ensure actor.modelMatrix is up to date (scene.update)
        //    * upload actor.modelMatrix and the shared viewProj into that actor's uniform buffer
        //    * set pipeline once, then set bindGroup per actor and draw
        // -------------------------
        {
            const rect = canvas.getBoundingClientRect();
            camera.updateViewProj(rect.width / rect.height);
        }
        let lastTime = performance.now();
        let fpsFrames = 0;
        let fpsTime = 0;
        function frame(now) {
            const dt = Math.max(0, (now - lastTime) / 1000);
            lastTime = now;
            resizeCanvas();
            applyMovement(dt);
            // update camera matrices
            const rect = canvas.getBoundingClientRect();
            camera.updateViewProj(rect.width / rect.height);
            // update actors (compute model matrices)
            scene.update(dt);
            // Update UI if needed (optional)
            hierarchyPanel.render();
            detailsPanel.render();
            const encoder = device.createCommandEncoder();
            // Only run picking if we actually have a gizmo and an actor
            if (gizmos.activeGizmo && gizmos.selectedActor) {
                pickingPass.render(encoder, gizmos.activeGizmo, gizmos.selectedActor, camera.viewProj, camera.position, gizmos.space);
            }
            // Main render pass follows...
            // Begin render
            //const encoder = device.createCommandEncoder();
            const current = context.getCurrentTexture();
            if (!current) {
                showError("No current texture from context.getCurrentTexture()");
                return;
            }
            const colorView = current.createView();
            if (!depthTexture) {
                showError("depthTexture missing at render time");
                return;
            }
            const depthView = depthTexture.createView();
            const pass = encoder.beginRenderPass({
                colorAttachments: [{ view: colorView, clearValue: { r: 0.08, g: 0.08, b: 0.08, a: 1.0 }, loadOp: "clear", storeOp: "store" }],
                depthStencilAttachment: { view: depthView, depthClearValue: 1.0, depthLoadOp: "clear", depthStoreOp: "store" }
            });
            // Set pipeline once per pass
            pass.setPipeline(pipeline);
            // For each actor: upload model + viewProj into that actor's uniform buffer, bind and draw
            for (const actor of scene.actors) {
                const gpu = actorGPUMap.get(actor);
                if (!gpu) {
                    // If actor was added at runtime, register it now
                    registerActor(actor);
                }
                const entry = actorGPUMap.get(actor);
                // Upload model matrix (offset 0) and viewProj (offset 64)
                device.queue.writeBuffer(entry.uniformBuffer, 0, actor.modelMatrix);
                device.queue.writeBuffer(entry.uniformBuffer, 64, camera.viewProj);
                // Bind actor's bind group and draw its mesh
                pass.setBindGroup(0, entry.bindGroup);
                // Actor draws its mesh (vertex/index buffers only)
                // CubeActor.draw(pass) will call setVertexBuffer/setIndexBuffer and drawIndexed
                actor.draw(pass);
            }
            // Draw gizmo AFTER actors
            gizmos.draw(pass, camera.viewProj, camera.position);
            pass.end();
            device.queue.submit([encoder.finish()]);
            // HUD FPS
            fpsFrames++;
            fpsTime += dt;
            if (fpsTime >= 0.25) {
                hud.textContent = `FPS: ${Math.round(fpsFrames / fpsTime)}`;
                fpsFrames = 0;
                fpsTime = 0;
            }
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }
    catch (err) {
        const msg = (err && err.message) ? err.message : String(err);
        showError(msg);
    }
}
main().catch(e => {
    console.error("Unhandled startup error:", e);
    const hud = document.querySelector("#hud");
    if (hud)
        hud.textContent = "Error: startup failed";
});
//# sourceMappingURL=main.js.map