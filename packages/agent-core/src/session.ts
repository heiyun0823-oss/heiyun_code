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

  /**
   * 获取指定索引范围的消息（不含 end 索引对应的消息）
   */
  getMessageRange(start: number, end: number): SessionNode[] {
    return this.messages.slice(start, end);
  }

  /**
   * 将 [start, end) 范围内的消息替换为一条 summary 消息。
   * 采用原子写入策略：先写临时文件，再 rename 替换原文件。
   */
  replaceRange(
    start: number,
    end: number,
    summaryNode: Omit<SessionNode, "id" | "timestamp">
  ): void {
    // 1. 构建新消息列表
    const summaryFull: SessionNode = {
      ...summaryNode,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    const newMessages = [
      ...this.messages.slice(0, start),
      summaryFull,
      ...this.messages.slice(end),
    ];

    // 2. 写入临时文件
    const tmpPath = this.filePath + ".tmp";
    const lines = newMessages.map((m) => JSON.stringify(m)).join("\n") + "\n";
    fs.writeFileSync(tmpPath, lines, "utf-8");

    // 3. 原子替换
    fs.renameSync(tmpPath, this.filePath);

    // 4. 更新内存
    this.messages = newMessages;
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
