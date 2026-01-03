/**
 * Skeleton Loading Components
 * Provides skeleton placeholders instead of spinners
 */

export const Skeleton = ({ className = '', width, height, rounded = 'rounded' }) => {
  const style = {};
  if (width) style.width = width;
  if (height) style.height = height;
  
  return (
    <div
      className={`bg-white/10 animate-pulse ${rounded} ${className}`}
      style={style}
    />
  );
};

export const SkeletonText = ({ lines = 1, className = '' }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="0.75rem"
          className={i === lines - 1 ? 'w-3/4' : 'w-full'}
        />
      ))}
    </div>
  );
};

export const SkeletonCard = ({ className = '' }) => {
  return (
    <div className={`p-3 rounded-lg border bg-white/5 border-white/10 ${className}`}>
      <Skeleton height="1rem" className="w-2/3 mb-2" />
      <SkeletonText lines={2} />
    </div>
  );
};

export const SkeletonButton = ({ className = '' }) => {
  return (
    <div className={`flex gap-2 items-center p-2 rounded bg-white/5 ${className}`}>
      <Skeleton width="1rem" height="1rem" rounded="rounded" />
      <Skeleton height="0.75rem" className="w-24" />
    </div>
  );
};

