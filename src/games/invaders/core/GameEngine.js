/**
 * GameEngine
 * Main game loop and state management
 */
import { Player } from './Player.js';
import { Invader } from './Invader.js';
export class GameEngine {
    constructor(width, height) {
        this.invaderDirection = 1; // 1 = right, -1 = left
        this.invaderSpeed = 0.5;
        this.invaderMoveTimer = 0;
        this.invaderMoveInterval = 1000; // Move every 1 second
        this.canvasWidth = width;
        this.canvasHeight = height;
        // Initialize player
        this.player = new Player(width / 2 - 20, height - 50, width);
        // Initialize invaders (5 rows × 11 columns)
        this.invaders = [];
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 11; col++) {
                const x = 100 + col * 50;
                const y = 50 + row * 40;
                const type = 3 - Math.floor(row / 2); // Different types by row
                this.invaders.push(new Invader(x, y, type));
            }
        }
        this.bullets = [];
        this.score = 0;
        this.lives = 3;
    }
    /**
     * Handle keyboard input
     */
    handleInput(key) {
        switch (key) {
            case 'ArrowLeft':
                this.player.moveLeft();
                break;
            case 'ArrowRight':
                this.player.moveRight();
                break;
            case 'Space':
                const bullet = this.player.shoot();
                if (bullet) {
                    this.bullets.push(bullet);
                }
                break;
        }
    }
    /**
     * Update game state
     */
    update(deltaTime) {
        // Update player
        this.player.update(deltaTime);
        // Update bullets
        this.bullets.forEach(bullet => bullet.update(deltaTime));
        // Update invader formation movement
        this.updateInvaderFormation(deltaTime);
        // Check collisions
        this.checkCollisions();
        // Remove dead entities
        this.bullets = this.bullets.filter(b => b.alive);
        this.invaders = this.invaders.filter(i => i.alive);
        // Check if invaders reached player
        if (this.invaders.some(inv => inv.y + inv.height >= this.player.y)) {
            this.player.kill();
        }
    }
    /**
     * Update invader formation movement
     */
    updateInvaderFormation(deltaTime) {
        this.invaderMoveTimer += deltaTime;
        if (this.invaderMoveTimer >= this.invaderMoveInterval) {
            this.invaderMoveTimer = 0;
            // Check if any invader hits edge
            const hitEdge = this.invaders.some(inv => {
                if (this.invaderDirection > 0) {
                    return inv.x + inv.width >= this.canvasWidth - 20;
                }
                else {
                    return inv.x <= 20;
                }
            });
            if (hitEdge) {
                // Move down and reverse direction
                this.invaders.forEach(inv => inv.move(0, 20));
                this.invaderDirection *= -1;
            }
            else {
                // Move horizontally
                this.invaders.forEach(inv => inv.move(this.invaderDirection * 10, 0));
            }
        }
    }
    /**
     * Check collisions between bullets and invaders
     */
    checkCollisions() {
        this.bullets.forEach(bullet => {
            if (!bullet.alive)
                return;
            this.invaders.forEach(invader => {
                if (!invader.alive)
                    return;
                if (this.isColliding(bullet, invader)) {
                    bullet.kill();
                    invader.kill();
                    this.score += invader.points;
                }
            });
        });
    }
    /**
     * Check if two entities are colliding (AABB collision)
     */
    isColliding(a, b) {
        return a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y;
    }
    /**
     * Check if game is over
     */
    isGameOver() {
        return !this.player.alive || this.lives <= 0;
    }
    /**
     * Check if player won
     */
    isVictory() {
        return this.invaders.length === 0;
    }
}
