import { SnakeCaseLogin } from "@/components/snake-case-login";

export default function ProductionLoginPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full">
        <h1 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-primary to-primary/70 text-transparent bg-clip-text">Real Service</h1>
        <p className="text-gray-500 text-center mb-6">Production Database Login</p>
        
        <SnakeCaseLogin />
        
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>This login page connects to the production database with snake_case column names.</p>
          <p className="mt-2">You can login with any of these credentials:</p>
          <div className="mt-2 p-3 bg-gray-100 border border-gray-200 rounded text-left">
            <p className="font-medium">Option 1: Username</p>
            <p><strong>Username:</strong> contractor10</p>
            <p><strong>Password:</strong> password</p>
          </div>
          <div className="mt-2 p-3 bg-gray-100 border border-gray-200 rounded text-left">
            <p className="font-medium">Option 2: Email</p>
            <p><strong>Email:</strong> contractor10@expressbd.ca</p>
            <p><strong>Password:</strong> password</p>
          </div>
          <div className="mt-2 p-3 bg-gray-100 border border-gray-200 rounded text-left">
            <p className="font-medium">Option 3: Shorthand</p>
            <p><strong>Username/Email:</strong> contractor 10</p>
            <p><strong>Password:</strong> password</p>
          </div>
        </div>
      </div>
    </div>
  );
}