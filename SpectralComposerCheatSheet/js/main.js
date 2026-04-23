import { calculateHarmonics, freqToNoteAndCents } from './harmonics.js';
import { SpectralNotation } from './notation.js';
import { getAudioEngine, getGlobalAnalyser } from './audio.js';
import { SpectralVisualizer } from './visualizer.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Notation class (uses global VexFlow loaded via CDN in HTML)
    const notation = new SpectralNotation('notation-canvas-container');
    
    // Initialize the spectral visualizer, but do not start it yet to avoid autoplay issues
    const visualizer = new SpectralVisualizer('spectral-canvas');
    let visualizerStarted = false;

    // Get the global audio engine instance
    const audioEngine = getAudioEngine();

    // References to UI elements
    const freqInput = document.getElementById('freq-input');
    const calcBtn = document.getElementById('calc-harmonic-btn');
    const playChordBtn = document.getElementById('play-chord-btn');
    const playArpBtn = document.getElementById('play-arpeggio-btn');
    
    const instrumentSelect = document.getElementById('instrument-select');
    const sliders = {
        sine: document.getElementById('sine-slider'),
        square: document.getElementById('square-slider'),
        triangle: document.getElementById('triangle-slider'),
        saw: document.getElementById('sawtooth-slider')
    };

    // Local state
    let currentFrequencies = [];

    /**
     * Safely starts the audio context and visualizer loop
     * after the user has interacted with the interface.
     */
    async function initAudioAndVisualizer() {
        await audioEngine.init();
        if (!visualizerStarted) {
            visualizer.start();
            visualizerStarted = true;
        }
    }

    /**
     * Extracts current slider values for the synthesizer mix
     * @returns {Object} Waveform mix (values between 0 and 1)
     */
    function getWaveforms() {
        return {
            sine: parseInt(sliders.sine.value) / 100,
            square: parseInt(sliders.square.value) / 100,
            triangle: parseInt(sliders.triangle.value) / 100,
            saw: parseInt(sliders.saw.value) / 100
        };
    }

    // Updates sliders based on the selected instrument preset
    instrumentSelect.addEventListener('change', (e) => {
        const inst = e.target.value;
        if (inst === 'synth') {
            sliders.sine.value = 100; sliders.square.value = 0; sliders.triangle.value = 0; sliders.saw.value = 0;
        } else if (inst === 'piano') {
            sliders.sine.value = 40; sliders.square.value = 20; sliders.triangle.value = 60; sliders.saw.value = 10;
        } else if (inst === 'flute') {
            sliders.sine.value = 90; sliders.square.value = 0; sliders.triangle.value = 10; sliders.saw.value = 0;
        }
    });

    // Event: Calculate Harmonic Series
    calcBtn.addEventListener('click', async () => {
        // Ensure audio and visualizer start on the first click
        await initAudioAndVisualizer();
        
        const baseFreq = parseFloat(freqInput.value) || 440;
        currentFrequencies = calculateHarmonics(baseFreq);
        
        // Convert frequencies to notes and send them to the staff
        const notationData = currentFrequencies.map(freq => freqToNoteAndCents(freq));
        notation.render(notationData);
    });

    // Event: Play Chord
    playChordBtn.addEventListener('click', async () => {
        await initAudioAndVisualizer();
        
        // If frequencies haven't been generated, generate them before playing
        if (currentFrequencies.length === 0) {
            calcBtn.click();
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        const waveforms = getWaveforms();
        audioEngine.playChord(currentFrequencies, waveforms);
        
        // Trigger pitch detection after a small delay
        setTimeout(detectPitchesFromAudio, 250);
    });

    // Event: Play Arpeggio
    playArpBtn.addEventListener('click', async () => {
        await initAudioAndVisualizer();
        
        if (currentFrequencies.length === 0) {
            calcBtn.click();
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        const waveforms = getWaveforms();
        audioEngine.playArpeggio(currentFrequencies, waveforms, 120);
    });

    /**
     * Pitch Detection: Analyzes the signal and updates the staff
     */
    function detectPitchesFromAudio() {
        const analyser = getGlobalAnalyser();
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);
        analyser.getFloatFrequencyData(dataArray);

        const sampleRate = audioEngine.ctx.sampleRate;
        const binSize = (sampleRate / 2) / bufferLength;

        const peaks = [];
        const threshold = -75;

        for (let i = 1; i < bufferLength - 1; i++) {
            const val = dataArray[i];
            if (val > threshold && val > dataArray[i - 1] && val > dataArray[i + 1]) {
                const alpha = dataArray[i - 1];
                const beta = val;
                const gamma = dataArray[i + 1];
                
                let p = 0;
                const denominator = alpha - 2 * beta + gamma;
                if (denominator !== 0) {
                    p = 0.5 * (alpha - gamma) / denominator;
                }
                
                const exactBin = i + p;
                const freq = exactBin * binSize;
                
                if (freq > 20 && freq < 10000) {
                    peaks.push({ freq: freq, db: val });
                }
            }
        }

        peaks.sort((a, b) => b.db - a.db);
        const topPeaks = peaks.slice(0, 32).sort((a, b) => a.freq - b.freq);

        if (topPeaks.length > 0) {
            const notationData = topPeaks.map(peak => freqToNoteAndCents(peak.freq));
            notation.render(notationData);
        }
    }
});