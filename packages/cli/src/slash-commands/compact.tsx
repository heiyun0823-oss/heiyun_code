import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import type { ContextManager, CompactPreview } from "@heiyun/agent-core";
import { Session } from "@heiyun/agent-core";

interface CompactPanelProps {
  contextManager: ContextManager;
  onClose: () => void;
}

export const CompactPanel: React.FC<CompactPanelProps> = ({
  contextManager,
  onClose,
}) => {
  const [preview, setPreview] = useState<CompactPreview | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 从 globalThis 获取当前 session
    const currentSession = (globalThis as any).__heiyunSession as Session | undefined;
    if (currentSession) {
      const p = contextManager.getCompactPreview(currentSession);
      setPreview(p);
    }
  }, [contextManager]);

  useInput((_input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    if (key.return) {
      handleConfirm();
    }
  });

  const handleConfirm = async () => {
    setIsCompressing(true);
    setError(null);
    try {
      const currentSession = (globalThis as any).__heiyunSession as Session | undefined;
      if (!currentSession) {
        setError("无法获取当前会话");
        return;
      }
      const summary = await contextManager.compress(currentSession);
      if (summary) {
        setResult(summary);
      } else {
        setError("压缩失败或无内容需要压缩");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCompressing(false);
    }
  };

  if (result) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor="#50c878" paddingX={1} marginY={1}>
        <Text color="#50c878">✓ 上下文压缩完成</Text>
        <Box marginY={1} paddingX={2}>
          <Text color="#888" italic>{result.slice(0, 300)}{result.length > 300 ? "..." : ""}</Text>
        </Box>
        <Text color="#555">按 Esc 返回对话</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor="#e57373" paddingX={1} marginY={1}>
        <Text color="#e57373">✗ {error}</Text>
        <Text color="#555">按 Esc 返回对话</Text>
      </Box>
    );
  }

  if (isCompressing) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor="#f0c040" paddingX={1} marginY={1}>
        <Text color="#f0c040">⏳ 正在压缩上下文...</Text>
      </Box>
    );
  }

  if (!preview) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor="#888" paddingX={1} marginY={1}>
        <Text color="#888">当前上下文无需压缩（所有消息在窗口内）</Text>
        <Text color="#555">按 Esc 返回对话</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="#4fc3f7" paddingX={1} marginY={1}>
      <Box marginBottom={1}>
        <Text bold color="#4fc3f7">上下文压缩预览</Text>
      </Box>
      <Box flexDirection="column" marginY={1}>
        <Text>
          <Text color="#ccc">总消息数: </Text>
          <Text color="#fff">{preview.totalMessages}</Text>
        </Text>
        <Text>
          <Text color="#ccc">待压缩: </Text>
          <Text color="#f0c040">#{preview.compressStart} - #{preview.compressEnd}</Text>
          <Text color="#888"> ({preview.compressEnd - preview.compressStart} 条)</Text>
        </Text>
        <Text>
          <Text color="#ccc">保留: </Text>
          <Text color="#50c878">{preview.retainCount} 条</Text>
        </Text>
        <Text>
          <Text color="#ccc">Token 变化: </Text>
          <Text color="#e57373">{preview.tokenBefore.toLocaleString()}</Text>
          <Text color="#ccc"> → </Text>
          <Text color="#50c878">~{preview.tokenAfter.toLocaleString()}</Text>
        </Text>
        {preview.tokenBefore > 0 && (
          <Text>
            <Text color="#ccc">节省: </Text>
            <Text color="#50c878">
              ~{Math.round((1 - preview.tokenAfter / preview.tokenBefore) * 100)}%
            </Text>
          </Text>
        )}
      </Box>
      <Box marginY={1}>
        <Text color="#fff">按 </Text>
        <Text color="#50c878" bold>Enter</Text>
        <Text color="#fff"> 确认压缩，按 </Text>
        <Text color="#888">Esc</Text>
        <Text color="#fff"> 取消</Text>
      </Box>
    </Box>
  );
};
