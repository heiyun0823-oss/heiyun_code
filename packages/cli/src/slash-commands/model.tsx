import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { loadSettings, saveSettings, fetchModels } from "../settings.js";
import type { ModelInfo } from "../settings.js";

interface ModelPanelProps {
  onClose: (selectedModel?: string) => void;
}

type ModelPhase = "loading" | "no-login" | "list" | "error";

export const ModelPanel: React.FC<ModelPanelProps> = ({ onClose }) => {
  const [phase, setPhase] = useState<ModelPhase>("loading");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadModels();
  }, []);

  async function loadModels() {
    const settings = loadSettings();

    if (!settings || !settings.activeProvider) {
      setPhase("no-login");
      return;
    }

    const providerConfig = settings.providers[settings.activeProvider];
    if (!providerConfig || !providerConfig.apiKey) {
      setPhase("no-login");
      return;
    }

    try {
      const fetchedModels = await fetchModels(
        providerConfig.apiBase,
        providerConfig.apiKey,
        settings.activeProvider
      );

      if (fetchedModels.length === 0) {
        setPhase("error");
        setErrorMessage("未找到可用模型");
        return;
      }

      setModels(fetchedModels);

      // 默认选中当前 active 的模型
      if (settings.activeModel) {
        const idx = fetchedModels.findIndex((m) => m.id === settings.activeModel);
        if (idx >= 0) setSelectedIndex(idx);
      }

      setPhase("list");
    } catch (err) {
      setPhase("error");
      const isInvalidKey =
        (err instanceof Error && (err as any).code === "INVALID_API_KEY") ||
        (err instanceof Error && err.message === "INVALID_API_KEY") ||
        (err instanceof Error && err.message.includes("401")) ||
        (err instanceof Error && err.message.includes("403"));

      if (isInvalidKey) {
        setErrorMessage("API Key 无效，请重新 /login 配置");
      } else if (
        (err instanceof Error && err.name === "AbortError") ||
        (err instanceof Error && err.message.includes("abort"))
      ) {
        setErrorMessage("连接超时，请检查网络或 API 地址");
      } else {
        setErrorMessage(err instanceof Error ? err.message : String(err));
      }
    }
  }

  useInput((_input, key) => {
    if (phase === "no-login" || phase === "error") {
      if (key.escape || key.return) {
        onClose();
      }
      return;
    }

    if (phase === "list") {
      if (key.upArrow) {
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : models.length - 1
        );
      } else if (key.downArrow) {
        setSelectedIndex((prev) =>
          prev < models.length - 1 ? prev + 1 : 0
        );
      } else if (key.escape) {
        onClose();
      } else if (key.return) {
        const selected = models[selectedIndex];
        if (!selected) return;

        const settings = loadSettings();
        if (settings) {
          settings.activeModel = selected.id;
          saveSettings(settings);
        }
        onClose(selected.id);
      }
    }
  });

  // 加载中
  if (phase === "loading") {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="#0f3460"
        paddingX={1}
        marginTop={1}
      >
        <Text color="#555">正在获取模型列表...</Text>
      </Box>
    );
  }

  // 未配置 /login
  if (phase === "no-login") {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="#0f3460"
        paddingX={1}
        marginTop={1}
      >
        <Text bold color="#e0e0e0">
          切换模型
        </Text>
        <Box marginY={1}>
          <Text color="#e94560">⚠ 尚未配置服务商</Text>
        </Box>
        <Text color="#555">请先使用 /login 配置 API 连接</Text>
        <Text color="#555">Esc 返回</Text>
      </Box>
    );
  }

  // 错误
  if (phase === "error") {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="#0f3460"
        paddingX={1}
        marginTop={1}
      >
        <Text bold color="#e0e0e0">
          切换模型
        </Text>
        <Box marginY={1}>
          <Text color="#e94560">错误: {errorMessage}</Text>
        </Box>
        <Text color="#555">Esc 返回</Text>
      </Box>
    );
  }

  // 模型列表
  const settings = loadSettings();
  const providerName = settings?.activeProvider ?? "unknown";

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="#0f3460"
      paddingX={1}
      marginTop={1}
    >
      <Text bold color="#e0e0e0">
        切换模型 ({providerName})
      </Text>
      <Box flexDirection="column" marginY={1}>
        {models.map((m, i) => (
          <Text
            key={m.id}
            color={
              i === selectedIndex ? "#50c878" : "#888"
            }
          >
            {i === selectedIndex ? " → " : "   "}
            {m.id}
            <Text color="#555"> ({m.provider})</Text>
          </Text>
        ))}
      </Box>
      <Text color="#555">↑↓ 选择  Enter 确认  Esc 取消</Text>
    </Box>
  );
};
