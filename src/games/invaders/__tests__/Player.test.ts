/**
 * Player Entity Tests
 * Tests for player-controlled entity
 */

import { describe, it, expect } from 'vitest';
import { Player } from '../core/Player.js';

describe('Player', () => {
  it('should create player at bottom center', () => {
    const player = new Player(400, 550);

    expect(player.x).toBe(400);
    expect(player.y).toBe(550);
    expect(player.alive).toBe(true);
  });

  it('should have correct dimensions', () => {
    const player = new Player(400, 550);

    expect(player.width).toBe(40);
    expect(player.height).toBe(20);
  });

  it('should move left', () => {
    const player = new Player(400, 550);

    player.moveLeft();

    expect(player.x).toBe(395); // 5px left
  });

  it('should move right', () => {
    const player = new Player(400, 550);

    player.moveRight();

    expect(player.x).toBe(405); // 5px right
  });

  it('should not move past left boundary', () => {
    const player = new Player(0, 550);

    player.moveLeft();

    expect(player.x).toBe(0); // Stays at boundary
  });

  it('should not move past right boundary', () => {
    const player = new Player(760, 550); // Max x = canvasWidth - playerWidth

    player.moveRight();

    expect(player.x).toBe(760); // Stays at boundary
  });

  it('should shoot bullet', () => {
    const player = new Player(400, 550);

    const bullet = player.shoot();

    expect(bullet).toBeDefined();
    expect(bullet.x).toBe(400 + 20); // Center of player
    expect(bullet.y).toBe(550);
  });

  it('should have cooldown between shots', () => {
    const player = new Player(400, 550);

    player.shoot();
    const secondBullet = player.shoot();

    expect(secondBullet).toBeNull(); // Can't shoot immediately
  });

  it('should reset cooldown after time', () => {
    const player = new Player(400, 550);

    player.shoot();
    player.update(500); // 500ms passed
    const secondBullet = player.shoot();

    expect(secondBullet).toBeDefined(); // Can shoot again
  });
});
