'use client';

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

type InlineRichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

const commands = [
  { label: "Bold", command: "bold" },
  { label: "Italic", command: "italic" },
  { label: "Link", command: "createLink", args: promptUrl },
  { label: "Bullet list", command: "insertUnorderedList" },
];

export function InlineRichTextEditor({ value, onChange }: InlineRichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  const handleInput = () => {
    if (!ref.current) {
      return;
    }
    onChange(ref.current.innerHTML);
  };

  const handleCommand = (command: string, args?: () => string | null) => {
    if (typeof document === "undefined") {
      return;
    }
    let commandValue: string | undefined;
    if (args) {
      const promptValue = args();
      if (!promptValue) {
        return;
      }
      commandValue = promptValue;
    }
    document.execCommand(command, false, commandValue);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {commands.map((action) => (
          <Button
            key={action.command}
            type="button"
            size="sm"
            variant="outline"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => handleCommand(action.command, action.args)}
          >
            {action.label}
          </Button>
        ))}
      </div>
      <div
        ref={ref}
        className="min-h-[160px] w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700 shadow-inner focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
      />
    </div>
  );
}

function promptUrl() {
  const value = window.prompt("Enter URL");
  if (!value) {
    return null;
  }
  if (!/^https?:\/\//.test(value)) {
    return `https://${value}`;
  }
  return value;
}



