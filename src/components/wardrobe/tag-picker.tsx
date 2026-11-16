"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TagOption = { id: string; name: string; useCount: number };

type Props = {
  value: string[];
  onChange: (tags: string[]) => void;
  max?: number;
};

const PRESET_TAGS = ["通勤", "休闲", "约会", "运动", "度假", "复古"];
const MAX_TAGS = 8;

/**
 * 标签选择器：预设 + 自定义 + 自动补全（按使用次数排序）。
 * 输入时请求 /api/tags?q= 做补全；回车或点提示项即加入。
 */
export function TagPicker({ value, onChange, max = MAX_TAGS }: Props) {
  const [input, setInput] = useState("");
  const [options, setOptions] = useState<TagOption[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // 点外部收起
  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // 防抖查询
  useEffect(() => {
    const q = input.trim();
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/tags?limit=10${q ? `&q=${encodeURIComponent(q)}` : ""}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : { tags: [] }))
        .then((data: { tags?: TagOption[] }) => {
          setOptions(
            (data.tags ?? []).filter((option) => !value.includes(option.name)),
          );
        })
        .catch(() => undefined);
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [input, value]);

  function add(name: string) {
    const tag = name.trim();
    if (!tag) return;
    if (value.includes(tag)) {
      setInput("");
      return;
    }
    if (value.length >= max) return;
    onChange([...value, tag]);
    setInput("");
    setOpen(false);
  }

  function remove(name: string) {
    onChange(value.filter((tag) => tag !== name));
  }

  return (
    <div ref={boxRef} className="space-y-2">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
            >
              {tag}
              <button
                type="button"
                onClick={() => remove(tag)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`移除标签 ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <Input
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add(input);
            }
            if (event.key === "Backspace" && !input && value.length > 0) {
              remove(value[value.length - 1]);
            }
          }}
          placeholder={
            value.length >= max ? `最多 ${max} 个标签` : "输入标签后回车，如「通勤」"
          }
          maxLength={12}
          disabled={value.length >= max}
        />

        {open && options.length > 0 ? (
          <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-background py-1 shadow-md">
            {options.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => add(option.name)}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span>{option.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {option.useCount} 次
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESET_TAGS.filter((tag) => !value.includes(tag)).map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => add(tag)}
            disabled={value.length >= max}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-muted",
              value.length >= max && "opacity-50",
            )}
          >
            ＋ {tag}
          </button>
        ))}
      </div>
    </div>
  );
}
