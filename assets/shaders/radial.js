// GLSL Shader Code (Radial Fragment)
const radialFragmentShaderSource = `
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

#define SPIN_ROTATION -2.0
#define OFFSET vec2(0.0)
#define LIGTHING 0.4
#define SPIN_AMOUNT 0.25
#define SPIN_EASE 1.0
#define IS_ROTATE false

vec4 effect(vec2 screenSize, vec2 screen_coords) {
    float pixel_size = length(screenSize.xy) / uPixelFilter;
    vec2 uv = (floor(screen_coords.xy*(1./pixel_size))*pixel_size - 0.5*screenSize.xy)/length(screenSize.xy) - OFFSET;
    float uv_len = length(uv);

    float speed = (SPIN_ROTATION*SPIN_EASE*0.2);
    if(IS_ROTATE){
       speed = iTime * speed;
    }
    speed += 302.2;
    float new_pixel_angle = atan(uv.y, uv.x) + speed - SPIN_EASE*20.*(1.*SPIN_AMOUNT*uv_len + (1. - 1.*SPIN_AMOUNT));
    vec2 mid = (screenSize.xy/length(screenSize.xy))/2.;
    uv = (vec2((uv_len * cos(new_pixel_angle) + mid.x), (uv_len * sin(new_pixel_angle) + mid.y)) - mid);

    uv *= 30.;
    speed = iTime*(uSpinSpeed);
    vec2 uv2 = vec2(uv.x+uv.y);

    // Skaliere Effekte basierend auf Qualität innerhalb fester Iterationen
    float qualityFactor = uQuality / 100.0; // Normiert uQuality von 1-100 auf 0.01-1.0
    qualityFactor = max(0.01, qualityFactor); // Mindestens 1% Qualität

    // Feste Anzahl von Schleifendurchgängen
    for(int i=0; i < 4; i++) {
        uv2 += qualityFactor * (sin(max(uv.x, uv.y)) + uv);
        uv  += qualityFactor * 0.5*vec2(cos(5.11 + 0.35*uv2.y + speed*0.13),sin(uv2.x - 0.11*speed));
        uv  -= qualityFactor * (cos(uv.x + uv.y) - sin(uv.x*0.71 - uv.y));
    }

    float contrast_mod = (0.25*3.5 + 0.5*SPIN_AMOUNT + 1.2) * uContrast;
    float paint_res = min(2.0, max(0.0, length(uv)*0.035*contrast_mod));
    float c1p = max(0.0, 1.0 - contrast_mod*abs(1.0-paint_res));
    float c2p = max(0.0, 1.0 - contrast_mod*abs(paint_res));
    float c3p = 1.0 - min(1.0, c1p + c2p);
    float light = (LIGTHING - 0.2)*max(c1p*5.0 - 4.0, 0.0) + LIGTHING*max(c2p*5.0 - 4.0, 0.0);
    return (0.3/3.5)*uColour1 + (1.0 - 0.3/3.5)*(uColour1*c1p + uColour2*c2p + vec4(c3p*uColour3.rgb, c3p*uColour1.a)) + light;
}

void main() {
    vec2 uv = gl_FragCoord.xy / iResolution.xy;
    gl_FragColor = effect(iResolution.xy, uv * iResolution.xy);
}
`;

// Shader Setup Helper Functions
function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(`Shader compilation error (${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'}): ${gl.getShaderInfoLog(shader)}`);
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl, vShader, fShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vShader);
  gl.attachShader(program, fShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(`Shader program linking error: ${gl.getProgramInfoLog(program)}`);
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

// Funktion zur Initialisierung eines Shader-Programms und Speichern der Uniforms
function setupShaderProgram(gl, vertexShader, fragmentShader, type) {
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
    };
    return { program, uniforms };
  }
  return { program: null, uniforms: null };
}

// Funktion zur Initialisierung des radialen Shaders
function initRadialShader(gl, vertexShader) {
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, radialFragmentShaderSource);
  if (fragmentShader) {
    const { program, uniforms } = setupShaderProgram(gl, vertexShader, fragmentShader, 'radial');
    return { program, uniforms };
  }
  return { program: null, uniforms: null };
} 