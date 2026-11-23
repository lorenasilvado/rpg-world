import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import { Placeholder } from '@tiptap/extensions'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Heading2, Italic, Link as LinkIcon, List } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { DESCRIPTION_PLACEHOLDER, descriptionHtml } from './descriptionHtml'
import { isAllowedLink, normalizeLink } from './links'

/**
 * A descrição do pin (pins.md → E2, AC-F3-07): texto rico com o TipTap (ADR 0001), com negrito,
 * itálico, título H2, lista e link, pela barra do editor ou pelos atalhos do TipTap (Ctrl+B, Ctrl+I).
 * Vazia, mostra o `DESCRIPTION_PLACEHOLDER`.
 * O HTML vai para o pin a cada mudança (`onChange`); uma descrição vazia fica `''`. Fora do foco, o
 * editor acompanha a descrição do pin (desfazer e refazer); ao sair dele, `onBlur` encerra o passo
 * do histórico. O link abre uma linha com o endereço: Enter aplica, Esc cancela, e vazio tira o link.
 */
export function DescriptionEditor({
  value,
  onChange,
  onBlur,
}: {
  value: string
  onChange: (html: string) => void
  onBlur: () => void
}) {
  const change = useRef(onChange)
  const blur = useRef(onBlur)
  useEffect(() => {
    change.current = onChange
    blur.current = onBlur
  })
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2] },
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        orderedList: false,
        strike: false,
        underline: false,
        // Só http, https e mailto, em todo caminho (digitado, colado, automático, salvo): o padrão do
        // TipTap aceitaria também ftp, tel, sms e outros.
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https', isAllowedUri: (url) => isAllowedLink(url) },
      }),
      Placeholder.configure({ placeholder: DESCRIPTION_PLACEHOLDER }),
    ],
    content: value,
    editorProps: {
      attributes: {
        'aria-label': 'Descrição',
        'aria-multiline': 'true',
        role: 'textbox',
        'data-testid': 'pin-description',
        class: 'pin-description min-h-[180px] px-3.5 py-3 text-[14px]/[22px] text-ink focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => change.current(descriptionHtml(editor)),
    onBlur: () => blur.current(),
  })

  // A descrição mudou fora do editor (desfazer ou refazer): o editor acompanha, sem virar mudança.
  useEffect(() => {
    if (!editor || editor.isFocused || descriptionHtml(editor) === value) return
    editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, value])

  const active = useEditorState({
    editor,
    // Os botões mostram a formatação sob o cursor só com o foco no texto (fora dele, a seleção não aparece).
    selector: ({ editor }) => {
      const on = (name: string, attrs?: Record<string, unknown>) => !!editor?.isFocused && editor.isActive(name, attrs)
      return { bold: on('bold'), italic: on('italic'), heading: on('heading', { level: 2 }), list: on('bulletList'), link: on('link') }
    },
  })

  const [linkOpen, setLinkOpen] = useState(false)

  return (
    <div className="rounded-panel border border-line-2 bg-field focus-within:border-amber focus-within:shadow-[0_0_0_3px_var(--amber-soft)]">
      <div role="toolbar" aria-label="Formatação" className="flex items-center gap-0.5 border-b border-line px-1.5 py-1">
        <ToolButton label="Negrito" shortcut="Ctrl+B" active={active?.bold} onClick={() => editor?.chain().focus().toggleBold().run()}>
          <Bold size={16} aria-hidden="true" />
        </ToolButton>
        <ToolButton label="Itálico" shortcut="Ctrl+I" active={active?.italic} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <Italic size={16} aria-hidden="true" />
        </ToolButton>
        <ToolButton label="Título" active={active?.heading} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={16} aria-hidden="true" />
        </ToolButton>
        <ToolButton label="Lista" active={active?.list} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <List size={16} aria-hidden="true" />
        </ToolButton>
        <ToolButton label="Link" active={active?.link || linkOpen} expanded={linkOpen} onClick={() => setLinkOpen((open) => !open)}>
          <LinkIcon size={16} aria-hidden="true" />
        </ToolButton>
      </div>
      {linkOpen && editor && <LinkRow editor={editor} onClose={() => setLinkOpen(false)} />}
      <EditorContent editor={editor} />
    </div>
  )
}

function ToolButton({
  label,
  shortcut,
  active = false,
  expanded,
  onClick,
  children,
}: {
  label: string
  shortcut?: string
  active?: boolean
  expanded?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={expanded === undefined ? active : undefined}
      aria-expanded={expanded}
      title={shortcut ? `${label} (${shortcut})` : label}
      // O clique não tira o foco do texto: a formatação vale para a seleção.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`grid size-8 place-items-center rounded-control ${active ? 'bg-amber-soft text-amber-ink' : 'text-ink-2 hover:bg-hover hover:text-ink'} active:bg-press focus-visible:shadow-[0_0_0_2px_var(--amber)] focus-visible:outline-none`}
    >
      {children}
    </button>
  )
}

/**
 * A linha do link: o endereço do link sob o cursor (ou vazio). Enter aplica (com texto selecionado,
 * vira link; sem, o endereço entra como texto com o link); vazio tira o link; Esc cancela.
 */
function LinkRow({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const id = useId()
  const [href, setHref] = useState(() => (editor.getAttributes('link').href as string | undefined) ?? '')
  const [invalid, setInvalid] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus({ preventScroll: true }), [])

  const apply = () => {
    if (!href.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      onClose()
      return
    }
    const url = normalizeLink(href)
    if (!url) {
      setInvalid(true)
      return
    }
    const chain = editor.chain().focus().extendMarkRange('link')
    if (editor.state.selection.empty && !editor.isActive('link')) {
      chain.insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] }).run()
    } else {
      chain.setLink({ href: url }).run()
    }
    onClose()
  }

  return (
    <div className="flex flex-col gap-1 border-b border-line px-2 py-1.5">
      <div className="flex items-center gap-1.5">
        <label htmlFor={id} className="sr-only">
          Endereço do link
        </label>
        <input
          ref={input}
          id={id}
          type="url"
          value={href}
          placeholder="https://…"
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-erro` : undefined}
          onChange={(e) => {
            setHref(e.target.value)
            setInvalid(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              apply()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              onClose()
              editor.commands.focus()
            }
          }}
          className="h-8 min-w-0 flex-1 rounded-control border border-line-2 bg-field px-2 text-[13px] text-ink placeholder:text-ink-3 focus:border-amber focus:outline-none"
        />
        <button
          type="button"
          onClick={apply}
          className="h-8 rounded-control px-2.5 text-[13px] font-extrabold text-amber-ink hover:bg-hover active:bg-press focus-visible:shadow-[0_0_0_2px_var(--amber)] focus-visible:outline-none"
        >
          Aplicar
        </button>
      </div>
      {invalid && (
        <p id={`${id}-erro`} className="px-0.5 text-[12px] text-brick-ink">
          Use um endereço http, https ou mailto.
        </p>
      )}
    </div>
  )
}
