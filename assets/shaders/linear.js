// GLSL Shader Code (Linear Fragment)
const linearFragmentShaderSource = `
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

#define PI 3.14159265359
#define RED1 1.0    // Full vibrant red
#define RED2 0.7    // Slightly subdued red
#define RED3 0.4    // Deeper, richer red
#define SINE1 1.0   // Standard sine modulation
#define SINE2 1.2   // Slightly faster modulation
#define SINE3 0.5   // Softer sine effect
#define MOD1 0.1    // Base modulation
#define MOD2 0.3    // Enhanced variation
#define MOD3 0.9    // Reduced modulation

vec4 effect(vec2 screenSize, vec2 screen_coords) {
    // Standard uv computation, no pixelation.
    vec2 uv = (screen_coords - 0.5 * screenSize) / length(screenSize);
    float uv_len = length(uv);
    
    // Use the day (0 to 6) to choose a noise variant.
    float day = mod(iTime * 0.1, 7.0);
    
    if(day < 1.0) {
        // Day 0: Original-style swirl distortion.
        float speed = mod(iTime * 0.4, PI * 2.0);
        float new_pixel_angle = atan(uv.y, uv.x) + speed - 20.0 * (0.25 * uv_len + 0.75);
        vec2 mid = (screenSize / length(screenSize)) / 2.0;
        uv = (vec2(uv_len * cos(new_pixel_angle) + mid.x, uv_len * sin(new_pixel_angle) + mid.y) - mid);
    }
    else if(day < 2.0) {
        // Day 1: Turbulent swirl with added high-frequency sine distortions.
        float angle = iTime + uv_len * 5.0;
        uv = vec2(uv.x * cos(angle) - uv.y * sin(angle),
                  uv.x * sin(angle) + uv.y * cos(angle));
        uv += 0.1 * vec2(sin(uv.y * 15.0 + iTime),
                         cos(uv.x * 15.0 + iTime));
    }
    else if(day < 3.0) {
        // Day 2: Wavy noise along both axes.
        uv += 0.05 * vec2(sin(uv.y * 20.0 + iTime),
                          cos(uv.x * 20.0 + iTime));
    }
    else if(day < 4.0) {
        // Day 3: Iterative fractal-like distortion.
        vec2 originalUV = uv;
        for (int i = 0; i < 7; i++) {
            uv += 0.1 * vec2(sin(uv.y * 10.0 + iTime * 0.5 + float(i)),
                             cos(uv.x * 10.0 + iTime * 0.5 + float(i)));
            uv *= 1.1;
        }
        uv = mix(uv, originalUV, 0.5);
    }
    else if(day < 5.0) {
        // Day 4: Radial jitter based on the pixel's angle.
        float jitter = 0.2 * sin(uv_len * 20.0 - iTime);
        float a = atan(uv.y, uv.x);
        uv += jitter * vec2(cos(a), sin(a));
    }
    else if(day < 6.0) {
        // Day 5: Grid-like noise using dot products.
        float n = sin(dot(uv, vec2(12.9898,78.233)) + iTime * 3.0);
        uv += 0.03 * vec2(n, cos(dot(uv, vec2(12.9898,78.233)) + iTime * 3.0));
    }
    else {
        // Day 6: Cellular-style distortion by fracturing the uv space.
        uv = fract(uv * 2.0 * (sin(iTime * 0.7 + 0.2) + 2.0) + (iTime * 0.25)) - 0.5;
        uv *= 1.5;
    }
    
    // Compute noise loop
    vec2 uv_loop = uv * 30.0;
    float speed = iTime * 7.0;
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

// Funktion zur Initialisierung des linearen Shaders
function initLinearShader(gl, vertexShader) {
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, linearFragmentShaderSource);
    if (fragmentShader) {
        const program = createProgram(gl, vertexShader, fragmentShader);
        if (program) {
            const uniforms = {
                iResolution: gl.getUniformLocation(program, "iResolution"),
                iTime: gl.getUniformLocation(program, "iTime"),
                uSpinSpeed: gl.getUniformLocation(program, "uSpinSpeed"),
                uPixelFilter: gl.getUniformLocation(program, "uPixelFilter"),
                uColour1: gl.getUniformLocation(program, "uColour1"),
                uColour2: gl.getUniformLocation(program, "uColour2"),
                uColour3: gl.getUniformLocation(program, "uColour3"),
                uQuality: gl.getUniformLocation(program, "uQuality"),
                uContrast: gl.getUniformLocation(program, "uContrast"),
                uInvertColors: gl.getUniformLocation(program, "uInvertColors"),
                uBrightness: gl.getUniformLocation(program, "uBrightness"),
                uSaturation: gl.getUniformLocation(program, "uSaturation")
            };
            return { program, uniforms };
        }
    }
    return { program: null, uniforms: null };
} 