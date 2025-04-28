import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from '../shared/schema';

// For node compatibility
import * as dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

console.log('Running migration...');
console.log('Connection string (masked):', connectionString.replace(/postgres:\/\/([^:]+):([^@]+)@/, 'postgres://[USER]:[PASSWORD]@'));

async function main() {
  // Create connection
  const sql = postgres(connectionString);
  
  // Create Drizzle database instance
  const db = drizzle(sql, { schema });

  // Create tables directly based on the schema
  try {
    console.log('Creating tables from schema...');
    
    // Define the table creation statements directly
    await sql`
      DO $$ 
      BEGIN
        -- Create user_type enum if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_type') THEN
          CREATE TYPE user_type AS ENUM ('landlord', 'contractor');
        END IF;
        
        -- Create job_status enum if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
          CREATE TYPE job_status AS ENUM ('draft', 'open', 'in_progress', 'completed', 'cancelled');
        END IF;
        
        -- Create job_pricing_type enum if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_pricing_type') THEN
          CREATE TYPE job_pricing_type AS ENUM ('fixed', 'open_bid');
        END IF;
        
        -- Create bid_status enum if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bid_status') THEN
          CREATE TYPE bid_status AS ENUM ('pending', 'accepted', 'rejected');
        END IF;
        
        -- Create transaction_type enum if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
          CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'payment', 'refund');
        END IF;
        
        -- Create message_type enum if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type') THEN
          CREATE TYPE message_type AS ENUM ('text', 'image');
        END IF;
        
        -- Create users table if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
          CREATE TABLE users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            full_name VARCHAR(100) NOT NULL,
            user_type user_type NOT NULL,
            phone VARCHAR(20),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        END IF;
        
        -- Create landlord_profiles table if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'landlord_profiles') THEN
          CREATE TABLE landlord_profiles (
            user_id INTEGER PRIMARY KEY REFERENCES users(id),
            bio TEXT,
            address TEXT,
            city VARCHAR(100),
            state VARCHAR(50),
            zip_code VARCHAR(20),
            profile_image_url TEXT,
            properties_count INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        END IF;
        
        -- Create contractor_profiles table if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contractor_profiles') THEN
          CREATE TABLE contractor_profiles (
            user_id INTEGER PRIMARY KEY REFERENCES users(id),
            bio TEXT,
            company_name VARCHAR(100),
            website_url TEXT,
            license_number VARCHAR(50),
            specialties TEXT[],
            hourly_rate DECIMAL(10, 2),
            city VARCHAR(100),
            state VARCHAR(50),
            service_area JSONB,
            service_radius INTEGER DEFAULT 25,
            service_zip_codes TEXT[],
            profile_image_url TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        END IF;
        
        -- Create jobs table if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jobs') THEN
          CREATE TABLE jobs (
            id SERIAL PRIMARY KEY,
            landlord_id INTEGER REFERENCES users(id),
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            category VARCHAR(100) NOT NULL,
            status job_status DEFAULT 'draft',
            pricing_type job_pricing_type DEFAULT 'fixed',
            budget DECIMAL(10, 2),
            location JSONB NOT NULL,
            address TEXT,
            city VARCHAR(100),
            state VARCHAR(50),
            zip_code VARCHAR(20),
            images TEXT[],
            timeline_start DATE,
            timeline_end DATE,
            contractor_id INTEGER REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        END IF;
        
        -- Create bids table if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bids') THEN
          CREATE TABLE bids (
            id SERIAL PRIMARY KEY,
            job_id INTEGER REFERENCES jobs(id),
            contractor_id INTEGER REFERENCES users(id),
            amount DECIMAL(10, 2) NOT NULL,
            description TEXT NOT NULL,
            estimated_completion_days INTEGER,
            status bid_status DEFAULT 'pending',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        END IF;
        
        -- Create transactions table if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') THEN
          CREATE TABLE transactions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            job_id INTEGER REFERENCES jobs(id),
            amount DECIMAL(10, 2) NOT NULL,
            type transaction_type NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            reference VARCHAR(255),
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        END IF;
        
        -- Create chat_rooms table if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_rooms') THEN
          CREATE TABLE chat_rooms (
            id SERIAL PRIMARY KEY,
            job_id INTEGER REFERENCES jobs(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        END IF;
        
        -- Create chat_participants table if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_participants') THEN
          CREATE TABLE chat_participants (
            id SERIAL PRIMARY KEY,
            chat_room_id INTEGER REFERENCES chat_rooms(id),
            user_id INTEGER REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        END IF;
        
        -- Create messages table if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
          CREATE TABLE messages (
            id SERIAL PRIMARY KEY,
            chat_room_id INTEGER REFERENCES chat_rooms(id),
            sender_id INTEGER REFERENCES users(id),
            content TEXT NOT NULL,
            type message_type DEFAULT 'text',
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        END IF;
        
        -- Create reviews table if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews') THEN
          CREATE TABLE reviews (
            id SERIAL PRIMARY KEY,
            job_id INTEGER REFERENCES jobs(id),
            reviewer_id INTEGER REFERENCES users(id),
            reviewee_id INTEGER REFERENCES users(id),
            rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
            content TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        END IF;
        
        -- Create waitlist_entries table if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'waitlist_entries') THEN
          CREATE TABLE waitlist_entries (
            id SERIAL PRIMARY KEY,
            email VARCHAR(100) UNIQUE NOT NULL,
            name VARCHAR(100),
            user_type user_type,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        END IF;
      END $$;
    `;
    
    // Test query to verify connection
    const result = await sql`SELECT current_database(), current_user, version()`;
    console.log('Connected to database:', result[0].current_database);
    console.log('Database user:', result[0].current_user);
    console.log('Postgres version:', result[0].version);
    
    console.log('Database tables created successfully!');
  } catch (error) {
    console.error('Error creating tables:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });