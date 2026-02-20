/**
 * Configuration file for scripts
 * Loads credentials from .env.local if available
 */

const fs = require('fs');
const path = require('path');

// Try to load .env.local from project root
let envVars = {};
const envPath = path.join(__dirname, '..', '.env.local');
const scriptsEnvPath = path.join(__dirname, '.env.local');

function loadEnvFile(filePath) {
  if (fs.existsSync(filePath)) {
    const envContent = fs.readFileSync(filePath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  }
}

// Load from both locations (scripts/.env.local takes precedence)
loadEnvFile(envPath);
loadEnvFile(scriptsEnvPath);

// Postgres URL for running migrations (optional)
const postgresUrl = process.env.HEALTH_LEAGUE_POSTGRES_URL_NON_POOLING
  || envVars.HEALTH_LEAGUE_POSTGRES_URL_NON_POOLING
  || (envVars.HEALTH_LEAGUE_POSTGRES_HOST && envVars.HEALTH_LEAGUE_POSTGRES_USER && envVars.HEALTH_LEAGUE_POSTGRES_PASSWORD
    ? `postgres://${envVars.HEALTH_LEAGUE_POSTGRES_USER}:${envVars.HEALTH_LEAGUE_POSTGRES_PASSWORD}@${envVars.HEALTH_LEAGUE_POSTGRES_HOST}:5432/postgres?sslmode=require`
    : null);

// Export config
module.exports = {
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || envVars.SUPABASE_URL || envVars.NEXT_PUBLIC_SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY,
  anonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || envVars.SUPABASE_ANON_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  postgresUrl: process.env.HEALTH_LEAGUE_POSTGRES_URL_NON_POOLING || envVars.HEALTH_LEAGUE_POSTGRES_URL_NON_POOLING || postgresUrl,
};
