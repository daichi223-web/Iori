/**
 * Invader Entity
 * Enemy invader
 */

import { Entity } from './Entity.js';

export class Invader extends Entity {
  public points: number;

  constructor(x: number, y: number, type: number = 1) {
    super(x, y, 30, 20);
    this.points = type * 10; // Different invader types worth different points
  }

  /**
   * Update invader (movement handled by GameEngine formation logic)
   */
  update(_deltaTime: number): void {
    // Invaders move as a formation, handled by GameEngine
  }
}
