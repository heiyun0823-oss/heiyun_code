import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { SessionNode, SessionMeta } from "./types.js";

export class Session {
  id: string;
  filePath: string;
  private messages: SessionNode[] = [];

  constructor(sessionDir: string, id?: string) {
    this.id = id ?? crypto.randomUUID();
    this.filePath = path.join(sessionDir, `${this.id}.jsonl`);
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  append(node: Omit<SessionNode, "id" | "timestamp">): void {
    const full: SessionNode = {
      ...node,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    this.messages.push(full);
    const line = JSON.stringify(full) + "\n";
    fs.appendFileSync(this.filePath, line, "utf-8");
  }

  getMessages(): SessionNode[] {
    return this.messages;
  }

  static load(filePath: string): Session {
    const session = new Session(path.dirname(filePath));
    session.filePath = filePath;
    session.id = path.basename(filePath, ".jsonl");
    const content = fs.readFileSync(filePath, "utf-8");
    session.messages = content
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as SessionNode);
    return session;
  }

  static list(sessionDir: string): SessionMeta[] {
    if (!fs.existsSync(sessionDir)) return [];
    const files = fs.readdirSync(sessionDir).filter((f) => f.endsWith(".jsonl"));
    return files.map((f) => {
      const filePath = path.join(sessionDir, f);
      const stat = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, "utf-8");
      const firstLine = content.trim().split("\n")[0];
      let summary = "(empty)";
      try {
        const node = JSON.parse(firstLine) as SessionNode;
        summary = node.content?.slice(0, 80) ?? summary;
      } catch {
        // use default summary
      }
      return {
        id: path.basename(f, ".jsonl"),
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString(),
        summary,
      };
    });
  }
}
