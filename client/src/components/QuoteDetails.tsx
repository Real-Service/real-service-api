import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Edit, Send, Check, X, ArrowUpRight, Printer, Download } from "lucide-react";
import { Quote } from "@shared/schema";

interface QuoteDetailsProps {
  quote: Quote | null;
  onEdit: () => void;
  onClose: () => void;
  onSend?: (quoteId: number) => void;
}

export function QuoteDetails({ quote, onEdit, onClose, onSend }: QuoteDetailsProps) {
  if (!quote) {
    return (
      <div className="text-center py-8">
        <p>No quote selected.</p>
      </div>
    );
  }

  // Calculate subtotal, tax, and total
  const subtotal = quote.items?.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0) || 0;
  const tax = quote.items?.reduce((acc, item) => acc + ((item.quantity * item.unitPrice) * (item.taxRate / 100)), 0) || 0;
  
  // Map payment terms to human-readable format
  const getPaymentTermsLabel = (term: string) => {
    const terms: Record<string, string> = {
      "due_on_receipt": "Due on Receipt",
      "net_15": "Net 15 Days",
      "net_30": "Net 30 Days",
      "net_60": "Net 60 Days",
      "custom": "Custom Terms"
    };
    return terms[term] || term;
  };

  // Format payment methods for display
  const formatPaymentMethods = (methods: string[]) => {
    if (!methods || !Array.isArray(methods)) return "Not specified";
    
    const methodNames: Record<string, string> = {
      "credit_card": "Credit Card",
      "bank_transfer": "Bank Transfer",
      "paypal": "PayPal",
      "cash": "Cash",
      "check": "Check"
    };
    
    return methods.map(method => methodNames[method] || method).join(", ");
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-blue-500";
      case "sent": return "bg-orange-500";
      case "viewed": return "bg-purple-500";
      case "accepted": return "bg-green-500";
      case "rejected": return "bg-red-500";
      case "revised": return "bg-amber-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold">{quote.title}</h2>
          <div className="flex items-center mt-1 text-sm text-muted-foreground">
            <FileText className="h-4 w-4 mr-1" />
            <span>Quote #{quote.id.toString().padStart(7, '0')}</span>
          </div>
        </div>
        
        <div className="flex flex-col items-start md:items-end gap-2">
          <Badge className={getStatusColor(quote.status)}>
            {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Created on {format(new Date(quote.createdAt), "PPP")}
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Client Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <div className="font-medium">{quote.clientName}</div>
              <div className="text-sm text-muted-foreground">{quote.clientEmail}</div>
              {quote.clientPhone && <div className="text-sm">{quote.clientPhone}</div>}
              {quote.clientAddress && <div className="text-sm">{quote.clientAddress}</div>}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Project Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Start Date</div>
                <div className="font-medium">
                  {quote.startDate ? format(new Date(quote.startDate), "PPP") : "Not specified"}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">End Date</div>
                <div className="font-medium">
                  {quote.endDate ? format(new Date(quote.endDate), "PPP") : "Not specified"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-3">Project Description</h3>
        <Card>
          <CardContent className="py-4">
            <p className="whitespace-pre-line">{quote.description}</p>
          </CardContent>
        </Card>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-3">Quote Items</h3>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Tax Rate</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quote.items?.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.description}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">${item.unitPrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{item.taxRate}%</TableCell>
                  <TableCell className="text-right">
                    ${(item.quantity * item.unitPrice).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="p-4 border-t">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Tax:</span>
              <span className="font-medium">${tax.toFixed(2)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between py-1">
              <span className="font-semibold">Total:</span>
              <span className="font-bold text-lg">${quote.totalAmount ? quote.totalAmount.toFixed(2) : (subtotal + tax).toFixed(2)}</span>
            </div>
          </div>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Payment Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-sm text-muted-foreground">Payment Terms</div>
              <div className="font-medium">
                {quote.paymentTerms ? getPaymentTermsLabel(quote.paymentTerms) : "Not specified"}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Payment Methods</div>
              <div className="font-medium">
                {quote.paymentMethods ? formatPaymentMethods(quote.paymentMethods as string[]) : "Not specified"}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Notes & Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {quote.notes && (
              <div>
                <div className="text-sm text-muted-foreground">Additional Notes</div>
                <div className="text-sm whitespace-pre-line">{quote.notes}</div>
              </div>
            )}
            {quote.termsAndConditions && (
              <div>
                <div className="text-sm text-muted-foreground">Terms & Conditions</div>
                <div className="text-sm whitespace-pre-line">{quote.termsAndConditions}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="flex flex-wrap justify-between gap-3 pt-4 border-t">
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          {quote.status === "draft" && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-1.5" /> Edit
            </Button>
          )}
        </div>
        
        <div className="space-x-2">
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-1.5" /> Print
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1.5" /> Download PDF
          </Button>
          {quote.status === "draft" && onSend && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => onSend(quote.id)}
            >
              <Send className="h-4 w-4 mr-1.5" /> Send to Client
            </Button>
          )}
          {quote.status === "accepted" && (
            <Button variant="default" size="sm">
              <ArrowUpRight className="h-4 w-4 mr-1.5" /> Convert to Invoice
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}