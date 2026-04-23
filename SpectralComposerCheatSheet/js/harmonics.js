/**
 * Calculates the first 32 harmonics of a base frequency.
 * @param {number} baseFreq - Fundamental frequency in Hz.
 * @returns {number[]} Array with the frequencies of the 32 harmonics.
 */
export function calculateHarmonics(baseFreq) {
    const harmonics = [];
    for (let i = 1; i <= 32; i++) {
        harmonics.push(baseFreq * i);
    }
    return harmonics;
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/**
 * Converts a frequency to the nearest musical note and its deviation in cents.
 * @param {number} freq - Frequency in Hz.
 * @returns {Object} Object with the note (e.g. "A4"), cents deviation, and nearest note frequency.
 */
export function freqToNoteAndCents(freq) {
    if (freq <= 0) return { note: "-", cents: 0, nearestFreq: 0 };

    // Calculate the MIDI note number (A4 = 440Hz, note 69)
    const midiFloat = 12 * Math.log2(freq / 440) + 69;
    const midiNote = Math.round(midiFloat);
    
    // Get note index (0-11) and octave
    const noteIndex = (midiNote % 12 + 12) % 12; // Prevent negative indices
    const octave = Math.floor(midiNote / 12) - 1;
    const noteName = `${NOTE_NAMES[noteIndex]}${octave}`;
    
    // Calculate the exact frequency of the rounded MIDI note in equal temperament
    const nearestFreq = 440 * Math.pow(2, (midiNote - 69) / 12);
    
    // Calculate deviation in cents (1200 cents per octave)
    const cents = 1200 * Math.log2(freq / nearestFreq);
    
    return {
        note: noteName,
        cents: Math.round(cents * 100) / 100, // Round to 2 decimals
        nearestFreq: nearestFreq
    };
}
