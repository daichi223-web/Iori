/**
 * Bullet Entity
 * Projectile fired by player
 */

import { Entity } from './Entity.js';

export class Bullet extends Entity {
  private speed: number = 8;

  constructor(x: number, y: number) {
    super(x, y, 4, 12); // Small bullet
  }

  /**
   * Update bullet position (moves upward)
   */
  update(_deltaTime: number): void {
    this.y -= this.speed;

    // Kill bullet if off-screen
    if (this.y < -this.height) {
      this.kill();
    }
  }
}
