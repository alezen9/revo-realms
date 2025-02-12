@group(0) @binding(0) var<storage, read_write> instancePositions : array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> visibilityBuffer : array<u32>;
@group(0) @binding(2) var<storage, read_write> drawCount : u32;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let index = id.x;
    if (index >= instancePositions.length()) { return; }

    let worldPos = instancePositions[index].xyz;
    let clipPos = cameraMatrix * vec4(worldPos, 1.0);

    let inFrustum = (
        clipPos.x > -clipPos.w && clipPos.x < clipPos.w &&
        clipPos.y > -clipPos.w && clipPos.y < clipPos.w &&
        clipPos.z > 0.0 && clipPos.z < clipPos.w
    );

    if (inFrustum) {
        let visibleIndex = atomicAdd(drawCount, 1);
        visibilityBuffer[visibleIndex] = index;
    }
}
