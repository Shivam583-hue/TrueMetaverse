export type CollisionRows = number[][];

export class CollisionGrid {
  readonly cols: number;
  readonly rows: number;

  private blocked: Uint8Array;
  private loaded: Uint8Array;

  constructor(cols: number, rows: number, source?: CollisionRows | null) {
    this.cols = cols;
    this.rows = rows;
    this.blocked = new Uint8Array(cols * rows);
    if (source) {
      for (let y = 0; y < Math.min(rows, source.length); y++) {
        const row = source[y]!;
        for (let x = 0; x < Math.min(cols, row.length); x++) {
          if (row[x] === 1) this.blocked[y * cols + x] = 1;
        }
      }
    }
    this.loaded = this.blocked.slice();
  }

  isBlocked(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return true;
    return this.blocked[y * this.cols + x] === 1;
  }

  setBlocked(x: number, y: number, value: boolean): void {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    this.blocked[y * this.cols + x] = value ? 1 : 0;
  }

  invertAll(): void {
    for (let i = 0; i < this.blocked.length; i++) {
      this.blocked[i] = this.blocked[i] === 1 ? 0 : 1;
    }
  }

  changedSinceLoad(): number {
    let n = 0;
    for (let i = 0; i < this.blocked.length; i++) {
      if (this.blocked[i] !== this.loaded[i]) n++;
    }
    return n;
  }

  toRows(): CollisionRows {
    const rows: CollisionRows = [];
    for (let y = 0; y < this.rows; y++) {
      const row = new Array<number>(this.cols);
      for (let x = 0; x < this.cols; x++)
        row[x] = this.blocked[y * this.cols + x]!;
      rows.push(row);
    }
    return rows;
  }

  static parse(data: unknown): CollisionRows | null {
    if (!Array.isArray(data) || data.length === 0) return null;
    for (const row of data) {
      if (!Array.isArray(row)) return null;
      for (const cell of row) {
        if (cell !== 0 && cell !== 1) return null;
      }
    }
    return data as CollisionRows;
  }
}
