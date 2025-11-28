'use client';

import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  blockKinds,
  blocksPalette,
  createBlock,
  type BlockKind,
  type BlockPayload,
} from "@/lib/blocks";

import { InlineRichTextEditor } from "./inline-rich-text";
import { CommentBadge } from "@/components/admin/comments/comment-badge";
import { useComments } from "@/components/admin/comments/comments-provider";

type BlockEditorProps = {
  blocks: BlockPayload[];
  onChange: (blocks: BlockPayload[]) => void;
};

export function BlockEditor({ blocks, onChange }: BlockEditorProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const moveBlock = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= blocks.length || to >= blocks.length) {
      return;
    }
    const next = [...blocks];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const updateBlock = (index: number, updater: (block: BlockPayload) => BlockPayload) => {
    onChange(blocks.map((block, position) => (position === index ? updater(block) : block)));
  };

  const removeBlock = (index: number) => {
    onChange(blocks.filter((_, position) => position !== index));
  };

  const duplicateBlock = (index: number) => {
    const block = blocks[index];
    if (!block) {
      return;
    }
    const clone: BlockPayload = {
      ...block,
      id: generateId(),
    };
    const next = [...blocks];
    next.splice(index + 1, 0, clone);
    onChange(next);
  };

  const handleAddBlock = (kind: BlockKind) => {
    onChange([...blocks, createBlock(kind)]);
  };

  if (!blocks.length) {
    return (
      <div className="space-y-6">
        <BlockLibrary onAdd={handleAddBlock} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {blocks.map((block, index) => (
        <article
          key={block.id ?? `${block.kind}-${index}`}
          className="rounded-2xl border border-slate-200 bg-white shadow-sm"
          draggable
          onDragStart={() => setDragIndex(index)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (dragIndex !== null) {
              moveBlock(dragIndex, index);
              setDragIndex(null);
            }
          }}
        >
          <BlockCard
            block={block}
            index={index}
            onMoveUp={() => moveBlock(index, index - 1)}
            onMoveDown={() => moveBlock(index, index + 1)}
            onRemove={() => removeBlock(index)}
            onDuplicate={() => duplicateBlock(index)}
            onChange={(next) => updateBlock(index, () => next)}
            canRemove={blocks.length > 1}
            isFirst={index === 0}
            isLast={index === blocks.length - 1}
          />
        </article>
      ))}

      <BlockLibrary onAdd={handleAddBlock} />
    </div>
  );
}

type BlockCardProps = {
  block: BlockPayload;
  index: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onChange: (block: BlockPayload) => void;
  canRemove: boolean;
  isFirst: boolean;
  isLast: boolean;
};

function BlockCard({
  block,
  index,
  onMoveDown,
  onMoveUp,
  onRemove,
  onDuplicate,
  onChange,
  canRemove,
  isFirst,
  isLast,
}: BlockCardProps) {
  const { activeBlockId } = useComments();
  const paletteEntry = blocksPalette[block.kind as BlockKind];

  const title = paletteEntry?.label ?? block.kind;
  const description = paletteEntry?.description;

  return (
    <div className="divide-y divide-slate-100">
      <CardHeader
        className={`flex flex-row items-start justify-between gap-6 ${
          activeBlockId === block.id ? "ring-2 ring-slate-400" : ""
        }`}
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Section {index + 1}
          </p>
          <CardTitle className="text-xl">{title}</CardTitle>
          {description && (
            <p className="text-sm text-slate-500">
              {description}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {block.id && <CommentBadge blockId={block.id} />}
          <Button type="button" variant="ghost" size="sm" onClick={onMoveUp} disabled={isFirst}>
            Move up
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onMoveDown} disabled={isLast}>
            Move down
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onDuplicate}>
            Duplicate
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={!canRemove}>
            Remove
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <BlockSettings block={block} onChange={onChange} />
        <BlockFields block={block} onChange={onChange} />
      </CardContent>
    </div>
  );
}

function BlockSettings({ block, onChange }: { block: BlockPayload; onChange: (block: BlockPayload) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="space-y-2">
        <Label className="text-xs uppercase text-slate-500">Background</Label>
        <Select
          value={block.settings.background}
          onChange={(event) =>
            onChange({
              ...block,
              settings: {
                ...block.settings,
                background: event.target.value as BlockPayload["settings"]["background"],
              },
            })
          }
        >
          <option value="default">Default</option>
          <option value="muted">Muted</option>
          <option value="dark">Dark</option>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-xs uppercase text-slate-500">Alignment</Label>
        <Select
          value={block.settings.alignment}
          onChange={(event) =>
            onChange({
              ...block,
              settings: {
                ...block.settings,
                alignment: event.target.value as BlockPayload["settings"]["alignment"],
              },
            })
          }
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
        </Select>
      </div>
      <div className="flex items-end">
        <label className="flex items-center gap-2 text-xs font-medium uppercase text-slate-500">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/20"
            checked={block.settings.fullWidth}
            onChange={(event) =>
              onChange({
                ...block,
                settings: { ...block.settings, fullWidth: event.target.checked },
              })
            }
          />
          <span>Full width layout</span>
        </label>
      </div>
    </div>
  );
}

function BlockFields({ block, onChange }: { block: BlockPayload; onChange: (block: BlockPayload) => void }) {
  switch (block.kind) {
    case "hero":
      return <HeroFields block={block} onChange={onChange} />;
    case "text":
      return <TextFields block={block} onChange={onChange} />;
    case "grid":
      return <GridFields block={block} onChange={onChange} />;
    case "media":
      return <MediaFields block={block} onChange={onChange} />;
    case "cta":
      return <CTAFields block={block} onChange={onChange} />;
    default:
      return (
        <p className="text-sm text-slate-500">
          Unsupported block type
        </p>
      );
  }
}

function HeroFields({
  block,
  onChange,
}: {
  block: Extract<BlockPayload, { kind: "hero" }>;
  onChange: (block: BlockPayload) => void;
}) {
  const update = (field: keyof typeof block.data, value: string) =>
    onChange({
      ...block,
      data: {
        ...block.data,
        [field]: value,
      },
    });

  const updateCta = (index: number, field: "label" | "href" | "variant", value: string) => {
    const ctas = block.data.ctas.map((cta, i) =>
      i === index
        ? {
            ...cta,
            [field]: field === "variant" ? (value as "primary" | "secondary") : value,
          }
        : cta,
    );
    onChange({
      ...block,
      data: {
        ...block.data,
        ctas,
      },
    });
  };

  const addCta = () => {
    onChange({
      ...block,
      data: {
        ...block.data,
        ctas: [
          ...block.data.ctas,
          {
            label: "Primary action",
            href: "/contact",
            variant: "primary",
          },
        ],
      },
    });
  };

  const removeCta = (index: number) => {
    onChange({
      ...block,
      data: {
        ...block.data,
        ctas: block.data.ctas.filter((_, i) => i !== index),
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Eyebrow">
          <Input value={block.data.eyebrow ?? ""} onChange={(event) => update("eyebrow", event.target.value)} />
        </Field>
        <Field label="Heading" required>
          <Input value={block.data.heading} onChange={(event) => update("heading", event.target.value)} required />
        </Field>
      </div>
      <Field label="Body">
        <Textarea value={block.data.body ?? ""} onChange={(event) => update("body", event.target.value)} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Media URL">
          <Input value={block.data.mediaUrl ?? ""} onChange={(event) => update("mediaUrl", event.target.value)} placeholder="https://..." />
        </Field>
        <Field label="Media alt text">
          <Input value={block.data.mediaAlt ?? ""} onChange={(event) => update("mediaAlt", event.target.value)} />
        </Field>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Calls-to-action</Label>
          <Button type="button" size="sm" variant="ghost" onClick={addCta} disabled={block.data.ctas.length >= 2}>
            Add CTA
          </Button>
        </div>
        <div className="space-y-3">
          {block.data.ctas.map((cta, index) => (
            <div key={`${cta.label}-${index}`} className="grid gap-3 md:grid-cols-3">
              <Input
                value={cta.label}
                onChange={(event) => updateCta(index, "label", event.target.value)}
                placeholder="Label"
              />
              <Input
                value={cta.href}
                onChange={(event) => updateCta(index, "href", event.target.value)}
                placeholder="/contact"
              />
              <div className="flex items-center gap-2">
                <Select
                  value={cta.variant}
                  onChange={(event) =>
                    updateCta(index, "variant", event.target.value as "primary" | "secondary")
                  }
                >
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                </Select>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeCta(index)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
          {!block.data.ctas.length && <p className="text-sm text-slate-500">Add a CTA to drive visitors to key actions.</p>}
        </div>
      </div>
    </div>
  );
}

function TextFields({
  block,
  onChange,
}: {
  block: Extract<BlockPayload, { kind: "text" }>;
  onChange: (block: BlockPayload) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Rich text</Label>
      <InlineRichTextEditor
        value={block.data.html}
        onChange={(html) => onChange({ ...block, data: { ...block.data, html } })}
      />
    </div>
  );
}

function GridFields({
  block,
  onChange,
}: {
  block: Extract<BlockPayload, { kind: "grid" }>;
  onChange: (block: BlockPayload) => void;
}) {
  const updateTitle = (value: string) =>
    onChange({
      ...block,
      data: {
        ...block.data,
        title: value,
      },
    });

  const updateColumn = (index: number, field: "title" | "body", value: string) => {
    onChange({
      ...block,
      data: {
        ...block.data,
        columns: block.data.columns.map((column, columnIndex) =>
          columnIndex === index
            ? {
                ...column,
                [field]: value,
              }
            : column,
        ),
      },
    });
  };

  const addColumn = () => {
    onChange({
      ...block,
      data: {
        ...block.data,
        columns: [
          ...block.data.columns,
          {
            title: "New column",
            body: "",
            icon: "",
          },
        ],
      },
    });
  };

  const removeColumn = (index: number) => {
    onChange({
      ...block,
      data: {
        ...block.data,
        columns: block.data.columns.filter((_, columnIndex) => columnIndex !== index),
      },
    });
  };

  return (
    <div className="space-y-4">
      <Field label="Section title">
        <Input value={block.data.title ?? ""} onChange={(event) => updateTitle(event.target.value)} />
      </Field>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Columns</Label>
          <Button type="button" size="sm" variant="ghost" onClick={addColumn}>
            Add column
          </Button>
        </div>
        <div className="grid gap-4">
          {block.data.columns.map((column, index) => (
            <div key={`column-${index}`} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Column {index + 1}
                </p>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeColumn(index)}>
                  Remove
                </Button>
              </div>
              <div className="mt-3 space-y-3">
                <Input value={column.title} onChange={(event) => updateColumn(index, "title", event.target.value)} placeholder="Title" />
                <Textarea value={column.body ?? ""} onChange={(event) => updateColumn(index, "body", event.target.value)} placeholder="Supporting copy" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MediaFields({
  block,
  onChange,
}: {
  block: Extract<BlockPayload, { kind: "media" }>;
  onChange: (block: BlockPayload) => void;
}) {
  const update = (field: keyof typeof block.data, value: string) =>
    onChange({
      ...block,
      data: {
        ...block.data,
        [field]: value,
      },
    });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Label">
        <Input value={block.data.label ?? ""} onChange={(event) => update("label", event.target.value)} />
      </Field>
      <Field label="Media URL" required>
        <Input value={block.data.url} onChange={(event) => update("url", event.target.value)} placeholder="https://..." required />
      </Field>
      <Field label="Alt text">
        <Input value={block.data.alt ?? ""} onChange={(event) => update("alt", event.target.value)} />
      </Field>
      <Field label="Caption">
        <Input value={block.data.caption ?? ""} onChange={(event) => update("caption", event.target.value)} />
      </Field>
    </div>
  );
}

function CTAFields({
  block,
  onChange,
}: {
  block: Extract<BlockPayload, { kind: "cta" }>;
  onChange: (block: BlockPayload) => void;
}) {
  const update = (field: keyof typeof block.data, value: string) =>
    onChange({
      ...block,
      data: {
        ...block.data,
        [field]: value,
      },
    });

  const updateCta = (index: number, field: "label" | "href" | "variant", value: string) => {
    const ctas = block.data.ctas.map((cta, i) =>
      i === index
        ? {
            ...cta,
            [field]: field === "variant" ? (value as "primary" | "secondary") : value,
          }
        : cta,
    );
    onChange({
      ...block,
      data: {
        ...block.data,
        ctas,
      },
    });
  };

  const addCta = () => {
    onChange({
      ...block,
      data: {
        ...block.data,
        ctas: [
          ...block.data.ctas,
          {
            label: "Get started",
            href: "/contact",
            variant: "primary",
          },
        ],
      },
    });
  };

  const removeCta = (index: number) => {
    onChange({
      ...block,
      data: {
        ...block.data,
        ctas: block.data.ctas.filter((_, i) => i !== index),
      },
    });
  };

  return (
    <div className="space-y-4">
      <Field label="Heading">
        <Input value={block.data.heading} onChange={(event) => update("heading", event.target.value)} />
      </Field>
      <Field label="Body">
        <Textarea value={block.data.body ?? ""} onChange={(event) => update("body", event.target.value)} />
      </Field>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Calls-to-action</Label>
          <Button type="button" size="sm" variant="ghost" onClick={addCta}>
            Add CTA
          </Button>
        </div>
        <div className="space-y-3">
          {block.data.ctas.map((cta, index) => (
            <div key={`${cta.label}-${index}`} className="grid gap-3 md:grid-cols-3">
              <Input value={cta.label} onChange={(event) => updateCta(index, "label", event.target.value)} placeholder="Label" />
              <Input value={cta.href} onChange={(event) => updateCta(index, "href", event.target.value)} placeholder="/pricing" />
              <div className="flex items-center gap-2">
                <Select
                  value={cta.variant}
                  onChange={(event) =>
                    updateCta(index, "variant", event.target.value as "primary" | "secondary")
                  }
                >
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                </Select>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeCta(index)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function BlockLibrary({ onAdd }: { onAdd: (kind: BlockKind) => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
      <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Block library
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {blockKinds.map((kind) => {
          const entry = blocksPalette[kind];
          return (
            <button
              key={kind}
              type="button"
              className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-400"
              onClick={() => onAdd(kind)}
            >
              <p className="text-sm font-semibold text-slate-900">{entry.label}</p>
              <p className="mt-1 text-xs text-slate-500">{entry.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
