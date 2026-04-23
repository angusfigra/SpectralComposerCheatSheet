export class SpectralNotation {
    /**
     * @param {string} containerId - The ID of the DOM element (e.g. 'notation-canvas-container')
     */
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        
        if (!this.container) {
            console.error(`Container ${containerId} not found.`);
        }
        
        // Assume VexFlow will be in the global scope (via CDN in HTML)
        this.VF = window.Vex ? window.Vex.Flow : null;
    }

    /**
     * Clears the current SVG/Canvas
     */
    clear() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    /**
     * Converts our note (e.g. "C#4") to the format VexFlow reads (e.g. "c#/4")
     */
    parseNoteToVex(noteName) {
        const match = noteName.match(/^([A-G])(#|b)?(\d+)$/);
        if (!match) return "c/4"; // safe fallback
        const note = match[1].toLowerCase();
        const acc = match[2] || "";
        const oct = match[3];
        return `${note}${acc}/${oct}`;
    }

    /**
     * Renders an array of note objects sequentially on a Grand Staff
     * @param {Array} harmonicsData - Array of objects with {note: "A4", cents: 15}
     */
    render(harmonicsData) {
        if (!this.VF) {
            console.warn("VexFlow is not initialized. Cannot draw notation.");
            return;
        }
        
        this.clear();
        if (!harmonicsData || harmonicsData.length === 0) return;

        // Calculate dynamic width based on the number of harmonics
        // ~60px per note + space for clefs
        const width = Math.max(800, harmonicsData.length * 60 + 100);
        const height = 250;

        // Configure VexFlow SVG renderer
        const renderer = new this.VF.Renderer(this.container, this.VF.Renderer.Backends.SVG);
        renderer.resize(width, height);
        const context = renderer.getContext();

        // Allow horizontal scroll in the container if notes exceed screen width
        this.container.style.overflowX = 'auto';
        this.container.style.overflowY = 'hidden';

        // Create Grand Staff (Treble = High, Bass = Low)
        const topStave = new this.VF.Stave(10, 20, width - 20).addClef('treble');
        const bottomStave = new this.VF.Stave(10, 120, width - 20).addClef('bass');

        // Visual connectors of the grand staff (braces and lines)
        const brace = new this.VF.StaveConnector(topStave, bottomStave).setType(3);
        const lineLeft = new this.VF.StaveConnector(topStave, bottomStave).setType(1);
        const lineRight = new this.VF.StaveConnector(topStave, bottomStave).setType(0);

        // Draw static elements
        topStave.setContext(context).draw();
        bottomStave.setContext(context).draw();
        brace.setContext(context).draw();
        lineLeft.setContext(context).draw();
        lineRight.setContext(context).draw();

        const topNotes = [];
        const bottomNotes = [];

        // Generate notes
        harmonicsData.forEach((data) => {
            const noteStr = data.note;
            const cents = data.cents;
            
            const vexKey = this.parseNoteToVex(noteStr);
            const match = noteStr.match(/\d+/);
            const octave = match ? parseInt(match[0]) : 4;
            
            // Decide which staff the note goes on (C4 and higher to treble)
            const isTreble = octave >= 4;

            // Main note
            const staveNote = new this.VF.StaveNote({
                clef: isTreble ? 'treble' : 'bass',
                keys: [vexKey],
                duration: 'q' // q = quarter note
            });

            // Add accidental if it exists (# or b)
            if (noteStr.includes('#')) {
                // Compatible with VexFlow v3 and v4
                staveNote.addModifier(new this.VF.Accidental('#'), 0);
            } else if (noteStr.includes('b')) {
                staveNote.addModifier(new this.VF.Accidental('b'), 0);
            }

            // Add cents deviation if significant (>= 15 or <= -15)
            if (Math.abs(cents) >= 15) {
                const sign = cents > 0 ? '+' : '';
                const centsText = `${sign}${cents.toFixed(0)}¢`;
                
                const annotation = new this.VF.Annotation(centsText)
                    .setFont("Arial", 10, "bold")
                    .setVerticalJustification(
                        isTreble ? this.VF.Annotation.VerticalJustify.TOP : this.VF.Annotation.VerticalJustify.BOTTOM
                    );
                
                staveNote.addModifier(annotation, 0);
            }

            // Create a "Ghost Note" (invisible note) to vertically synchronize
            // the opposite staff so both voices flow at the same speed.
            const ghostKey = isTreble ? 'c/3' : 'c/5';
            const ghostNote = new this.VF.GhostNote({
                clef: isTreble ? 'bass' : 'treble',
                keys: [ghostKey],
                duration: 'q'
            });

            if (isTreble) {
                topNotes.push(staveNote);
                bottomNotes.push(ghostNote);
            } else {
                bottomNotes.push(staveNote);
                topNotes.push(ghostNote);
            }
        });

        // Format notes and draw
        try {
            // Create voices (SOFT mode to not require exact measures)
            const topVoice = new this.VF.Voice({
                num_beats: harmonicsData.length,
                beat_value: 4
            }).setMode(this.VF.Voice.Mode.SOFT);
            topVoice.addTickables(topNotes);

            const bottomVoice = new this.VF.Voice({
                num_beats: harmonicsData.length,
                beat_value: 4
            }).setMode(this.VF.Voice.Mode.SOFT);
            bottomVoice.addTickables(bottomNotes);

            // Format to available width
            new this.VF.Formatter()
                .joinVoices([topVoice, bottomVoice])
                .format([topVoice, bottomVoice], width - 100);

            // Draw notes
            topVoice.draw(context, topStave);
            bottomVoice.draw(context, bottomStave);
            
        } catch (error) {
            console.error("Error formatting or drawing notes in VexFlow:", error);
        }
    }
}
