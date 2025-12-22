/**
 * Space Invaders - Main Entry Point
 * Iori v3.0 Showcase Game
 */
import { GameEngine } from './core/GameEngine.js';
import { RenderSystem } from './systems/RenderSystem.js';
class Game {
    constructor() {
        this.lastTime = 0;
        this.running = false;
        // Get canvas
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            throw new Error('Canvas not found');
        }
        // Initialize systems
        this.engine = new GameEngine(this.canvas.width, this.canvas.height);
        this.renderer = new RenderSystem(this.canvas);
        // Setup input
        this.setupInput();
        console.log('🎮 Space Invaders Initialized');
        console.log(`   Invaders: ${this.engine.invaders.length}`);
        console.log(`   Lives: ${this.engine.lives}`);
    }
    setupInput() {
        const keys = {};
        window.addEventListener('keydown', (e) => {
            keys[e.code] = true;
            // Handle restart
            if (e.code === 'KeyR' && (this.engine.isGameOver() || this.engine.isVictory())) {
                this.restart();
            }
            // Prevent default for game keys
            if (['ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
                e.preventDefault();
            }
        });
        window.addEventListener('keyup', (e) => {
            keys[e.code] = false;
        });
        // Process held keys
        setInterval(() => {
            if (keys['ArrowLeft']) {
                this.engine.handleInput('ArrowLeft');
            }
            if (keys['ArrowRight']) {
                this.engine.handleInput('ArrowRight');
            }
            if (keys['Space']) {
                this.engine.handleInput('Space');
            }
        }, 16); // Check every frame (60 FPS)
    }
    restart() {
        this.engine = new GameEngine(this.canvas.width, this.canvas.height);
        console.log('🔄 Game Restarted');
    }
    gameLoop(currentTime) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        // Update game state
        this.engine.update(deltaTime);
        // Render
        this.renderer.render(this.engine);
        // Continue loop
        if (this.running) {
            requestAnimationFrame((time) => this.gameLoop(time));
        }
    }
    start() {
        console.log('🚀 Game Started');
        this.running = true;
        this.lastTime = performance.now();
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    stop() {
        this.running = false;
        console.log('⏸️  Game Stopped');
    }
}
// Auto-start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const game = new Game();
        game.start();
    });
}
else {
    const game = new Game();
    game.start();
}
export { Game };
