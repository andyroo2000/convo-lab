export default function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Grid of skeleton cards */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm p-6">
            {/* Title skeleton */}
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>

            {/* Subtitle skeleton */}
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>

            {/* Content lines skeleton */}
            <div className="space-y-2 mb-4">
              <div className="h-3 bg-gray-200 rounded w-full"></div>
              <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            </div>

            {/* Pills/tags skeleton */}
            <div className="flex gap-2 mb-4">
              <div className="h-6 bg-gray-200 rounded-full w-16"></div>
              <div className="h-6 bg-gray-200 rounded-full w-20"></div>
            </div>

            {/* Button skeleton */}
            <div className="h-10 bg-gray-200 rounded w-full"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
