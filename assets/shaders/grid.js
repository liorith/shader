// GLSL Shader Code (Grid Fragment)
const gridFragmentShaderSource = `
precision mediump float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uSpinSpeed;
uniform float uPixelFilter;
uniform vec4 uColour1;
uniform vec4 uColour2;
uniform vec4 uColour3;
uniform float uQuality;
uniform float uContrast;
uniform float uInvertColors;
uniform float uBrightness;
uniform float uSaturation;

vec4 effect(vec2 screenSize, vec2 screen_coords) {
    // Standard uv computation
    float pixel_size = length(screenSize.xy) / uPixelFilter;
    vec2 uv = (floor(screen_coords.xy*(1./pixel_size))*pixel_size - 0.5*screenSize.xy)/length(screenSize.xy);
    float uv_len = length(uv);
    
    // Grid-like noise using dot products
    float n = sin(dot(uv, vec2(12.9898,78.233)) + iTime * uSpinSpeed * 0.3);
    uv += 0.03 * vec2(n, cos(dot(uv, vec2(12.9898,78.233)) + iTime * uSpinSpeed * 0.3));
    
    // Compute noise loop
    vec2 uv_loop = uv * 30.0;
    float speed = iTime * uSpinSpeed * 2.0;
    vec2 uv2 = vec2(uv_loop.x + uv_loop.y);
    for (int i = 0; i < 5; i++) {
        uv2 += sin(max(uv_loop.x, uv_loop.y)) + uv_loop;
        uv_loop += 0.5 * vec2(
            cos(5.1123314 + 0.353 * uv2.y + speed * 0.131121),
            sin(uv2.x - 0.113 * speed)
        );
        uv_loop -= cos(uv_loop.x + uv_loop.y) - sin(uv_loop.x * 0.711 - uv_loop.y);
    }

    // Precomputed constants
    float paint_res = min(2.0, max(0.0, length(uv_loop) * 0.077));
    float c1p = max(0.0, 1.0 - 2.2 * abs(1.0 - paint_res));
    float c2p = max(0.0, 1.0 - 2.2 * abs(paint_res));
    float c3p = 1.0 - min(1.0, c1p + c2p);
    float light = 0.2 * max(c1p * 5.0 - 4.0, 0.0) + 0.4 * max(c2p * 5.0 - 4.0, 0.0);

    // Blend colors with computed modulation and light
    vec4 finalColor = (0.3 / 3.5) * uColour1
        + (1.0 - 0.3 / 3.5) * (uColour1 * c1p + uColour2 * c2p + vec4(c3p * uColour3.rgb, c3p * uColour1.a))
        + light;

    // Apply brightness and saturation
    finalColor.rgb *= uBrightness;
    finalColor.rgb = mix(vec3(dot(finalColor.rgb, vec3(0.2126, 0.7152, 0.0722))), finalColor.rgb, uSaturation);

    // Apply contrast
    finalColor.rgb = mix(vec3(0.5), finalColor.rgb, uContrast);

    // Invert colors if enabled
    if (uInvertColors > 0.5) {
        finalColor.rgb = 1.0 - finalColor.rgb;
    }

    return finalColor;
}

void main() {
    vec2 uv = gl_FragCoord.xy;
    gl_FragColor = effect(iResolution.xy, uv);
}
`;

// Funktion zur Initialisierung des Grid Shaders
function initGridShader(gl, vertexShader) {
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, gridFragmentShaderSource);
    if (fragmentShader) {
        const { program, uniforms } = setupShaderProgram(gl, vertexShader, fragmentShader, 'grid');
        return { program, uniforms };
    }
    return { program: null, uniforms: null };
} 