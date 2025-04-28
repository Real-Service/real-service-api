import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar"; 
import { Star, StarHalf } from "lucide-react";

export default function DashboardPreviews() {
  return (
    <div id="how-it-works" className="py-8 bg-blue-900">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-white">How It Works</h2>
          <p className="mt-2 max-w-2xl text-xl text-blue-300 mx-auto">
            See how our platform streamlines the entire maintenance process.
          </p>
        </div>

        {/* Landlord Dashboard Preview */}
        <div className="mt-16">
          <h3 className="text-2xl font-bold text-white mb-6">Landlord Dashboard</h3>
          <Card className="bg-blue-900/50 border border-blue-800 rounded-lg shadow-lg overflow-hidden">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                {/* Wallet Balance */}
                <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                  <h4 className="text-sm font-medium text-gray-500 uppercase">Wallet Balance</h4>
                  <div className="mt-2 flex items-baseline">
                    <span className="text-3xl font-semibold text-gray-900">$2,450</span>
                    <span className="ml-2 text-sm text-gray-600">USD</span>
                  </div>
                  <div className="mt-4">
                    <Button variant="link" className="text-sm text-primary font-medium p-0">Add Funds</Button>
                  </div>
                </div>

                {/* Active Projects */}
                <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                  <h4 className="text-sm font-medium text-gray-500 uppercase">Active Projects</h4>
                  <div className="mt-2 flex items-baseline">
                    <span className="text-3xl font-semibold text-gray-900">4</span>
                    <span className="ml-2 text-sm text-gray-600">jobs in progress</span>
                  </div>
                  <div className="mt-4">
                    <Button variant="link" className="text-sm text-primary font-medium p-0">View All</Button>
                  </div>
                </div>

                {/* Completed Projects */}
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                  <h4 className="text-sm font-medium text-gray-500 uppercase">Completed Projects</h4>
                  <div className="mt-2 flex items-baseline">
                    <span className="text-3xl font-semibold text-gray-900">27</span>
                    <span className="ml-2 text-sm text-gray-600">total completed</span>
                  </div>
                  <div className="mt-4">
                    <Button variant="link" className="text-sm text-primary font-medium p-0">View History</Button>
                  </div>
                </div>
              </div>

              {/* Projects List */}
              <h4 className="font-medium text-lg mb-4">Current Projects</h4>
              <div className="overflow-hidden border border-gray-200 rounded-lg">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Project
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Contractor
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Price
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">Bathroom Sink Replacement</div>
                          <div className="text-sm text-gray-500">123 Main St, Unit 4B</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Avatar className="h-8 w-8 bg-gray-200">
                              <AvatarFallback>JD</AvatarFallback>
                            </Avatar>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900">John Doe</div>
                              <div className="flex items-center">
                                {[...Array(4)].map((_, i) => (
                                  <Star key={i} className="h-3 w-3 text-amber-400 fill-current" />
                                ))}
                                <StarHalf className="h-3 w-3 text-amber-400 fill-current" />
                                <span className="ml-1 text-xs text-gray-500">4.5</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            In Progress
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          $350.00
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Button variant="link" className="text-primary hover:text-blue-800 p-0">Message</Button>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">Kitchen Faucet Repair</div>
                          <div className="text-sm text-gray-500">456 Oak Ave, Unit 2C</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Avatar className="h-8 w-8 bg-gray-200">
                              <AvatarFallback>SM</AvatarFallback>
                            </Avatar>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900">Sarah Miller</div>
                              <div className="flex items-center">
                                {[...Array(5)].map((_, i) => (
                                  <Star key={i} className="h-3 w-3 text-amber-400 fill-current" />
                                ))}
                                <span className="ml-1 text-xs text-gray-500">5.0</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                            Pending Approval
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          $125.00
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Button variant="link" className="text-emerald-600 hover:text-emerald-800 mr-3 p-0">Approve</Button>
                          <Button variant="link" className="text-primary hover:text-blue-800 p-0">Message</Button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-6 flex justify-center">
                <Button className="bg-primary text-white hover:bg-blue-600">
                  Post New Job
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contractor Dashboard Preview */}
        <div className="mt-16">
          <h3 className="text-2xl font-bold text-white mb-6">Contractor Dashboard</h3>
          <Card className="bg-blue-900/50 border border-blue-800 rounded-lg shadow-lg overflow-hidden">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Available Jobs */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <h4 className="text-sm font-medium text-gray-500 uppercase">Available Jobs</h4>
                  <div className="mt-2 flex items-baseline">
                    <span className="text-3xl font-semibold text-gray-900">12</span>
                    <span className="ml-2 text-sm text-gray-600">in your area</span>
                  </div>
                  <div className="mt-4">
                    <Button variant="link" className="text-sm text-primary font-medium p-0">Browse Jobs</Button>
                  </div>
                </div>

                {/* Active Projects */}
                <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                  <h4 className="text-sm font-medium text-gray-500 uppercase">Current Projects</h4>
                  <div className="mt-2 flex items-baseline">
                    <span className="text-3xl font-semibold text-gray-900">3</span>
                    <span className="ml-2 text-sm text-gray-600">in progress</span>
                  </div>
                  <div className="mt-4">
                    <Button variant="link" className="text-sm text-primary font-medium p-0">View All</Button>
                  </div>
                </div>

                {/* Earnings */}
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                  <h4 className="text-sm font-medium text-gray-500 uppercase">Earnings This Month</h4>
                  <div className="mt-2 flex items-baseline">
                    <span className="text-3xl font-semibold text-gray-900">$3,780</span>
                    <span className="ml-2 text-sm text-gray-600">USD</span>
                  </div>
                  <div className="mt-4">
                    <Button variant="link" className="text-sm text-primary font-medium p-0">View History</Button>
                  </div>
                </div>
              </div>

              {/* Available Jobs List */}
              <h4 className="font-medium text-lg mb-4">Available Jobs Near You</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Job Card 1 */}
                <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-medium text-gray-900">Ceiling Fan Installation</h5>
                      <p className="text-sm text-gray-500 mt-1">789 Elm St, Apt 3D - Chicago, IL</p>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                      Fixed Price
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm text-gray-600">
                    Need a new ceiling fan installed in the master bedroom. Have the fan already, just need installation.
                  </p>
                  <div className="mt-4 flex justify-between items-center">
                    <span className="font-medium text-gray-900">$150.00</span>
                    <Button className="bg-emerald-500 hover:bg-emerald-600 text-white py-1 h-auto">
                      Bid Now
                    </Button>
                  </div>
                </div>

                {/* Job Card 2 */}
                <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-medium text-gray-900">Drywall Repair</h5>
                      <p className="text-sm text-gray-500 mt-1">321 Pine St - Chicago, IL</p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                      Open Bid
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm text-gray-600">
                    Need repair for 3 holes in drywall (approx. 6" diameter each) with texture matching and painting.
                  </p>
                  <div className="mt-4 flex justify-between items-center">
                    <span className="font-medium text-gray-900">Submit Your Bid</span>
                    <Button className="bg-emerald-500 hover:bg-emerald-600 text-white py-1 h-auto">
                      Bid Now
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Current Projects */}
              <h4 className="font-medium text-lg mb-4">Your Current Projects</h4>
              <div className="overflow-hidden border border-gray-200 rounded-lg">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Project
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Client
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Price
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">Bathroom Tile Replacement</div>
                          <div className="text-sm text-gray-500">555 River Rd, Unit 7A</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Avatar className="h-8 w-8 bg-gray-200">
                              <AvatarFallback>RJ</AvatarFallback>
                            </Avatar>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900">Robert Johnson</div>
                              <div className="flex items-center">
                                {[...Array(4)].map((_, i) => (
                                  <Star key={i} className="h-3 w-3 text-amber-400 fill-current" />
                                ))}
                                <Star className="h-3 w-3 text-amber-400" />
                                <span className="ml-1 text-xs text-gray-500">4.0</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            In Progress
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          $950.00
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Button variant="link" className="text-emerald-600 hover:text-emerald-800 mr-3 p-0">Mark Complete</Button>
                          <Button variant="link" className="text-primary hover:text-blue-800 p-0">Message</Button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
