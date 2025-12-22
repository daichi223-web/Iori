/**
 * Invader Entity
 * Enemy invader
 */
import { Entity } from './Entity.js';
export class Invader extends Entity {
    constructor(x, y, type = 1) {
        super(x, y, 30, 20);
        this.points = type * 10; // Different invader types worth different points
    }
    /**
     * Update invader (movement handled by GameEngine formation logic)
     */
    update(deltaTime) {
        // Invaders move as a formation, handled by GameEngine
    }
}
