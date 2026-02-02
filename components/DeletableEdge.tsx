import React from 'react';
import {
    BaseEdge,
    EdgeLabelRenderer,
    EdgeProps,
    getBezierPath,
    useInternalNode,
    useReactFlow,
} from '@xyflow/react';

const DeletableEdge = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
}: EdgeProps) => {
    const { setEdges } = useReactFlow();
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const onEdgeClick = (evt: React.MouseEvent) => {
        evt.stopPropagation();
        setEdges((edges) => edges.filter((edge) => edge.id !== id));
    };

    return (
        <>
            <BaseEdge
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    ...style,
                    strokeWidth: 3,
                    stroke: '#94a3b8',
                    transition: 'stroke 0.3s',
                }}
                className="react-flow__edge-path custom-edge"
            />

            {/* Animated Flow Line */}
            <path
                d={edgePath}
                fill="none"
                stroke="#10b981"
                strokeWidth={3}
                strokeDasharray="10,10"
                className="animated-edge-path"
            />

            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        fontSize: 12,
                        pointerEvents: 'all',
                    }}
                    className="nodrag nopan"
                >
                    <button
                        className="w-8 h-8 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-200 dark:hover:border-rose-900/30 transition-all hover:scale-110 active:scale-90 group"
                        onClick={onEdgeClick}
                        title="Remover conexão"
                    >
                        <span className="material-icons-round text-lg">delete_outline</span>
                    </button>
                </div>
            </EdgeLabelRenderer>
        </>
    );
};

export default DeletableEdge;
