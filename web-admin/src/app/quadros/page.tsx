'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react'
import { toPng } from 'html-to-image'
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  CursorArrowRaysIcon,
  DocumentDuplicateIcon,
  FolderPlusIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  MapIcon,
  PlusIcon,
  PresentationChartBarIcon,
  RectangleGroupIcon,
  ShareIcon,
  SparklesIcon,
  Squares2X2Icon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import AdminLayout from '@/components/layout/AdminLayout'
import '@xyflow/react/dist/style.css'
import styles from './workspace.module.css'

const STORAGE_KEY = 'sofi_visual_boards_v1'

type ElementKind = 'process' | 'decision' | 'sticky' | 'title' | 'frame'
type FlowData = { label: string; detail?: string; kind: ElementKind; color: string }
type FlowNode = Node<FlowData, 'sofi'>
type Snapshot = { nodes: FlowNode[]; edges: Edge[] }
type Board = Snapshot & { id: string; name: string; updatedAt: string }

const palette = ['#10b981', '#00a9e0', '#725cff', '#ffb000', '#ff6b8a', '#0b2341']

function id(prefix = 'node') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function node(label: string, x: number, y: number, kind: ElementKind = 'process', color = '#00a9e0', detail?: string): FlowNode {
  return { id: id(), type: 'sofi', position: { x, y }, data: { label, detail, kind, color } }
}

function starterBoard(): Board {
  const start = node('Demanda recebida', 80, 170, 'process', '#10b981', 'Entrada do processo')
  const review = node('Analisar informações', 390, 170, 'process', '#00a9e0', 'Responsável: equipe')
  const decision = node('Aprovar?', 710, 170, 'decision', '#725cff')
  const done = node('Concluir e registrar', 1010, 80, 'process', '#10b981', 'Salvar evidências')
  const adjust = node('Solicitar ajustes', 1010, 300, 'process', '#ffb000', 'Retornar ao responsável')
  return {
    id: id('board'),
    name: 'Fluxo de trabalho principal',
    updatedAt: new Date().toISOString(),
    nodes: [start, review, decision, done, adjust],
    edges: [
      edge(start.id, review.id), edge(review.id, decision.id),
      edge(decision.id, done.id, 'Sim'), edge(decision.id, adjust.id, 'Não'),
      edge(adjust.id, review.id, 'Revisar'),
    ],
  }
}

function edge(source: string, target: string, label?: string): Edge {
  return { id: id('edge'), source, target, label, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#52708d', strokeWidth: 2 }, labelStyle: { fill: '#23415f', fontWeight: 800, fontSize: 11 }, labelBgStyle: { fill: '#ffffff', fillOpacity: 0.92 } }
}

function SofiNode({ data, selected }: NodeProps<FlowNode>) {
  const classes = `${styles.visualNode} ${styles[data.kind]} ${selected ? styles.selected : ''}`
  return <div className={classes} style={{ '--node-color': data.color } as React.CSSProperties}>
    <Handle type="target" position={Position.Left} className={styles.handle} />
    <Handle type="source" position={Position.Right} className={styles.handle} />
    {data.kind === 'decision' ? <div className={styles.diamond}><div><b>{data.label}</b>{data.detail && <small>{data.detail}</small>}</div></div> : <div className={styles.nodeBody}><span className={styles.nodeSignal} /><b>{data.label}</b>{data.detail && <small>{data.detail}</small>}</div>}
  </div>
}

const nodeTypes = { sofi: SofiNode }

function template(type: 'flow' | 'mind' | 'swot' | 'journey'): Snapshot {
  if (type === 'mind') {
    const center = node('Objetivo central', 520, 260, 'title', '#725cff', 'Mapa mental')
    const branches = [
      node('Pessoas', 120, 80, 'sticky', '#00a9e0'), node('Processos', 920, 80, 'sticky', '#10b981'),
      node('Recursos', 120, 470, 'sticky', '#ffb000'), node('Resultados', 920, 470, 'sticky', '#ff6b8a'),
    ]
    return { nodes: [center, ...branches], edges: branches.map(item => edge(center.id, item.id)) }
  }
  if (type === 'swot') {
    const frame = node('Análise estratégica', 210, 50, 'frame', '#725cff', 'Matriz SWOT')
    const cards = [
      node('Forças', 290, 170, 'sticky', '#10b981', 'Vantagens internas'), node('Fraquezas', 650, 170, 'sticky', '#ff6b8a', 'Pontos internos'),
      node('Oportunidades', 290, 410, 'sticky', '#00a9e0', 'Cenário externo'), node('Ameaças', 650, 410, 'sticky', '#ffb000', 'Riscos externos'),
    ]
    return { nodes: [frame, ...cards], edges: [] }
  }
  if (type === 'journey') {
    const steps = ['Descoberta', 'Primeiro contato', 'Atendimento', 'Decisão', 'Relacionamento'].map((label, index) => node(label, 80 + index * 270, 220, 'process', palette[index], `Etapa ${index + 1}`))
    return { nodes: steps, edges: steps.slice(0, -1).map((item, index) => edge(item.id, steps[index + 1].id)) }
  }
  const steps = [node('Início', 80, 220, 'process', '#10b981'), node('Executar atividade', 380, 220, 'process', '#00a9e0'), node('Está correto?', 700, 220, 'decision', '#725cff'), node('Finalizar', 1020, 100, 'process', '#10b981'), node('Corrigir', 1020, 350, 'process', '#ffb000')]
  return { nodes: steps, edges: [edge(steps[0].id, steps[1].id), edge(steps[1].id, steps[2].id), edge(steps[2].id, steps[3].id, 'Sim'), edge(steps[2].id, steps[4].id, 'Não'), edge(steps[4].id, steps[1].id)] }
}

export default function QuadrosPage() {
  return <AdminLayout><ReactFlowProvider><VisualWorkspace /></ReactFlowProvider></AdminLayout>
}

function VisualWorkspace() {
  const initial = useMemo(starterBoard, [])
  const [boards, setBoards] = useState<Board[]>([initial])
  const [activeId, setActiveId] = useState(initial.id)
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges)
  const [loaded, setLoaded] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [boardsOpen, setBoardsOpen] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [saved, setSaved] = useState(true)
  const history = useRef<{ past: Snapshot[]; future: Snapshot[] }>({ past: [], future: [] })
  const dragSnapshot = useRef<Snapshot | null>(null)
  const flow = useReactFlow<FlowNode, Edge>()
  const instance = useRef<ReactFlowInstance<FlowNode, Edge> | null>(null)
  const importInput = useRef<HTMLInputElement>(null)

  const active = boards.find(board => board.id === activeId) || boards[0]
  const selected = nodes.find(item => item.id === selectedId)

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Board[]
      if (stored.length) {
        setBoards(stored)
        setActiveId(stored[0].id)
        setNodes(stored[0].nodes)
        setEdges(stored[0].edges)
      }
    } catch {}
    setLoaded(true)
  }, [setEdges, setNodes])

  useEffect(() => {
    if (!loaded) return
    setSaved(false)
    const timer = window.setTimeout(() => {
      setBoards(current => {
        const next = current.map(board => board.id === activeId ? { ...board, nodes, edges, updatedAt: new Date().toISOString() } : board)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        return next
      })
      setSaved(true)
    }, 450)
    return () => window.clearTimeout(timer)
  }, [nodes, edges, activeId, loaded])

  const remember = useCallback((snapshot: Snapshot = { nodes, edges }) => {
    history.current.past.push(clone(snapshot))
    if (history.current.past.length > 40) history.current.past.shift()
    history.current.future = []
  }, [edges, nodes])

  const undo = useCallback(() => {
    const previous = history.current.past.pop()
    if (!previous) return
    history.current.future.push(clone({ nodes, edges }))
    setNodes(previous.nodes); setEdges(previous.edges)
  }, [edges, nodes, setEdges, setNodes])

  const redo = useCallback(() => {
    const next = history.current.future.pop()
    if (!next) return
    history.current.past.push(clone({ nodes, edges }))
    setNodes(next.nodes); setEdges(next.edges)
  }, [edges, nodes, setEdges, setNodes])

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest('input,textarea,[contenteditable=true]')) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo() }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && selected) { event.preventDefault(); duplicateSelected() }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  })

  function syncCurrent(list = boards) {
    const next = list.map(board => board.id === activeId ? { ...board, nodes, edges, updatedAt: new Date().toISOString() } : board)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    return next
  }

  function switchBoard(board: Board) {
    setBoards(current => syncCurrent(current))
    setActiveId(board.id); setNodes(board.nodes); setEdges(board.edges); setSelectedId('')
    history.current = { past: [], future: [] }; setBoardsOpen(false)
  }

  function createBoard() {
    const fresh: Board = { id: id('board'), name: `Novo quadro ${boards.length + 1}`, nodes: [], edges: [], updatedAt: new Date().toISOString() }
    const next = [...syncCurrent(), fresh]
    setBoards(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); switchBoard(fresh)
  }

  function renameBoard(name: string) {
    setBoards(current => {
      const next = current.map(board => board.id === activeId ? { ...board, name } : board)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  function removeBoard(boardId: string) {
    if (boards.length === 1 || !window.confirm('Excluir este quadro? Esta ação não pode ser desfeita.')) return
    const next = boards.filter(board => board.id !== boardId)
    setBoards(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    if (boardId === activeId) {
      setActiveId(next[0].id); setNodes(next[0].nodes); setEdges(next[0].edges); setSelectedId('')
      history.current = { past: [], future: [] }
    }
  }

  function addNode(kind: ElementKind) {
    remember()
    const position = flow.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    const labels: Record<ElementKind, string> = { process: 'Nova etapa', decision: 'Decisão?', sticky: 'Nova ideia', title: 'Novo tópico', frame: 'Novo espaço' }
    const created = node(labels[kind], position.x, position.y, kind, kind === 'sticky' ? '#ffb000' : '#00a9e0')
    setNodes(current => [...current, created]); setSelectedId(created.id)
  }

  function duplicateSelected() {
    if (!selected) return
    remember()
    const copy: FlowNode = { ...clone(selected), id: id(), selected: false, position: { x: selected.position.x + 36, y: selected.position.y + 36 } }
    setNodes(current => [...current.map(item => ({ ...item, selected: false })), copy]); setSelectedId(copy.id)
  }

  function updateSelected(data: Partial<FlowData>) {
    if (!selectedId) return
    setNodes(current => current.map(item => item.id === selectedId ? { ...item, data: { ...item.data, ...data } } : item))
  }

  function deleteSelected() {
    if (!selectedId) return
    remember(); setNodes(current => current.filter(item => item.id !== selectedId)); setEdges(current => current.filter(item => item.source !== selectedId && item.target !== selectedId)); setSelectedId('')
  }

  function applyTemplate(type: 'flow' | 'mind' | 'swot' | 'journey') {
    if (nodes.length && !window.confirm('Aplicar o modelo substituirá o conteúdo atual. Continuar?')) return
    remember(); const next = template(type); setNodes(next.nodes); setEdges(next.edges); setTemplatesOpen(false); window.setTimeout(() => flow.fitView({ padding: 0.18, duration: 500 }), 50)
  }

  async function exportPng() {
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement | null
    if (!viewport) return
    const dataUrl = await toPng(viewport, { backgroundColor: '#f7fbff', pixelRatio: 2, cacheBust: true })
    const anchor = document.createElement('a'); anchor.href = dataUrl; anchor.download = `${active?.name || 'quadro-sofi'}.png`; anchor.click()
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ product: 'SOFI Visual', version: 1, board: { ...active, nodes, edges } }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${active?.name || 'quadro-sofi'}.json`; anchor.click(); URL.revokeObjectURL(url)
  }

  async function importJson(file?: File) {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      const incoming = parsed.board || parsed
      if (!Array.isArray(incoming.nodes) || !Array.isArray(incoming.edges)) throw new Error('Quadro inválido')
      remember(); setNodes(incoming.nodes); setEdges(incoming.edges); if (incoming.name) renameBoard(incoming.name)
      window.setTimeout(() => flow.fitView({ padding: 0.2, duration: 500 }), 50)
    } catch { window.alert('Não foi possível importar este arquivo.') }
  }

  const onConnect = useCallback((connection: Connection) => { remember(); setEdges(current => addEdge({ ...connection, ...edge(connection.source!, connection.target!) }, current)) }, [remember, setEdges])

  return <div className={styles.page}>
    <header className={styles.workspaceHeader}>
      <div className={styles.boardIdentity}><div className={styles.boardSwitcher}><button onClick={() => setBoardsOpen(value => !value)}><Squares2X2Icon /><span>Meus quadros</span><ChevronDownIcon /></button>{boardsOpen && <div className={styles.boardMenu}><div className={styles.boardMenuHead}><b>Quadros visuais</b><button onClick={createBoard}><FolderPlusIcon />Novo</button></div>{boards.map(board => <div key={board.id} className={`${styles.boardRow} ${board.id === activeId ? styles.boardRowActive : ''}`}><button onClick={() => switchBoard(board)}><span>{board.name}</span><small>{board.nodes.length} elementos</small></button><button onClick={() => removeBoard(board.id)} title="Excluir quadro"><TrashIcon /></button></div>)}</div>}</div><input value={active?.name || ''} onChange={event => renameBoard(event.target.value)} aria-label="Nome do quadro" /><span className={saved ? styles.saved : styles.saving}>{saved ? 'Salvo' : 'Salvando...'}</span></div>
      <div className={styles.headerActions}><button onClick={undo} disabled={!history.current.past.length} title="Desfazer"><ArrowPathIcon className={styles.undoIcon} /></button><button onClick={redo} disabled={!history.current.future.length} title="Refazer"><ArrowPathIcon /></button><button onClick={() => setTemplatesOpen(value => !value)}><RectangleGroupIcon />Modelos</button><div className={styles.exportMenu}><button><ShareIcon />Exportar<ChevronDownIcon /></button><div><button onClick={exportPng}>Imagem PNG</button><button onClick={exportJson}>Arquivo do quadro</button><button onClick={() => importInput.current?.click()}>Importar quadro</button></div></div><input ref={importInput} type="file" accept="application/json,.json" className={styles.hidden} onChange={event => { importJson(event.target.files?.[0]); event.currentTarget.value = '' }} /></div>
    </header>

    <div className={styles.canvasShell}>
      <aside className={styles.tools} aria-label="Ferramentas do quadro">
        <button className={styles.activeTool} title="Selecionar"><CursorArrowRaysIcon /></button><span />
        <button onClick={() => addNode('sticky')} title="Nota adesiva"><span className={styles.stickyGlyph} /></button>
        <button onClick={() => addNode('process')} title="Processo"><span className={styles.processGlyph} /></button>
        <button onClick={() => addNode('decision')} title="Decisão"><span className={styles.decisionGlyph} /></button>
        <button onClick={() => addNode('title')} title="Texto"><b className={styles.textGlyph}>T</b></button>
        <button onClick={() => addNode('frame')} title="Espaço"><RectangleGroupIcon /></button><span />
        <button onClick={() => setTemplatesOpen(true)} title="Modelos"><SparklesIcon /></button>
      </aside>

      {templatesOpen && <section className={styles.templates}><div><p>Biblioteca de modelos</p><h2>Comece com uma estrutura profissional</h2></div><button className={styles.closePanel} onClick={() => setTemplatesOpen(false)}>Fechar</button><div className={styles.templateGrid}><button onClick={() => applyTemplate('flow')}><PresentationChartBarIcon /><b>Fluxograma</b><small>Processos e decisões</small></button><button onClick={() => applyTemplate('mind')}><SparklesIcon /><b>Mapa mental</b><small>Ideias conectadas</small></button><button onClick={() => applyTemplate('swot')}><Squares2X2Icon /><b>Matriz SWOT</b><small>Análise estratégica</small></button><button onClick={() => applyTemplate('journey')}><MapIcon /><b>Jornada</b><small>Experiência por etapas</small></button></div></section>}

      <ReactFlow<FlowNode, Edge>
        nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
        onInit={value => { instance.current = value }} onNodeClick={(_, current) => setSelectedId(current.id)} onPaneClick={event => { setSelectedId(''); if (event.detail === 2) { const position = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }); remember(); setNodes(current => [...current, node('Nova ideia', position.x, position.y, 'sticky', '#ffb000')]) } }}
        onNodeDoubleClick={(_, current) => { const label = window.prompt('Editar texto do elemento', current.data.label); if (label?.trim()) { remember(); setNodes(list => list.map(item => item.id === current.id ? { ...item, data: { ...item.data, label: label.trim() } } : item)) } }}
        onNodeDragStart={() => { dragSnapshot.current = clone({ nodes, edges }) }} onNodeDragStop={() => { if (dragSnapshot.current) remember(dragSnapshot.current); dragSnapshot.current = null }}
        fitView fitViewOptions={{ padding: 0.18 }} minZoom={0.15} maxZoom={2.5} snapToGrid snapGrid={[16, 16]} deleteKeyCode={['Backspace', 'Delete']}
        selectionOnDrag panOnScroll panOnDrag={[1, 2]} zoomOnDoubleClick={false} proOptions={{ hideAttribution: true }}
        ariaLabelConfig={{ 'node.a11yDescription.default': 'Pressione Enter para selecionar este elemento', 'controls.ariaLabel': 'Controles do quadro', 'minimap.ariaLabel': 'Minimapa do quadro' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#bdd0df" />
        <MiniMap<FlowNode> pannable zoomable position="bottom-right" nodeColor={current => current.data.color} nodeStrokeColor="#ffffff" nodeStrokeWidth={3} bgColor="rgba(255,255,255,.94)" maskColor="rgba(7,30,58,.08)" />
        <Controls position="bottom-left" showInteractive={false} />
        <Panel position="bottom-center" className={styles.canvasStatus}><span>{nodes.length} elementos</span><i />Duplo clique no canvas cria uma nota</Panel>
      </ReactFlow>

      {selected && <aside className={styles.inspector}><div className={styles.inspectorHead}><div><span>PROPRIEDADES</span><h3>Editar elemento</h3></div><button onClick={() => setSelectedId('')}>Fechar</button></div><label>Título<input value={selected.data.label} onChange={event => updateSelected({ label: event.target.value })} /></label><label>Descrição<textarea value={selected.data.detail || ''} onChange={event => updateSelected({ detail: event.target.value })} rows={3} /></label><div><span className={styles.fieldLabel}>Cor</span><div className={styles.swatches}>{palette.map(color => <button key={color} onClick={() => updateSelected({ color })} style={{ background: color }} aria-label={`Usar cor ${color}`} className={selected.data.color === color ? styles.swatchActive : ''} />)}</div></div><div className={styles.inspectorActions}><button onClick={duplicateSelected}><DocumentDuplicateIcon />Duplicar</button><button onClick={deleteSelected} className={styles.danger}><TrashIcon />Excluir</button></div></aside>}
    </div>
  </div>
}
