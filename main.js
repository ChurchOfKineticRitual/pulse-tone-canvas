
// Audio context and components
let oscillator, metronome, masterVolume, audioAnalyser;
let tickFlag = false;
let isPlaying = false;
let p5Instance;
let waveform;
let shouldShowPermissionOverlay = false;
let visualizationMode = 'basic'; // Default visualization mode
let oscillationPhase = 0; // For animated visualizations

// DOM elements
const startStopButton = document.getElementById('start-stop');
const freqInput = document.getElementById('freq-input');
const freqSlider = document.getElementById('freq-slider');
const tempoInput = document.getElementById('tempo-input');
const tempoSlider = document.getElementById('tempo-slider');
const volSlider = document.getElementById('vol-slider');
const audioPermissionOverlay = document.getElementById('audio-permission-overlay');
const enableAudioButton = document.getElementById('enable-audio');
const vizButtons = document.querySelectorAll('.viz-option');

// Constants
const FADE_TIME = 0.5; // 500ms
const MIN_FREQ = 20;
const MAX_FREQ = 20000;
const MIN_BPM = 20;
const MAX_BPM = 300;
const DEFAULT_FREQ = 440;
const DEFAULT_BPM = 120;
const PARAM_SMOOTHING_TIME = 0.05; // 50ms

// Initialize values
let currentFrequency = DEFAULT_FREQ;
let currentTempo = DEFAULT_BPM;
let currentVolume = -20; // dB

// Input validation helpers
function clampFrequency(value) {
  return Math.max(MIN_FREQ, Math.min(MAX_FREQ, Number(value) || DEFAULT_FREQ));
}

function clampTempo(value) {
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Number(value) || DEFAULT_BPM));
}

// Update functions
function updateFrequency() {
  const sourceValue = this === freqSlider ? freqSlider.value : freqInput.value;
  currentFrequency = clampFrequency(sourceValue);
  
  // Update both controls to show the same value
  freqInput.value = currentFrequency;
  freqSlider.value = Math.min(freqSlider.max, currentFrequency);
  
  if (oscillator) {
    oscillator.frequency.rampTo(currentFrequency, PARAM_SMOOTHING_TIME);
  }
}

function updateTempo() {
  const sourceValue = this === tempoSlider ? tempoSlider.value : tempoInput.value;
  currentTempo = clampTempo(sourceValue);
  
  // Update both controls to show the same value
  tempoInput.value = currentTempo;
  tempoSlider.value = currentTempo;
  
  if (Tone.Transport.state === 'started') {
    Tone.Transport.bpm.rampTo(currentTempo, PARAM_SMOOTHING_TIME);
  }
}

function updateVolume() {
  currentVolume = Number(volSlider.value);
  
  if (masterVolume) {
    // Only update immediately if we're currently playing
    if (isPlaying) {
      masterVolume.volume.rampTo(currentVolume, PARAM_SMOOTHING_TIME);
    }
  }
}

function setVisualizationMode(mode) {
  visualizationMode = mode;
  
  // Update button states
  vizButtons.forEach(button => {
    if (button.dataset.mode === mode) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  });
}

// Setup p5.js sketch for the waveform visualization
function setupP5() {
  // Define the sketch
  const sketch = (p) => {
    p.setup = () => {
      const container = document.getElementById('wave-display');
      const canvas = p.createCanvas(container.offsetWidth, container.offsetHeight);
      canvas.parent('wave-display');
      
      p.strokeWeight(2);
      p.noFill();
      
      // Create the waveform analyzer
      waveform = new Tone.Waveform(1024);
      if (oscillator) {
        oscillator.connect(waveform);
      }
    };

    p.draw = () => {
      p.background(0);
      
      // Draw grid lines for retro-futuristic look
      drawGrid(p);
      
      // Draw the waveform if we're playing
      if (isPlaying && waveform) {
        const buffer = waveform.getValue();
        
        // Set the appropriate stroke color based on the tick flag
        if (tickFlag) {
          p.stroke(207, 210, 255); // #cfd2ff - brighter for pulse
          p.strokeWeight(4);
          tickFlag = false; // Reset the flag for next frame
        } else {
          p.stroke(150, 150, 200); // Slightly dimmer when not on pulse
          p.strokeWeight(2);
        }
        
        switch (visualizationMode) {
          case 'basic':
            drawBasicWaveform(p, buffer);
            break;
          case 'mirror':
            drawMirroredWaveform(p, buffer);
            break;
          case 'circle':
            drawCircularWaveform(p, buffer);
            break;
          default:
            drawBasicWaveform(p, buffer);
        }
      }
      
      // Update the phase for animations
      oscillationPhase += 0.02;
      if (oscillationPhase > p.TWO_PI) {
        oscillationPhase -= p.TWO_PI;
      }
    };

    p.windowResized = () => {
      const container = document.getElementById('wave-display');
      p.resizeCanvas(container.offsetWidth, container.offsetHeight);
    };
  };
  
  // Create the p5 instance
  p5Instance = new p5(sketch);
}

// Grid drawing for retro-futuristic look
function drawGrid(p) {
  p.stroke(30, 30, 50);
  p.strokeWeight(1);
  
  // Draw horizontal lines
  const hSpacing = p.height / 10;
  for (let y = 0; y < p.height; y += hSpacing) {
    p.line(0, y, p.width, y);
  }
  
  // Draw vertical lines
  const vSpacing = p.width / 20;
  for (let x = 0; x < p.width; x += vSpacing) {
    p.line(x, 0, x, p.height);
  }
}

// Visualization drawing functions
function drawBasicWaveform(p, buffer) {
  p.beginShape();
  for (let i = 0; i < buffer.length; i++) {
    const x = p.map(i, 0, buffer.length - 1, 0, p.width);
    const y = p.map(buffer[i], -1, 1, 0, p.height);
    p.vertex(x, y);
  }
  p.endShape();
  
  // Draw a secondary line with glow effect
  p.stroke(150, 150, 200, 50);
  p.strokeWeight(6);
  p.beginShape();
  for (let i = 0; i < buffer.length; i += 4) {
    const x = p.map(i, 0, buffer.length - 1, 0, p.width);
    const y = p.map(buffer[i], -1, 1, 0, p.height);
    p.vertex(x, y);
  }
  p.endShape();
}

function drawMirroredWaveform(p, buffer) {
  const midHeight = p.height / 2;
  
  // Add subtle movement to the wave
  const time = p.millis() * 0.001;
  
  // Draw in the top half
  p.beginShape();
  for (let i = 0; i < buffer.length; i++) {
    const x = p.map(i, 0, buffer.length - 1, 0, p.width);
    
    // Add a subtle sine wave modulation
    const modulation = p.sin(i * 0.01 + time) * 10;
    
    const y = p.map(buffer[i], -1, 1, 0, midHeight) + modulation;
    p.vertex(x, y);
  }
  p.endShape();
  
  // Draw mirrored in the bottom half
  p.beginShape();
  for (let i = 0; i < buffer.length; i++) {
    const x = p.map(i, 0, buffer.length - 1, 0, p.width);
    
    // Mirror the modulation as well
    const modulation = p.sin(i * 0.01 + time) * -10;
    
    const y = p.map(buffer[i] * -1, -1, 1, midHeight, p.height) + modulation;
    p.vertex(x, y);
  }
  p.endShape();
  
  // Draw center line
  p.strokeWeight(1);
  p.stroke(245, 231, 122, 100);
  p.line(0, midHeight, p.width, midHeight);
}

function drawCircularWaveform(p, buffer) {
  const centerX = p.width / 2;
  const centerY = p.height / 2;
  const baseRadius = Math.min(p.width, p.height) / 3;
  
  // Draw outer circle reference
  p.stroke(30, 30, 60);
  p.strokeWeight(1);
  p.ellipse(centerX, centerY, baseRadius * 2);
  
  p.push();
  p.translate(centerX, centerY);
  
  // Draw spinning arcs in the background
  const arcCount = 3;
  for (let i = 0; i < arcCount; i++) {
    const arcPhase = oscillationPhase + (i * p.TWO_PI / arcCount);
    p.stroke(150, 150, 200, 40);
    p.strokeWeight(2);
    p.arc(0, 0, baseRadius * 2.2, baseRadius * 2.2, 
          arcPhase, arcPhase + p.PI / 2);
  }
  
  // Draw the waveform
  p.stroke(150, 150, 200);
  p.strokeWeight(2);
  p.beginShape();
  
  for (let i = 0; i < buffer.length; i += 2) {
    const angle = p.map(i, 0, buffer.length, 0, p.TWO_PI);
    // Animate the radius with the oscillation phase
    const pulseFactor = 1 + 0.1 * p.sin(oscillationPhase * 3);
    const r = baseRadius + (buffer[i] * baseRadius * 0.5 * pulseFactor);
    const x = r * p.cos(angle);
    const y = r * p.sin(angle);
    p.vertex(x, y);
  }
  
  p.endShape(p.CLOSE);
  
  // Add some particle-like effects
  for (let i = 0; i < 8; i++) {
    const particleAngle = oscillationPhase + (i * p.TWO_PI / 8);
    const particleRadius = baseRadius * 1.2;
    const px = particleRadius * p.cos(particleAngle);
    const py = particleRadius * p.sin(particleAngle);
    
    p.stroke(245, 231, 122, 150);
    p.strokeWeight(3);
    p.point(px, py);
    
    // Small glow effect
    p.stroke(245, 231, 122, 50);
    p.strokeWeight(8);
    p.point(px, py);
  }
  
  p.pop();
}

// Audio setup and control
async function setupAudio() {
  try {
    // Create master volume node
    masterVolume = new Tone.Volume(-Infinity).toDestination();
    
    // Create oscillator and connect to master
    oscillator = new Tone.Oscillator({
      type: "sine",
      frequency: currentFrequency
    }).connect(masterVolume);
    
    // Create metronome synth
    metronome = new Tone.MembraneSynth({
      envelope: {
        attack: 0.001,
        decay: 0.1,
        sustain: 0,
        release: 0.1
      }
    }).connect(masterVolume);

    // Create analyzer for the waveform
    waveform = new Tone.Waveform(1024);
    oscillator.connect(waveform);
    
    // Schedule the metronome to play on quarter notes
    Tone.Transport.scheduleRepeat((time) => {
      metronome.triggerAttackRelease("C2", "16n", time);
      tickFlag = true; // Set the flag for the visual pulse
    }, "4n");
    
    // Set initial BPM
    Tone.Transport.bpm.value = currentTempo;
    
    await Tone.start();
    console.log("Audio context started successfully");
    
    // Hide the overlay if it was shown
    audioPermissionOverlay.classList.add('hidden');
    return true;
  } catch (error) {
    console.error("Failed to start audio context:", error);
    shouldShowPermissionOverlay = true;
    audioPermissionOverlay.classList.remove('hidden');
    return false;
  }
}

// Start and stop audio playback
async function startAudio() {
  if (!oscillator) {
    const success = await setupAudio();
    if (!success) return;
  }

  isPlaying = true;
  startStopButton.textContent = "STOP";
  
  // Start oscillator if it's not already running
  if (oscillator.state !== "started") {
    oscillator.start();
  }
  
  // Fade in the volume
  masterVolume.volume.value = -Infinity;
  masterVolume.volume.rampTo(currentVolume, FADE_TIME);
  
  // Start transport for metronome
  Tone.Transport.start();
}

function stopAudio() {
  isPlaying = false;
  startStopButton.textContent = "START";
  
  // Fade out the volume
  masterVolume.volume.rampTo(-Infinity, FADE_TIME);
  
  // Stop the transport after fade out
  setTimeout(() => {
    if (!isPlaying) {  // Check we haven't started again
      Tone.Transport.stop();
    }
  }, FADE_TIME * 1000);
}

// Event listeners
startStopButton.addEventListener('click', () => {
  if (isPlaying) {
    stopAudio();
  } else {
    startAudio();
  }
});

freqInput.addEventListener('input', updateFrequency);
freqInput.addEventListener('blur', () => {
  freqInput.value = currentFrequency; // Reset to valid value on blur
});
freqSlider.addEventListener('input', updateFrequency);

tempoInput.addEventListener('input', updateTempo);
tempoInput.addEventListener('blur', () => {
  tempoInput.value = currentTempo; // Reset to valid value on blur
});
tempoSlider.addEventListener('input', updateTempo);

volSlider.addEventListener('input', updateVolume);

// Visualization mode buttons
vizButtons.forEach(button => {
  button.addEventListener('click', () => {
    setVisualizationMode(button.dataset.mode);
  });
});

enableAudioButton.addEventListener('click', async () => {
  const success = await setupAudio();
  if (success) {
    audioPermissionOverlay.classList.add('hidden');
  }
});

// Handle autoplay policy
document.addEventListener('click', async () => {
  if (shouldShowPermissionOverlay) {
    const success = await setupAudio();
    if (success) {
      shouldShowPermissionOverlay = false;
    }
  }
}, { once: true });

// Initialize everything
window.addEventListener('load', () => {
  // Set initial UI values
  freqInput.value = currentFrequency;
  freqSlider.value = Math.min(freqSlider.max, currentFrequency);
  tempoInput.value = currentTempo;
  tempoSlider.value = currentTempo;
  volSlider.value = currentVolume;
  
  // Setup the visualizer
  setupP5();
  
  // Try to initialize audio (might be blocked by browser policy)
  Tone.start().catch(() => {
    console.log("Audio start blocked by browser. Will require user interaction.");
    shouldShowPermissionOverlay = true;
    audioPermissionOverlay.classList.remove('hidden');
  });
});
