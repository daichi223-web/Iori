/**
 * Tetris Core Game Logic
 * @module tetris-core
 */

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

export type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export type Cell = TetrominoType | null;
export type Board = Cell[][];

export interface Tetromino {
  type: TetrominoType;
  shape: number[][];
  x: number;
  y: number;
}

/** Tetromino shapes definition */
const SHAPES: Record<TetrominoType, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

/** Tetromino colors for UI rendering */
export const COLORS: Record<TetrominoType, string> = {
  I: '#00d4ff',
  O: '#ffd700',
  T: '#9b59b6',
  S: '#2ecc71',
  Z: '#e74c3c',
  J: '#3498db',
  L: '#e67e22',
};

/**
 * Creates an empty game board
 */
export function createBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () =>
    Array.from({ length: BOARD_WIDTH }, () => null)
  );
}

/**
 * Rotates a piece 90 degrees clockwise
 */
export function rotatePiece(shape: number[][]): number[][] {
  const size = shape.length;
  const rotated: number[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 0)
  );

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      rotated[x][size - 1 - y] = shape[y][x];
    }
  }

  return rotated;
}

/**
 * Checks if a piece collides with board boundaries or other blocks
 */
export function checkCollision(board: Board, piece: Tetromino): boolean {
  const { shape, x, y } = piece;

  for (let py = 0; py < shape.length; py++) {
    for (let px = 0; px < shape[py].length; px++) {
      if (shape[py][px]) {
        const newX = x + px;
        const newY = y + py;

        if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) {
          return true;
        }

        if (newY >= 0 && board[newY][newX] !== null) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Clears completed lines and returns new board with lines cleared count
 */
export function clearLines(board: Board): { newBoard: Board; linesCleared: number } {
  const newBoard = board.filter(row => !row.every(cell => cell !== null));
  const linesCleared = BOARD_HEIGHT - newBoard.length;

  while (newBoard.length < BOARD_HEIGHT) {
    newBoard.unshift(Array.from({ length: BOARD_WIDTH }, () => null));
  }

  return { newBoard, linesCleared };
}

/**
 * Merges a piece into the board
 */
export function mergePiece(board: Board, piece: Tetromino): Board {
  const newBoard = board.map(row => [...row]);
  const { shape, x, y, type } = piece;

  for (let py = 0; py < shape.length; py++) {
    for (let px = 0; px < shape[py].length; px++) {
      if (shape[py][px] && y + py >= 0) {
        newBoard[y + py][x + px] = type;
      }
    }
  }

  return newBoard;
}

/**
 * Creates a random tetromino
 */
export function createRandomTetromino(): Tetromino {
  const types: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  const type = types[Math.floor(Math.random() * types.length)];
  const shape = SHAPES[type].map(row => [...row]);

  return {
    type,
    shape,
    x: Math.floor((BOARD_WIDTH - shape[0].length) / 2),
    y: 0,
  };
}

/**
 * Main Tetris Game class
 */
export class TetrisGame {
  private board: Board;
  private currentPiece: Tetromino | null = null;
  private nextPiece: Tetromino | null = null;
  private _score = 0;
  private _level = 1;
  private _linesCleared = 0;
  private _gameOver = false;
  private _isPaused = false;

  constructor() {
    this.board = createBoard();
  }

  get score(): number {
    return this._score;
  }

  get level(): number {
    return this._level;
  }

  get linesCleared(): number {
    return this._linesCleared;
  }

  /** Starts the game */
  start(): void {
    this.board = createBoard();
    this._score = 0;
    this._level = 1;
    this._linesCleared = 0;
    this._gameOver = false;
    this._isPaused = false;
    this.nextPiece = createRandomTetromino();
    this.spawnNewPiece();
  }

  /** Spawns a new piece at the top */
  spawnNewPiece(): void {
    this.currentPiece = this.nextPiece || createRandomTetromino();
    this.nextPiece = createRandomTetromino();

    if (checkCollision(this.board, this.currentPiece)) {
      this._gameOver = true;
    }
  }

  /** Returns current game board */
  getBoard(): Board {
    return this.board;
  }

  /** Sets the board (for testing) */
  setBoard(board: Board): void {
    this.board = board;
  }

  /** Returns current piece */
  getCurrentPiece(): Tetromino | null {
    return this.currentPiece;
  }

  /** Returns next piece */
  getNextPiece(): Tetromino | null {
    return this.nextPiece;
  }

  /** Moves piece left */
  moveLeft(): boolean {
    if (!this.currentPiece || this._gameOver || this._isPaused) return false;

    const newPiece = { ...this.currentPiece, x: this.currentPiece.x - 1 };
    if (!checkCollision(this.board, newPiece)) {
      this.currentPiece = newPiece;
      return true;
    }
    return false;
  }

  /** Moves piece right */
  moveRight(): boolean {
    if (!this.currentPiece || this._gameOver || this._isPaused) return false;

    const newPiece = { ...this.currentPiece, x: this.currentPiece.x + 1 };
    if (!checkCollision(this.board, newPiece)) {
      this.currentPiece = newPiece;
      return true;
    }
    return false;
  }

  /** Moves piece down */
  moveDown(): boolean {
    if (!this.currentPiece || this._gameOver || this._isPaused) return false;

    const newPiece = { ...this.currentPiece, y: this.currentPiece.y + 1 };
    if (!checkCollision(this.board, newPiece)) {
      this.currentPiece = newPiece;
      return true;
    }

    this.lockPiece();
    return false;
  }

  /** Rotates current piece */
  rotate(): boolean {
    if (!this.currentPiece || this._gameOver || this._isPaused) return false;

    const rotatedShape = rotatePiece(this.currentPiece.shape);
    const newPiece = { ...this.currentPiece, shape: rotatedShape };

    if (!checkCollision(this.board, newPiece)) {
      this.currentPiece = newPiece;
      return true;
    }

    // Wall kick attempts
    const kicks = [-1, 1, -2, 2];
    for (const kick of kicks) {
      const kickedPiece = { ...newPiece, x: newPiece.x + kick };
      if (!checkCollision(this.board, kickedPiece)) {
        this.currentPiece = kickedPiece;
        return true;
      }
    }

    return false;
  }

  /** Hard drops piece to the bottom */
  hardDrop(): void {
    if (!this.currentPiece || this._gameOver || this._isPaused) return;

    while (this.moveDown()) {
      this._score += 2;
    }
  }

  /** Locks the current piece and checks for line clears */
  private lockPiece(): void {
    if (!this.currentPiece) return;

    this.board = mergePiece(this.board, this.currentPiece);
    const { newBoard, linesCleared } = clearLines(this.board);
    this.board = newBoard;

    if (linesCleared > 0) {
      this._score += this.calculateScore(linesCleared);
      this.addLinesCleared(linesCleared);
    }

    this.spawnNewPiece();
  }

  /** Calculates score for cleared lines */
  calculateScore(lines: number): number {
    const scores = [0, 100, 300, 500, 800];
    return (scores[lines] || 0) * this._level;
  }

  /** Adds lines to total and updates level */
  addLinesCleared(lines: number): void {
    this._linesCleared += lines;
    this._level = Math.floor(this._linesCleared / 10) + 1;
  }

  /** Returns whether game is over */
  isGameOver(): boolean {
    return this._gameOver;
  }

  /** Returns whether game is paused */
  isPaused(): boolean {
    return this._isPaused;
  }

  /** Toggles pause state */
  togglePause(): void {
    this._isPaused = !this._isPaused;
  }

  /** Gets the drop interval based on level */
  getDropInterval(): number {
    return Math.max(100, 1000 - (this._level - 1) * 100);
  }

  /** Gets ghost piece position (preview of where piece will land) */
  getGhostPiece(): Tetromino | null {
    if (!this.currentPiece) return null;

    const ghost = { ...this.currentPiece };
    while (!checkCollision(this.board, { ...ghost, y: ghost.y + 1 })) {
      ghost.y++;
    }
    return ghost;
  }
}
