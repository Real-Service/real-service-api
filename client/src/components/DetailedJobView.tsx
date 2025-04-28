import { useState } from 'react';
import { 
  Wrench, Clock, MapPin, DollarSign, Calendar, List, 
  UserCircle, Package, ClipboardList, HandCoins, MessageSquare,
  PlusCircle, XCircle, CheckCircle, Hammer 
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Badge,
  ScrollArea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Card,
  CardContent,
  Separator,
} from '@/components/ui';
import { CategoryIcon } from './CategoryIcon';
import { ProgressBar } from './ProgressBar';
import { ExtendedJob, Job } from '@shared/schema';
import { formatCurrency, formatDistance, formatDate } from '@/lib/utils';

type DetailedJobViewProps = {
  job: ExtendedJob | null;
  isOpen: boolean;
  onClose: () => void;
  onPlaceBid: () => void;
  onUpdateBid?: () => void;
  onWithdrawBid?: () => void;
  onContact?: () => void;
  hasBid: boolean;
  bidStatus?: 'pending' | 'accepted' | 'rejected';
};

export function DetailedJobView({
  job,
  isOpen,
  onClose,
  onPlaceBid,
  onUpdateBid,
  onWithdrawBid,
  onContact,
  hasBid,
  bidStatus
}: DetailedJobViewProps) {
  const [activeTab, setActiveTab] = useState('details');

  if (!job) return null;
  
  // Utility functions to extract structured data from job
  const getRequirements = (job: ExtendedJob): string[] => {
    const requirements: string[] = [];
    
    // Extract skills/requirements from job description
    const descLines = job.description.split(/\n+/);
    let inRequirementsSection = false;
    
    for (const line of descLines) {
      const trimmedLine = line.trim().toLowerCase();
      
      if (trimmedLine.includes('requirements') || 
          trimmedLine.includes('qualifications') || 
          trimmedLine.includes('skills needed')) {
        inRequirementsSection = true;
        continue;
      }
      
      if (inRequirementsSection) {
        // If we hit another section header, stop collecting requirements
        if (trimmedLine.endsWith(':') || trimmedLine.endsWith('*')) {
          break;
        }
        
        // Extract bullet points or numbered items
        const itemMatch = line.match(/^[\s-•*]*(\d+\.|\*|\-|\•|\–)?\s*(.+)$/);
        
        if (itemMatch && itemMatch[2] && itemMatch[2].length > 3) {
          requirements.push(itemMatch[2].trim());
        }
      }
    }
    
    // If no structured requirements found, look for keyword phrases
    if (requirements.length === 0) {
      const skillKeywords = [
        'experience with', 'knowledge of', 'familiar with', 
        'certified in', 'ability to', 'proficient in',
        'understanding of', 'skills in'
      ];
      
      for (const line of descLines) {
        for (const keyword of skillKeywords) {
          if (line.toLowerCase().includes(keyword)) {
            requirements.push(line.trim());
            break;
          }
        }
      }
    }
    
    // Add requested skills from categoryTags if available
    if (job.categoryTags && Array.isArray(job.categoryTags)) {
      job.categoryTags.forEach(tag => {
        const formattedTag = `Experience with ${tag.charAt(0).toUpperCase() + tag.slice(1)} work`;
        if (!requirements.includes(formattedTag)) {
          requirements.push(formattedTag);
        }
      });
    }
    
    return requirements.slice(0, 5); // Limit to 5 requirements
  };
  
  const getMaterialsInfo = (job: ExtendedJob): { providedByClient: boolean, materials: string[] } => {
    const result = {
      providedByClient: false,
      materials: [] as string[]
    };
    
    const descriptionLower = job.description.toLowerCase();
    
    // Check if materials are provided by client
    if (descriptionLower.includes('materials provided') || 
        descriptionLower.includes('materials will be provided') ||
        descriptionLower.includes('provide all materials') ||
        descriptionLower.includes('materials are on site')) {
      result.providedByClient = true;
    }
    
    // Extract material list if mentioned
    const materialsRegex = /materials(needed|required|list)?:([^:]+)/i;
    const materialsMatch = job.description.match(materialsRegex);
    
    if (materialsMatch && materialsMatch[2]) {
      const materialsText = materialsMatch[2].trim();
      const materialItems = materialsText.split(/[,\n]/).map(item => item.trim()).filter(item => item.length > 0);
      result.materials = materialItems;
    }
    
    return result;
  };
  
  const getToolsRequired = (job: ExtendedJob): string[] => {
    const tools: string[] = [];
    
    // Check for tools section in description
    const toolsRegex = /tools(needed|required|list)?:([^:]+)/i;
    const toolsMatch = job.description.match(toolsRegex);
    
    if (toolsMatch && toolsMatch[2]) {
      const toolsText = toolsMatch[2].trim();
      return toolsText.split(/[,\n]/).map(item => item.trim()).filter(item => item.length > 0);
    }
    
    // Extract likely tool mentions
    const commonTools = [
      'hammer', 'drill', 'saw', 'ladder', 'screwdriver', 'wrench', 
      'pliers', 'level', 'tape measure', 'safety equipment'
    ];
    
    commonTools.forEach(tool => {
      if (job.description.toLowerCase().includes(tool)) {
        tools.push(tool.charAt(0).toUpperCase() + tool.slice(1));
      }
    });
    
    return tools;
  };
  
  const getEstimatedDuration = (job: ExtendedJob): string => {
    // Check for explicit duration mentions
    const durationRegex = /(estimated|expected|approx|approximately|about|around)?\s*(time|duration|timeframe):?\s*([^.,\n]+)/i;
    const durationMatch = job.description.match(durationRegex);
    
    if (durationMatch && durationMatch[3]) {
      return durationMatch[3].trim();
    }
    
    // Look for duration mentions in general text
    const timeReferences = [
      { regex: /(\d+)\s*day/i, format: (matches: any) => `${matches[1]} day(s)` },
      { regex: /(\d+)\s*hour/i, format: (matches: any) => `${matches[1]} hour(s)` },
      { regex: /(\d+)-(\d+)\s*day/i, format: (matches: any) => `${matches[1]}-${matches[2]} days` },
      { regex: /(\d+)-(\d+)\s*hour/i, format: (matches: any) => `${matches[1]}-${matches[2]} hours` },
      { regex: /(\d+)\s*week/i, format: (matches: any) => `${matches[1]} week(s)` },
      { regex: /half\s*day/i, format: () => "Half day" },
      { regex: /full\s*day/i, format: () => "Full day" },
      { regex: /one\s*day/i, format: () => "1 day" },
      { regex: /two\s*day/i, format: () => "2 days" },
    ];
    
    for (const ref of timeReferences) {
      const match = job.description.match(ref.regex);
      if (match) {
        return ref.format(match);
      }
    }
    
    // Default fallback
    return "Not specified";
  };
  
  const getJobImages = (job: ExtendedJob): string[] => {
    if (job.images && Array.isArray(job.images) && job.images.length > 0) {
      return job.images;
    }
    
    // Return empty array if no images
    return [];
  };
  
  const getLocationString = (job: ExtendedJob): string => {
    const location = job.location;
    
    if (location.address) {
      return location.address;
    }
    
    if (location.city && location.state) {
      return `${location.city}, ${location.state}`;
    }
    
    if (location.city) {
      return location.city;
    }
    
    return "Location not specified";
  };

  // Extract data using utility functions
  const requirements = getRequirements(job);
  const materialsInfo = getMaterialsInfo(job);
  const toolsRequired = getToolsRequired(job);
  const estimatedDuration = getEstimatedDuration(job);
  const images = getJobImages(job);
  const locationStr = getLocationString(job);
  
  // Determine urgency level
  const isUrgent = job.description.toLowerCase().includes('urgent') || 
                  job.description.toLowerCase().includes('emergency') ||
                  job.description.toLowerCase().includes('asap');
  
  // Determine job size based on budget or description
  let jobSize = 'Medium';
  if (job.budget) {
    if (job.budget < 300) {
      jobSize = 'Small';
    } else if (job.budget > 1000) {
      jobSize = 'Large';
    }
  } else {
    // Try to infer from description
    const descLower = job.description.toLowerCase();
    if (descLower.includes('small job') || descLower.includes('quick job') || descLower.includes('minor')) {
      jobSize = 'Small';
    } else if (descLower.includes('large job') || descLower.includes('major') || descLower.includes('complex')) {
      jobSize = 'Large';
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-start justify-between w-full">
            <div>
              <DialogTitle className="text-xl">{job.title}</DialogTitle>
              <div className="flex flex-wrap gap-2 mt-2">
                {Array.isArray(job.categoryTags) && job.categoryTags.map((tag, index) => (
                  <Badge variant="outline" key={index} className="flex items-center gap-1">
                    <CategoryIcon category={tag.toLowerCase()} />
                    {tag}
                  </Badge>
                ))}
                {isUrgent && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Urgent
                  </Badge>
                )}
                <Badge variant="outline" className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  {jobSize} Job
                </Badge>
              </div>
            </div>
            
            {job.status === 'in_progress' && job.progress !== null && (
              <div className="w-40">
                <p className="text-xs font-medium mb-1">Job Progress</p>
                <ProgressBar value={job.progress} showValue={true} />
              </div>
            )}
          </div>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-6">
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1">
                <ClipboardList className="h-4 w-4 mr-2" />
                Details
              </TabsTrigger>
              <TabsTrigger value="requirements" className="flex-1">
                <List className="h-4 w-4 mr-2" />
                Requirements
              </TabsTrigger>
              {images.length > 0 && (
                <TabsTrigger value="photos" className="flex-1">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Photos ({images.length})
                </TabsTrigger>
              )}
            </TabsList>
          </div>
          
          <ScrollArea className="max-h-[calc(90vh-200px)] mt-4">
            <TabsContent value="details" className="m-0 p-6 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-sm mb-3">Job Description</h3>
                  <p className="whitespace-pre-line text-sm">{job.description}</p>
                  
                  <div className="mt-6">
                    <h3 className="font-semibold text-sm mb-3">Job Info</h3>
                    <div className="space-y-3">
                      <div className="flex items-start">
                        <MapPin className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm">{locationStr}</span>
                      </div>
                      
                      <div className="flex items-start">
                        <Calendar className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="text-sm">Posted on {formatDate(job.createdAt)}</p>
                          {job.deadline && (
                            <p className="text-sm mt-1">Due by {formatDate(job.deadline)}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-start">
                        <Clock className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm">Estimated duration: {estimatedDuration}</span>
                      </div>
                      
                      <div className="flex items-start">
                        <DollarSign className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm">
                          {job.budget ? (
                            <>Budget: {formatCurrency(job.budget)}</>
                          ) : (
                            <>No budget specified</>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm mb-3">Materials</h3>
                      {materialsInfo.providedByClient ? (
                        <div className="flex items-center mb-3">
                          <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                          <span className="text-sm">Materials provided by client</span>
                        </div>
                      ) : (
                        <div className="flex items-center mb-3">
                          <XCircle className="h-4 w-4 mr-2 text-yellow-500" />
                          <span className="text-sm">Contractor must provide materials</span>
                        </div>
                      )}
                      
                      {materialsInfo.materials.length > 0 ? (
                        <ul className="space-y-1.5 text-sm list-disc list-inside ml-1">
                          {materialsInfo.materials.map((material, index) => (
                            <li key={index}>{material}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No specific materials listed
                        </p>
                      )}
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm mb-3">Tools Required</h3>
                      {toolsRequired.length > 0 ? (
                        <ul className="space-y-1.5 text-sm list-disc list-inside ml-1">
                          {toolsRequired.map((tool, index) => (
                            <li key={index}>{tool}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="flex items-center">
                          <Wrench className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            No specific tools mentioned
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm mb-3">Client</h3>
                      <div className="flex items-center">
                        <UserCircle className="h-5 w-5 mr-2 text-muted-foreground" />
                        <span className="text-sm">Client #{job.landlordId}</span>
                      </div>
                      {onContact && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full mt-3"
                          onClick={onContact}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Contact Client
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
              
              <Separator className="my-6" />
              
              <div className="flex justify-between items-center">
                <div>
                  {job.status === "open" && (
                    <p className="text-sm text-muted-foreground">
                      This job is open for bidding
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {job.status === "open" && !hasBid && (
                    <Button onClick={onPlaceBid}>
                      <HandCoins className="h-4 w-4 mr-2" />
                      Place Bid
                    </Button>
                  )}
                  
                  {hasBid && bidStatus === "pending" && (
                    <>
                      {onUpdateBid && (
                        <Button variant="outline" onClick={onUpdateBid}>
                          <PlusCircle className="h-4 w-4 mr-2" />
                          Update Bid
                        </Button>
                      )}
                      
                      {onWithdrawBid && (
                        <Button variant="destructive" onClick={onWithdrawBid}>
                          <XCircle className="h-4 w-4 mr-2" />
                          Withdraw Bid
                        </Button>
                      )}
                    </>
                  )}
                  
                  {hasBid && bidStatus === "accepted" && (
                    <Badge className="px-4 py-1.5" variant="success">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Bid Accepted
                    </Badge>
                  )}
                  
                  {hasBid && bidStatus === "rejected" && (
                    <Badge className="px-4 py-1.5" variant="destructive">
                      <XCircle className="h-4 w-4 mr-2" />
                      Bid Rejected
                    </Badge>
                  )}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="requirements" className="m-0 p-6 pt-2">
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4">Job Requirements</h3>
                  {requirements.length > 0 ? (
                    <ul className="space-y-3">
                      {requirements.map((req, index) => (
                        <li key={index} className="flex items-start">
                          <Hammer className="h-4 w-4 mr-2 mt-0.5 text-primary flex-shrink-0" />
                          <span className="text-sm">{req}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No specific requirements listed for this job.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {images.length > 0 && (
              <TabsContent value="photos" className="m-0 p-6 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {images.map((imageUrl, index) => (
                    <img 
                      key={index}
                      src={imageUrl}
                      alt={`Job photo ${index + 1}`}
                      className="rounded-md object-cover aspect-video w-full"
                    />
                  ))}
                </div>
              </TabsContent>
            )}
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}