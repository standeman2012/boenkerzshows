import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import { useEffect, useRef } from "react";
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading1, Heading2, Quote, AlignLeft, AlignCenter, AlignRight } from "lucide-react";

export function RichTextEditor({ value, onChange, editable = true }: { value: string; onChange: (html: string) => void; editable?: boolean }) {
  const debouncer = useRef<any>(null);
  const editor = useEditor({
    extensions: [StarterKit, Underline, TextAlign.configure({ types: ["heading", "paragraph"] }), Link.configure({ openOnClick: true })],
    content: value || "<p></p>",
    editable,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (debouncer.current) clearTimeout(debouncer.current);
      debouncer.current = setTimeout(() => onChange(html), 400);
    },
    editorProps: { attributes: { class: "tiptap" } },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value || "<p></p>", { emitUpdate: false } as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  const btn = "p-2 rounded hover:bg-muted";
  const btnActive = "bg-primary/10 text-primary";

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card flex flex-col h-full">
      {editable && (
        <div className="flex items-center gap-1 border-b border-border p-2 flex-wrap">
          <button className={`${btn} ${editor.isActive("bold") ? btnActive : ""}`} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></button>
          <button className={`${btn} ${editor.isActive("italic") ? btnActive : ""}`} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></button>
          <button className={`${btn} ${editor.isActive("underline") ? btnActive : ""}`} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></button>
          <div className="w-px h-5 bg-border mx-1" />
          <button className={`${btn} ${editor.isActive("heading", { level: 1 }) ? btnActive : ""}`} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-4 w-4" /></button>
          <button className={`${btn} ${editor.isActive("heading", { level: 2 }) ? btnActive : ""}`} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></button>
          <div className="w-px h-5 bg-border mx-1" />
          <button className={`${btn} ${editor.isActive("bulletList") ? btnActive : ""}`} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></button>
          <button className={`${btn} ${editor.isActive("orderedList") ? btnActive : ""}`} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></button>
          <button className={`${btn} ${editor.isActive("blockquote") ? btnActive : ""}`} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></button>
          <div className="w-px h-5 bg-border mx-1" />
          <button className={btn} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="h-4 w-4" /></button>
          <button className={btn} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="h-4 w-4" /></button>
          <button className={btn} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="h-4 w-4" /></button>
        </div>
      )}
      <div className="flex-1 overflow-auto p-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
