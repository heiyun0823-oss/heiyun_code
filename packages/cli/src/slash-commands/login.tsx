import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { PROVIDER_REGISTRY, saveSettings, loadSettings } from "../settings.js";
import type { SettingsData } from "../settings.js";

interface LoginPanelProps {
  onClose: () => void;
}

type LoginPhase = "select-provider" | "input-key" | "saving";

export const LoginPanel: React.FC<LoginPanelProps> = ({ onClose }) => {
  const [phase, setPhase] = useState<LoginPhase>("select-provider");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const selectedProvider = PROVIDER_REGISTRY[selectedIndex];

  // 全局键盘处理
  useInput((_input, key) => {
    if (phase === "select-provider") {
      if (key.upArrow) {
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : PROVIDER_REGISTRY.length - 1
        );
      } else if (key.downArrow) {
        setSelectedIndex((prev) =>
          prev < PROVIDER_REGISTRY.length - 1 ? prev + 1 : 0
        );
      } else if (key.escape) {
        onClose();
      } else if (key.return) {
        setPhase("input-key");
      }
    } else if (phase === "input-key") {
      if (key.escape) {
        onClose();
      }
    }
  });

  // API Key 输入确认
  const handleKeySubmit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setPhase("saving");
    try {
      const existingSettings = loadSettings();
      const providers = existingSettings?.providers ?? {};

      providers[selectedProvider.id] = {
        apiBase: selectedProvider.defaultApiBase,
        apiKey: trimmed,
      };

      const newSettings: SettingsData = {
        ...existingSettings,
        providers,
        activeProvider: selectedProvider.id,
        activeModel:
          existingSettings?.activeProvider === selectedProvider.id
            ? existingSettings.activeModel
            : null,
      };

      saveSettings(newSettings);
      setSaved(true);

      // 短暂显示成功信息后关闭
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("input-key");
    }
  };

  // 保存成功提示
  if (phase === "saving" && saved) {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="green"
        paddingX={1}
        marginTop={1}
      >
        <Text color="green">
          ✓ 已保存 {selectedProvider.name} 配置
        </Text>
        <Text color="#555">模型列表已更新，使用 /model 选择模型</Text>
      </Box>
    );
  }

  // 阶段 1：选择 Provider
  if (phase === "select-provider") {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="#0f3460"
        paddingX={1}
        marginTop={1}
      >
        <Text bold color="#e0e0e0">
          选择模型服务商
        </Text>
        <Box flexDirection="column" marginY={1}>
          {PROVIDER_REGISTRY.map((p, i) => (
            <Text key={p.id} color={i === selectedIndex ? "#50c878" : "#888"}>
              {i === selectedIndex ? " → " : "   "}
              {p.name}
              <Text color="#555">    {p.defaultApiBase}</Text>
            </Text>
          ))}
        </Box>
        <Text color="#555">
          ↑↓ 选择  Enter 确认  Esc 取消
        </Text>
      </Box>
    );
  }

  // 阶段 2：输入 API Key
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="#0f3460"
      paddingX={1}
      marginTop={1}
    >
      <Text bold color="#e0e0e0">
        输入 {selectedProvider.name} API Key
      </Text>
      {selectedProvider.id === "deepseek" && (
        <Text color="#555">
          访问 https://platform.deepseek.com/api_keys 获取
        </Text>
      )}
      <Box marginY={1}>
        <Text color="#50c878">▸ </Text>
        <TextInput
          value={apiKey}
          onChange={setApiKey}
          onSubmit={handleKeySubmit}
          placeholder="输入 API Key..."
        />
      </Box>
      {error && <Text color="#e94560">错误: {error}</Text>}
      <Text color="#555">Enter 确认  Esc 取消</Text>
    </Box>
  );
};
