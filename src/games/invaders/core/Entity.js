/**
 * Base Entity Class
 * Base class for all game entities (Player, Invaders, Bullets)
 */
export class Entity {
    constructor(x, y, width = 20, height = 20) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.alive = true;
    }
    /**
     * Move entity by delta
     */
    move(dx, dy) {
        this.x += dx;
        this.y += dy;
    }
    /**
     * Kill this entity
     */
    kill() {
        this.alive = false;
    }
    /**
     * Get bounding box for collision detection
     */
    getBounds() {
        return {
            left: this.x,
            right: this.x + this.width,
            top: this.y,
            bottom: this.y + this.height
        };
    }
    /**
     * Update entity (override in subclasses)
     */
    update(deltaTime) {
        // Base implementation does nothing
    }
}
