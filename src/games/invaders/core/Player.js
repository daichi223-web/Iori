/**
 * Player Entity
 * Player-controlled ship
 */
import { Entity } from './Entity.js';
import { Bullet } from './Bullet.js';
export class Player extends Entity {
    constructor(x, y, canvasWidth = 800) {
        super(x, y, 40, 20);
        this.speed = 5;
        this.canvasWidth = 800;
        this.shootCooldown = 0;
        this.shootCooldownTime = 300; // 300ms between shots
        this.canvasWidth = canvasWidth;
    }
    /**
     * Move player left
     */
    moveLeft() {
        this.x = Math.max(0, this.x - this.speed);
    }
    /**
     * Move player right
     */
    moveRight() {
        this.x = Math.min(this.canvasWidth - this.width, this.x + this.speed);
    }
    /**
     * Shoot a bullet
     */
    shoot() {
        if (this.shootCooldown > 0) {
            return null;
        }
        this.shootCooldown = this.shootCooldownTime;
        return new Bullet(this.x + this.width / 2, this.y);
    }
    /**
     * Update player cooldown
     */
    update(deltaTime) {
        if (this.shootCooldown > 0) {
            this.shootCooldown = Math.max(0, this.shootCooldown - deltaTime);
        }
    }
}
