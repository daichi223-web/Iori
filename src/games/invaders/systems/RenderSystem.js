/**
 * RenderSystem
 * Handles all canvas rendering
 */
export class RenderSystem {
    constructor(canvas) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get 2D context');
        }
        this.ctx = ctx;
    }
    /**
     * Render entire game state
     */
    render(engine) {
        // Clear canvas
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        // Render player
        if (engine.player.alive) {
            this.renderPlayer(engine.player);
        }
        // Render invaders
        engine.invaders.forEach(invader => {
            this.renderInvader(invader);
        });
        // Render bullets
        engine.bullets.forEach(bullet => {
            this.renderBullet(bullet);
        });
        // Render UI
        this.renderUI(engine);
        // Render game over / victory
        if (engine.isGameOver()) {
            this.renderGameOver();
        }
        else if (engine.isVictory()) {
            this.renderVictory();
        }
    }
    renderPlayer(player) {
        this.ctx.fillStyle = '#00FF00';
        this.ctx.fillRect(player.x, player.y, player.width, player.height);
    }
    renderInvader(invader) {
        this.ctx.fillStyle = '#FF0000';
        this.ctx.fillRect(invader.x, invader.y, invader.width, invader.height);
    }
    renderBullet(bullet) {
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    }
    renderUI(engine) {
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '20px Arial';
        this.ctx.fillText(`Score: ${engine.score}`, 20, 30);
        this.ctx.fillText(`Lives: ${engine.lives}`, this.canvas.width - 100, 30);
    }
    renderGameOver() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#FF0000';
        this.ctx.font = '48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.font = '24px Arial';
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillText('Press R to Restart', this.canvas.width / 2, this.canvas.height / 2 + 50);
    }
    renderVictory() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#00FF00';
        this.ctx.font = '48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('VICTORY!', this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.font = '24px Arial';
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillText('Press R to Restart', this.canvas.width / 2, this.canvas.height / 2 + 50);
    }
}
