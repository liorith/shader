// Farb-Presets
const colorPresets = {
  original: {
    COLOUR_1: [0.924, 0.232, 0.228, 1.0],
    COLOUR_2: [0.124, 0.185, 0.941, 1.0],
    COLOUR_3: [0.050, 0.050, 0.050, 1.0]
  },
  sunset: {
    COLOUR_1: [0.98, 0.412, 0.188, 1.0], 
    COLOUR_2: [0.819, 0.239, 0.553, 1.0], 
    COLOUR_3: [0.129, 0.075, 0.227, 1.0]
  },
  ocean: {
    COLOUR_1: [0.086, 0.407, 0.875, 1.0], 
    COLOUR_2: [0.027, 0.647, 0.647, 1.0], 
    COLOUR_3: [0.008, 0.184, 0.270, 1.0]
  },
  forest: {
    COLOUR_1: [0.154, 0.682, 0.376, 1.0], 
    COLOUR_2: [0.596, 0.843, 0.203, 1.0], 
    COLOUR_3: [0.047, 0.164, 0.047, 1.0]
  },
  lavender: {
    COLOUR_1: [0.584, 0.345, 0.698, 1.0],
    COLOUR_2: [0.431, 0.235, 0.541, 1.0],
    COLOUR_3: [0.247, 0.157, 0.329, 1.0]
  },
  golden: {
    COLOUR_1: [0.988, 0.729, 0.149, 1.0],
    COLOUR_2: [0.871, 0.494, 0.063, 1.0],
    COLOUR_3: [0.306, 0.161, 0.027, 1.0]
  },
  mint: {
    COLOUR_1: [0.39, 0.851, 0.663, 1.0],
    COLOUR_2: [0.223, 0.639, 0.557, 1.0],
    COLOUR_3: [0.051, 0.235, 0.22, 1.0]
  },
  neon: {
    COLOUR_1: [0.984, 0.141, 0.5, 1.0],
    COLOUR_2: [0.231, 0.992, 0.557, 1.0],
    COLOUR_3: [0.086, 0.145, 0.227, 1.0]
  },
  eye: {
    COLOUR_1: [0.999, 0.000, 0.000, 1.0],
    COLOUR_2: [0.000, 0.999, 0.000, 1.0],
    COLOUR_3: [0.000, 0.000, 0.999, 1.0]
  },
  sepia: {
    COLOUR_1: [0.360, 0.250, 0.200, 1.0],
    COLOUR_2: [0.620, 0.321, 0.111, 1.0],
    COLOUR_3: [0.120, 0.074, 0.062, 1.0]
  },
  monochrom: {
    COLOUR_1: [0.500, 0.500, 0.500, 1.0],
    COLOUR_2: [0.800, 0.800, 0.800, 1.0],
    COLOUR_3: [0.050, 0.050, 0.050, 1.0]
  }
};

// Hilfsfunktion zum Konvertieren von Hex zu RGB (0-1 Range)
function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r / 255.0, g / 255.0, b / 255.0, 1.0];
}

// Hilfsfunktion zum Konvertieren von RGB zu Hex
function rgbToHex(rgb) {
  const toHex = (c) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
}

// Farb-Animation für sanfte Übergänge
function animateColorChange(targetColors) {
  const startColors = {
    COLOUR_1: [...shaderParams.COLOUR_1],
    COLOUR_2: [...shaderParams.COLOUR_2],
    COLOUR_3: [...shaderParams.COLOUR_3]
  };
  
  const duration = 1000; // 1 Sekunde für die Animation
  const startTime = performance.now();
  
  function updateColors(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Easing-Funktion für einen glatteren Übergang
    const easedProgress = progress < 0.5 
      ? 4 * progress * progress * progress 
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    
    // Interpolation für alle Farbkanäle
    for (let i = 0; i < 4; i++) {
      shaderParams.COLOUR_1[i] = startColors.COLOUR_1[i] + (targetColors.COLOUR_1[i] - startColors.COLOUR_1[i]) * easedProgress;
      shaderParams.COLOUR_2[i] = startColors.COLOUR_2[i] + (targetColors.COLOUR_2[i] - startColors.COLOUR_2[i]) * easedProgress;
      shaderParams.COLOUR_3[i] = startColors.COLOUR_3[i] + (targetColors.COLOUR_3[i] - startColors.COLOUR_3[i]) * easedProgress;
    }
    
    if (progress < 1) {
      requestAnimationFrame(updateColors);
    }
  }
  
  requestAnimationFrame(updateColors);
} 