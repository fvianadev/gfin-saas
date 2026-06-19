import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import WebSocket from 'ws'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { transport: WebSocket }
})

async function testReset() {
  const email = 'francionildoviananeres@gmail.com'
  console.log('Testing resetPasswordForEmail for:', email)
  try {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:5173/reset-password'
    })
    console.log('Result Data:', data)
    console.log('Result Error:', error)
    if (error) {
      console.log('Error Type:', typeof error)
      console.log('Error Keys:', Object.keys(error))
      console.log('Error Message:', error.message)
      console.log('Error Status:', error.status)
      console.log('Error JSON:', JSON.stringify(error))
    }
  } catch (err) {
    console.error('Caught Exception:', err)
  }
}

testReset()
