  // Grid View Implementation with the design from the provided image
  const GridView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
      {jobs.map((job) => {
        const timeUntil = getTimeUntilStart(job);
        const bidData = getBidData(job.id);
        const jobSize = getJobSize(job);
        const isUrgent = isJobUrgent(job);
        const biddingTimeLeft = getBiddingTimeLeft(job);

        return (
          <Card
            key={job.id}
            data-job-id={job.id}
            className={`overflow-hidden cursor-pointer bg-white border border-gray-200 shadow-sm rounded-lg text-gray-800 text-sm transition-all duration-200
              ${hoveredJobId === job.id || highlightedJobId === job.id ? "ring-1 ring-blue-400 shadow-md" : "hover:shadow-md"}
              relative
            `}
            onMouseEnter={() => handleJobHover(job.id)}
            onMouseLeave={() => handleJobHover(null)}
          >
            {/* Category tag - Top left */}
            {job.categoryTags &&
              Array.isArray(job.categoryTags) &&
              job.categoryTags.length > 0 && (
                <div className="absolute top-2 left-2 z-10">
                  <Badge
                    variant="secondary"
                    className="bg-green-600 text-white text-xs px-2 py-0.5 rounded font-medium"
                  >
                    {getCategoryDisplayName(String(job.categoryTags[0]))}
                  </Badge>
                </div>
              )}

            {/* Urgency badge - Top right */}
            {isUrgent && (
              <div className="absolute top-2 right-2 z-10">
                <Badge
                  variant="destructive"
                  className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-medium shadow-sm"
                >
                  URGENT
                </Badge>
              </div>
            )}

            {/* Card Content */}
            <CardContent className="p-4" onClick={() => onViewDetails ? onViewDetails(job) : onBidJob && onBidJob(job)}>
              {/* Header: Title + Budget with job size on second line */}
              <div className="mb-2">
                <div className="flex justify-between mb-1">
                  <h3 className="text-base font-semibold text-gray-800 line-clamp-1 hover:line-clamp-none transition-all" title={job.title}>
                    {job.title}
                  </h3>
                  <div className="text-base font-semibold text-green-600">
                    ${job.budget?.toFixed(2)}
                  </div>
                </div>
                <div className="flex justify-between">
                  <div className="text-xs text-gray-500 font-medium">
                    • {jobSize === "small" ? "Small Job" : jobSize === "medium" ? "Medium Job" : "Large Job"}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="mb-3">
                <p className="text-sm text-gray-700 line-clamp-2">
                  {job.description}
                </p>
              </div>

              {/* Posted time */}
              <div className="text-xs text-gray-500 mb-3">
                Posted {formatDistance(job.createdAt)}
              </div>

              {/* Property Owner Info */}
              <div className="flex items-center mb-3">
                <div className="h-6 w-6 rounded-full bg-yellow-300 text-yellow-600 flex items-center justify-center text-xs font-bold mr-2">
                  PO
                </div>
                <div className="text-sm font-medium">
                  Property Owner
                </div>
              </div>

              {/* Location */}
              <div className="flex items-center text-sm text-gray-700 mb-3">
                <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                <span className="truncate">
                  {typeof job.location === "object" && job.location !== null
                    ? `${(job.location as any)?.city || ""}, ${(job.location as any)?.state || ""}`
                    : "No location specified"}
                </span>
              </div>

              {/* Required Skills section */}
              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-700 mb-1">
                  Skills Required
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                    Pipe Installation
                  </Badge>
                  <Badge variant="outline" className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                    Fixture Replacement
                  </Badge>
                  <Badge variant="outline" className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                    Leak Repair
                  </Badge>
                  <Badge variant="outline" className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                    Communication Skills
                  </Badge>
                </div>
              </div>

              {/* Estimated Duration */}
              <div className="mb-4">
                <div className="flex justify-between text-xs">
                  <div className="font-semibold text-gray-700">Estimated Duration</div>
                  <div className="text-gray-700">
                    Posted<br/>
                    <span className="text-gray-500">{formatDistance(job.createdAt)}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-600">
                  1-2 days
                </div>
              </div>

              {/* Job Status */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-600 text-white text-xs px-2 py-0.5 rounded">
                    {job.status}
                  </Badge>
                  <span className="text-xs text-gray-600">
                    {bidData.count} bid{bidData.count !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200 my-2"></div>

              {/* Bottom - categories and action buttons */}
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  {job.categoryTags &&
                    Array.isArray(job.categoryTags) &&
                    job.categoryTags.length > 0 && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-100 text-xs">
                        {getCategoryDisplayName(String(job.categoryTags[0])).toLowerCase()}
                      </Badge>
                    )}
                </div>
                <div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-gray-600 hover:text-gray-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      toast({
                        title: "Message Poster",
                        description: "This feature is coming soon!",
                      });
                    }}
                  >
                    Message Poster
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="border border-gray-300 text-gray-700 hover:bg-gray-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDetails ? onViewDetails(job) : null;
                    }}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );