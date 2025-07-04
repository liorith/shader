// GLSL Shader Code (Waves Fragment)
const wavesFragmentShaderSource = `
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

// Verbesserte Wellenfunktion mit mehreren Frequenzen
float wave(vec2 p, float freq, float speed) {
    float wave1 = sin(p.x * freq + iTime * speed);
    float wave2 = sin(p.y * freq * 0.5 + iTime * speed * 0.7);
    float wave3 = sin((p.x + p.y) * freq * 0.3 + iTime * speed * 0.5);
    return (wave1 + wave2 + wave3) / 3.0;
}

// Komplexe Wellenmuster mit mehreren Schichten (Qualität steuert Oktaven, Granularität die Basisfrequenz)
float complexWaves(vec2 p) {
    // Zentriere und skaliere die Koordinaten einmalig für die Wellenberechnung
    p = (p - 0.5) * 2.0; // Skaliert p von 0-1 auf -1 bis 1
    
    float waves = 0.0;
    float amplitude = 1.0;
    
    // Die Basisfrequenz wird nicht mehr direkt von uPixelFilter gesteuert, nur noch von Quality
    float baseFrequency = mix(5.0, 50.0, uQuality / 100.0); // Beispiel: von 5 bis 50
    float frequency = baseFrequency;
    
    // Anzahl der Oktaven wird durch uQuality gesteuert (Qualität)
    float numOctaves = mix(1.0, 8.0, uQuality / 100.0);
    numOctaves = floor(numOctaves);
    
    // Feste Anzahl von Iterationen
    const int ITERATIONS = 8;
    for(int i = 0; i < ITERATIONS; i++) {
        waves += amplitude * wave(p, frequency, uSpinSpeed * 0.2);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    
    return waves * 0.5 + 0.5; // Normalisiere auf 0-1
}

vec4 effect(vec2 screenSize, vec2 screen_coords) {
    // Pixelierung basierend auf uPixelFilter
    vec2 uv = floor(screen_coords.xy / iResolution.xy * uPixelFilter) / uPixelFilter;
    
    // Berechne Wellenmuster mit den pixeligen UVs
    float waveValue = complexWaves(uv);
    
    // Weichere Farbübergänge mit mehreren Schwellenwerten
    vec4 finalColor = mix(
        mix(uColour1, uColour2, smoothstep(0.2, 0.8, waveValue)),
        uColour3,
        smoothstep(0.4, 0.6, waveValue)
    );
    
    // Farbanpassungen
    finalColor.rgb *= uBrightness;
    finalColor.rgb = mix(vec3(dot(finalColor.rgb, vec3(0.2126, 0.7152, 0.0722))), finalColor.rgb, uSaturation);
    finalColor.rgb = mix(vec3(0.5), finalColor.rgb, uContrast);
    
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

// Funktion zur Initialisierung des Waves Shaders (ähnlich wie initRadialShader)
function initWavesShader(gl, vertexShader) {
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, wavesFragmentShaderSource);
  if (fragmentShader) {
    const { program, uniforms } = setupShaderProgram(gl, vertexShader, fragmentShader, 'waves');
    return { program, uniforms };
  }
  return { program: null, uniforms: null };
} 