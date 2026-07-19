import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading1, Heading2, Quote, AlignLeft, AlignCenter, AlignRight } from "lucide-react";

export type RemoteCaret = { userId: string; name: string; pos: number; color: string };

export function RichTextEditor({
  value,
  onChange,
  onLocalChange,
  onSelection,
  editable = true,
  remoteCarets = [],
}: {
  value: string;
  onChange: (html: string) => void;
  onLocalChange?: (html: string) => void;
  onSelection?: (pos: number) => void;
  editable?: boolean;
  remoteCarets?: RemoteCaret[];
}) {
  const debouncer = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [caretRects, setCaretRects] = useState<{ userId: string; name: string; color: string; left: number; top: number; height: number }[]>([]);

  const editor = useEditor({
    extensions: [StarterKit, Underline, TextAlign.configure({ types: ["heading", "paragraph"] }), Link.configure({ openOnClick: true })],
    content: value || "<p></p>",
    editable,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onLocalChange?.(html);
      if (debouncer.current) clearTimeout(debouncer.current);
      debouncer.current = setTimeout(() => onChange(html), 400);
    },
    onSelectionUpdate: ({ editor }) => {
      onSelection?.(editor.state.selection.from);
    },
    editorProps: { attributes: { class: "tiptap" } },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(value || "<p></p>", { emitUpdate: false } as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Compute remote caret positions on top of the editor
  useEffect(() => {
    if (!editor || !wrapperRef.current) return;
    const compute = () => {
      if (!wrapperRef.current) return;
      const wrap = wrapperRef.current.getBoundingClientRect();
      const size = editor.state.doc.content.size;
      const next = remoteCarets.map((c) => {
        try {
          const pos = Math.min(Math.max(c.pos, 1), size);
          const coords = editor.view.coordsAtPos(pos);
          return { userId: c.userId, name: c.name, color: c.color, left: coords.left - wrap.left, top: coords.top - wrap.top, height: coords.bottom - coords.top };
        } catch {
          return null;
        }
      }).filter(Boolean) as any;
      setCaretRects(next);
    };
    compute();
    // Recompute whenever the local doc/selection changes so remote carets follow live typing.
    const onTx = () => compute();
    editor.on("transaction", onTx);
    editor.on("selectionUpdate", onTx);
    // Also recompute on scroll/resize so carets stay glued to the right glyph.
    const wrap = wrapperRef.current;
    wrap.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      editor.off("transaction", onTx);
      editor.off("selectionUpdate", onTx);
      wrap.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, [editor, remoteCarets]);

  if (!editor) return null;

  const btn = "p-2 rounded hover:bg-muted";
  const btnActive = "bg-primary/10 text-primary";

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card flex flex-col h-full">
      {editable && (
        <div className="flex items-center gap-1 border-b border-border p-2 flex-wrap">
          <button type="button" className={`${btn} ${editor.isActive("bold") ? btnActive : ""}`} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></button>
          <button type="button" className={`${btn} ${editor.isActive("italic") ? btnActive : ""}`} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></button>
          <button type="button" className={`${btn} ${editor.isActive("underline") ? btnActive : ""}`} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></button>
          <div className="w-px h-5 bg-border mx-1" />
          <button type="button" className={`${btn} ${editor.isActive("heading", { level: 1 }) ? btnActive : ""}`} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-4 w-4" /></button>
          <button type="button" className={`${btn} ${editor.isActive("heading", { level: 2 }) ? btnActive : ""}`} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></button>
          <div className="w-px h-5 bg-border mx-1" />
          <button type="button" className={`${btn} ${editor.isActive("bulletList") ? btnActive : ""}`} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></button>
          <button type="button" className={`${btn} ${editor.isActive("orderedList") ? btnActive : ""}`} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></button>
          <button type="button" className={`${btn} ${editor.isActive("blockquote") ? btnActive : ""}`} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></button>
          <div className="w-px h-5 bg-border mx-1" />
          <button type="button" className={btn} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="h-4 w-4" /></button>
          <button type="button" className={btn} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="h-4 w-4" /></button>
          <button type="button" className={btn} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="h-4 w-4" /></button>
        </div>
      )}
      <div ref={wrapperRef} className="flex-1 overflow-auto p-4 relative">
        <EditorContent editor={editor} />
        {caretRects.map((c) => (
          <div key={c.userId} className="pointer-events-none absolute z-10" style={{ left: c.left, top: c.top, height: c.height }}>
            <div style={{ width: 2, height: "100%", background: c.color }} />
            <div style={{ background: c.color }} className="absolute -top-5 left-0 text-[10px] text-white px-1 py-0.5 rounded whitespace-nowrap font-medium">
              {c.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
