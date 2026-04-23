export class AudioEngine {
    constructor() {
        // Initialize Audio Context (compatible with older browsers)
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        
        // Create global AnalyserNode
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.8;

        // Create a DynamicsCompressor and a master gain to avoid clipping
        this.compressor = this.ctx.createDynamicsCompressor();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.8; // General volume

        // Connect the audio chain: Analyzer -> Compressor -> Master -> Speakers
        this.analyser.connect(this.compressor);
        this.compressor.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
    }

    /**
     * Ensures the audio context is active (browsers suspend it until interaction)
     */
    async init() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    /**
     * Creates a synthesizer sound based on the sum of oscillators.
     * @param {number} freq - Base frequency in Hz.
     * @param {Object} waveforms - Object with percentages (0 to 1) e.g. {sine: 0.5, sawtooth: 0.2, square: 0.3}
     * @param {number} startTime - Time in AudioContext
     * @param {number} duration - Duration in seconds
     * @param {number} gainMultipler - Multiplier to reduce gain and avoid distortion in chords
     */
    createSynthTone(freq, waveforms, startTime, duration, gainMultipler = 1.0) {
        const toneGain = this.ctx.createGain();
        toneGain.connect(this.analyser);

        // Smooth ADSR envelope to avoid clicks (Attack, Decay, Sustain, Release)
        const attack = 0.2;
        const decay = 0.3;
        const sustain = 0.7;
        const release = 0.5;

        const maxGain = 1.0 * gainMultipler;

        toneGain.gain.setValueAtTime(0, startTime);
        toneGain.gain.linearRampToValueAtTime(maxGain, startTime + attack); // Attack
        toneGain.gain.linearRampToValueAtTime(maxGain * sustain, startTime + attack + decay); // Decay to Sustain
        toneGain.gain.setValueAtTime(maxGain * sustain, Math.max(startTime, startTime + duration - release)); // Sustain
        toneGain.gain.linearRampToValueAtTime(0, startTime + duration); // Release

        // Sum of oscillators according to waveform mix
        for (const [waveType, percentage] of Object.entries(waveforms)) {
            if (percentage > 0) {
                const osc = this.ctx.createOscillator();
                // Web Audio API uses specific names (we adapt "saw" to "sawtooth")
                osc.type = waveType === 'saw' ? 'sawtooth' : waveType;
                osc.frequency.setValueAtTime(freq, startTime);

                const oscGain = this.ctx.createGain();
                oscGain.gain.value = percentage; // Apply the mix percentage (0 to 1)

                osc.connect(oscGain);
                oscGain.connect(toneGain);

                osc.start(startTime);
                osc.stop(startTime + duration);
            }
        }
    }

    /**
     * Plays all frequencies simultaneously (Chord)
     * @param {number[]} frequencies - Array of frequencies (Hz)
     * @param {Object} waveforms - Object with waveform mix
     */
    playChord(frequencies, waveforms) {
        this.init();
        const startTime = this.ctx.currentTime + 0.05;
        const duration = 3.0; // Chord duration

        // Reduce volume based on harmonic count to prevent clipping
        const safeGain = 1.0 / Math.max(1, frequencies.length);

        frequencies.forEach(freq => {
            this.createSynthTone(freq, waveforms, startTime, duration, safeGain);
        });
    }

    /**
     * Plays the frequencies in sequence (Arpeggio)
     * @param {number[]} frequencies - Array of frequencies (Hz)
     * @param {Object} waveforms - Object with waveform mix
     * @param {number} bpm - Beats per minute for speed (default: 120)
     */
    playArpeggio(frequencies, waveforms, bpm = 120) {
        this.init();
        const startTime = this.ctx.currentTime + 0.05;
        
        // Calculate "step" duration based on BPM (e.g. quarter notes)
        const stepDuration = 60 / bpm; 
        const noteDuration = stepDuration * 1.5; // Legato (slight overlap between notes)

        // In arpeggios, notes play one by one, we can use higher general gain
        // but we still limit it a bit if notes overlap.
        const safeGain = 0.5;

        frequencies.forEach((freq, index) => {
            const time = startTime + (index * stepDuration);
            this.createSynthTone(freq, waveforms, time, noteDuration, safeGain);
        });
    }
}

// Global shared instance for the whole app
let globalAudioEngine = null;

/**
 * Returns the single instance of AudioEngine.
 */
export function getAudioEngine() {
    if (!globalAudioEngine) {
        globalAudioEngine = new AudioEngine();
    }
    return globalAudioEngine;
}

/**
 * Directly exports the function to get the reference to the global AnalyserNode.
 * @returns {AnalyserNode}
 */
export function getGlobalAnalyser() {
    return getAudioEngine().analyser;
}
