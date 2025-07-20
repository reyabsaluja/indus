#!/usr/bin/env node

/**
 * Environment Variables Checker
 * Run this script to verify all required environment variables are set
 */

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_ALPACA_API_KEY',
  'NEXT_PUBLIC_ALPACA_SECRET_KEY',
  'GOOGLE_AI_API_KEY'
];

const optionalEnvVars = [
  'NODE_ENV',
  'VERCEL_URL',
  'VERCEL_ENV'
];

console.log('🔍 Checking environment variables...\n');

let allRequired = true;

console.log('Required Variables:');
requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '❌';
  const displayValue = value ? '***set***' : 'missing';
  console.log(`${status} ${varName}: ${displayValue}`);
  
  if (!value) {
    allRequired = false;
  }
});

console.log('\nOptional Variables:');
optionalEnvVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '⚪';
  const displayValue = value ? (varName === 'NODE_ENV' ? value : '***set***') : 'not set';
  console.log(`${status} ${varName}: ${displayValue}`);
});

console.log('\n' + '='.repeat(50));

if (allRequired) {
  console.log('✅ All required environment variables are set!');
  console.log('🚀 Your app should be ready for deployment.');
} else {
  console.log('❌ Some required environment variables are missing.');
  console.log('📋 Please check the .env.example file for reference.');
  console.log('🔧 Set them in your .env.local file for local development.');
  console.log('☁️  Set them in Vercel dashboard for production deployment.');
}

console.log('\n📖 See DEPLOYMENT.md for detailed setup instructions.');

process.exit(allRequired ? 0 : 1);
