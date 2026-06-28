struct Uniforms {
    mvp : mat4x4<f32>
};

@group(0) @binding(0)
var<uniform> uniforms : Uniforms;

struct VSOut {
    @builtin(position) pos : vec4<f32>,
    @location(0) color : vec3<f32>
};

@vertex
fn vs_main(
    @location(0) position : vec3<f32>,
    @location(1) color : vec3<f32>
) -> VSOut {
    var out : VSOut;
    out.pos = uniforms.mvp * vec4<f32>(position, 1.0);
    out.color = color;
    return out;
}

@fragment
fn fs_main(in : VSOut) -> @location(0) vec4<f32> {
    return vec4<f32>(in.color, 1.0);
}