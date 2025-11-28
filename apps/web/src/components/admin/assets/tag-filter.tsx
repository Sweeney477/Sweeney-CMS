"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AssetTagDTO } from "@/types/assets";
import { useState } from "react";

type TagFilterProps = {
  tags: AssetTagDTO[];
  selected: string[];
  onToggle: (tagId: string) => void;
  onCreateTag?: (payload: { name: string; color?: string }) => Promise<void>;
};

export function TagFilter({
  tags,
  selected,
  onToggle,
  onCreateTag,
}: TagFilterProps) {
  const [newTagName, setNewTagName] = useState("");

  async function handleCreateTag() {
    if (!newTagName.trim() || !onCreateTag) return;
    await onCreateTag({ name: newTagName.trim(), color: randomColor() });
    setNewTagName("");
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-900">
        Tags
        {onCreateTag && (
          <div className="flex items-center gap-2">
            <Input
              value={newTagName}
              onChange={(event) => setNewTagName(event.target.value)}
              placeholder="New tag name"
              className="h-8 w-32"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1"
              onClick={handleCreateTag}
              disabled={!newTagName.trim()}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => onToggle(tag.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              selected.includes(tag.id)
                ? "border-transparent bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
            }`}
            style={
              selected.includes(tag.id) && tag.color
                ? {
                    backgroundColor: tag.color,
                    borderColor: tag.color,
                  }
                : undefined
            }
          >
            {tag.name}
          </button>
        ))}
        {!tags.length && (
          <p className="text-xs text-slate-500">No tags yet. Create one!</p>
        )}
      </div>
    </div>
  );
}

function randomColor() {
  return `#${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0")}`;
}



