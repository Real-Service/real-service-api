// This script tests the session store in PostgreSQL
import { Pool } from 'pg';
import connectPg from 'connect-pg-simple';
import session from 'express-session';
import dotenv from 'dotenv';

dotenv.config();

async function testSessionStore() {
  console.log('Testing session store with PostgreSQL...');
  console.log(`ENV: ${process.env.NODE_ENV || 'development'}`);

  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable not set');
    process.exit(1);
  }

  // Create a PostgreSQL Pool
  const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { 
      rejectUnauthorized: false 
    }
  });

  try {
    // Test basic connection
    const { rows } = await pgPool.query('SELECT NOW()');
    console.log(`✅ PostgreSQL connection successful: ${rows[0].now}`);
    
    // Check if session table exists
    const tableCheck = await pgPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'session'
      )
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ Session table exists in database');
      
      // Get table structure
      const tableInfo = await pgPool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'session'
      `);
      
      console.log('Session table structure:');
      tableInfo.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
      
      // Check primary key
      const pkInfo = await pgPool.query(`
        SELECT c.column_name
        FROM information_schema.table_constraints tc 
        JOIN information_schema.constraint_column_usage AS ccu USING (constraint_schema, constraint_name) 
        JOIN information_schema.columns AS c ON c.table_schema = tc.constraint_schema
          AND tc.table_name = c.table_name AND ccu.column_name = c.column_name
        WHERE tc.constraint_type = 'PRIMARY KEY' and tc.table_name = 'session'
      `);
      
      if (pkInfo.rows.length > 0) {
        console.log(`✅ Primary key found: ${pkInfo.rows[0].column_name}`);
      } else {
        console.warn('⚠️ No primary key found on session table!');
      }
      
      // Try to initialize session store
      const PostgresSessionStore = connectPg(session);
      const sessionStore = new PostgresSessionStore({
        pool: pgPool,
        tableName: 'session',
        createTableIfMissing: false,
      });
      
      console.log('✅ PostgreSQL session store initialized successfully');
      
      // Test creating a session
      const testSessionId = `test-${Date.now()}`;
      await sessionStore.set(testSessionId, {
        cookie: { maxAge: 60000 },
        user: { id: 999, name: 'Test User' }
      });
      console.log('✅ Created test session successfully');
      
      // Test retrieving a session
      const retrievedSession = await sessionStore.get(testSessionId);
      console.log('Retrieved session:', retrievedSession);
      
      if (retrievedSession && retrievedSession.user && retrievedSession.user.id === 999) {
        console.log('✅ Retrieved test session successfully');
      } else {
        console.error('❌ Failed to retrieve test session as expected');
        // Let's query the database directly to see what's there
        const directQuery = await pgPool.query('SELECT * FROM session WHERE sid = $1', [testSessionId]);
        console.log('Direct query results:', directQuery.rows);
        
        if (directQuery.rows.length > 0) {
          console.log('Session exists in DB but could not be retrieved by the session store');
          console.log('Raw sess data type:', typeof directQuery.rows[0].sess);
          console.log('Raw sess data:', JSON.stringify(directQuery.rows[0].sess, null, 2));
          
          // Try to manually parse/stringify the session data
          try {
            const sessData = directQuery.rows[0].sess;
            
            // Try to manually get the session with a different approach
            const manualQueryResult = await pgPool.query(
              'SELECT sess FROM session WHERE sid = $1', 
              [testSessionId]
            );
            
            if (manualQueryResult.rows.length > 0) {
              console.log('Manual query result:', manualQueryResult.rows[0].sess);
            }
          } catch (e) {
            console.error('Error handling session data:', e);
          }
        }
      }
      
      // Test deleting a session
      await sessionStore.destroy(testSessionId);
      console.log('✅ Deleted test session successfully');
      
      // Verify it's gone
      const deletedSession = await sessionStore.get(testSessionId);
      if (!deletedSession) {
        console.log('✅ Session deletion verified');
      } else {
        console.error('❌ Failed to delete test session');
      }
      
      console.log('✅ All session store tests PASSED!');
    } else {
      console.error('❌ Session table does not exist in the database');
    }
  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    await pgPool.end();
  }
}

testSessionStore();