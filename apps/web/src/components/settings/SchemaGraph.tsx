import { useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitFork, Layers, Info } from 'lucide-react';

interface SchemaNode {
  id: string;
  label: string;
  type: 'standard' | 'custom';
  fields: { name: string; type: string; isLookup?: boolean; relatedTo?: string }[];
  x: number;
  y: number;
}

interface SchemaLink {
  source: string;
  target: string;
  label: string;
  field: string;
}

interface SchemaGraphProps {
  objects: any[];
  fieldsByObject: Record<string, any[]>;
}

export function SchemaGraph({ objects = [], fieldsByObject = {} }: SchemaGraphProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);

  // Layout node definitions dynamically
  const nodes = useMemo<SchemaNode[]>(() => {
    // Standard Nodes
    const list: SchemaNode[] = [
      {
        id: 'Party',
        label: 'Party (Contact/Lead)',
        type: 'standard',
        x: 120,
        y: 130,
        fields: [
          { name: 'name', type: 'text' },
          { name: 'type', type: 'select' },
          { name: 'email', type: 'email' },
          { name: 'phone_raw', type: 'phone' }
        ]
      },
      {
        id: 'Case',
        label: 'Case (Ticket/Deal)',
        type: 'standard',
        x: 480,
        y: 80,
        fields: [
          { name: 'title', type: 'text' },
          { name: 'stage', type: 'text' },
          { name: 'assigned_to_id', type: 'lookup', isLookup: true, relatedTo: 'User' },
          { name: 'party_id', type: 'lookup', isLookup: true, relatedTo: 'Party' }
        ]
      },
      {
        id: 'Interaction',
        label: 'Interaction (Timeline)',
        type: 'standard',
        x: 480,
        y: 280,
        fields: [
          { name: 'channel', type: 'select' },
          { name: 'direction', type: 'select' },
          { name: 'party_id', type: 'lookup', isLookup: true, relatedTo: 'Party' }
        ]
      }
    ];

    // Add Custom Objects
    objects.forEach((obj, idx) => {
      const customFields = fieldsByObject[obj.api_name] || [];
      const fieldsList = customFields.map(f => ({
        name: f.name,
        type: f.field_type,
        isLookup: f.field_type === 'lookup',
        relatedTo: f.related_to
      }));

      // Distribute custom nodes below or in a grid
      const x = 120 + (idx % 2) * 360;
      const y = 430 + Math.floor(idx / 2) * 160;

      list.push({
        id: obj.api_name,
        label: `${obj.singular_label} (Custom)`,
        type: 'custom',
        x,
        y,
        fields: [
          { name: 'name', type: 'text' },
          ...fieldsList.slice(0, 3) // Show first few fields
        ]
      });
    });

    return list;
  }, [objects, fieldsByObject]);

  // Links resolution
  const links = useMemo<SchemaLink[]>(() => {
    const list: SchemaLink[] = [
      { source: 'Case', target: 'Party', label: 'belongs to', field: 'party_id' },
      { source: 'Interaction', target: 'Party', label: 'associated with', field: 'party_id' }
    ];

    // Read custom object lookup relationships
    nodes.forEach(node => {
      node.fields.forEach(f => {
        if (f.isLookup && f.relatedTo) {
          // Check if target node exists in our graph
          const targetExists = nodes.some(n => n.id === f.relatedTo);
          if (targetExists) {
            list.push({
              source: node.id,
              target: f.relatedTo,
              label: `references`,
              field: f.name
            });
          }
        }
      });
    });

    return list;
  }, [nodes]);

  return (
    <Card className="bg-white border-[#e2e8f0] rounded-xl shadow-none overflow-hidden">
      <CardHeader className="pb-3 border-b border-[#e2e8f0]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-500">
            <GitFork size={15} />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-[#0f172a]">
              Relationship Schema Graph
            </CardTitle>
            <CardDescription className="text-[11px] text-[#94a3b8]">
              Interactive visual map of database connections, entity lookups, and primary keys.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 relative bg-slate-50/20">
        <div className="overflow-x-auto min-h-[480px] p-4 flex justify-center">
          <svg 
            width={640} 
            height={600} 
            className="rounded-lg border border-slate-100/50 bg-slate-900/5 select-none"
          >
            {/* Grid Patterns for premium look */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(148, 163, 184, 0.05)" strokeWidth="1"/>
              </pattern>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#cbd5e1" />
              </marker>
              <marker
                id="arrow-active"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#6366f1" />
              </marker>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Link paths */}
            {links.map((link, idx) => {
              const sourceNode = nodes.find(n => n.id === link.source);
              const targetNode = nodes.find(n => n.id === link.target);
              if (!sourceNode || !targetNode) return null;

              // Calculate start and end coordinates of lookups
              const sx = sourceNode.x + 80;
              const sy = sourceNode.y + 40;
              const tx = targetNode.x + 80;
              const ty = targetNode.y + 40;

              const isHighlighted = 
                hoveredNode === link.source || 
                hoveredNode === link.target ||
                hoveredLink === `${link.source}-${link.target}`;

              // Bezier curve calculations for organic linkages
              const dx = tx - sx;
              const dy = ty - sy;
              const cx1 = sx + dx * 0.5;
              const cy1 = sy;
              const cx2 = sx + dx * 0.5;
              const cy2 = ty;

              const pathData = `M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`;

              return (
                <g 
                  key={idx}
                  onMouseEnter={() => setHoveredLink(`${link.source}-${link.target}`)}
                  onMouseLeave={() => setHoveredLink(null)}
                  className="cursor-pointer"
                >
                  {/* Thick invisible path for easier hovering */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={16}
                  />
                  <path
                    d={pathData}
                    fill="none"
                    stroke={isHighlighted ? '#6366f1' : '#e2e8f0'}
                    strokeWidth={isHighlighted ? 2.5 : 1.5}
                    strokeDasharray={isHighlighted ? '0' : '4, 4'}
                    markerEnd={`url(#${isHighlighted ? 'arrow-active' : 'arrow'})`}
                    className="transition-all duration-300"
                  />
                  {/* Label tooltip for relations */}
                  {isHighlighted && (
                    <foreignObject
                      x={(sx + tx) / 2 - 50}
                      y={(sy + ty) / 2 - 12}
                      width={100}
                      height={24}
                    >
                      <div className="bg-slate-900/90 text-white font-mono text-[8px] rounded px-1.5 py-0.5 text-center shadow-md border border-slate-700/50 truncate">
                        {link.field}
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            })}

            {/* Nodes group */}
            {nodes.map((node) => {
              const isTargetHovered = hoveredNode === node.id;
              const isLinkedToHovered = links.some(l => 
                (hoveredNode === l.source && node.id === l.target) ||
                (hoveredNode === l.target && node.id === l.source)
              );

              return (
                <g 
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className="cursor-pointer"
                >
                  {/* Card wrapper */}
                  <rect
                    width={180}
                    height={110}
                    rx={10}
                    fill="#ffffff"
                    stroke={isTargetHovered ? '#6366f1' : isLinkedToHovered ? '#818cf8' : '#e2e8f0'}
                    strokeWidth={isTargetHovered ? 2 : 1}
                    className="shadow-xs transition-all duration-200"
                  />
                  {/* Title tab block */}
                  <rect
                    width={180}
                    height={28}
                    rx={10}
                    fill={node.type === 'custom' ? '#f5f3ff' : '#f8fafc'}
                    clipPath="inset(0 0 10 0)"
                  />
                  <line
                    x1={0}
                    y1={28}
                    x2={180}
                    y2={28}
                    stroke={isTargetHovered ? '#6366f1' : '#e2e8f0'}
                    strokeWidth={1}
                  />

                  {/* Header Title Text */}
                  <text
                    x={10}
                    y={18}
                    fill="#0f172a"
                    fontSize={10}
                    fontWeight="bold"
                    fontFamily="Inter, system-ui, sans-serif"
                  >
                    {node.label}
                  </text>

                  {/* Subtitle Badge Indicator */}
                  <rect
                    x={130}
                    y={6}
                    width={40}
                    height={14}
                    rx={3}
                    fill={node.type === 'custom' ? '#8b5cf6' : '#64748b'}
                    opacity={0.15}
                  />
                  <text
                    x={150}
                    y={16}
                    fill={node.type === 'custom' ? '#7c3aed' : '#334155'}
                    fontSize={7}
                    fontWeight="bold"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {node.type === 'custom' ? 'CUSTOM' : 'SYSTEM'}
                  </text>

                  {/* Fields lists render */}
                  {node.fields.slice(0, 3).map((field, fIdx) => (
                    <g key={field.name} transform={`translate(10, ${38 + fIdx * 20})`}>
                      {/* Bullet icon type */}
                      <circle
                        cx={4}
                        cy={10}
                        r={2.5}
                        fill={field.isLookup ? '#6366f1' : '#94a3b8'}
                      />
                      {/* Field name */}
                      <text
                        x={14}
                        y={13}
                        fill="#334155"
                        fontSize={9}
                        fontFamily="monospace"
                      >
                        {field.name}
                      </text>
                      {/* Field Type */}
                      <text
                        x={160}
                        y={13}
                        fill="#94a3b8"
                        fontSize={8}
                        textAnchor="end"
                        fontFamily="monospace"
                      >
                        {field.type}
                      </text>
                    </g>
                  ))}

                  {/* Count indicator overlay */}
                  {node.fields.length > 3 && (
                    <text
                      x={10}
                      y={102}
                      fill="#94a3b8"
                      fontSize={7}
                      fontStyle="italic"
                    >
                      + {node.fields.length - 3} other fields defined
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Small Legend Block */}
        <div className="p-3 border-t border-[#e2e8f0] bg-slate-50/50 flex items-center justify-between text-[10px] text-slate-500 font-medium">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-slate-200 border border-slate-300 inline-block" />
              System Entities
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-violet-100 border border-violet-300 inline-block" />
              Custom Objects
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t border-dashed border-[#6366f1] inline-block" />
              Lookup Relationships
            </span>
          </div>
          <span className="text-slate-400 italic">Hover nodes or lines to trace paths</span>
        </div>
      </CardContent>
    </Card>
  );
}
