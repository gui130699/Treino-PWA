-- ==================================================
-- TREINO PWA - SCHEMA DO SUPABASE
-- ==================================================
-- Execute estes comandos no SQL Editor do Supabase
-- (https://urnfqiwgtloldzaovive.supabase.co)
--
-- Ordem de execução:
-- 1. Tabelas base (sem dependências)
-- 2. Tabelas com foreign keys
-- 3. Índices
-- 4. Row Level Security (RLS) policies
-- ==================================================

-- Limpar tabelas existentes (CUIDADO: apaga todos os dados!)
-- Descomente apenas se quiser recriar tudo do zero
-- DROP TABLE IF EXISTS session_sets CASCADE;
-- DROP TABLE IF EXISTS sessions CASCADE;
-- DROP TABLE IF EXISTS template_items CASCADE;
-- DROP TABLE IF EXISTS templates CASCADE;
-- DROP TABLE IF EXISTS exercise_requests CASCADE;
-- DROP TABLE IF EXISTS exercises CASCADE;
-- DROP TABLE IF EXISTS settings CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- ==================================================
-- TABELA: users
-- ==================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'admin')),
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ==================================================
-- TABELA: settings (configurações por usuário)
-- ==================================================
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit TEXT NOT NULL DEFAULT 'kg' CHECK (unit IN ('kg', 'lb')),
  rest_default INTEGER NOT NULL DEFAULT 90,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);

-- ==================================================
-- TABELA: exercises (catálogo de exercícios)
-- ==================================================
CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  primary_muscle TEXT NOT NULL,
  secondary_muscles TEXT[] DEFAULT '{}',
  equipment TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('compound', 'isolation', 'other')),
  instructions TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  youtube_url TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercises_is_active ON exercises(is_active);
CREATE INDEX IF NOT EXISTS idx_exercises_name ON exercises(name);
CREATE INDEX IF NOT EXISTS idx_exercises_primary_muscle ON exercises(primary_muscle);

-- ==================================================
-- TABELA: exercise_requests (solicitações de exercícios)
-- ==================================================
CREATE TABLE IF NOT EXISTS exercise_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  details TEXT DEFAULT '',
  optional_youtube_url TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercise_requests_status ON exercise_requests(status);
CREATE INDEX IF NOT EXISTS idx_exercise_requests_requested_by ON exercise_requests(requested_by);

-- ==================================================
-- TABELA: templates (treinos/templates)
-- ==================================================
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  day_label TEXT DEFAULT '',
  muscle_groups TEXT[] DEFAULT '{}',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_owner_id ON templates(owner_id);

-- ==================================================
-- TABELA: template_items (exercícios em cada treino)
-- ==================================================
CREATE TABLE IF NOT EXISTS template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  sort_order BIGINT NOT NULL DEFAULT 0,
  target_sets INTEGER,
  target_reps TEXT DEFAULT '',
  rest_seconds INTEGER,
  combo_type TEXT CHECK (combo_type IN ('superset', 'biset', 'triset', 'giantset', NULL)),
  combo_group TEXT,
  combo_order INTEGER,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_items_template_id ON template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_template_items_exercise_id ON template_items(exercise_id);

-- ==================================================
-- TABELA: sessions (sessões de treino)
-- ==================================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'finished', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  notes TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_sessions_owner_id ON sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC);

-- ==================================================
-- TABELA: session_sets (séries executadas em cada sessão)
-- ==================================================
CREATE TABLE IF NOT EXISTS session_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  set_index INTEGER NOT NULL,
  reps INTEGER,
  weight_kg NUMERIC(10,3),
  rir INTEGER,
  rpe NUMERIC(3,1),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_sets_session_id ON session_sets(session_id);
CREATE INDEX IF NOT EXISTS idx_session_sets_exercise_id ON session_sets(exercise_id);

-- ==================================================
-- FUNCTIONS & TRIGGERS (atualizar updated_at automaticamente)
-- ==================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exercises_updated_at BEFORE UPDATE ON exercises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==================================================
-- IMPORTANTE: Habilitar RLS em todas as tabelas

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_sets ENABLE ROW LEVEL SECURITY;

-- ==================================================
-- POLICIES: users
-- ==================================================
-- Usuários podem ver seu próprio perfil
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Admins podem ver todos os usuários
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Usuários podem atualizar seu próprio perfil
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- ==================================================
-- POLICIES: settings
-- ==================================================
CREATE POLICY "Users can manage own settings" ON settings
  FOR ALL USING (auth.uid() = user_id);

-- ==================================================
-- POLICIES: exercises
-- ==================================================
-- Todos podem ver exercícios ativos
CREATE POLICY "Everyone can view active exercises" ON exercises
  FOR SELECT USING (is_active = TRUE);

-- Admins podem ver todos os exercícios
CREATE POLICY "Admins can view all exercises" ON exercises
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins podem criar/editar/deletar exercícios
CREATE POLICY "Admins can manage exercises" ON exercises
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ==================================================
-- POLICIES: exercise_requests
-- ==================================================
-- Usuários podem criar solicitações
CREATE POLICY "Users can create requests" ON exercise_requests
  FOR INSERT WITH CHECK (auth.uid() = requested_by);

-- Usuários podem ver suas próprias solicitações
CREATE POLICY "Users can view own requests" ON exercise_requests
  FOR SELECT USING (auth.uid() = requested_by);

-- Admins podem ver todas as solicitações
CREATE POLICY "Admins can view all requests" ON exercise_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins podem atualizar solicitações (aprovar/rejeitar)
CREATE POLICY "Admins can update requests" ON exercise_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ==================================================
-- POLICIES: templates
-- ==================================================
-- Usuários podem gerenciar seus próprios templates
CREATE POLICY "Users can manage own templates" ON templates
  FOR ALL USING (auth.uid() = owner_id);

-- ==================================================
-- POLICIES: template_items
-- ==================================================
-- Usuários podem gerenciar itens de seus templates
CREATE POLICY "Users can manage own template items" ON template_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM templates WHERE id = template_items.template_id AND owner_id = auth.uid()
    )
  );

-- ==================================================
-- POLICIES: sessions
-- ==================================================
-- Usuários podem gerenciar suas próprias sessões
CREATE POLICY "Users can manage own sessions" ON sessions
  FOR ALL USING (auth.uid() = owner_id);

-- ==================================================
-- POLICIES: session_sets
-- ==================================================
-- Usuários podem gerenciar sets de suas sessões
CREATE POLICY "Users can manage own session sets" ON session_sets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sessions WHERE id = session_sets.session_id AND owner_id = auth.uid()
    )
  );

-- ==================================================
-- SEED: Exercícios iniciais (opcional)
-- ==================================================
-- Inserir alguns exercícios básicos (execute após criar um usuário admin)

INSERT INTO exercises (name, primary_muscle, secondary_muscles, equipment, type, is_active)
VALUES
  ('Supino reto com barra', 'peito', ARRAY['tríceps','ombro anterior'], 'barra', 'compound', TRUE),
  ('Supino inclinado com halteres', 'peito', ARRAY['tríceps','ombro anterior'], 'halter', 'compound', TRUE),
  ('Crossover na polia', 'peito', ARRAY[]::TEXT[], 'cabo', 'isolation', TRUE),
  ('Puxada alta na polia', 'costas', ARRAY['bíceps'], 'cabo', 'compound', TRUE),
  ('Remada curvada com barra', 'costas', ARRAY['bíceps','trapézio'], 'barra', 'compound', TRUE),
  ('Remada baixa na polia', 'costas', ARRAY['bíceps'], 'cabo', 'compound', TRUE),
  ('Agachamento livre', 'pernas', ARRAY['glúteos','core'], 'barra', 'compound', TRUE),
  ('Leg press 45°', 'pernas', ARRAY['glúteos'], 'máquina', 'compound', TRUE),
  ('Cadeira extensora', 'quadríceps', ARRAY[]::TEXT[], 'máquina', 'isolation', TRUE),
  ('Cadeira flexora', 'posteriores', ARRAY[]::TEXT[], 'máquina', 'isolation', TRUE),
  ('Desenvolvimento com barra', 'ombro', ARRAY['tríceps'], 'barra', 'compound', TRUE),
  ('Elevação lateral com halteres', 'ombro lateral', ARRAY[]::TEXT[], 'halter', 'isolation', TRUE),
  ('Rosca direta', 'bíceps', ARRAY[]::TEXT[], 'barra', 'isolation', TRUE),
  ('Rosca alternada com halteres', 'bíceps', ARRAY[]::TEXT[], 'halter', 'isolation', TRUE),
  ('Tríceps na polia', 'tríceps', ARRAY[]::TEXT[], 'cabo', 'isolation', TRUE),
  ('Tríceps testa', 'tríceps', ARRAY[]::TEXT[], 'barra', 'isolation', TRUE)
ON CONFLICT DO NOTHING;

-- ==================================================
-- VERIFICAÇÃO: Listar todas as tabelas criadas
-- ==================================================
-- Execute esta query para confirmar que tudo foi criado:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- ==================================================
-- FIM DO SCRIPT
-- ==================================================
-- Próximos passos:
-- 1. Execute este script no SQL Editor do Supabase
-- 2. Crie um usuário de teste via Auth do Supabase
-- 3. Integre o Supabase Auth no app.js substituindo o demo login
-- 4. Implemente sincronização offline->online usando o IndexedDB como cache
-- ==================================================
