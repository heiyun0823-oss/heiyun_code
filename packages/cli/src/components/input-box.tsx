import React, { useState } from "react";
import { Text, Box, useInput } from "ink";
import TextInput from "ink-text-input";

interface SlashCommand {
  name: string;
  description: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  { name: "/login", description: "配置 API 登录" },
  { name: "/model", description: "选择模型" },
  { name: "/new", description: "开启新对话" },
  { name: "/resume", description: "恢复历史对话" },
  { name: "/compact", description: "压缩上下文" },
];

interface InputBoxProps {
  onSubmit: (text: string) => void;
  disabled: boolean;
}

export const InputBox = React.memo<InputBoxProps>(({
  onSubmit,
  disabled,
}) => {
  const [value, setValue] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const matchingCommands = value.startsWith("/")
    ? SLASH_COMMANDS.filter((cmd) => cmd.name.startsWith(value))
    : [];

  const showSuggestions = matchingCommands.length > 0;

  useInput((_input, key) => {
    if (key.escape) {
      setValue("");
      setSelectedIndex(0);
      return;
    }
    if (!showSuggestions) return;
    if (key.downArrow) {
      setSelectedIndex((i) =>
        Math.min(i + 1, matchingCommands.length - 1)
      );
    }
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(i - 1, 0));
    }
    if (key.tab && matchingCommands.length > 0) {
      setValue(matchingCommands[selectedIndex].name + " ");
      setSelectedIndex(0);
    }
  });

  const handleSubmit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (showSuggestions) {
      onSubmit(matchingCommands[selectedIndex].name);
    } else {
      onSubmit(trimmed);
    }
    setValue("");
    setSelectedIndex(0);
  };

  const handleChange = (newValue: string) => {
    setValue(newValue);
    setSelectedIndex(0);
  };

  return (
    <Box flexDirection="column">
      {showSuggestions && (
        <Box flexDirection="column" marginBottom={1}>
          {matchingCommands.map((cmd, i) => (
            <Box key={cmd.name}>
              <Text color={i === selectedIndex ? "#50c878" : "#888"}>
                {i === selectedIndex ? "▸ " : "  "}
                {cmd.name}
              </Text>
              <Text color="#555"> — {cmd.description}</Text>
            </Box>
          ))}
        </Box>
      )}
      <Box borderStyle="single" borderColor="#0f3460" paddingX={1}>
        <Text color="#50c878">▸ </Text>
        {disabled ? (
          <Text color="#555">处理中...</Text>
        ) : (
          <TextInput
            value={value}
            onChange={handleChange}
            onSubmit={handleSubmit}
            placeholder="输入你的问题...  输入 / 查看命令"
          />
        )}
        <Text color="#555">  Ctrl+C 退出</Text>
      </Box>
    </Box>
  );
});
