'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Workflow,
  Plus,
  Trash2,
  Play,
  RotateCcw,
  GripVertical,
} from 'lucide-react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'

// Custom node component
function CalculationNode({ data }: { data: { label: string; type: string; formula?: string } }) {
  return (
    <div className="px-4 py-2 rounded-lg bg-background border-2 border-emerald-300 dark:border-emerald-700 shadow-md min-w-[150px]">
      <Handle type="target" position={Position.Left} className="!bg-emerald-500 !w-2 !h-2" />
      <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
        {data.type}
      </div>
      <div className="text-sm font-medium">{data.label}</div>
      {data.formula && (
        <div className="text-[10px] font-mono text-muted-foreground mt-1">{data.formula}</div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-emerald-500 !w-2 !h-2" />
    </div>
  )
}

const nodeTypes: NodeTypes = {
  calculation: CalculationNode,
}

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'calculation',
    position: { x: 50, y: 100 },
    data: { label: 'Load Current', type: 'INPUT', formula: 'I = P / (√3 × V × PF)' },
  },
  {
    id: '2',
    type: 'calculation',
    position: { x: 300, y: 50 },
    data: { label: 'Cable Selection', type: 'PROCESS', formula: 'Cable ≥ I × 1.25' },
  },
  {
    id: '3',
    type: 'calculation',
    position: { x: 300, y: 180 },
    data: { label: 'Voltage Drop', type: 'CALCULATION', formula: 'Vd = (2×L×I×R)/1000' },
  },
  {
    id: '4',
    type: 'calculation',
    position: { x: 550, y: 100 },
    data: { label: 'Cable Verification', type: 'DECISION', formula: 'Vd ≤ 2.5%?' },
  },
  {
    id: '5',
    type: 'calculation',
    position: { x: 800, y: 100 },
    data: { label: 'Final Selection', type: 'OUTPUT' },
  },
]

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#059669' } },
  { id: 'e1-3', source: '1', target: '3', animated: true, style: { stroke: '#059669' } },
  { id: 'e2-4', source: '2', target: '4', animated: true, style: { stroke: '#059669' } },
  { id: 'e3-4', source: '3', target: '4', animated: true, style: { stroke: '#059669' } },
  { id: 'e4-5', source: '4', target: '5', animated: true, style: { stroke: '#059669' } },
]

export function WorkflowBuilderSection() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onConnect = React.useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#059669' } }, eds)),
    [setEdges]
  )

  const addNode = (type: string) => {
    const newNode: Node = {
      id: `${Date.now()}`,
      type: 'calculation',
      position: { x: Math.random() * 400 + 50, y: Math.random() * 300 + 50 },
      data: { label: `Step ${nodes.length + 1}`, type, formula: '' },
    }
    setNodes((nds) => [...nds, newNode])
  }

  const clearCanvas = () => {
    setNodes([])
    setEdges([])
  }

  const loadExample = () => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Workflow className="h-5 w-5 text-emerald-600" />
            Workflow Builder
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Build visual engineering calculation workflows
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[250px_1fr] gap-4">
        {/* Toolbar */}
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Add Nodes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { type: 'INPUT', desc: 'Input parameter' },
                { type: 'CALCULATION', desc: 'Compute value' },
                { type: 'PROCESS', desc: 'Process step' },
                { type: 'DECISION', desc: 'Condition check' },
                { type: 'OUTPUT', desc: 'Final result' },
              ].map(({ type, desc }) => (
                <Button
                  key={type}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => addNode(type)}
                >
                  <Plus className="h-3 w-3 mr-2" />
                  <span className="font-medium">{type}</span>
                  <span className="text-muted-foreground ml-auto">{desc}</span>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full" onClick={loadExample}>
                <RotateCcw className="h-3 w-3 mr-2" />
                Load Example
              </Button>
              <Button variant="outline" size="sm" className="w-full" onClick={clearCanvas}>
                <Trash2 className="h-3 w-3 mr-2" />
                Clear Canvas
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Node Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs space-y-1 text-muted-foreground">
                <p>• Drag nodes to reposition</p>
                <p>• Connect by dragging between handles</p>
                <p>• Click nodes to select/delete</p>
                <p>• Scroll to zoom in/out</p>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Nodes:</span>
                <span className="font-bold">{nodes.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Connections:</span>
                <span className="font-bold">{edges.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Canvas */}
        <Card className="overflow-hidden">
          <div className="h-[calc(100vh-280px)] min-h-[400px]">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              fitView
              className="bg-background"
            >
              <Background color="#aaa" gap={16} />
              <Controls className="!bg-background !border-border" />
              <MiniMap
                className="!bg-background !border-border"
                nodeColor={() => '#059669'}
                maskColor="rgba(0, 0, 0, 0.1)"
              />
            </ReactFlow>
          </div>
        </Card>
      </div>
    </motion.div>
  )
}
