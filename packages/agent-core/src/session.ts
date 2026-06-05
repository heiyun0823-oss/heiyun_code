/**
 * @heiyun/agent-core — session.ts
 * ==================================
 * Session（会话）类 — 对话数据的持久化和内存管理。
 *
 * 存储格式：JSONL（JSON Lines）
 *   - 每行是一条完整的 JSON 对象
 *   - 不是整个数组，而是逐行追加
 *   - 好处：追加写入简单（appendFileSync），不需要重写整个文件
 *
 * 双重存储：
 *   - 内存中：SessionNode[] 数组（快速读写）
 *   - 磁盘上：.jsonl 文件（持久化，重启后恢复）
 *   每次 append() 同时写入内存和磁盘，保证一致性。
 *
 * UUID（Universally Unique Identifier）：
 *   crypto.randomUUID() 生成全局唯一的随机 ID。
 *   形式如 "550e8400-e29b-41d4-a716-446655440000"。
 *   用于标识每个会话和每条消息，确保不会冲突。
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { SessionNode, SessionMeta } from "./types.js";

/**
 * 会话类
 * 负责管理一次完整对话的所有消息记录。
 */
export class Session {
  id: string;                          // 会话唯一 ID（UUID）
  filePath: string;                    // JSONL 文件存储路径
  private messages: SessionNode[] = []; // 内存中的消息列表（private 外部无法直接访问）

  /**
   * 构造函数
   * @param sessionDir — 会话文件存储目录（如 ~/.heiyun/sessions）
   * @param id — 可选，指定会话 ID（恢复时会用到）；不指定则自动生成
   */
  constructor(sessionDir: string, id?: string) {
    this.id = id ?? crypto.randomUUID();  // ?? 空值合并：id 没有就生成
    this.filePath = path.join(sessionDir, `${this.id}.jsonl`);
    // 确保目录存在（recursive: true 自动创建嵌套目录）
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  /**
   * 追加一条消息
   * 同时写入内存数组和磁盘 JSONL 文件（同步操作，保证数据一致）
   * @param node — 消息内容（自动补充 id 和 timestamp）
   */
  append(node: Omit<SessionNode, "id" | "timestamp">): void {
    // 补充 id 和 timestamp，组装完整节点
    const full: SessionNode = {
      ...node,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),  // ISO 8601 格式的当前时间
    };
    // 写入内存
    this.messages.push(full);
    // 写入磁盘：JSON.stringify 序列化 + 换行符
    const line = JSON.stringify(full) + "\n";
    fs.appendFileSync(this.filePath, line, "utf-8");
  }

  /**
   * 获取所有消息（返回数组引用，调用方不应修改）
   */
  getMessages(): SessionNode[] {
    return this.messages;
  }

  /**
   * 获取指定索引范围的消息（不含 end 索引对应的消息）
   * Array.slice(start, end)：从 start 到 end（不包含 end）
   * 例如：slice(0, 5) 返回索引 0,1,2,3,4
   */
  getMessageRange(start: number, end: number): SessionNode[] {
    return this.messages.slice(start, end);
  }

  /**
   * 将 [start, end) 范围内的消息替换为一条 summary 消息。
   * 用于上下文压缩（Context Compaction）：
   * 当对话历史太长时，把早期消息"浓缩"为摘要，释放 token 空间。
   *
   * 采用原子写入策略：
   *   1. 构建新消息列表（保留 + 替换）
   *   2. 写入临时文件（.tmp）
   *   3. rename 替换原文件（操作系统层级的原子操作，不会出现半写入状态）
   *   4. 更新内存
   *
   * @param start — 要替换的起始索引
   * @param end — 要替换的结束索引（不包含）
   * @param summaryNode — 替换成的摘要节点
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

    // 拼接：start 之前的消息 + 摘要 + end 之后的消息
    const newMessages = [
      ...this.messages.slice(0, start),
      summaryFull,
      ...this.messages.slice(end),
    ];

    // 2. 写入临时文件（避免直接写原文件时发生错误导致数据损坏）
    const tmpPath = this.filePath + ".tmp";
    const lines = newMessages.map((m) => JSON.stringify(m)).join("\n") + "\n";
    fs.writeFileSync(tmpPath, lines, "utf-8");

    // 3. 原子替换：rename 是操作系统级别的原子操作
    fs.renameSync(tmpPath, this.filePath);

    // 4. 更新内存中的消息列表
    this.messages = newMessages;
  }

  /**
   * 从磁盘加载已有会话
   * 静态方法（static）：通过 Session.load(path) 调用，不需要 new Session()
   *
   * 加载流程：
   *   1. 读取 JSONL 文件全部内容
   *   2. 按换行符分割为多行
   *   3. 过滤空行
   *   4. 逐行 JSON.parse 解析
   *   5. 填充到 Session 实例的 messages 数组中
   *
   * @param filePath — .jsonl 文件的完整路径
   * @returns 恢复后的 Session 实例
   */
  static load(filePath: string): Session {
    // 创建一个空的 Session（只为了初始化和设置 filePath）
    const session = new Session(path.dirname(filePath));
    session.filePath = filePath;
    // 从文件名提取 ID（去掉 .jsonl 后缀）
    session.id = path.basename(filePath, ".jsonl");

    // 读取并解析 JSONL
    const content = fs.readFileSync(filePath, "utf-8");
    session.messages = content
      .trim()                            // 去除首尾空白
      .split("\n")                       // 按行分割
      .filter(Boolean)                   // 过滤空行
      .map((line) => JSON.parse(line) as SessionNode); // 每行解析为 JSON

    return session;
  }

  /**
   * 列出所有历史会话（元数据）
   * 静态方法，不需要实例即可调用。
   *
   * @param sessionDir — 会话存储目录
   * @returns 会话元数据数组，按创建时间倒序排列
   */
  static list(sessionDir: string): SessionMeta[] {
    // 目录不存在则返回空数组
    if (!fs.existsSync(sessionDir)) return [];

    // 列出所有 .jsonl 文件
    const files = fs.readdirSync(sessionDir).filter((f) => f.endsWith(".jsonl"));
    return files.map((f) => {
      const filePath = path.join(sessionDir, f);
      const stat = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, "utf-8");
      // 取第一行的前 80 个字符作为摘要
      const firstLine = content.trim().split("\n")[0];
      let summary = "(empty)";
      try {
        const node = JSON.parse(firstLine) as SessionNode;
        // content?.slice(0, 80) 安全截取（如果 content 为 null 则用 "(empty)"）
        summary = node.content?.slice(0, 80) ?? summary;
      } catch {
        // 解析失败，使用默认摘要
      }
      return {
        id: path.basename(f, ".jsonl"),
        createdAt: stat.birthtime.toISOString(),   // birthtime = 文件创建时间
        updatedAt: stat.mtime.toISOString(),         // mtime = 最后修改时间
        summary,
      };
    });
  }
}
