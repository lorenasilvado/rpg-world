import { ImagePlus, Plus, TriangleAlert, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useStore } from 'zustand'
import type { Pin } from '../../persistence/types'
import { pinImageId, type PinImages } from '../../state/pinImages'
import { PIN_TYPES, pinType, type PinType } from '../../state/pinTypes'
import type { PinsStore } from '../../state/pinsStore'
import { FIELD_KEY_MAX, FIELD_VALUE_MAX, addField, removeField, renameField, setFieldValue } from './fields'
import { PinIcon } from './PinIcon'
import { IMAGE_ACCEPT, IMAGE_TEXT, checkImageFile, formatBytes, resizeImage } from './uploadImage'

/** O que o envio mostra: nada, uma imagem acima de 1 MB esperando a escolha, ou um erro. */
type Upload = { kind: 'idle' } | { kind: 'busy' } | { kind: 'large'; file: File } | { kind: 'error'; title?: string; text: string }

/**
 * A aba Detalhes do drawer (pins.md → E2, AC-F3-10 e AC-F3-11):
 *
 * - **Tipo e ícone:** a biblioteca embutida, os 7 tipos (um grupo de opções: escolher um troca o
 *   tipo e o ícone para o do tipo), e "Enviar imagem", que põe a imagem no círculo do Personalizado.
 *   Com a imagem, "Remover imagem" volta ao Personalizado hachurado.
 * - **Envio:** PNG, JPG ou SVG de até 1 MB é reduzido para 256 px e guardado como blob (`images`);
 *   acima de 1 MB, a mensagem pergunta (Recusar ou Aceitar com redução); outro formato é recusado
 *   com a mensagem dos formatos aceitos. Recusado, o ícone continua o anterior.
 * - **Pin pai:** ainda não existe ("Em breve").
 * - **Campos:** pares chave/valor, com "Adicionar campo" (a chave do campo novo fica com o foco e o
 *   texto selecionado) e o × de cada um. A chave muda ao sair do campo (vazia ou repetida, volta a
 *   anterior); o valor, a cada tecla.
 */
export function PinDetails({
  pin,
  pins,
  images,
  resize = resizeImage,
}: {
  pin: Pin
  pins: PinsStore
  images: PinImages
  /** Reduz a imagem (os testes do jsdom, sem canvas, trocam). */
  resize?: (file: Blob) => Promise<Blob>
}) {
  const type = pinType(pin.type)
  const imageId = pinImageId(pin)
  const imageUrl = useStore(images.store, (s) => (imageId ? s.urls[imageId] : undefined))
  const [upload, setUpload] = useState<Upload>({ kind: 'idle' })
  const fileInput = useRef<HTMLInputElement>(null)
  const acceptButton = useRef<HTMLButtonElement>(null)
  const ids = useId()

  useEffect(() => {
    if (upload.kind === 'large') acceptButton.current?.focus()
  }, [upload.kind])

  const pickType = (next: PinType) => {
    setUpload({ kind: 'idle' })
    pins.getState().updatePin(pin.id, { type: next, icon: { kind: 'builtin', key: next } })
  }

  const store = async (file: File) => {
    setUpload({ kind: 'busy' })
    let blob: Blob
    try {
      blob = await resize(file)
    } catch {
      setUpload({ kind: 'error', text: IMAGE_TEXT.unreadable })
      return
    }
    try {
      const blobId = await images.add(blob)
      pins.getState().updatePin(pin.id, { type: 'custom', icon: { kind: 'image', blobId } })
      setUpload({ kind: 'idle' })
    } catch {
      setUpload({ kind: 'error', text: IMAGE_TEXT.saveFailed })
    }
  }

  const onFile = (file: File | undefined) => {
    if (!file) return
    const check = checkImageFile(file)
    if (check === 'format') setUpload({ kind: 'error', title: IMAGE_TEXT.formatTitle, text: IMAGE_TEXT.format })
    else if (check === 'large') setUpload({ kind: 'large', file })
    else void store(file)
  }

  const reject = () => {
    setUpload({ kind: 'idle' })
    fileInput.current?.focus()
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby={`${ids}-tipo`} className="flex flex-col gap-3">
        <h3 id={`${ids}-tipo`} className="text-[13px] font-bold text-ink-2">
          Tipo e ícone
        </h3>
        <div role="radiogroup" aria-labelledby={`${ids}-tipo`} className="grid grid-cols-4 gap-1.5" data-testid="pin-type-library">
          {PIN_TYPES.map((t) => {
            const checked = type === t.id
            return (
              <label
                key={t.id}
                className={[
                  'flex min-h-[72px] cursor-pointer flex-col items-center justify-center gap-1 rounded-control border px-1 py-1.5 text-center text-[11px]/[13px] font-bold text-ink',
                  'has-focus-visible:shadow-[0_0_0_2px_var(--amber)]',
                  checked ? 'border-amber bg-amber-soft' : 'border-transparent hover:bg-hover',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name={`${ids}-tipo`}
                  value={t.id}
                  checked={checked}
                  onChange={() => pickType(t.id)}
                  className="sr-only"
                />
                <PinIcon type={t.id} size={26} image={t.id === 'custom' ? imageUrl : undefined} />
                {t.label}
              </label>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInput}
            id={`${ids}-arquivo`}
            type="file"
            accept={IMAGE_ACCEPT}
            className="peer sr-only"
            aria-describedby={`${ids}-dica`}
            disabled={upload.kind === 'busy'}
            onChange={(e) => {
              onFile(e.target.files?.[0])
              // O mesmo arquivo de novo também conta (depois de Recusar, por exemplo).
              e.target.value = ''
            }}
          />
          <label
            htmlFor={`${ids}-arquivo`}
            className="flex h-9 cursor-pointer items-center gap-1.5 rounded-control border border-dashed border-line-2 px-3 text-[13px] font-bold text-ink hover:border-amber hover:text-amber-ink peer-focus-visible:shadow-[0_0_0_2px_var(--amber)] peer-disabled:cursor-wait peer-disabled:opacity-55"
          >
            <ImagePlus size={16} aria-hidden="true" />
            {imageId ? 'Trocar imagem' : 'Enviar imagem'}
          </label>
          {imageId && (
            <button
              type="button"
              onClick={() => pickType('custom')}
              className="flex h-9 items-center gap-1.5 rounded-control px-3 text-[13px] font-bold text-ink-2 hover:bg-hover hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--amber)] focus-visible:outline-none"
            >
              <X size={16} aria-hidden="true" />
              Remover imagem
            </button>
          )}
          <span id={`${ids}-dica`} className="basis-full text-[12px] text-ink-2">
            {IMAGE_TEXT.hint}
          </span>
        </div>

        {upload.kind === 'large' && (
          <div
            role="alertdialog"
            aria-labelledby={`${ids}-grande`}
            aria-describedby={`${ids}-grande-texto`}
            data-testid="pin-image-large"
            className="flex flex-col gap-3 rounded-control border border-line-2 bg-field p-3"
          >
            <p id={`${ids}-grande`} className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
              <TriangleAlert size={16} aria-hidden="true" className="shrink-0 text-amber-ink" />
              {IMAGE_TEXT.largeTitle}
            </p>
            <p id={`${ids}-grande-texto`} className="text-[13px] text-ink-2">
              {IMAGE_TEXT.large(upload.file.name, formatBytes(upload.file.size))}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={reject}
                className="h-9 rounded-control border border-line-2 bg-field px-3 text-[13px] font-bold text-ink hover:bg-sunken focus-visible:shadow-[0_0_0_2px_var(--amber)] focus-visible:outline-none"
              >
                {IMAGE_TEXT.reject}
              </button>
              <button
                ref={acceptButton}
                type="button"
                onClick={() => void store(upload.file)}
                className="h-9 rounded-control bg-amber px-3 text-[13px] font-bold text-on-amber hover:brightness-95 focus-visible:shadow-[0_0_0_2px_var(--paper-solid),0_0_0_4px_var(--amber)] focus-visible:outline-none"
              >
                {IMAGE_TEXT.accept}
              </button>
            </div>
          </div>
        )}
        {upload.kind === 'error' && (
          <div role="alert" data-testid="pin-image-error" className="flex items-start gap-2 rounded-control border border-brick/40 bg-field p-3 text-[13px] text-ink">
            <TriangleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-brick" />
            <p className="flex-1">
              {upload.title && <strong className="block">{upload.title}</strong>}
              {upload.text}
            </p>
            <button
              type="button"
              aria-label="Fechar mensagem"
              onClick={() => setUpload({ kind: 'idle' })}
              className="-m-1 grid size-7 shrink-0 place-items-center rounded-control text-ink-2 hover:bg-hover hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--amber)] focus-visible:outline-none"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}
      </section>

      <section aria-labelledby={`${ids}-pai`} className="flex flex-col gap-2">
        <h3 id={`${ids}-pai`} className="flex items-center gap-2 text-[13px] font-bold text-ink-2">
          Pin pai
          <span className="rounded-pill border border-line bg-paper-solid px-2 py-0.5 text-[11px]/4 font-bold text-ink-2">Em breve</span>
        </h3>
        <p className="text-[13px] text-ink-2">O pin a que este pertence (ex.: a vila de um reino).</p>
      </section>

      <FieldList pin={pin} pins={pins} />
    </div>
  )
}

/** Os campos livres (chave/valor) do pin. */
function FieldList({ pin, pins }: { pin: Pin; pins: PinsStore }) {
  const ids = useId()
  /** A chave do campo recém-criado: ela recebe o foco, com o texto selecionado. */
  const [created, setCreated] = useState<string | null>(null)
  const entries = Object.entries(pin.fields)

  const add = () => {
    const next = addField(pin.fields)
    pins.getState().updatePin(pin.id, { fields: next.fields })
    setCreated(next.key)
  }

  return (
    <section aria-labelledby={`${ids}-campos`} className="flex flex-col gap-2">
      <h3 id={`${ids}-campos`} className="text-[13px] font-bold text-ink-2">
        Campos
      </h3>
      {entries.length === 0 && <p className="text-[13px] text-ink-2">Anote o que quiser: governante, população, facção…</p>}
      {entries.length > 0 && (
        <ul className="flex flex-col gap-1.5" data-testid="pin-fields">
          {entries.map(([key, value], i) => (
            // A posição é a identidade da linha: trocar a chave não remonta os campos (o foco fica).
            <li key={i} className="flex items-center gap-1.5">
              <FieldKey
                pin={pin}
                pins={pins}
                fieldKey={key}
                focus={created === key}
                onFocused={() => setCreated(null)}
              />
              <input
                aria-label={`Valor de ${key}`}
                value={value}
                maxLength={FIELD_VALUE_MAX}
                onChange={(e) => pins.getState().updatePin(pin.id, { fields: setFieldValue(pin.fields, key, e.target.value) })}
                onBlur={() => pins.getState().endTextEdit()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.currentTarget.blur()
                  }
                }}
                className="h-[38px] min-w-0 flex-1 rounded-control border border-line-2 bg-field px-2.5 text-[14px] font-semibold text-ink focus:border-amber focus:shadow-[0_0_0_3px_var(--amber-soft)] focus:outline-none"
              />
              <button
                type="button"
                aria-label={`Remover campo ${key}`}
                title="Remover campo"
                onClick={() => pins.getState().updatePin(pin.id, { fields: removeField(pin.fields, key) })}
                className="grid size-9 shrink-0 place-items-center rounded-control text-ink-3 hover:bg-hover hover:text-brick focus-visible:shadow-[0_0_0_2px_var(--amber)] focus-visible:outline-none"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={add}
        className="flex h-9 items-center gap-1.5 self-start rounded-control border border-dashed border-line-2 px-3 text-[13px] font-bold text-ink hover:border-amber hover:text-amber-ink focus-visible:shadow-[0_0_0_2px_var(--amber)] focus-visible:outline-none"
      >
        <Plus size={16} aria-hidden="true" />
        Adicionar campo
      </button>
    </section>
  )
}

/** A chave de um campo: muda ao sair (Enter também sai); vazia ou repetida, volta a anterior. */
function FieldKey({
  pin,
  pins,
  fieldKey,
  focus,
  onFocused,
}: {
  pin: Pin
  pins: PinsStore
  fieldKey: string
  focus: boolean
  onFocused: () => void
}) {
  const [draft, setDraft] = useState(fieldKey)
  const input = useRef<HTMLInputElement>(null)

  // A chave mudou fora do campo (desfazer, refazer): o campo acompanha.
  useEffect(() => {
    if (document.activeElement !== input.current) setDraft(fieldKey)
  }, [fieldKey])

  useEffect(() => {
    if (!focus) return
    input.current?.focus()
    input.current?.select()
    onFocused()
  }, [focus, onFocused])

  const commit = () => {
    const current = pins.getState().pins.find((p) => p.id === pin.id)
    if (!current) return
    const next = renameField(current.fields, fieldKey, draft)
    if (next) pins.getState().updatePin(pin.id, { fields: next })
    setDraft(next ? draft.trim().slice(0, FIELD_KEY_MAX) : fieldKey)
  }

  return (
    <input
      ref={input}
      aria-label="Campo"
      value={draft}
      maxLength={FIELD_KEY_MAX}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      className="h-[38px] w-[120px] shrink-0 rounded-control border border-line-2 bg-sunken px-2.5 text-[13px] font-bold text-ink-2 focus:border-amber focus:text-ink focus:shadow-[0_0_0_3px_var(--amber-soft)] focus:outline-none"
    />
  )
}
