/**
 * Player Entity
 * Player-controlled ship
 */

import { Entity } from './Entity.js';
import { Bullet } from './Bullet.js';

export class Player extends Entity {
  private speed: number = 5;
  private canvasWidth: number = 800;
  private shootCooldown: number = 0;
  private shootCooldownTime: number = 300; // 300ms between shots

  constructor(x: number, y: number, canvasWidth: number = 800) {
    super(x, y, 40, 20);
    this.canvasWidth = canvasWidth;
  }

  /**
   * Move player left
   */
  moveLeft(): void {
    this.x = Math.max(0, this.x - this.speed);
  }

  /**
   * Move player right
   */
  moveRight(): void {
    this.x = Math.min(this.canvasWidth - this.width, this.x + this.speed);
  }

  /**
   * Shoot a bullet
   */
  shoot(): Bullet | null {
    if (this.shootCooldown > 0) {
      return null;
    }

    this.shootCooldown = this.shootCooldownTime;
    return new Bullet(this.x + this.width / 2, this.y);
  }

  /**
   * Update player cooldown
   */
  update(deltaTime: number): void {
    if (this.shootCooldown > 0) {
      this.shootCooldown = Math.max(0, this.shootCooldown - deltaTime);
    }
  }
}
