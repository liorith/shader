// Canvas und WebGL-Kontext
const canvas = document.getElementById("shader-canvas");
const gl = canvas.getContext("webgl", { powerPreference: "high-performance" });

// Shader-Parameter
const shaderParams = {
  SPIN_SPEED: 5.0,
  PIXEL_FILTER: 5000.0,
  COLOUR_1: [0.924, 0.232, 0.228, 1.0],
  COLOUR_2: [0.124, 0.185, 0.941, 1.0],
  COLOUR_3: [0.050, 0.050, 0.050, 1.0],
  QUALITY: 100,
  CONTRAST: 1.0
};

// Standardwerte für Einstellungen
const defaultSettings = {
  SPIN_SPEED: 5.0,
  PIXEL_FILTER: 5000.0,
  QUALITY: 100,
  CONTRAST: 1.0
};

// Performance-Einstellungen
let performanceMode = {
  active: true,
  lowFPS: false,
  frameSkip: 0,
  frameCount: 0,
  isPageVisible: true,
  backgroundMode: {
    fps: 15,
    pixelFilter: 2000,
    spinSpeed: 1.0,
    quality: 50
  },
  shaderPaused: false,
  targetFPS: 60
};

// UI Elemente
const menuButton = document.getElementById("menuButton");
const controlPanel = document.getElementById("controlPanel");
const speedSlider = document.getElementById("speedSlider");
const speedInput = document.getElementById("speedInput");
const pixelSlider = document.getElementById("pixelSlider");
const pixelInput = document.getElementById("pixelInput");
const fpsSlider = document.getElementById("fpsSlider");
const fpsInput = document.getElementById("fpsInput");
const qualitySlider = document.getElementById("qualitySlider");
const qualityInput = document.getElementById("qualityInput");
const contrastSlider = document.getElementById("contrastSlider");
const contrastInput = document.getElementById("contrastInput");
const speedValue = document.getElementById("speedValue");
const pixelValue = document.getElementById("pixelValue");
const fpsValue = document.getElementById("fpsValue");
const qualityValue = document.getElementById("qualityValue");
const contrastValue = document.getElementById("contrastValue");
const presetButtons = document.querySelectorAll(".preset-button");
const performanceToggle = document.getElementById("performanceToggle");
const customColor1Input = document.getElementById("customColor1");
const customColor2Input = document.getElementById("customColor2");
const customColor3Input = document.getElementById("customColor3");
const customPresetButton = document.querySelector(".preset-button[data-preset='custom']");
const shaderTypeButtons = document.querySelectorAll(".type-button");
const elementsWithTooltips = document.querySelectorAll("[data-tooltip]");
const resetSettingsButton = document.getElementById("resetSettingsButton");
const pauseToggle = document.getElementById("pauseToggle");

// Neue UI Elemente für Panels und Panel Buttons
const panelButtons = document.querySelectorAll(".panel-button");
const controlPanels = document.querySelectorAll(".control-panel");

// UI Event Listeners
menuButton.addEventListener("click", () => {
  // menuButton.classList.toggle("open"); // Hauptmenü-Button steuert jetzt die Panel-Buttons
  // controlPanel.classList.toggle("open"); // controlPanel wird nicht mehr direkt verwendet

  // Blendet alle Panels und Panel-Buttons ein/aus
  const isMenuOpen = menuButton.classList.toggle("open");
  panelButtons.forEach(button => button.style.display = isMenuOpen ? "flex" : "none");

  // Schließt Panels wenn Hauptmenü geschlossen wird
  if (!isMenuOpen) {
    controlPanels.forEach(panel => panel.classList.remove("active"));
    panelButtons.forEach(button => button.classList.remove("active"));
  }
});

// Event Listener für Panel Buttons
panelButtons.forEach(button => {
  button.addEventListener("click", () => {
    const targetPanelId = button.dataset.panel + "Panel";
    const targetPanel = document.getElementById(targetPanelId);

    // Panels ein-/ausblenden und aktive Klasse setzen
    controlPanels.forEach(panel => {
      if (panel.id === targetPanelId) {
        panel.classList.toggle("active");
      } else {
        panel.classList.remove("active");
      }
    });

    // Aktiven Zustand für Buttons setzen
    panelButtons.forEach(btn => {
      if (btn === button) {
        btn.classList.toggle("active");
      } else {
        btn.classList.remove("active");
      }
    });

     // Wenn alle Panels geschlossen sind, Hauptmenü-Button Zustand anpassen (optional)
     const anyPanelActive = Array.from(controlPanels).some(panel => panel.classList.contains("active"));
     if (!anyPanelActive) {
        // Optional: Hauptmenü-Button als inaktiv markieren oder ähnliches
     }
  });
});

// Initial: Alle Panels und Panel Buttons ausblenden
controlPanels.forEach(panel => panel.classList.remove("active"));
panelButtons.forEach(button => button.style.display = "none");

// Geschwindigkeit-Slider und Input
function updateSpeed(value) {
  const speed = parseFloat(value);
  shaderParams.SPIN_SPEED = speed;
  speedValue.textContent = Math.round(speed * 10) / 10;
  speedSlider.value = speed;
  speedInput.value = speed.toFixed(1);
}

speedSlider.addEventListener("input", () => {
  updateSpeed(speedSlider.value);
});

speedInput.addEventListener("input", () => {
  const value = Math.min(Math.max(parseFloat(speedInput.value) || 0, 0), 15);
  updateSpeed(value);
});

// Geschwindigkeit-Input Scroll-Listener
speedInput.addEventListener("wheel", (event) => {
  event.preventDefault();
  const step = parseFloat(speedInput.step);
  const currentValue = parseFloat(speedInput.value);
  const newValue = event.deltaY < 0 ? currentValue + step : currentValue - step;
  const clampedValue = Math.min(Math.max(newValue, parseFloat(speedInput.min)), parseFloat(speedInput.max));
  updateSpeed(clampedValue);
}, { passive: true });

// Pixel-Slider und Input
function updatePixel(value) {
  const pixelValue = parseFloat(value);
  shaderParams.PIXEL_FILTER = pixelValue;
  const displayValue = pixelValue >= 1000 ? 
    (pixelValue / 1000).toFixed(1).replace('.0', '') + 'k' : 
    Math.round(pixelValue);
  document.getElementById("pixelValue").textContent = displayValue;
  pixelSlider.value = pixelValue;
  pixelInput.value = pixelValue;
}

pixelSlider.addEventListener("input", () => {
  updatePixel(pixelSlider.value);
});

pixelInput.addEventListener("input", () => {
  const value = Math.min(Math.max(parseFloat(pixelInput.value) || 50, 50), 5000);
  updatePixel(value);
});

// Pixel-Input Scroll-Listener
pixelInput.addEventListener("wheel", (event) => {
  event.preventDefault();
  const step = parseFloat(pixelInput.step);
  const currentValue = parseFloat(pixelInput.value);
  const newValue = event.deltaY < 0 ? currentValue + step : currentValue - step;
  const clampedValue = Math.min(Math.max(newValue, parseFloat(pixelInput.min)), parseFloat(pixelInput.max));
  updatePixel(clampedValue);
}, { passive: true });

// FPS-Slider und Input
function updateFPS(value) {
  const fps = parseInt(value);
  performanceMode.targetFPS = fps;
  fpsValue.textContent = fps;
  fpsSlider.value = fps;
  fpsInput.value = fps;
}

fpsSlider.addEventListener("input", () => {
  updateFPS(fpsSlider.value);
});

fpsInput.addEventListener("input", () => {
  const value = Math.min(Math.max(parseInt(fpsInput.value) || 0, 0), 120);
  updateFPS(value);
});

// FPS-Input Scroll-Listener
fpsInput.addEventListener("wheel", (event) => {
  event.preventDefault();
  const step = parseInt(fpsInput.step);
  const currentValue = parseInt(fpsInput.value);
  const newValue = event.deltaY < 0 ? currentValue + step : currentValue - step;
  const clampedValue = Math.min(Math.max(newValue, parseInt(fpsInput.min)), parseInt(fpsInput.max));
  updateFPS(clampedValue);
}, { passive: true });

// Qualität-Slider und Input
function updateQuality(value) {
  const quality = parseInt(value);
  shaderParams.QUALITY = quality;
  qualityValue.textContent = quality;
  qualitySlider.value = quality;
  qualityInput.value = quality;
}

qualitySlider.addEventListener("input", () => {
  updateQuality(qualitySlider.value);
});

qualityInput.addEventListener("input", () => {
  const value = Math.min(Math.max(parseInt(qualityInput.value) || 1, 1), 100);
  updateQuality(value);
});

// Qualität-Input Scroll-Listener
qualityInput.addEventListener("wheel", (event) => {
  event.preventDefault();
  const step = parseInt(qualityInput.step);
  const currentValue = parseInt(qualityInput.value);
  const newValue = event.deltaY < 0 ? currentValue + step : currentValue - step;
  const clampedValue = Math.min(Math.max(newValue, parseInt(qualityInput.min)), parseInt(qualityInput.max));
  updateQuality(clampedValue);
}, { passive: true });

// Kontrast-Slider und Input
function updateContrast(value) {
  const contrast = parseFloat(value);
  shaderParams.CONTRAST = contrast;
  contrastValue.textContent = Math.round(contrast * 10) / 10;
  contrastSlider.value = contrast;
  contrastInput.value = contrast.toFixed(1);
}

contrastSlider.addEventListener("input", () => {
  updateContrast(contrastSlider.value);
});

contrastInput.addEventListener("input", () => {
  const value = Math.min(Math.max(parseFloat(contrastInput.value) || 0.5, 0.5), 2.0);
  updateContrast(value);
});

// Kontrast-Input Scroll-Listener
contrastInput.addEventListener("wheel", (event) => {
  event.preventDefault();
  const step = parseFloat(contrastInput.step);
  const currentValue = parseFloat(contrastInput.value);
  const newValue = event.deltaY < 0 ? currentValue + step : currentValue - step;
  const clampedValue = Math.min(Math.max(newValue, parseFloat(contrastInput.min)), parseFloat(contrastInput.max));
  updateContrast(clampedValue);
}, { passive: true });

// Performance-Modus
performanceToggle.addEventListener("change", () => {
  performanceMode.active = performanceToggle.checked;
  // Deaktiviere/Aktiviere den Pause-Umschalter basierend auf dem Aktiv-Umschalter
  pauseToggle.disabled = !performanceMode.active;
  if (!performanceMode.active) {
    // Wenn der Shader deaktiviert wird, sorge dafür, dass er nicht pausiert ist und stoppe das Rendering
    performanceMode.shaderPaused = false;
    pauseToggle.checked = false; // Setze den Pause-Umschalter zurück
    // Hier wird das Rendering bereits durch die render-Funktion gestoppt, wenn !performanceMode.active

    // Speichere aktuelle Einstellungen
    performanceMode.backgroundMode.originalPixelFilter = shaderParams.PIXEL_FILTER;
    performanceMode.backgroundMode.originalSpinSpeed = shaderParams.SPIN_SPEED;
    performanceMode.backgroundMode.originalQuality = shaderParams.QUALITY;
    
    // Setze minimale Werte
    shaderParams.PIXEL_FILTER = 100;
    shaderParams.SPIN_SPEED = 0;
    shaderParams.QUALITY = 1;
    
    // Aktualisiere UI
    pixelSlider.value = shaderParams.PIXEL_FILTER;
    speedSlider.value = shaderParams.SPIN_SPEED;
    qualitySlider.value = shaderParams.QUALITY;
    pixelValue.textContent = shaderParams.PIXEL_FILTER;
    speedValue.textContent = "0.0";
    qualityValue.textContent = shaderParams.QUALITY;
    
    // Zeige eine statische Farbe an
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  } else {
    // Stelle ursprüngliche Einstellungen wieder her, wenn der Shader aktiviert wird
    if (performanceMode.backgroundMode.originalPixelFilter) {
      shaderParams.PIXEL_FILTER = performanceMode.backgroundMode.originalPixelFilter;
      shaderParams.SPIN_SPEED = performanceMode.backgroundMode.originalSpinSpeed;
      shaderParams.QUALITY = performanceMode.backgroundMode.originalQuality;
      
      // Aktualisiere UI
      pixelSlider.value = shaderParams.PIXEL_FILTER;
      speedSlider.value = shaderParams.SPIN_SPEED;
      qualitySlider.value = shaderParams.QUALITY;
      pixelValue.textContent = (shaderParams.PIXEL_FILTER / 1000).toFixed(1).replace('.0', '') + 'k';
      speedValue.textContent = shaderParams.SPIN_SPEED.toFixed(1);
      qualityValue.textContent = shaderParams.QUALITY;
    }
  }
});

// Hintergrund-Performance-Optimierung
document.addEventListener('visibilitychange', () => {
  performanceMode.isPageVisible = !document.hidden;
  
  if (!performanceMode.isPageVisible) {
    // Speichere aktuelle Einstellungen
    performanceMode.backgroundMode.originalPixelFilter = shaderParams.PIXEL_FILTER;
    performanceMode.backgroundMode.originalSpinSpeed = shaderParams.SPIN_SPEED;
    performanceMode.backgroundMode.originalQuality = shaderParams.QUALITY;
    
    // Reduziere Qualität im Hintergrund
    shaderParams.PIXEL_FILTER = performanceMode.backgroundMode.pixelFilter;
    shaderParams.SPIN_SPEED = performanceMode.backgroundMode.spinSpeed;
    shaderParams.QUALITY = performanceMode.backgroundMode.quality;
    
    // Aktualisiere UI
    pixelSlider.value = shaderParams.PIXEL_FILTER;
    speedSlider.value = shaderParams.SPIN_SPEED;
    qualitySlider.value = shaderParams.QUALITY;
    pixelValue.textContent = (shaderParams.PIXEL_FILTER / 1000).toFixed(1).replace('.0', '') + 'k';
    speedValue.textContent = shaderParams.SPIN_SPEED.toFixed(1);
    qualityValue.textContent = shaderParams.QUALITY;
  } else {
    // Stelle ursprüngliche Einstellungen wieder her
    if (performanceMode.backgroundMode.originalPixelFilter) {
      shaderParams.PIXEL_FILTER = performanceMode.backgroundMode.originalPixelFilter;
      shaderParams.SPIN_SPEED = performanceMode.backgroundMode.originalSpinSpeed;
      shaderParams.QUALITY = performanceMode.backgroundMode.originalQuality;
      
      // Aktualisiere UI
      pixelSlider.value = shaderParams.PIXEL_FILTER;
      speedSlider.value = shaderParams.SPIN_SPEED;
      qualitySlider.value = shaderParams.QUALITY;
      pixelValue.textContent = (shaderParams.PIXEL_FILTER / 1000).toFixed(1).replace('.0', '') + 'k';
      speedValue.textContent = shaderParams.SPIN_SPEED.toFixed(1);
      qualityValue.textContent = shaderParams.QUALITY;
    }
  }
});

// Farbpresets mit aktiver Markierung und Aktualisierung der Farbwähler
presetButtons.forEach(button => {
  button.addEventListener("click", () => {
    const preset = button.dataset.preset;
    if (colorPresets[preset]) {
      animateColorChange(colorPresets[preset]);
      
      presetButtons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");

      updateCustomColorPickers(colorPresets[preset]);
    } else if (preset === 'custom') {
      presetButtons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      shaderParams.COLOUR_1 = hexToRgb(customColor1Input.value);
      shaderParams.COLOUR_2 = hexToRgb(customColor2Input.value);
      shaderParams.COLOUR_3 = hexToRgb(customColor3Input.value);
      animateColorChange({
        COLOUR_1: shaderParams.COLOUR_1,
        COLOUR_2: shaderParams.COLOUR_2,
        COLOUR_3: shaderParams.COLOUR_3
      });
    }
  });
});

// Hilfsfunktion zum Konvertieren von Hex zu RGB (0-1 Range)
function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r / 255.0, g / 255.0, b / 255.0, 1.0];
}

// Hilfsfunktion zum Aktualisieren der benutzerdefinierten Farbwähler
function updateCustomColorPickers(colors) {
    // Konvertiere RGB (0-1) zu Hex
    function rgbToHex(rgb) {
        const toHex = (c) => {
            const hex = Math.round(c * 255).toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        };
        return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
    }

    customColor1Input.value = rgbToHex(colors.COLOUR_1);
    customColor2Input.value = rgbToHex(colors.COLOUR_2);
    customColor3Input.value = rgbToHex(colors.COLOUR_3);
}

// Event Listener für benutzerdefinierte Farbwähler
function handleCustomColorInput() {
  presetButtons.forEach(btn => btn.classList.remove("active"));
  customPresetButton.classList.add("active");

  shaderParams.COLOUR_1 = hexToRgb(customColor1Input.value);
  shaderParams.COLOUR_2 = hexToRgb(customColor2Input.value);
  shaderParams.COLOUR_3 = hexToRgb(customColor3Input.value);

  animateColorChange({
    COLOUR_1: shaderParams.COLOUR_1,
    COLOUR_2: shaderParams.COLOUR_2,
    COLOUR_3: shaderParams.COLOUR_3
  });
}

customColor1Input.addEventListener("input", handleCustomColorInput);
customColor2Input.addEventListener("input", handleCustomColorInput);
customColor3Input.addEventListener("input", handleCustomColorInput);

// Initialisiere Farbwähler und aktiviere das Original Preset beim Start
updateCustomColorPickers(colorPresets.original);
presetButtons.forEach(btn => btn.classList.remove("active"));
document.querySelector(".preset-button[data-preset='original']").classList.add("active");

// Farb-Animation für sanfte Übergänge
function animateColorChange(targetColors) {
  const startColors = {
    COLOUR_1: [...shaderParams.COLOUR_1],
    COLOUR_2: [...shaderParams.COLOUR_2],
    COLOUR_3: [...shaderParams.COLOUR_3]
  };
  
  const duration = 1000;
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

// Canvas Größenanpassung
function resizeCanvas() {
  const { innerWidth, innerHeight } = window;
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
}

resizeCanvas();
const debouncedResize = debounce(resizeCanvas, 250);
window.addEventListener("resize", debouncedResize);

// Debounce-Funktion für bessere Performance
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// GLSL Shader Code (Vertex - bleibt gleich)
const vertexShaderSource = `
attribute vec4 position;
void main() {
  gl_Position = position;
}
`;

// Erstelle den Vertex-Shader
const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);

// Initialisiere den radialen Shader
const { program: radialProgram, uniforms: radialUniforms } = initRadialShader(gl, vertexShader);

// Aktuell aktives Shader-Programm und Uniforms (Nur Radial verfügbar)
let currentProgram = radialProgram;
let currentUniforms = radialUniforms;

// Setze den aktiven Button basierend auf dem initialen Programm
if (currentProgram === radialProgram && radialProgram) {
     const radialButton = document.querySelector(".type-button[data-type='radial']");
     if(radialButton) radialButton.classList.add("active");
     const linearButton = document.querySelector(".type-button[data-type='linear']");
     if(linearButton) linearButton.classList.remove("active");
} else {
    shaderTypeButtons.forEach(btn => btn.classList.remove("active"));
}

// Position Buffer (Vollbild) - bleibt gleich, da beide Shader das gleiche Vertex-Shader verwenden
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  -1, -1,
   1, -1,
  -1,  1,
  -1,  1,
   1, -1,
   1,  1
]), gl.STATIC_DRAW);

const positionLocation = gl.getAttribLocation(radialProgram, "position"); // Position Location nur vom Radial Programm holen
gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

// Event Listener für Shader-Typ Auswahl (Nur Radial ist aktiv)
shaderTypeButtons.forEach(button => {
  button.addEventListener("click", () => {
    const type = button.dataset.type;
    if (type === 'radial' && radialProgram) {
      currentProgram = radialProgram;
      currentUniforms = radialUniforms;
       // Aktiven Button markieren
      shaderTypeButtons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
    } // Linearer Button hat keinen aktiven Event-Handler mehr
  });
});

// FPS-Steuerung für den Stromsparmodus
let lastFrameTime = 0;
const targetFPSLowPower = 30; // Niedrigere FPS im Stromsparmodus

// Event Listener für Shader Pause Toggle
pauseToggle.addEventListener("change", () => {
  performanceMode.shaderPaused = pauseToggle.checked;
  // Die render-Funktion wird die Animation basierend auf performanceMode.shaderPaused steuern
});

// === Render Loop ===
function render(currentTime) {
  performanceMode.frameCount++;

  // Wenn der Shader nicht aktiv oder pausiert ist oder kein Programm aktiv, nur UI aktualisieren und Render Loop fortsetzen
  if (!performanceMode.active || performanceMode.shaderPaused || !currentProgram) {
    requestAnimationFrame(render);
    return;
  }

  // FPS-Limitierung basierend auf Slider oder Hintergrund-Modus
  const targetFPS = !performanceMode.isPageVisible ?
    performanceMode.backgroundMode.fps :
    performanceMode.targetFPS;

  const frameInterval = 1000 / targetFPS;

  const deltaTime = currentTime - lastFrameTime;
  if (deltaTime < frameInterval) {
    requestAnimationFrame(render);
    return;
  }
  lastFrameTime = currentTime - (deltaTime % frameInterval);

  gl.useProgram(currentProgram); // Das aktuell ausgewählte Programm verwenden
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(currentUniforms.iResolution, canvas.width, canvas.height);
  gl.uniform1f(currentUniforms.iTime, currentTime * 0.001);

  // Aktualisiere Shader-Parameter für das aktuelle Programm
  gl.uniform1f(currentUniforms.uSpinSpeed, shaderParams.SPIN_SPEED);
  gl.uniform1f(currentUniforms.uPixelFilter, shaderParams.PIXEL_FILTER);
  gl.uniform4fv(currentUniforms.uColour1, shaderParams.COLOUR_1);
  gl.uniform4fv(currentUniforms.uColour2, shaderParams.COLOUR_2);
  gl.uniform4fv(currentUniforms.uColour3, shaderParams.COLOUR_3);
  gl.uniform1f(currentUniforms.uQuality, shaderParams.QUALITY); // Übergabe des Qualitätsparameters
  gl.uniform1f(currentUniforms.uContrast, shaderParams.CONTRAST);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
  requestAnimationFrame(render);
}

// Starte die Renderloop
requestAnimationFrame(render);

// Event Listener für Elemente mit Tooltips
elementsWithTooltips.forEach(element => {
  element.addEventListener("mouseover", () => {
    // Entferne die Klasse von allen anderen Elementen
    elementsWithTooltips.forEach(el => el.classList.remove("tooltip-active"));
    // Füge die Klasse zum aktuellen Element hinzu
    element.classList.add("tooltip-active");
  });

  element.addEventListener("mouseout", () => {
    // Entferne die Klasse nach einer kurzen Verzögerung (falls die Maus schnell wechselt)
    setTimeout(() => {
      if (!element.matches(':hover')) { // Überprüfe, ob die Maus das Element wirklich verlassen hat
        element.classList.remove("tooltip-active");
      }
    }, 50);
  });
});

// Event Listener für Reset Button
resetSettingsButton.addEventListener("click", () => {
  updateSpeed(defaultSettings.SPIN_SPEED);
  updatePixel(defaultSettings.PIXEL_FILTER);
  updateQuality(defaultSettings.QUALITY);
  updateContrast(defaultSettings.CONTRAST);

  // Optional: Setze Farbpreset auf Standard zurück
  // Finde den Button mit data-preset='original' und simuliere einen Klick
  const originalPresetButton = document.querySelector(".preset-button[data-preset='original']");
  if (originalPresetButton) {
    originalPresetButton.click();
  }
}); 