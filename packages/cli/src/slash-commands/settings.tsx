import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { loadSettings, saveSettings } from "../settings.js";
import { loadConfig } from "../config.js";
import { THEMES, DEFAULT_THEME } from "../theme.js";

interface SettingsPanelProps {
  onClose: () => void;
}

const CATEGORIES = ["模型参数", "主题设置", "路径与日志", "API 连接"] as const;

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [itemIndex, setItemIndex] = useState(0);
  const [temperature, setTemperature] = useState(0.7);
  const [maxRounds, setMaxRounds] = useState(50);
  const [currentTheme, setCurrentTheme] = useState(DEFAULT_THEME);
  const [focusLeft, setFocusLeft] = useState(true);

  useEffect(() => {
    const settings = loadSettings();
    if (settings) {
      if (settings.temperature != null) setTemperature(settings.temperature);
      if (settings.maxRounds != null) setMaxRounds(settings.maxRounds);
      if (settings.theme) setCurrentTheme(settings.theme);
    }
  }, []);

  const saveField = useCallback((key: string, value: number | string) => {
    const settings = loadSettings() ?? {
      providers: {},
      activeProvider: null,
      activeModel: null,
    };
    (settings as any)[key] = value;
    saveSettings(settings);
  }, []);

  useInput((_input, key) => {
    if (key.escape) {
      onClose();
      return;
    }

    if (key.tab) {
      setFocusLeft((prev) => !prev);
      return;
    }

    if (focusLeft) {
      if (key.upArrow) {
        setCategoryIndex((prev) => (prev > 0 ? prev - 1 : CATEGORIES.length - 1));
        setItemIndex(0);
      } else if (key.downArrow) {
        setCategoryIndex((prev) => (prev < CATEGORIES.length - 1 ? prev + 1 : 0));
        setItemIndex(0);
      } else if (key.return || key.rightArrow) {
        setFocusLeft(false);
      }
      return;
    }

    if (key.leftArrow) {
      setFocusLeft(true);
      return;
    }

    if (categoryIndex === 0) {
      if (key.upArrow) {
        setItemIndex((prev) => (prev > 0 ? prev - 1 : 1));
      } else if (key.downArrow) {
        setItemIndex((prev) => (prev < 1 ? prev + 1 : 0));
      } else if (key.leftArrow) {
        if (itemIndex === 0) {
          const next = Math.max(0, +(temperature - 0.1).toFixed(1));
          setTemperature(next);
          saveField("temperature", next);
        } else {
          const next = Math.max(10, maxRounds - 10);
          setMaxRounds(next);
          saveField("maxRounds", next);
        }
      } else if (key.rightArrow) {
        if (itemIndex === 0) {
          const next = Math.min(2, +(temperature + 0.1).toFixed(1));
          setTemperature(next);
          saveField("temperature", next);
        } else {
          const next = Math.min(100, maxRounds + 10);
          setMaxRounds(next);
          saveField("maxRounds", next);
        }
      }
    } else if (categoryIndex === 1) {
      const themeNames = Object.keys(THEMES);
      if (key.upArrow) {
        setItemIndex((prev) => (prev > 0 ? prev - 1 : themeNames.length - 1));
      } else if (key.downArrow) {
        setItemIndex((prev) => (prev < themeNames.length - 1 ? prev + 1 : 0));
      } else if (key.return) {
        const selected = themeNames[itemIndex];
        setCurrentTheme(selected);
        saveField("theme", selected);
      }
    }
  });

  const renderLeftMenu = () => (
    <Box flexDirection="column" width={16} marginRight={1}>
      {CATEGORIES.map((cat, i) => (
        <Text key={cat} color={i === categoryIndex ? "#50c878" : "#888"}>
          {i === categoryIndex ? (focusLeft ? "▸◉ " : " ◉ ") : " ○ "}
          {cat}
        </Text>
      ))}
    </Box>
  );

  const renderRightPane = () => {
    switch (categoryIndex) {
      case 0:
        return (
          <Box flexDirection="column">
            <Text bold color="#e0e0e0">模型参数</Text>
            <Box marginTop={1} flexDirection="column">
              <Text color={itemIndex === 0 ? "#50c878" : "#888"}>
                {itemIndex === 0 ? " → " : "   "}
                temperature: {temperature.toFixed(1)}
                <Text color="#555">  ←→ 调整 (0.0 - 2.0)</Text>
              </Text>
              <Text color={itemIndex === 1 ? "#50c878" : "#888"}>
                {itemIndex === 1 ? " → " : "   "}
                maxRounds: {maxRounds}
                <Text color="#555">  ←→ 调整 (10 - 100)</Text>
              </Text>
            </Box>
          </Box>
        );
      case 1: {
        const themeNames = Object.keys(THEMES);
        return (
          <Box flexDirection="column">
            <Text bold color="#e0e0e0">主题设置</Text>
            <Box marginTop={1} flexDirection="column">
              {themeNames.map((name, i) => (
                <Text key={name} color={i === itemIndex ? "#50c878" : "#888"}>
                  {currentTheme === name ? "◉ " : "○ "}
                  {name}
                  {currentTheme === name ? " (当前)" : ""}
                </Text>
              ))}
            </Box>
            <Box marginTop={1}>
              <Text color="#555">↑↓ 选择  Enter 确认</Text>
            </Box>
          </Box>
        );
      }
      case 2: {
        const config = loadConfig({});
        return (
          <Box flexDirection="column">
            <Text bold color="#e0e0e0">路径与日志</Text>
            <Box marginTop={1} flexDirection="column">
              <Text color="#888">sessionDir: {config.sessionDir}</Text>
              <Text color="#888">workdir: {config.workdir}</Text>
            </Box>
            <Box marginTop={1}>
              <Text color="#555">通过环境变量 HEIYUN_CODE_SESSION_DIR 修改</Text>
            </Box>
          </Box>
        );
      }
      case 3: {
        const settings = loadSettings();
        const provider = settings?.activeProvider ?? "未配置";
        const providerConfig = settings?.providers[provider];
        const apiBase = providerConfig?.apiBase ?? "未配置";
        const apiKey = providerConfig?.apiKey;
        const maskedKey = apiKey ? `${apiKey.slice(0, 3)}***` : "未配置";
        return (
          <Box flexDirection="column">
            <Text bold color="#e0e0e0">API 连接</Text>
            <Box marginTop={1} flexDirection="column">
              <Text color="#888">服务商: {provider}</Text>
              <Text color="#888">地址: {apiBase}</Text>
              <Text color="#888">密钥: {maskedKey}</Text>
            </Box>
            <Box marginTop={1}>
              <Text color="#555">使用 /login 修改 API 配置</Text>
            </Box>
          </Box>
        );
      }
      default:
        return null;
    }
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="#0f3460"
      paddingX={1}
      marginTop={1}
    >
      <Text bold color="#e0e0e0">设置</Text>
      <Box flexDirection="row" marginTop={1}>
        {renderLeftMenu()}
        <Box flexDirection="column" paddingLeft={1} borderStyle="single" borderColor="#333" paddingX={1}>
          {renderRightPane()}
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text color="#555">↑↓ 选择  ←→ 调整值  Tab 切换面板  Esc 返回</Text>
      </Box>
    </Box>
  );
};
