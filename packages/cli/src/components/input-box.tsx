import React, { useState } from "react";
import { Text, Box } from "ink";
import TextInput from "ink-text-input";

interface InputBoxProps {
  onSubmit: (text: string) => void;
  disabled: boolean;
}

export const InputBox: React.FC<InputBoxProps> = ({
  onSubmit,
  disabled,
}) => {
  const [value, setValue] = useState("");

  const handleSubmit = (text: string) => {
    const trimmed = text.trim();
    if (trimmed) {
      onSubmit(trimmed);
      setValue("");
    }
  };

  return (
    <Box borderStyle="single" borderColor="#0f3460" paddingX={1}>
      <Text color="#50c878">▸ </Text>
      {disabled ? (
        <Text color="#555">处理中...</Text>
      ) : (
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder="输入你的问题..."
        />
      )}
      <Text color="#555">  Ctrl+C 退出</Text>
    </Box>
  );
};
