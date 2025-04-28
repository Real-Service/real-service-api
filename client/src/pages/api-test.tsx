import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export default function ApiTestPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [testEndpoint, setTestEndpoint] = useState("/api/jobs-fix/all-jobs");
  const [responseData, setResponseData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Predefined test endpoints
  const testEndpoints = [
    "/api/jobs-fix/all-jobs",
    `/api/jobs-fix/contractor-bids/${user?.id}`,
    `/api/jobs-fix/contractor-jobs/${user?.id}`,
    "/api/jobs-fix/job/1",
    "/api/jobs-fix/job-bids/1"
  ];
  
  async function testEndpointCall() {
    setIsLoading(true);
    setError(null);
    setResponseData(null);
    
    try {
      const response = await fetch(testEndpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(user?.id ? { "X-User-ID": String(user.id) } : {})
        },
        credentials: "include"
      });
      
      // Get the response as text first
      const responseText = await response.text();
      
      // Try to parse as JSON
      try {
        const data = JSON.parse(responseText);
        setResponseData(data);
      } catch (e) {
        // If not valid JSON, just show the text
        setResponseData({ raw: responseText });
      }
      
      if (!response.ok) {
        setError(`Error: ${response.status} ${response.statusText}`);
      } else {
        toast({
          title: "API Test Successful",
          description: `Endpoint ${testEndpoint} returned a successful response`,
          variant: "default"
        });
      }
    } catch (error) {
      setError(`Request failed: ${error instanceof Error ? error.message : String(error)}`);
      toast({
        title: "API Test Failed",
        description: `Error testing endpoint ${testEndpoint}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Add a test function for creating a bid
  async function testCreateBid() {
    setIsLoading(true);
    setError(null);
    setResponseData(null);
    
    if (!user?.id) {
      setError("User not authenticated");
      setIsLoading(false);
      return;
    }
    
    const testBidData = {
      jobId: 1,
      contractorId: user.id,
      amount: 100 + Math.floor(Math.random() * 900), // Random amount between 100-1000
      proposal: `Test bid proposal created at ${new Date().toISOString()}`,
      timeEstimate: "2 weeks"
    };
    
    try {
      const response = await fetch("/api/jobs-fix/create-bid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": String(user.id)
        },
        body: JSON.stringify(testBidData),
        credentials: "include"
      });
      
      // Get the response as text first
      const responseText = await response.text();
      
      // Try to parse as JSON
      try {
        const data = JSON.parse(responseText);
        setResponseData(data);
      } catch (e) {
        // If not valid JSON, just show the text
        setResponseData({ raw: responseText });
      }
      
      if (!response.ok) {
        setError(`Error: ${response.status} ${response.statusText}`);
        toast({
          title: "Bid Creation Failed",
          description: `Error: ${response.status} ${response.statusText}`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Bid Created Successfully",
          description: `Created bid with amount $${testBidData.amount}`,
          variant: "default"
        });
      }
    } catch (error) {
      setError(`Request failed: ${error instanceof Error ? error.message : String(error)}`);
      toast({
        title: "Bid Creation Failed",
        description: `Error: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">API Endpoint Testing Tool</h1>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Test API Endpoint</CardTitle>
          <CardDescription>
            Select or enter an API endpoint to test
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="endpoint">API Endpoint</Label>
              <Input 
                id="endpoint" 
                value={testEndpoint} 
                onChange={(e) => setTestEndpoint(e.target.value)}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>Predefined Endpoints</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {testEndpoints.map((endpoint) => (
                  <Button 
                    key={endpoint} 
                    variant="outline" 
                    size="sm"
                    onClick={() => setTestEndpoint(endpoint)}
                  >
                    {endpoint}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button 
            onClick={testEndpointCall} 
            disabled={isLoading}
          >
            {isLoading ? "Testing..." : "Test Endpoint"}
          </Button>
          
          <Button 
            onClick={testCreateBid} 
            disabled={isLoading}
            variant="secondary"
          >
            {isLoading ? "Creating..." : "Test Create Bid"}
          </Button>
        </CardFooter>
      </Card>
      
      {error && (
        <Card className="mb-8 border-red-500">
          <CardHeader className="bg-red-50 dark:bg-red-900/20">
            <CardTitle className="text-red-600 dark:text-red-400">Error</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <pre className="bg-red-50 dark:bg-red-900/20 p-4 rounded overflow-x-auto text-red-600 dark:text-red-400">
              {error}
            </pre>
          </CardContent>
        </Card>
      )}
      
      {responseData && (
        <Card>
          <CardHeader>
            <CardTitle>Response</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-x-auto max-h-[500px]">
              {JSON.stringify(responseData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}