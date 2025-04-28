import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

/**
 * Special login component that uses the snake_case auth endpoint
 * This is specifically designed to work with the Neon production database
 */
export function SnakeCaseLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Missing fields",
        description: "Please enter both email and password",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // Ensure email is properly formatted - remove whitespace
      const cleanEmail = email.trim();
      
      console.log("Attempting login with:", { email: cleanEmail, passwordLength: password.length });
      
      // Use our simplified auth endpoint
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email: cleanEmail, password }),
        credentials: 'include'
      });
      
      if (response.ok) {
        const userData = await response.json();
        toast({
          title: "Login successful",
          description: `Welcome ${userData.full_name || userData.username}!`,
        });
        
        // Refresh page to update auth state
        window.location.href = '/dashboard';
      } else {
        const error = await response.json();
        toast({
          title: "Login failed",
          description: error.message || "Invalid credentials",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Login error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // If already logged in, don't show login form
  if (user) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <p className="text-center mb-4">You are already logged in as <span className="font-bold">{user.full_name || user.username}</span></p>
        <Button 
          className="w-full" 
          onClick={() => { window.location.href = '/dashboard'; }}
        >
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Production Login</h2>
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <Label htmlFor="email">Username or Email</Label>
          <Input 
            id="email"
            type="text" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your username or email"
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input 
            id="password"
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
        </div>
        <Button 
          type="submit" 
          className="w-full" 
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Logging in...
            </>
          ) : (
            "Login"
          )}
        </Button>
      </form>
    </div>
  );
}