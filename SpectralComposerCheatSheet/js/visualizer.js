import { getGlobalAnalyser } from './audio.js';

export class SpectralVisualizer {
    /**
     * @param {string} canvasId - El ID del elemento <canvas> (ej. 'spectral-canvas')
     */
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`Canvas ${canvasId} no encontrado.`);
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        this.analyser = getGlobalAnalyser();
        
        // Configurar el buffer para los datos de frecuencia
        this.bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(this.bufferLength);

        this.animationId = null;

        // Ajustar el tamaño del canvas a su contenedor
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    /**
     * Ajusta la resolución interna del canvas para evitar que se vea borroso.
     */
    resizeCanvas() {
        if (!this.canvas) return;
        
        // Obtener el tamaño visual del canvas en CSS
        const rect = this.canvas.parentElement.getBoundingClientRect();
        
        // Excluimos el padding del contenedor visualizer-panel (aprox 40px en total)
        // O más seguro, tomar el cliente width/height del propio elemento si estuviera en bloque.
        // Como el canvas está en un flex contenedor, le damos el tamaño de su padre:
        this.canvas.width = this.canvas.parentElement.clientWidth - 40; 
        this.canvas.height = this.canvas.parentElement.clientHeight - 60; // restamos padding y titulo
    }

    /**
     * Inicia el bucle de animación para el visualizador.
     */
    start() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.draw();
    }

    /**
     * Bucle principal de dibujado
     */
    draw() {
        if (!this.canvas || !this.ctx) return;

        this.animationId = requestAnimationFrame(() => this.draw());

        // Obtener los datos de frecuencia actuales
        this.analyser.getByteFrequencyData(this.dataArray);

        // Limpiar el canvas con un fondo semi-transparente para un efecto de estela leve
        this.ctx.fillStyle = 'rgba(10, 10, 10, 0.4)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Queremos mostrar solo la parte relevante del espectro (ej. hasta 10kHz aprox)
        // La mitad de los bins suele ser suficiente para el espectro musical útil.
        const visibleBins = Math.floor(this.bufferLength * 0.5); 
        const barWidth = (width / visibleBins) * 2.5;
        
        let x = 0;

        for (let i = 0; i < visibleBins; i++) {
            const value = this.dataArray[i];
            const percent = value / 255;
            
            // Altura de la barra
            const barHeight = height * percent;

            // Color reactivo a la intensidad (del morado al blanco brillante)
            // Valor bajo: morado oscuro/azulado
            // Valor alto: magenta/blanco brillante
            const hue = 280 - (percent * 60); // 280 es morado, bajando a ~220 (azul claro/cyan) o podemos subir a magenta (320)
            const saturation = 80 + (percent * 20); // 80% a 100%
            const lightness = 30 + (percent * 50); // 30% a 80%

            this.ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

            // Dibujar desde abajo hacia arriba
            this.ctx.fillRect(x, height - barHeight, barWidth, barHeight);

            x += barWidth + 0.5; // +0.5 para un pequeño espacio entre barras
        }
    }

    /**
     * Detiene la animación.
     */
    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
}
