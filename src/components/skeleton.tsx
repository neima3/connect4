import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`bg-gray-200 rounded ${className}`}
    >
      <motion.div
        animate={{ x: ['-100%', '100%'] }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'linear',
        }}
        className="h-full w-1/3 bg-gradient-to-r from-transparent via-gray-300 to-transparent"
      />
    </motion.div>
  );
}

export function BoardSkeleton() {
  return (
    <div className="inline-block bg-gray-300 p-4 rounded-lg shadow-2xl">
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 42 }, (_, i) => (
          <Skeleton key={i} className="aspect-square rounded-full" />
        ))}
      </div>
    </div>
  );
}

export function ButtonSkeleton() {
  return <Skeleton className="h-12 w-full rounded-lg" />;
}

export function GameMenuSkeleton() {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl bg-white p-8 shadow-xl">
        <Skeleton className="h-12 w-32 mx-auto mb-8 rounded" />
        <div className="space-y-4">
          <ButtonSkeleton />
          <ButtonSkeleton />
          <ButtonSkeleton />
        </div>
        <Skeleton className="h-4 w-48 mx-auto mt-6 rounded" />
      </div>
    </div>
  );
}
