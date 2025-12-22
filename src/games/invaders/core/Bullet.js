/**
 * Bullet Entity
 * Projectile fired by player
 */
import { Entity } from './Entity.js';
export class Bullet extends Entity {
    constructor(x, y) {
        super(x, y, 4, 12); // Small bullet
        this.speed = 8;
    }
    /**
     * Update bullet position (moves upward)
     */
    update(deltaTime) {
        this.y -= this.speed;
        // Kill bullet if off-screen
        if (this.y < -this.height) {
            this.kill();
        }
    }
}
