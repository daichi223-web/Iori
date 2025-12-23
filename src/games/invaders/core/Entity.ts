/**
 * Base Entity Class
 * Base class for all game entities (Player, Invaders, Bullets)
 */

export interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export class Entity {
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public alive: boolean;

  constructor(x: number, y: number, width: number = 20, height: number = 20) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.alive = true;
  }

  /**
   * Move entity by delta
   */
  move(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }

  /**
   * Kill this entity
   */
  kill(): void {
    this.alive = false;
  }

  /**
   * Get bounding box for collision detection
   */
  getBounds(): Bounds {
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
  update(_deltaTime: number): void {
    // Base implementation does nothing
  }
}
