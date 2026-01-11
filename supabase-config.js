// Configuração do Supabase
export const SUPABASE_CONFIG = {
  url: "https://urnfqiwgtloldzaovive.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybmZxaXdndGxvbGR6YW92aXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY2MjY4MDAsImV4cCI6MjA1MjIwMjgwMH0.sb_publishable_C-JUI7jQWTd5ocVYfCCbcg_w73rcUKz"
};

// Nota: A chave acima é a chave pública (anon key) do Supabase
// É seguro incluí-la no código frontend, pois ela tem permissões limitadas
// definidas pelas Row Level Security (RLS) policies do Supabase

// Para instalar o cliente Supabase:
// 1. Via CDN (adicione no HTML):
//    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//
// 2. Via NPM (se usar bundler):
//    npm install @supabase/supabase-js
//    import { createClient } from '@supabase/supabase-js'

// Inicialização (adicionar em app.js quando integrar):
// const supabase = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
