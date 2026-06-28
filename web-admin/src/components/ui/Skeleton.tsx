export function Skeleton({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-xl ${className}`}
      style={{ background: 'rgba(255,255,255,0.06)', ...style }}
    />
  )
}

export function SkeletonCard() {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <Skeleton style={{ height: 32, width: '40%', marginBottom: 12 }} />
      <Skeleton style={{ height: 14, width: '60%', marginBottom: 6 }} />
      <Skeleton style={{ height: 14, width: '40%' }} />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <Skeleton style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
      <div className="flex-1">
        <Skeleton style={{ height: 13, width: '55%', marginBottom: 5 }} />
        <Skeleton style={{ height: 11, width: '35%' }} />
      </div>
      <Skeleton style={{ height: 22, width: 70, borderRadius: 99 }} />
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="px-4 py-3" style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Skeleton style={{ height: 11, width: '80%' }} />
      </div>
      {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} />)}
    </div>
  )
}
