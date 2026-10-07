import db from './db.js';

export default class History {
  private _id: number;
  private _listener_id: number;
  private _key: string;

  constructor({ id, listener_id, key }: IHistory) {
    this._id = id;
    this._listener_id = listener_id;
    this._key = key;
  }

  get id(): number { return this._id; }
  get listener_id(): number { return this._listener_id; }
  get key(): string { return this._key; }

  static async create(listener_id: number, key: string): Promise<boolean> {
    const result = db.prepare(`
      INSERT INTO listener_history (listener_id, key)
      VALUES (?, ?)
      ON CONFLICT(listener_id, key) DO NOTHING
    `).run(listener_id, key);

    return result.changes === 0;
  }
}
