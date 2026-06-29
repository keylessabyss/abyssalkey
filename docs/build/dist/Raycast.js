// src/Raycast.ts
import { vec3, mat4 } from "./gl-matrix";
export function raycastActors(actors, cameraPos, rayDir) {
    let closest = null;
    let closestDist = Infinity;
    for (const actor of actors) {
        const bounds = actor.getBounds();
        // Transform ray into actor local space
        const invModel = mat4.create();
        mat4.invert(invModel, actor.modelMatrix);
        const localOrigin = vec3.transformMat4(vec3.create(), cameraPos, invModel);
        const localDir = vec3.transformMat4(vec3.create(), rayDir, invModel);
        vec3.normalize(localDir, localDir);
        // Ray vs AABB
        let tmin = -Infinity;
        let tmax = Infinity;
        for (let i = 0; i < 3; i++) {
            if (Math.abs(localDir[i]) < 1e-6) {
                if (localOrigin[i] < bounds.min[i] || localOrigin[i] > bounds.max[i]) {
                    tmin = Infinity;
                    break;
                }
            }
            else {
                const t1 = (bounds.min[i] - localOrigin[i]) / localDir[i];
                const t2 = (bounds.max[i] - localOrigin[i]) / localDir[i];
                tmin = Math.max(tmin, Math.min(t1, t2));
                tmax = Math.min(tmax, Math.max(t1, t2));
            }
        }
        if (tmax >= tmin && tmin < closestDist && tmin > 0) {
            closestDist = tmin;
            closest = actor;
        }
    }
    return closest;
}
//# sourceMappingURL=Raycast.js.map