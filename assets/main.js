// Canvas und WebGL-Kontext
const canvas = document.getElementById("shader-canvas");

// Globale Variablen für Shader
let currentShader = null;
let currentUniforms = null;
let lastFrameTime = 0;
let shaders = null;
const shaderTypeButtons = document.querySelectorAll(".type-button");

// WebGL-Erweiterungen
let extTimerQuery = null; // Variable für die EXT_disjoint_timer_query Erweiterung

// Vordefinierte Auflösungen
const predefinedResolutions = {
  '8k': [7680, 4320],
  '4k': [3840, 2160],
  '3k': [3200, 1800],
  '2k': [2560, 1440],
  'fullhd': [1920, 1080],
  'hd': [1280, 720],
  'sd': [854, 480]
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

// Debug-Modus Einstellungen
const debugMode = {
  active: true,
  stats: {
    displayFps: 0, // Display FPS (requestAnimationFrame Rate)
    estimatedCpuFps: 0, // Geschätzte FPS basierend auf der CPU-Ausführungszeit der Render-Funktion
    estimatedGpuFps: 0, // Geschätzte FPS basierend auf GPU-Zeitmessung (wenn Erweiterung verfügbar)
    displayFrameTime: 0, // Durchschnittliche Zeit zwischen requestAnimationFrame Aufrufen (1000/displayFps)
    averageCpuExecutionTime: 0, // Durchschnittliche Gesamtausführungszeit der Render-Funktion (CPU-seitig)
    averageGpuRenderTime: 0, // Durchschnittliche GPU-Renderzeit (wenn Erweiterung verfügbar)
    drawCalls: 0,
    shaderType: '',
    resolution: { width: 0, height: 0 },
    renderingMode: 'Unbekannt',
    gpuModel: 'Unbekannt',
    memory: {
      total: 0,
      used: 0
    },
    uniforms: {}
  },
  updateInterval: 100, // Update alle 250ms
  lastUpdate: performance.now(),
  isUpdating: false,
  renderDurationTimes: [], // Array für die gemessene Zeit des Render-Aufrufs (nur gl.drawArrays Zeit - CPU-seitig)
  maxRenderDurationSamples: 60, // Anzahl der Samples für die durchschnittliche Render-Zeit (nur gl.drawArrays Zeit)
  renderExecutionTimes: [], // Array für die gemessene Gesamtausführungszeit der Render-Funktion (CPU-seitig)
  maxRenderExecutionSamples: 60, // Anzahl der Samples für die durchschnittliche Render-Ausführungszeit
  gpuRenderTimes: [], // Array für gemessene GPU-Renderzeiten
  maxGpuRenderTimeSamples: 60, // Anzahl der Samples für die durchschnittliche GPU-Zeit
  gpuTimerQueries: [], // Warteschlange für ausstehende GPU-Timer-Abfragen
  isGpuTimerDisjoint: false, // Flag, ob die GPU-Timer unzusammenhängend sind (Ergebnisse ungültig)
  isGpuTimerAvailable: false // Flag, ob die EXT_disjoint_timer_query Erweiterung verfügbar ist
};

// FPS-Zähler und Zeitstempel für die Shadertoy-ähnliche FPS-Messung (Display FPS)
let frameCount = 0;
let displayFps = 0;
let lastFpsUpdateTime = performance.now();
let fpsHistory = []; // Array für FPS-Historie
const fpsHistorySize = 60; // Anzahl der FPS-Werte für die Durchschnittsberechnung
const fpsUpdateInterval = 1000; // Update-Intervall in ms

// Versuche zuerst WebGL2 mit Hardware-Beschleunigung
let gl = canvas.getContext("webgl2", { 
  powerPreference: "high-performance",
  failIfMajorPerformanceCaveat: true,
  antialias: false,
  depth: false,
  stencil: false,
  alpha: true,
  desynchronized: true
});

// Wenn WebGL-Kontext erhalten wurde
if (gl) {
    console.log('WebGL-Kontext erfolgreich initialisiert.');
    let rendererInfo = gl.getExtension('WEBGL_debug_renderer_info');
    
    // Prüfe auf die Timer-Abfrage-Erweiterung
    extTimerQuery = gl.getExtension('EXT_disjoint_timer_query');
    if (extTimerQuery) {
        debugMode.isGpuTimerAvailable = true;
        console.log('EXT_disjoint_timer_query Erweiterung verfügbar.');
    } else {
        debugMode.isGpuTimerAvailable = false;
        console.warn('EXT_disjoint_timer_query Erweiterung nicht verfügbar. GPU-Zeitmessung nicht möglich.');
}

    let renderer = 'Unbekannt';
    let vendor = 'Unbekannt';
let isSoftwareRendering = false;

if (rendererInfo) {
        renderer = gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL);
        vendor = gl.getParameter(rendererInfo.UNMASKED_VENDOR_WEBGL);

        debugMode.stats.gpuModel = renderer;

    // Prüfe, ob Software-Rendering verwendet wird (basierend auf Renderer-Namen)
    if (renderer.toLowerCase().includes('swiftshader') ||
        renderer.toLowerCase().includes('llvmpipe') ||
        renderer.toLowerCase().includes('software')) {
        isSoftwareRendering = true;
            debugMode.stats.renderingMode = 'Software (GPU)';
            console.log('Software-Rendering erkannt (GPU):', renderer);
    } else {
            debugMode.stats.renderingMode = 'GPU';
        console.log('Hardware-Rendering erkannt:', renderer);
        }
    } else {
        console.warn('WEBGL_debug_renderer_info Erweiterung nicht verfügbar.');
         debugMode.stats.renderingMode = 'GPU (Info N/A)'; // Kann GPU sein, aber keine Detailinfo
    }

    // Wenn Hardware-Rendering erkannt, zeige den Auswahl-Dialog
    if (!isSoftwareRendering && rendererInfo) { // Zeige Dialog nur bei erkannter Hardware-GPU
        const renderingDialog = document.getElementById('rendering-dialog');
        const rendererNameElement = document.getElementById('renderer-name');
        const vendorNameElement = document.getElementById('vendor-name');

        if (rendererNameElement && vendorNameElement && renderingDialog) {
            rendererNameElement.textContent = renderer;
            vendorNameElement.textContent = vendor;
            showDialog(renderingDialog);
            
        document.getElementById("gpuRenderButton").addEventListener("click", () => {
                hideDialog(renderingDialog);
                initShader();
                displayRenderingWarning('GPU-Rendering aktiviert');
        });
        document.getElementById("softwareRenderButton").addEventListener("click", () => {
                hideDialog(renderingDialog);
                attemptSoftwareRendering(false);
            });
            document.getElementById("cpuRenderButton").addEventListener("click", () => {
                hideDialog(renderingDialog);
                attemptSoftwareRendering(true);
            });

            } else {
            console.error('HTML-Elemente für Rendering-Dialog nicht gefunden! Starte Shader im Standardmodus.');
            initShader(); // Fallback: Starte Shader sofort
        }
    } else {
         // Wenn Software-Rendering (GPU) erkannt oder keine Renderer-Info verfügbar,
         // starte den Shader sofort.
         initShader();
         displayRenderingWarning('Software-Rendering aktiviert');
    }

} else { // Wenn kein WebGL-Kontext erhalten wurde (weder WebGL2 noch WebGL1 mit high-performance)
    console.error('WebGL-Kontext konnte nicht initialisiert werden.');
    const errorDialog = document.getElementById('webgl-error-dialog');
    if (errorDialog) {
        showDialog(errorDialog);
        // Event Listener für den Fallback-Button
        const softwareFallbackButton = document.getElementById("softwareFallbackButton");
        if (softwareFallbackButton) {
             softwareFallbackButton.addEventListener("click", () => {
                 hideDialog(errorDialog);
                 attemptSoftwareRendering(false); // Versuche Standard Software-Rendering als Fallback
             });
        } else {
             console.error('Software Fallback Button HTML-Element nicht gefunden!');
        }
    } else {
        console.error('WebGL-Fehler-Dialog HTML-Element nicht gefunden! Keine weiteren Optionen verfügbar.');
    }
}

// Funktion zum Versuch von Software-Rendering
function attemptSoftwareRendering(useCpuOptions) {
    console.log('Versuche Software-Rendering. CPU Optionen:', useCpuOptions);
    let tempGl = null;

    // Versuche WebGL2 mit low-power Optionen
    tempGl = canvas.getContext("webgl2", {
                powerPreference: "low-power",
        failIfMajorPerformanceCaveat: false,
                antialias: false,
                depth: false,
                stencil: false,
                alpha: true,
                desynchronized: true,
            });

    if (!tempGl) {
                // Fallback auf WebGL1 mit denselben Optionen
        tempGl = canvas.getContext("webgl", {
                    powerPreference: "low-power",
            failIfMajorPerformanceCaveat: false,
                    antialias: false,
                    depth: false,
                    stencil: false,
                    alpha: true,
                    desynchronized: true,
                });
            }

    // Prüfe den erhaltenen Kontext
    if (tempGl) {
        const debugInfo = tempGl.getExtension('WEBGL_debug_renderer_info');
                 let rendererName = 'unbekannt';
                 let isActuallySoftware = false;

                 if (debugInfo) {
            rendererName = tempGl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
             // Überprüfe auf bekannte Software-Renderer-Namen
                     if (rendererName.toLowerCase().includes('swiftshader') || 
                         rendererName.toLowerCase().includes('llvmpipe') || 
                         rendererName.toLowerCase().includes('software')) {
                         isActuallySoftware = true;
                     }
                 }

        // Entscheide basierend auf useCpuOptions und dem erhaltenen Renderer
        if (useCpuOptions) { // Benutzer wählte Software (CPU)
                 if (isActuallySoftware) {
                 gl = tempGl; // Setze den globalen gl-Kontext auf den Software-Kontext
                 debugMode.stats.renderingMode = 'Software (CPU)';
                 debugMode.stats.gpuModel = rendererName; // Renderer Name ist das Software-Modell
                 console.log('Software-Rendering (CPU) erfolgreich aktiviert:', rendererName);
                 displayRenderingWarning('Software-Rendering (CPU) aktiviert');
                 initShader();
                 } else {
                console.warn(`Unerwünschter Renderer (${rendererName}) für CPU-Option erhalten.`);
                     // Kontext erhalten, aber es ist KEIN Software-Renderer (wahrscheinlich GPU)
                 // Zeige den CPU-Fallback-GPU-Dialog an
                 const cpuFallbackGpuDialog = document.getElementById('cpu-fallback-gpu-dialog');
                 const gpuRendererInfoElement = document.getElementById('cpu-fallback-gpu-renderer-info');

                 if (cpuFallbackGpuDialog && gpuRendererInfoElement) {
                      gpuRendererInfoElement.textContent = `Erkannter Renderer: ${rendererName}`; // Zeige den erhaltenen Renderer an
                      showDialog(cpuFallbackGpuDialog);
                      // Event Listener für den Button im Dialog
                      const useGpuButton = document.getElementById('useGpuFromCpuFallbackButton');
                      if (useGpuButton) {
                           useGpuButton.onclick = () => { // Nutze onclick, um vorherige Listener zu überschreiben
                               hideDialog(cpuFallbackGpuDialog);
                               gl = tempGl; // Setze den globalen gl-Kontext auf den erhaltenen GPU-Kontext
                               // Aktualisiere Debug-Statistiken für den Low-Power GPU Modus
                               const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                               let gpuRendererName = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Unbekannt';
                               debugMode.stats.renderingMode = 'GPU (Low Power)';
                               debugMode.stats.gpuModel = gpuRendererName;
                               console.log('GPU (Low Power) Modus aus CPU-Fallback aktiviert:', gpuRendererName);
                               displayRenderingWarning('GPU (Low Power) Modus aktiviert (aus CPU-Fallback)');
                               initShader();
                           };
                     } else {
                           console.error('Button im CPU-Fallback-GPU-Dialog nicht gefunden!');
                           // Fallback: Zeige den allgemeinen Fehlerdialog
                           displayErrorDialog('Software-Rendering (CPU) fehlgeschlagen', `Konnte reines Software-Rendering über CPU nicht initialisieren. Es wurde ein ${rendererName} Renderer erhalten.`);
                       }
                 } else {
                      console.error('CPU-Fallback-GPU-Dialog HTML-Elemente nicht gefunden!');
                      // Fallback: Zeige den allgemeinen Fehlerdialog
                      displayErrorDialog('Software-Rendering (CPU) fehlgeschlagen', `Konnte reines Software-Rendering über CPU nicht initialisieren. Es wurde ein ${rendererName} Renderer erhalten.`);
                 }
                 // Den unerwünschten Kontext verlieren wir hier nicht sofort, er wird verwendet, falls der Benutzer auf den Button klickt.
            }
        } else { // Benutzer wählte Standard Software (oder Fallback)
            // Für den Standard Software-Button oder Fallback akzeptieren wir jeden Kontext mit low-power
             gl = tempGl; // Setze den globalen gl-Kontext
             // Aktualisiere Rendering-Modus basierend auf dem erhaltenen Renderer (kann Software oder Hardware sein)
             if (isActuallySoftware) {
                 debugMode.stats.renderingMode = 'Software (GPU)'; // Oder einfach 'Software'
                 debugMode.stats.gpuModel = rendererName; // Renderer Name ist das Software-Modell
                 console.log('Software-Rendering erfolgreich aktiviert:', rendererName);
                 displayRenderingWarning('Software-Rendering aktiviert');
             } else {
                  // Wenn wir hier einen Hardware-Renderer mit low-power Optionen bekommen, notieren wir das
                  const hardwareRendererName = debugInfo ? tempGl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Unbekannt'; // Holen wir den Namen erneut
                  debugMode.stats.renderingMode = 'GPU (Low Power)';
                  debugMode.stats.gpuModel = hardwareRendererName;
                  console.log('GPU (Low Power) Modus aktiviert:', hardwareRendererName);
                  displayRenderingWarning('GPU (Low Power) Modus aktiviert');
             }
            initShader();
                 }
            } else {
                // Kein Kontext erhalten (weder WebGL2 noch WebGL1 mit den Optionen)
        console.error('Software-Rendering Kontext konnte nicht initialisiert werden.');
        displayErrorDialog('Rendering Fehlgeschlagen', 'Konnte weder GPU- noch Software-Rendering initialisieren.');
    }
}

// Hilfsfunktion zur Anzeige des Fehler-Dialogs
function displayErrorDialog(title, message) {
    const errorDialog = document.getElementById('webgl-error-dialog');
     const errorMessageElement = errorDialog ? errorDialog.querySelector('p:nth-of-type(2)') : null; // Annahme: Die Fehlermeldung steht im zweiten p-Tag

    if (errorDialog) {
        // Titel und Hauptnachricht des Fehlerdialogs anpassen (falls nötig)
        // Hier setzen wir nur die Fehlermeldung im zweiten p-Tag
         if (errorMessageElement) {
            errorMessageElement.textContent = message;
         }
        showDialog(errorDialog);
         // Stelle sicher, dass andere Dialoge ausgeblendet sind
         const renderingDialog = document.getElementById('rendering-dialog');
         if (renderingDialog) hideDialog(renderingDialog);
         const cpuFallbackGpuDialog = document.getElementById('cpu-fallback-gpu-dialog');
         if (cpuFallbackGpuDialog) hideDialog(cpuFallbackGpuDialog);
    } else {
        console.error('Kritischer Fehler: WebGL-Fehler-Dialog HTML-Element nicht gefunden!', message);
        alert(`Fehler: ${title}\n${message}`); // Fallback mit einfachem Alert
    }
}

// Hilfsfunktion zur Anzeige der Rendering-Warnung
function displayRenderingWarning(message) {
    // Bestimme die passende Warnung basierend auf der Nachricht
    let warningElement;
    if (message.includes('GPU-Rendering aktiviert')) {
        warningElement = document.getElementById('gpu-rendering-warning');
    } else if (message.includes('Software-Rendering aktiviert') && !message.includes('CPU')) {
        warningElement = document.getElementById('software-rendering-warning');
    } else if (message.includes('Software-Rendering (CPU) aktiviert')) {
        warningElement = document.getElementById('cpu-rendering-warning');
    } else if (message.includes('GPU (Low Power) Modus aktiviert') && !message.includes('aus CPU-Fallback')) {
        warningElement = document.getElementById('low-power-gpu-warning');
    } else if (message.includes('GPU (Low Power) Modus aktiviert (aus CPU-Fallback)')) {
        warningElement = document.getElementById('low-power-gpu-fallback-warning');
    } else {
        // Fallback auf die generische Warnung für andere Nachrichten
        warningElement = document.getElementById('rendering-warning');
        const warningText = document.getElementById('rendering-warning-text');
        if (warningText) {
            warningText.textContent = message;
        }
    }

    if (warningElement) {
        showDialog(warningElement);
        
        // Automatisches Ausblenden nach 5 Sekunden
        setTimeout(() => {
            hideDialog(warningElement);
        }, 5000);
    }
}

// Shader-Parameter
const shaderParams = {
  SPIN_SPEED: 5.0,
  PIXEL_FILTER: 5000.0,
  COLOUR_1: [0.924, 0.232, 0.228, 1.0],
  COLOUR_2: [0.124, 0.185, 0.941, 1.0],
  COLOUR_3: [0.050, 0.050, 0.050, 1.0],
  QUALITY: 100,
  CONTRAST: 1.0,
  INVERT_COLORS: 0.0,
  BRIGHTNESS: 1.0,
  SATURATION: 1.0
};

// Standardwerte für Einstellungen
const defaultSettings = {
  SPIN_SPEED: 5.0,
  PIXEL_FILTER: 5000.0,
  QUALITY: 100,
  CONTRAST: 1.0,
  BRIGHTNESS: 1.0,
  SATURATION: 1.0
};

// UI Elemente
const menuButton = document.getElementById("menuButton");
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
const brightnessSlider = document.getElementById("brightnessSlider");
const brightnessInput = document.getElementById("brightnessInput");
const saturationSlider = document.getElementById("saturationSlider");
const saturationInput = document.getElementById("saturationInput");
const speedValue = document.getElementById("speedValue");
const pixelValue = document.getElementById("pixelValue");
const fpsValue = document.getElementById("fpsValue");
const qualityValue = document.getElementById("qualityValue");
const contrastValue = document.getElementById("contrastValue");
const brightnessValue = document.getElementById("brightnessValue");
const saturationValue = document.getElementById("saturationValue");
const presetButtons = document.querySelectorAll(".preset-button");
const performanceToggle = document.getElementById("performanceToggle");
const customColor1Input = document.getElementById("customColor1");
const customColor2Input = document.getElementById("customColor2");
const customColor3Input = document.getElementById("customColor3");
const customPresetButton = document.querySelector(".preset-button[data-preset='custom']");
const elementsWithTooltips = document.querySelectorAll("[data-tooltip]");
const resetSettingsButton = document.getElementById("resetSettingsButton");
const pauseToggle = document.getElementById("pauseToggle");
const invertToggle = document.getElementById("invertToggle");
const generateRandomColorsButton = document.getElementById("generateRandomColorsButton");
const lowFPSToggle = document.getElementById("lowFPSToggle");

// Neue UI Elemente für Panels und Panel Buttons
const panelButtons = document.querySelectorAll(".panel-button");
const controlPanels = document.querySelectorAll(".control-panel");

// UI Event Listeners
menuButton.addEventListener("click", () => {
  const isMenuOpen = menuButton.classList.toggle("open");
  
  // Animiertes Ein- und Ausblenden der Panel-Buttons
  panelButtons.forEach((button, index) => {
    if (isMenuOpen) {
      button.style.display = "flex";
      button.classList.remove("hide");
    } else {
      button.classList.add("hide");
      // Warte auf das Ende der Animation bevor der Button ausgeblendet wird
      setTimeout(() => {
        button.style.display = "none";
      }, 300);
    }
  });

  if (!isMenuOpen) {
    controlPanels.forEach(panel => panel.classList.remove("active"));
    panelButtons.forEach(button => button.classList.remove("active"));
  }
});

panelButtons.forEach(button => {
  button.addEventListener("click", () => {
    const targetPanelId = button.dataset.panel + "Panel";
    const targetPanel = document.getElementById(targetPanelId);

    controlPanels.forEach(panel => {
      if (panel.id === targetPanelId) {
        // Füge/entferne 'active' Klasse direkt vom PANEL
        panel.classList.toggle("active");

      } else {
         // Entferne 'active' Klasse von allen anderen Panels
         panel.classList.remove("active");
      }
    });

    panelButtons.forEach(btn => {
      if (btn === button) {
        btn.classList.toggle("active");
      } else {
        btn.classList.remove("active");
      }
    });

     // Diese Logik zur Überprüfung ob Panels aktiv sind, kann bleiben oder angepasst werden, je nach Bedarf
     const anyPanelActive = Array.from(controlPanels).some(panel => panel.classList.contains("active"));
     // Füge hier ggf. Logik hinzu, wenn alle Panels geschlossen sind.
  });
});

controlPanels.forEach(panel => panel.classList.remove("active"));
panelButtons.forEach(button => button.style.display = "none");

function updateSpeed(value) {
  const speed = parseFloat(value);
  shaderParams.SPIN_SPEED = speed;
  speedValue.textContent = Math.round(speed * 10) / 10;
  speedSlider.value = speed;
  speedInput.value = speed.toFixed(1);
}

// Hilfsfunktion für wheel Event-Listener
function createWheelHandler(input, updateFunction, min, max, step) {
  return (event) => {
    const currentValue = parseFloat(input.value);
  const newValue = event.deltaY < 0 ? currentValue + step : currentValue - step;
    const clampedValue = Math.min(Math.max(newValue, min), max);
    updateFunction(clampedValue);
  };
}

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

function updateFPS(value) {
  const fps = parseInt(value);
  performanceMode.targetFPS = fps;
  fpsValue.textContent = fps;
  fpsSlider.value = fps;
  fpsInput.value = fps;
}

function updateQuality(value) {
  const quality = parseInt(value);
  shaderParams.QUALITY = quality;
  qualityValue.textContent = quality;
  qualitySlider.value = quality;
  qualityInput.value = quality;
}

function updateContrast(value) {
  const contrast = parseFloat(value);
  shaderParams.CONTRAST = contrast;
  contrastValue.textContent = Math.round(contrast * 10) / 10;
  contrastSlider.value = contrast;
  contrastInput.value = contrast.toFixed(2);
}

function updateBrightness(value) {
  const brightness = parseFloat(value);
  shaderParams.BRIGHTNESS = brightness;
  brightnessValue.textContent = brightness.toFixed(1);
  brightnessSlider.value = brightness;
  brightnessInput.value = brightness.toFixed(2);
}

function updateSaturation(value) {
  const saturation = parseFloat(value);
  shaderParams.SATURATION = saturation;
  saturationValue.textContent = saturation.toFixed(1);
  saturationSlider.value = saturation;
  saturationInput.value = saturation.toFixed(2);
}

performanceToggle.addEventListener("change", () => {
  performanceMode.active = performanceToggle.checked;
  pauseToggle.disabled = !performanceMode.active;
  if (!performanceMode.active) {
    performanceMode.shaderPaused = false;
    pauseToggle.checked = false;

    performanceMode.backgroundMode.originalPixelFilter = shaderParams.PIXEL_FILTER;
    performanceMode.backgroundMode.originalSpinSpeed = shaderParams.SPIN_SPEED;
    performanceMode.backgroundMode.originalQuality = shaderParams.QUALITY;
    
    shaderParams.PIXEL_FILTER = 100;
    shaderParams.SPIN_SPEED = 0;
    shaderParams.QUALITY = 1;
    
    pixelSlider.value = shaderParams.PIXEL_FILTER;
    speedSlider.value = shaderParams.SPIN_SPEED;
    qualitySlider.value = shaderParams.QUALITY;
    
    pixelValue.textContent = shaderParams.PIXEL_FILTER;
    speedValue.textContent = "0.0";
    qualityValue.textContent = shaderParams.QUALITY;
    
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  } else {
    if (performanceMode.backgroundMode.originalPixelFilter) {
      shaderParams.PIXEL_FILTER = performanceMode.backgroundMode.originalPixelFilter;
      shaderParams.SPIN_SPEED = performanceMode.backgroundMode.originalSpinSpeed;
      shaderParams.QUALITY = performanceMode.backgroundMode.originalQuality;
      
      pixelSlider.value = shaderParams.PIXEL_FILTER;
      speedSlider.value = shaderParams.SPIN_SPEED;
      qualitySlider.value = shaderParams.QUALITY;
      pixelValue.textContent = (shaderParams.PIXEL_FILTER / 1000).toFixed(1).replace('.0', '') + 'k';
      speedValue.textContent = shaderParams.SPIN_SPEED.toFixed(1);
      qualityValue.textContent = shaderParams.QUALITY;
    }
  }
});

document.addEventListener('visibilitychange', () => {
  performanceMode.isPageVisible = !document.hidden;
  
  if (!performanceMode.isPageVisible) {
    performanceMode.backgroundMode.originalPixelFilter = shaderParams.PIXEL_FILTER;
    performanceMode.backgroundMode.originalSpinSpeed = shaderParams.SPIN_SPEED;
    performanceMode.backgroundMode.originalQuality = shaderParams.QUALITY;
    
    shaderParams.PIXEL_FILTER = performanceMode.backgroundMode.pixelFilter;
    shaderParams.SPIN_SPEED = performanceMode.backgroundMode.spinSpeed;
    shaderParams.QUALITY = performanceMode.backgroundMode.quality;
    
    pixelSlider.value = shaderParams.PIXEL_FILTER;
    speedSlider.value = shaderParams.SPIN_SPEED;
    qualitySlider.value = shaderParams.QUALITY;
    pixelValue.textContent = (shaderParams.PIXEL_FILTER / 1000).toFixed(1).replace('.0', '') + 'k';
    speedValue.textContent = shaderParams.SPIN_SPEED.toFixed(1);
    qualityValue.textContent = shaderParams.QUALITY;
  } else {
    if (performanceMode.backgroundMode.originalPixelFilter) {
      shaderParams.PIXEL_FILTER = performanceMode.backgroundMode.originalPixelFilter;
      shaderParams.SPIN_SPEED = performanceMode.backgroundMode.originalSpinSpeed;
      shaderParams.QUALITY = performanceMode.backgroundMode.originalQuality;
      
      pixelSlider.value = shaderParams.PIXEL_FILTER;
      speedSlider.value = shaderParams.SPIN_SPEED;
      qualitySlider.value = shaderParams.QUALITY;
      pixelValue.textContent = (shaderParams.PIXEL_FILTER / 1000).toFixed(1).replace('.0', '') + 'k';
      speedValue.textContent = shaderParams.SPIN_SPEED.toFixed(1);
      qualityValue.textContent = shaderParams.QUALITY;
    }
  }
});

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

function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r / 255.0, g / 255.0, b / 255.0, 1.0];
}

    function rgbToHex(rgb) {
        const toHex = (c) => {
            const hex = Math.round(c * 255).toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        };
        return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
    }

function updateCustomColorPickers(colors) {
    customColor1Input.value = rgbToHex(colors.COLOUR_1);
    customColor2Input.value = rgbToHex(colors.COLOUR_2);
    customColor3Input.value = rgbToHex(colors.COLOUR_3);
}

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

updateCustomColorPickers(colorPresets.original);
presetButtons.forEach(btn => btn.classList.remove("active"));
document.querySelector(".preset-button[data-preset='original']").classList.add("active");

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
    const easedProgress = progress < 0.5 
      ? 4 * progress * progress * progress 
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    
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

// Funktion zur Aktualisierung der Renderauflösung
function updateResolution(value) {
  console.log('updateResolution aufgerufen mit Wert:', value);
  if (value === 'auto') {
    console.log('Auflösungsmodus: Automatisch');
    // Bei 'auto' wird die Größe im resizeCanvas gehandhabt
    resizeCanvas(); 
  } else if (predefinedResolutions[value]) {
    console.log('Auflösungsmodus: Festgelegt', value, '->', predefinedResolutions[value]);
    // Bei vordefinierter Auflösung die Canvas-Größe direkt setzen
    canvas.width = predefinedResolutions[value][0];
    canvas.height = predefinedResolutions[value][1];
    if (gl) {
       console.log('WebGL Viewport aktualisiert:', canvas.width, canvas.height);
       gl.viewport(0, 0, canvas.width, canvas.height);
    }
  } else {
    console.warn('Unbekannter Auflösungswert:', value);
  }
   console.log('Aktuelle Canvas Größe nach updateResolution:', canvas.width, 'x', canvas.height);
  // Debug Info Resolution aktualisieren (wird in render loop gehandhabt)
}

// Canvas Größenanpassung
function resizeCanvas() {
  console.log('resizeCanvas aufgerufen');
  // Finde den aktuell aktiven Auflösungs-Button
  const activeResolutionButton = document.querySelector('.resolution-button.active');
  const resolutionMode = activeResolutionButton ? activeResolutionButton.dataset.resolution : 'auto';

  if (resolutionMode === 'auto') {
    console.log('resizeCanvas: Modus Automatisch');
  const { innerWidth, innerHeight } = window;
  canvas.width = innerWidth;
  canvas.height = innerHeight;
    if (gl) {
      console.log('resizeCanvas: Viewport Automatisch aktualisiert:', canvas.width, canvas.height);
  gl.viewport(0, 0, canvas.width, canvas.height);
    }
  } else if (predefinedResolutions[resolutionMode]) {
    console.log('resizeCanvas: Modus Festgelegt (Größe sollte bereits in updateResolution gesetzt sein)');
    // Wenn eine feste Auflösung gewählt ist, wird die Größe durch updateResolution gesetzt
    // Hier nur den Viewport anpassen, falls nötig (sollte aber der Canvas Größe entsprechen)
    if (gl) {
      console.log('resizeCanvas: Viewport Festgelegt aktualisiert:', canvas.width, canvas.height);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
  } else {
    console.warn('resizeCanvas: Unbekannter Auflösungsmodus:', resolutionMode);
  }
   console.log('Aktuelle Canvas Größe nach resizeCanvas:', canvas.width, 'x', canvas.height);
}

resizeCanvas();
// Debounced Resize Event Listener bleibt aktiv für 'auto' Modus
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

// Hilfsfunktionen für Shader-Erstellung
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader Kompilierungsfehler:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Programm Link-Fehler:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

// Initialisiere die Shader
function initShader() {
  if (!gl) {
    console.error('WebGL-Kontext ist nicht verfügbar');
    return;
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

// Initialisiere die Shader
shaders = {
    default: initDefaultShader(gl, vertexShader),
    swirl: initSwirlShader(gl, vertexShader),
    turbulent: initTurbulentShader(gl, vertexShader),
    wavy: initWavyShader(gl, vertexShader),
    fractal: initFractalShader(gl, vertexShader),
    radial: initRadialShader(gl, vertexShader),
    grid: initGridShader(gl, vertexShader),
    cellular: initCellularShader(gl, vertexShader),
    mixed: initMixedShader(gl, vertexShader),
    wavegrid: initWaveGridShader(gl, vertexShader),
    spiral: initSpiralShader(gl, vertexShader),
    pulse: initPulseShader(gl, vertexShader)
};

// Überprüfe, ob alle Shader erfolgreich initialisiert wurden
Object.entries(shaders).forEach(([name, shader]) => {
  if (!shader || !shader.program) {
    console.error(`Fehler bei der Initialisierung des ${name}-Shaders`);
  } else {
    console.log(`${name}-Shader erfolgreich initialisiert`);

      // Zusätzliche Validierung des Programms
      if (!gl.getProgramParameter(shader.program, gl.VALIDATE_STATUS)) {
          console.error(`Programm Validierungsfehler für ${name}-Shader:`, gl.getProgramInfoLog(shader.program));
          // Hier könnten wir entscheiden, ob wir den Shader trotzdem verwenden oder einen Fallback machen
          // Vorerst loggen wir nur den Fehler
      }

    // Debug-Ausgabe der Uniform-Locations
    console.log(`${name}-Shader Uniforms:`, shader.uniforms);
  }
});

// Position Buffer (Vollbild)
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

// Aktuell aktives Shader-Programm und Uniforms
  currentShader = shaders.default;
currentUniforms = getUniformLocations(gl, currentShader.program);

  // Überprüfe, ob das Shader-Programm und die Uniforms gültig sind, bevor wir sie verwenden
  if (!currentShader || !currentShader.program || !currentUniforms) {
      console.error("Initialer Shader oder Uniforms nicht gültig. Kann nicht rendern.");
      // Hier könnten wir einen Fallback-Zustand anzeigen oder eine Fehlermeldung
      return; // Render-Loop nicht starten
  }


  // Initialisiere den Standard-Shader
  gl.useProgram(currentShader.program);
  const positionLocation = gl.getAttribLocation(currentShader.program, "position");

  // Stelle sicher, dass das Attribut gefunden wurde
  if (positionLocation < 0) {
      console.error("Kann Attribut-Location für 'position' nicht finden.");
      return; // Render-Loop nicht starten
  }

  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  // Setze den initialen aktiven Shader-Button
  const initialShaderButton = document.querySelector(".type-button[data-type='standard']");
  if (initialShaderButton) {
    initialShaderButton.classList.add("active");
  }


  // Initialisiere die Event-Listener
  initEventListeners();

  // Starte die Renderloop
  requestAnimationFrame(render);
}

// Funktion zum Abrufen der Uniform-Locations für ein Shader-Programm
function getUniformLocations(gl, program) {
  return {
    iResolution: gl.getUniformLocation(program, 'iResolution'),
    iTime: gl.getUniformLocation(program, 'iTime'),
    uSpinSpeed: gl.getUniformLocation(program, 'uSpinSpeed'),
    uPixelFilter: gl.getUniformLocation(program, 'uPixelFilter'),
    uColour1: gl.getUniformLocation(program, 'uColour1'),
    uColour2: gl.getUniformLocation(program, 'uColour2'),
    uColour3: gl.getUniformLocation(program, 'uColour3'),
    uQuality: gl.getUniformLocation(program, 'uQuality'),
    uContrast: gl.getUniformLocation(program, 'uContrast'),
    uInvertColors: gl.getUniformLocation(program, 'uInvertColors'),
    uBrightness: gl.getUniformLocation(program, 'uBrightness'),
    uSaturation: gl.getUniformLocation(program, 'uSaturation')
  };
}

// Event Listener für Shader-Typ-Buttons
shaderTypeButtons.forEach(button => {
  button.addEventListener('click', () => {
    const shaderType = button.getAttribute('data-type');
    if (shaderType && shaders[shaderType]) {
      // Entferne 'active' Klasse von allen Buttons
      shaderTypeButtons.forEach(btn => btn.classList.remove('active'));
      // Füge 'active' Klasse zum geklickten Button hinzu
      button.classList.add('active');
      // Wechsle zum ausgewählten Shader
      currentShader = shaders[shaderType];
      currentUniforms = getUniformLocations(gl, currentShader.program);
      // Aktualisiere Debug-Info
      debugMode.stats.shaderType = shaderType.charAt(0).toUpperCase() + shaderType.slice(1);
    }
  });
});

// FPS-Steuerung für den Stromsparmodus
const targetFPSLowPower = 30; // Niedrigere FPS im Stromsparmodus

// Event Listener für Shader Pause Toggle
pauseToggle.addEventListener("change", () => {
  performanceMode.shaderPaused = pauseToggle.checked;
});

// Event Listener für Farben invertieren Toggle
invertToggle.addEventListener("change", () => {
  shaderParams.INVERT_COLORS = invertToggle.checked ? 1.0 : 0.0;
});

// Event Listener für Low FPS Modus Toggle
lowFPSToggle.addEventListener("change", () => {
    performanceMode.lowFPS = lowFPSToggle.checked;
    // Die render-Funktion wird die Framerate basierend auf performanceMode.lowFPS steuern
});

// Hilfsfunktion zum Generieren einer zufälligen Farbe (RGB im Bereich 0-1)
function generateRandomColor() {
  return [Math.random(), Math.random(), Math.random(), 1.0];
}

// Event Listener für Zufällig generieren Button
generateRandomColorsButton.addEventListener("click", () => {
  const randomColors = {
    COLOUR_1: generateRandomColor(),
    COLOUR_2: generateRandomColor(),
    COLOUR_3: generateRandomColor()
  };

  // Aktualisiere shaderParams und starte die Animation
  animateColorChange(randomColors);

  // Aktualisiere die benutzerdefinierten Farbwähler und setze das 'Custom' Preset aktiv
  updateCustomColorPickers(randomColors);
  presetButtons.forEach(btn => btn.classList.remove("active"));
  customPresetButton.classList.add("active");
});

// === Render Loop ===
function render(currentTime) {
  frameCount++; // Erhöhe Frame-Zähler für FPS-Berechnung
  
  // Startzeit für die Messung der Gesamtausführungszeit der Render-Funktion (CPU-seitig)
  const renderExecutionStartTime = performance.now();

  // --- Display FPS Messung (Shadertoy-ähnlich) ---
  const now = performance.now();
  const delta = now - lastFpsUpdateTime;

  if (delta >= 1000) { // Mindestens 1 Sekunde vergangen?
    displayFps = (frameCount / delta) * 1000; // Display FPS berechnen
    frameCount = 0;                     // Zähler zurücksetzen
    lastFpsUpdateTime = now;
    // Optional: console.log(`Display FPS: ${displayFps.toFixed(2)}`);
  }
  // --- Ende Display FPS Messung ---

  // Wenn der Shader nicht aktiv oder pausiert ist oder kein Programm aktiv, nur UI aktualisieren und Render Loop fortsetzen
  if (!performanceMode.active || performanceMode.shaderPaused || !currentShader) {
    // Debug-Informationen aktualisieren (wenn aktiv)
    if (debugMode.active) {
      updateDebugInfo(now); // Verwende den 'now' Zeitstempel
    }

    // Endezeit für die Messung der Gesamtausführungszeit der Render-Funktion (wenn nichts gerendert wird - CPU-seitig)
    const renderExecutionEndTime = performance.now();
    const renderExecutionTime = renderExecutionEndTime - renderExecutionStartTime;
    debugMode.renderExecutionTimes.push(renderExecutionTime);
    if (debugMode.renderExecutionTimes.length > debugMode.maxRenderExecutionSamples) {
        debugMode.renderExecutionTimes.shift();
    }

    requestAnimationFrame(render);
    return;
  }

  // FPS-Limitierung basierend auf Slider, Hintergrund-Modus oder Low FPS Modus
  let targetFPS = performanceMode.targetFPS;
  if (!performanceMode.isPageVisible) {
      targetFPS = performanceMode.backgroundMode.fps;
  }
  if (performanceMode.lowFPS) {
    targetFPS = 30;
  }

  const frameInterval = 1000 / targetFPS;
  const deltaTime = now - lastFrameTime; // Nutze 'now' für die Delta-Berechnung

  // Nur rendern wenn genug Zeit vergangen ist
  if (deltaTime >= frameInterval) {
    lastFrameTime = now - (deltaTime % frameInterval); // Nutze 'now' für die Aktualisierung

    // --- Render Performance Messung (nur gl.drawArrays Zeit - CPU-seitig) ---
    // Diese CPU-seitige Messung kann beibehalten werden, ist aber nicht die GPU-Zeit
    const renderStartTime = performance.now();

    // --- GPU-Zeitmessung starten (wenn Erweiterung verfügbar) ---
    if (debugMode.isGpuTimerAvailable) {
        const query = extTimerQuery.createQueryEXT();
        extTimerQuery.beginQueryEXT(extTimerQuery.TIME_ELAPSED_EXT, query);
        debugMode.gpuTimerQueries.push(query); // Füge die Abfrage zur Warteschlange hinzu
    }
    // --- Ende GPU-Zeitmessung starten ---

    // Optimierte Shader-Aktualisierung
    gl.useProgram(currentShader.program);
    
    // Batch-Update der Uniforms
    const uniforms = {
      iResolution: [canvas.width, canvas.height],
      iTime: now * 0.001, // Nutze 'now' für die Zeituniform
      uSpinSpeed: shaderParams.SPIN_SPEED,
      uPixelFilter: shaderParams.PIXEL_FILTER,
      uColour1: shaderParams.COLOUR_1,
      uColour2: shaderParams.COLOUR_2,
      uColour3: shaderParams.COLOUR_3,
      uQuality: shaderParams.QUALITY,
      uContrast: shaderParams.CONTRAST,
      uInvertColors: shaderParams.INVERT_COLORS,
      uBrightness: shaderParams.BRIGHTNESS,
      uSaturation: shaderParams.SATURATION
    };

    // Setze alle Uniforms auf einmal
    Object.entries(uniforms).forEach(([name, value]) => {
      const location = currentShader.uniforms[name];
      if (location !== null) {
        if (Array.isArray(value)) {
          if (value.length === 2) {
            gl.uniform2f(location, value[0], value[1]);
          } else if (value.length === 4) {
            gl.uniform4fv(location, value);
          } else if (value.length === 3) { // Falls 3D-Vektoren in Zukunft benötigt werden
             gl.uniform3fv(location, value);
          }
        } else if (typeof value === 'number') { // Füge Typ-Prüfung hinzu
          gl.uniform1f(location, value);
        } else if (typeof value === 'boolean') { // Füge Typ-Prüfung für bool hinzu
          gl.uniform1i(location, value ? 1 : 0);
        }
      }
    });

    // Optimierter Draw-Call
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // --- GPU-Zeitmessung stoppen (wenn Erweiterung verfügbar) ---
    if (debugMode.isGpuTimerAvailable) {
        extTimerQuery.endQueryEXT(extTimerQuery.TIME_ELAPSED_EXT);
    }
    // --- Ende GPU-Zeitmessung stoppen ---

    const renderEndTime = performance.now();
    const renderDuration = renderEndTime - renderStartTime;

    // Speichere die Render-Dauer (nur gl.drawArrays Zeit - CPU-seitig)
    debugMode.renderDurationTimes.push(renderDuration);
    if (debugMode.renderDurationTimes.length > debugMode.maxRenderDurationSamples) {
      debugMode.renderDurationTimes.shift();
    }
    // --- Ende Render Performance Messung (nur gl.drawArrays Zeit - CPU-seitig) ---

  }

  // Debug-Informationen aktualisieren
  if (debugMode.active) {
    updateDebugInfo(now); // Verwende den 'now' Zeitstempel
  }

  // Endezeit für die Messung der Gesamtausführungszeit der Render-Funktion (CPU-seitig)
  const renderExecutionEndTime = performance.now();
  const renderExecutionTime = renderExecutionEndTime - renderExecutionStartTime;
  debugMode.renderExecutionTimes.push(renderExecutionTime);
  if (debugMode.renderExecutionTimes.length > debugMode.maxRenderExecutionSamples) {
      debugMode.renderExecutionTimes.shift();
  }

  requestAnimationFrame(render);
}

// Starte die Renderloop (wird jetzt in initShader gestartet)
// requestAnimationFrame(render);

// Funktion zur Überprüfung und Anpassung der Tooltip-Position
function checkTooltipPosition() {
  const tooltips = document.querySelectorAll('[data-tooltip]');
  
  tooltips.forEach(tooltip => {
    const rect = tooltip.getBoundingClientRect();
    const tooltipText = tooltip.getAttribute('data-tooltip');
    const tempTooltip = document.createElement('div');
    tempTooltip.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: normal;
      max-width: 250px;
      padding: 8px 12px;
      font-size: 0.875rem;
    `;
    tempTooltip.textContent = tooltipText;
    document.body.appendChild(tempTooltip);
    
    const tooltipWidth = tempTooltip.offsetWidth;
    document.body.removeChild(tempTooltip);
    
    // Wenn der Tooltip am rechten Rand aus dem Bildschirm laufen würde
    if (rect.left + tooltipWidth > window.innerWidth) {
      tooltip.classList.add('auto-position');
    } else {
      tooltip.classList.remove('auto-position');
    }
  });
}

// Event Listener für Tooltip-Positionierung
window.addEventListener('resize', debounce(checkTooltipPosition, 250));
document.addEventListener('DOMContentLoaded', checkTooltipPosition);

// Event Listener für Elemente mit Tooltips
elementsWithTooltips.forEach(element => {
  element.addEventListener("mouseover", () => {
    // Entferne die Klasse von allen anderen Elementen
    elementsWithTooltips.forEach(el => el.classList.remove("tooltip-active"));
    // Füge die Klasse zum aktuellen Element hinzu
    element.classList.add("tooltip-active");
    // Überprüfe die Position
    checkTooltipPosition();
  });

  element.addEventListener("mouseout", () => {
    // Entferne die Klasse nach einer kurzen Verzögerung
    setTimeout(() => {
      if (!element.matches(':hover')) {
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
  updateBrightness(defaultSettings.BRIGHTNESS);
  updateSaturation(defaultSettings.SATURATION);

  // Optional: Setze Farbpreset auf Standard zurück
  const originalPresetButton = document.querySelector(".preset-button[data-preset='original']");
  if (originalPresetButton) {
    originalPresetButton.click();
  }

  // Setze Farben invertieren Umschalter zurück
  invertToggle.checked = false;
  shaderParams.INVERT_COLORS = 0.0;

  // Setze Low FPS Modus Umschalter zurück
  lowFPSToggle.checked = false;
  performanceMode.lowFPS = false;

  // Setze Renderauflösung auf Standard (Automatisch) zurück
  const autoResolutionButton = document.querySelector('.resolution-button[data-resolution="auto"]');
  if (autoResolutionButton) {
    autoResolutionButton.click(); // Simuliere Klick auf 'Automatisch' Button
  }
});

// Funktion zur Initialisierung der Event-Listener
function initEventListeners() {
  // Event Listener für Reset Button
  resetSettingsButton.addEventListener("click", () => {
    updateSpeed(defaultSettings.SPIN_SPEED);
    updatePixel(defaultSettings.PIXEL_FILTER);
    updateQuality(defaultSettings.QUALITY);
    updateContrast(defaultSettings.CONTRAST);
    updateBrightness(defaultSettings.BRIGHTNESS);
    updateSaturation(defaultSettings.SATURATION);

    // Optional: Setze Farbpreset auf Standard zurück
    const originalPresetButton = document.querySelector(".preset-button[data-preset='original']");
    if (originalPresetButton) {
      originalPresetButton.click();
    }

    // Setze Farben invertieren Umschalter zurück
    invertToggle.checked = false;
    shaderParams.INVERT_COLORS = 0.0;

    // Setze Low FPS Modus Umschalter zurück
    lowFPSToggle.checked = false;
    performanceMode.lowFPS = false;

    // Setze Renderauflösung auf Standard (Automatisch) zurück
    const autoResolutionButton = document.querySelector('.resolution-button[data-resolution="auto"]');
    if (autoResolutionButton) {
      autoResolutionButton.click(); // Simuliere Klick auf 'Automatisch' Button
    }
  });

  // Event Listener für Shader Pause Toggle
  pauseToggle.addEventListener("change", () => {
    performanceMode.shaderPaused = pauseToggle.checked;
  });

  // Event Listener für Farben invertieren Toggle
  invertToggle.addEventListener("change", () => {
    shaderParams.INVERT_COLORS = invertToggle.checked ? 1.0 : 0.0;
  });

  // Event Listener für Low FPS Modus Toggle
  lowFPSToggle.addEventListener("change", () => {
    performanceMode.lowFPS = lowFPSToggle.checked;
  });

  // Event Listener für Zufällig generieren Button
  generateRandomColorsButton.addEventListener("click", () => {
    const randomColors = {
      COLOUR_1: generateRandomColor(),
      COLOUR_2: generateRandomColor(),
      COLOUR_3: generateRandomColor()
    };

    // Aktualisiere shaderParams und starte die Animation
    animateColorChange(randomColors);

    // Aktualisiere die benutzerdefinierten Farbwähler und setze das 'Custom' Preset aktiv
    updateCustomColorPickers(randomColors);
    presetButtons.forEach(btn => btn.classList.remove("active"));
    customPresetButton.classList.add("active");
  });

  // Event Listener für Shader-Typ-Buttons
  shaderTypeButtons.forEach(button => {
    button.addEventListener('click', () => {
      const shaderType = button.getAttribute('data-type');
      if (shaderType && shaders[shaderType]) {
        // Entferne 'active' Klasse von allen Buttons
        shaderTypeButtons.forEach(btn => btn.classList.remove('active'));
        // Füge 'active' Klasse zum geklickten Button hinzu
        button.classList.add('active');
        // Wechsle zum ausgewählten Shader
        currentShader = shaders[shaderType];
        currentUniforms = getUniformLocations(gl, currentShader.program);
        // Aktualisiere Debug-Info
        debugMode.stats.shaderType = shaderType.charAt(0).toUpperCase() + shaderType.slice(1);
      }
    });
  });

  // Event Listener für Debug Toggle
  const debugToggle = document.getElementById('debugToggle');
  const showUniformsToggle = document.getElementById('showUniformsToggle');
  const showGpuDetailsToggle = document.getElementById('showGpuDetailsToggle');
  const debugMenu = document.getElementById('debug-menu');
  const uniformsListElement = document.getElementById('debug-uniforms-list');
  const uniformsSectionTitle = debugMenu ? debugMenu.querySelector('.debug-section-title') : null;
  const gpuDetailsElement = document.getElementById('debug-gpu-details');

  function updateDebugMenuVisibility() {
    const isDebugActive = debugToggle.checked;
    const isUniformsActive = showUniformsToggle.checked;
    const isGpuDetailsActive = showGpuDetailsToggle ? showGpuDetailsToggle.checked : false;
    
    if (debugMenu) {
        // Das gesamte Debug-Menü ist sichtbar, wenn der Haupt-Toggle aktiv ist
        debugMenu.style.display = isDebugActive ? 'block' : 'none';

        // Die Uniforms-Liste und der Titel sind sichtbar, wenn der Haupt-Toggle UND der Uniforms-Toggle aktiv sind
        const showUniforms = isDebugActive && isUniformsActive;

        if (uniformsListElement) {
            uniformsListElement.style.display = showUniforms ? 'grid' : 'none';
        }
        if (uniformsSectionTitle) {
             uniformsSectionTitle.style.display = isDebugActive && isUniformsActive ? 'block' : 'none';
      }

        // Der GPU-Details Bereich ist sichtbar, wenn der Haupt-Toggle UND der GPU-Details-Toggle aktiv sind
        const showGpuDetails = isDebugActive && isGpuDetailsActive;
        if (gpuDetailsElement) {
            gpuDetailsElement.style.display = showGpuDetails ? 'block' : 'none';
        }
    }

     // Stelle sicher, dass updateDebugInfo läuft, wenn debugMode.active ist (steuert die Datenaktualisierung, nicht die UI-Sichtbarkeit)
     // Die Logik hierfür bleibt wie sie ist.
    if (debugMode.active && !debugMode.isUpdating) {
      debugMode.isUpdating = true;
      requestAnimationFrame(function debugRenderLoop(currentTime) {
        if (debugMode.active) {
          updateDebugInfo(currentTime);
          requestAnimationFrame(debugRenderLoop);
        } else {
          debugMode.isUpdating = false; // Loop stoppen, wenn nicht aktiv
        }
      });
    }
  }


  if (debugToggle && debugMenu) {
    debugToggle.addEventListener('change', () => {
      debugMode.active = debugToggle.checked; // Steuert die Datenaktualisierung
      updateDebugMenuVisibility(); // Steuert die UI-Sichtbarkeit
      if (debugMode.active) { // Wenn Debug-Modus aktiv wird, Uniforms sofort aktualisieren
         updateDebugInfo(performance.now());
      }
    });

     // Event Listener für den neuen Uniforms Toggle
    if (showUniformsToggle) {
        showUniformsToggle.addEventListener('change', updateDebugMenuVisibility);
    }

     // Event Listener für den neuen GPU Details Toggle
    if (showGpuDetailsToggle) {
        showGpuDetailsToggle.addEventListener('change', updateDebugMenuVisibility);
    }

    // Initialen Zustand setzen
    debugMode.active = debugToggle.checked; // Steuert die Datenaktualisierung
    updateDebugMenuVisibility(); // Setzt die initiale UI-Sichtbarkeit

    // Stelle sicher, dass updateDebugInfo läuft, wenn debugMode.active ist (steuert die Datenaktualisierung, nicht die UI-Sichtbarkeit)
    // Diese Logik wurde in die updateDebugMenuVisibility Funktion verschoben und angepasst.

  }

  // Event Listener für Renderauflösung Buttons
  const resolutionButtons = document.querySelectorAll(".resolution-button");

  if (resolutionButtons.length > 0) {
    console.log('Resolution Buttons gefunden', resolutionButtons);
    resolutionButtons.forEach(button => {
      button.addEventListener("click", (event) => {
        const value = event.target.dataset.resolution;
        console.log('Resolution Button Clicked', value);
        
        // Entferne 'active' Klasse von allen Buttons
        resolutionButtons.forEach(btn => btn.classList.remove("active"));
        
        // Füge 'active' Klasse zum geklickten Button hinzu
        event.target.classList.add("active");

        updateResolution(value);
      });
    });

    // Initialen Wert setzen - triggere Klick auf den anfänglich aktiven Button (sollte 'auto' sein laut HTML)
    const initialActiveButton = document.querySelector('.resolution-button.active');
    if (initialActiveButton) {
        console.log('Setze initialen Auflösungswert über aktiven Button', initialActiveButton.dataset.resolution);
        initialActiveButton.click(); // Trigger Klick, um updateResolution aufzurufen und Active Class zu setzen
    } else {
        console.warn('Kein initial aktiver Auflösungs-Button gefunden!');
        // Fallback: setze 'auto' als Standard, falls kein Button aktiv ist im HTML
        updateResolution('auto');
    }

  } else {
    console.error('Resolution Buttons NICHT gefunden!');
  }

  // Event Listener für die Effekte Slider (jetzt im Effects Panel)
  pixelSlider.addEventListener("input", () => {
    updatePixel(pixelSlider.value);
    pixelInput.value = pixelSlider.value;
  });
  pixelInput.addEventListener("input", () => {
    const value = Math.min(Math.max(parseFloat(pixelInput.value) || 0, 10), 5000);
    updatePixel(value);
  });

  contrastSlider.addEventListener("input", () => {
    updateContrast(contrastSlider.value);
    contrastInput.value = contrastSlider.value;
  });
  contrastInput.addEventListener("input", () => {
    const value = Math.min(Math.max(parseFloat(contrastInput.value) || 0.5, 0.5), 2.0);
    updateContrast(value);
  });

  brightnessSlider.addEventListener("input", () => {
    updateBrightness(brightnessSlider.value);
    brightnessInput.value = brightnessSlider.value;
  });
  brightnessInput.addEventListener("input", () => {
    const value = Math.min(Math.max(parseFloat(brightnessInput.value) || 0.1, 0.1), 2.0);
    updateBrightness(value);
  });

  saturationSlider.addEventListener("input", () => {
    updateSaturation(saturationSlider.value);
    saturationInput.value = saturationSlider.value;
  });
  saturationInput.addEventListener("input", () => {
    const value = Math.min(Math.max(parseFloat(saturationInput.value) || 0.0, 0.0), 2.0);
    updateSaturation(value);
  });

  // Event Listener für den Geschwindigkeit Slider (jetzt im Effects Panel)
  speedSlider.addEventListener("input", () => {
    updateSpeed(speedSlider.value);
    speedInput.value = speedSlider.value;
  });
  speedInput.addEventListener("input", () => {
    const value = Math.min(Math.max(parseFloat(speedInput.value) || 0, 0), 15);
    updateSpeed(value);
  });

  // Event Listener für den FPS Slider (bleibt im Slider Panel)
  fpsSlider.addEventListener("input", () => {
    updateFPS(fpsSlider.value);
    fpsInput.value = fpsSlider.value;
  });
  fpsInput.addEventListener("input", () => {
    const value = Math.min(Math.max(parseInt(fpsInput.value) || 0, 0), 360);
    updateFPS(value);
  });

  // Event Listener für den Qualität Slider (bleibt im Slider Panel)
  qualitySlider.addEventListener("input", () => {
    updateQuality(qualitySlider.value);
    qualityInput.value = qualitySlider.value;
  });
  qualityInput.addEventListener("input", () => {
    const value = Math.min(Math.max(parseInt(qualityInput.value) || 1, 1), 100);
    updateQuality(value);
  });

  // Event Listener für alle Input-Elemente (Wheel) - jetzt in initEventListeners
  speedInput.addEventListener("wheel", createWheelHandler(speedInput, updateSpeed, 0, 15, parseFloat(speedInput.step)), { passive: true });
  pixelInput.addEventListener("wheel", createWheelHandler(pixelInput, updatePixel, 50, 5000, parseFloat(pixelInput.step)), { passive: true });
  fpsInput.addEventListener("wheel", createWheelHandler(fpsInput, updateFPS, 0, 360, parseInt(fpsInput.step)), { passive: true });
  qualityInput.addEventListener("wheel", createWheelHandler(qualityInput, updateQuality, 1, 100, parseInt(qualityInput.step)), { passive: true });
  contrastInput.addEventListener("wheel", createWheelHandler(contrastInput, updateContrast, 0.5, 2.0, parseFloat(contrastInput.step)), { passive: true });
  brightnessInput.addEventListener("wheel", createWheelHandler(brightnessInput, updateBrightness, 0.1, 2.0, parseFloat(brightnessInput.step)), { passive: true });
  saturationInput.addEventListener("wheel", createWheelHandler(saturationInput, updateSaturation, 0.0, 2.0, parseFloat(saturationInput.step)), { passive: true });

}

// Debug-Menü initialisieren (Diese Funktion wird angepasst)
function initDebugMenu() {
  console.log('Debug-Menü initialisiert.');
  // Die Sichtbarkeit wird jetzt über den Toggle in initEventListeners gesteuert
}

// Debug-Informationen aktualisieren
function updateDebugInfo(currentTime) {
  // Aktualisiere nur alle updateInterval Millisekunden
  if (currentTime - debugMode.lastUpdate < debugMode.updateInterval) {
    return;
  }

  // FPS-Berechnung verbessern
  const timeSinceLastUpdate = currentTime - lastFpsUpdateTime;
  if (timeSinceLastUpdate >= fpsUpdateInterval) {
    // Berechne aktuellen FPS
    const currentFps = (frameCount * 1000) / timeSinceLastUpdate;
    
    // Füge FPS zur Historie hinzu
    fpsHistory.push(currentFps);
    if (fpsHistory.length > fpsHistorySize) {
      fpsHistory.shift();
    }
    
    // Berechne Durchschnitts-FPS
    displayFps = fpsHistory.reduce((sum, fps) => sum + fps, 0) / fpsHistory.length;
    
    // Reset für nächste Messung
    frameCount = 0;
    lastFpsUpdateTime = currentTime;
  }

  // --- Verarbeite GPU-Timer-Abfragen (wenn verfügbar) ---
  if (debugMode.isGpuTimerAvailable) {
      // Prüfe, ob die Ergebnisse der Abfragen noch gültig sind
      debugMode.isGpuTimerDisjoint = gl.getParameter(extTimerQuery.GPU_DISJOINT_EXT);

      // Verarbeite ausstehende Abfragen
      while (debugMode.gpuTimerQueries.length > 0) {
          const query = debugMode.gpuTimerQueries[0];
          if (gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE_EXT)) {
        const timeElapsed = gl.getQueryParameter(query, gl.QUERY_RESULT_EXT);
              gl.deleteQuery(query);
              debugMode.gpuTimerQueries.shift();

              if (!debugMode.isGpuTimerDisjoint) {
                  const gpuTimeMs = timeElapsed / 1000000.0;
                  debugMode.gpuRenderTimes.push(gpuTimeMs);
                  if (debugMode.gpuRenderTimes.length > debugMode.maxGpuRenderTimeSamples) {
                      debugMode.gpuRenderTimes.shift();
                  }
              }
    } else {
              break;
    }
      }

    // Berechne die durchschnittliche GPU-Renderzeit mit gewichtetem Durchschnitt
      let totalGpuTime = 0;
    let totalWeight = 0;
      if (debugMode.gpuRenderTimes.length > 0) {
      debugMode.gpuRenderTimes.forEach((time, index) => {
        const weight = index + 1; // Neuere Werte haben höheres Gewicht
        totalGpuTime += time * weight;
        totalWeight += weight;
      });
      debugMode.stats.averageGpuRenderTime = totalGpuTime / totalWeight;
      } else {
          debugMode.stats.averageGpuRenderTime = 0;
      }

    // Berechne die geschätzte GPU-FPS mit gewichtetem Durchschnitt
      debugMode.stats.estimatedGpuFps = debugMode.stats.averageGpuRenderTime > 0 && !debugMode.isGpuTimerDisjoint ?
      1000 / debugMode.stats.averageGpuRenderTime : 0;
  }

  // --- Berechne und aktualisiere Debug-Statistiken (CPU-seitig) ---
    let totalRenderExecutionTime = 0;
  let totalWeight = 0;
    if (debugMode.renderExecutionTimes.length > 0) {
    debugMode.renderExecutionTimes.forEach((time, index) => {
      const weight = index + 1; // Neuere Werte haben höheres Gewicht
      totalRenderExecutionTime += time * weight;
      totalWeight += weight;
    });
    debugMode.stats.averageRenderExecutionTime = totalRenderExecutionTime / totalWeight;
    } else {
        debugMode.stats.averageRenderExecutionTime = 0;
    }

  // Geschätzte CPU-FPS mit gewichtetem Durchschnitt
  debugMode.stats.estimatedCpuFps = debugMode.stats.averageRenderExecutionTime > 0 ?
    1000 / debugMode.stats.averageRenderExecutionTime : 0;
  
  // Aktualisiere Debug-Statistiken
  debugMode.stats.displayFps = displayFps; // Entferne Math.round für volle Genauigkeit
  debugMode.stats.estimatedCpuFps = Math.round(debugMode.stats.estimatedCpuFps);
  debugMode.stats.averageCpuExecutionTime = Math.round(debugMode.stats.averageRenderExecutionTime * 100) / 100;

  debugMode.stats.drawCalls = 1; // Bleibt bei 1 pro Render-Durchgang
  debugMode.stats.shaderType = currentShader === shaders.standard ? 'Standard' : 'Gemischt';
  debugMode.stats.resolution = {
    width: canvas.width,
    height: canvas.height
  };
  
  // Uniforms aus aktuellem Shader sammeln
  if (currentShader && currentShader.program) {
      debugMode.stats.uniforms = {}; // Zurücksetzen der Uniform-Liste
      const numUniforms = gl.getProgramParameter(currentShader.program, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < numUniforms; ++i) {
          const uniformInfo = gl.getActiveUniform(currentShader.program, i);
          if (uniformInfo) {
              const uniformName = uniformInfo.name;
              const uniformLocation = gl.getUniformLocation(currentShader.program, uniformName);
              
              let uniformValue = gl.getUniform(currentShader.program, uniformLocation);

              let formattedValue;
              // Explizite Formatierung für Farbuniforms
              if (uniformName === 'uColour1' || uniformName === 'uColour2' || uniformName === 'uColour3') {
                  if (uniformValue && uniformValue.length === 4) { // Stelle sicher, dass es ein 4-Element-Array ist
                       formattedValue = `${uniformValue[0].toFixed(2)}, ${uniformValue[1].toFixed(2)}, ${uniformValue[2].toFixed(2)}, ${uniformValue[3].toFixed(2)}`;
                  } else {
                       formattedValue = String(uniformValue); // Fallback, falls unerwartetes Format
                  }
              } else if (Array.isArray(uniformValue)) {
                  // Standardformatierung für andere Array-Uniforms
                  formattedValue = `[${uniformValue.map(v => v.toFixed(2)).join(', ')}]`;
              } else if (typeof uniformValue === 'number') {
                  formattedValue = uniformValue.toFixed(2);
              } else {
                  formattedValue = String(uniformValue);
              }

              // Füge Uniform zur Debug-Liste hinzu
              debugMode.stats.uniforms[uniformName] = formattedValue;
          }
      }
  }
  
  // Reset Update-Zeit
  debugMode.lastUpdate = currentTime;
  
  // UI aktualisieren mit verbesserten Anzeigen
  const elements = {
    fps: document.getElementById('debug-fps'),
    frameTime: document.getElementById('debug-frame-time'),
    drawCalls: document.getElementById('debug-draw-calls'),
    shaderType: document.getElementById('debug-shader-type'),
    resolution: document.getElementById('debug-resolution'),
    renderingMode: document.getElementById('debug-rendering-mode'), // Element jetzt im GPU Details Div
    gpuModel: document.getElementById('debug-gpu-model'),           // Element jetzt im GPU Details Div
    gpuInfo: document.getElementById('debug-gpu-info'),             // Element jetzt im GPU Details Div
    uniformsList: document.getElementById('debug-uniforms-list')
  };

  // Aktualisiere die Werte mit verbesserten Beschriftungen
  if (elements.fps) elements.fps.textContent = `${debugMode.stats.displayFps.toFixed(2)} FPS (Display)`;
  if (elements.frameTime) elements.frameTime.textContent = `${debugMode.stats.averageCpuExecutionTime} ms (CPU)`;
  if (elements.drawCalls) elements.drawCalls.textContent = debugMode.stats.drawCalls;
  if (elements.shaderType) elements.shaderType.textContent = debugMode.stats.shaderType;
  if (elements.resolution) elements.resolution.textContent = `${canvas.width}x${canvas.height}`;

  // Aktualisiere GPU Details Elemente (auch wenn das GPU Details Div unsichtbar ist)
  if (elements.renderingMode) elements.renderingMode.textContent = debugMode.stats.renderingMode;
  if (elements.gpuModel) elements.gpuModel.textContent = debugMode.stats.gpuModel;

  // Verbesserte GPU-Info-Anzeige (bleibt im GPU Details Div)
  if (elements.gpuInfo) {
      if (debugMode.isGpuTimerAvailable) {
          if (!debugMode.isGpuTimerDisjoint) {
        elements.gpuInfo.textContent = `${Math.round(debugMode.stats.estimatedGpuFps)} FPS (GPU)`;
          } else {
        elements.gpuInfo.textContent = 'GPU: Disjoint';
          }
      } else {
      elements.gpuInfo.textContent = 'GPU: N/A';
      }
  }

  // Aktualisiere Uniforms Anzeige
  if (elements.uniformsList) {
      elements.uniformsList.innerHTML = ''; // Liste leeren
      for (const name in debugMode.stats.uniforms) {
          const value = debugMode.stats.uniforms[name];
          const uniformItem = document.createElement('div');
          uniformItem.classList.add('debug-uniform-item');
          uniformItem.innerHTML = `
              <span class="debug-uniform-label">${name}:</span>
              <span class="debug-uniform-value">${value}</span>
          `;
          elements.uniformsList.appendChild(uniformItem);
      }
  }
}

// Initialisiere Shader und Event-Listener beim Laden des DOM
document.addEventListener('DOMContentLoaded', initShader); 

// Funktion zum animierten Einblenden eines Dialogs
function showDialog(dialogElement) {
    if (!dialogElement) return;
    dialogElement.style.display = 'block';
    dialogElement.classList.remove('hide');
}

// Funktion zum animierten Ausblenden eines Dialogs
function hideDialog(dialogElement) {
    if (!dialogElement) return;
    dialogElement.classList.add('hide');
    // Warte auf das Ende der Animation
    setTimeout(() => {
        dialogElement.style.display = 'none';
        dialogElement.classList.remove('hide');
    }, 300); // 300ms entspricht der Animationsdauer
}