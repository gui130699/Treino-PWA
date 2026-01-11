-- ========================================
-- COMANDOS RÁPIDOS - SUPABASE
-- ========================================
-- Cole no SQL Editor do Supabase e execute
-- ========================================

-- 1️⃣ CRIAR TODAS AS TABELAS
-- (Execute o arquivo supabase-schema.sql completo)
-- Este é apenas um resumo para referência rápida

-- 2️⃣ VERIFICAR SE TABELAS FORAM CRIADAS
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Resultado esperado: 8 tabelas
-- users, settings, exercises, exercise_requests,
-- templates, template_items, sessions, session_sets

-- 3️⃣ VERIFICAR EXERCÍCIOS SEED
SELECT COUNT(*) as total_exercicios 
FROM exercises 
WHERE is_active = TRUE;

-- Resultado esperado: 16 exercícios

-- 4️⃣ LISTAR TODOS OS EXERCÍCIOS
SELECT name, primary_muscle, equipment, type 
FROM exercises 
WHERE is_active = TRUE 
ORDER BY primary_muscle, name;

-- 5️⃣ CRIAR USUÁRIO ADMIN (depois de criar no Auth)
-- Substitua 'UUID-DO-AUTH' pelo UUID real do usuário criado
INSERT INTO users (id, email, role, full_name)
VALUES ('UUID-DO-AUTH', 'seu-email@gmail.com', 'admin', 'Seu Nome');

-- 6️⃣ VERIFICAR USUÁRIOS
SELECT email, role, created_at 
FROM users 
ORDER BY created_at DESC;

-- 7️⃣ VERIFICAR POLICIES (Row Level Security)
SELECT schemaname, tablename, policyname 
FROM pg_policies 
ORDER BY tablename, policyname;

-- Resultado esperado: ~20 policies

-- 8️⃣ TESTAR RLS (depois de fazer login no app)
-- Esta query só retorna exercícios ativos (RLS aplicada)
SELECT * FROM exercises WHERE is_active = TRUE LIMIT 5;

-- ========================================
-- COMANDOS DE MANUTENÇÃO
-- ========================================

-- LIMPAR DADOS DE TESTE (CUIDADO!)
-- Descomente apenas se quiser resetar tudo
-- TRUNCATE TABLE session_sets, sessions, template_items, 
-- templates, exercise_requests, settings, users CASCADE;

-- RESETAR SEED DE EXERCÍCIOS
-- DELETE FROM exercises;
-- (depois execute o INSERT de exercícios do supabase-schema.sql)

-- ========================================
-- QUERIES ÚTEIS PARA DESENVOLVIMENTO
-- ========================================

-- Ver todos os treinos de um usuário
SELECT t.name, t.day_label, t.muscle_groups, 
       COUNT(ti.id) as num_exercises
FROM templates t
LEFT JOIN template_items ti ON ti.template_id = t.id
WHERE t.owner_id = 'UUID-DO-USUARIO'
GROUP BY t.id, t.name, t.day_label, t.muscle_groups
ORDER BY t.created_at DESC;

-- Ver histórico de treinos de um usuário
SELECT s.started_at, s.finished_at, t.name as treino,
       COUNT(DISTINCT ss.exercise_id) as num_exercises,
       COUNT(ss.id) as total_sets,
       SUM(ss.weight_kg * ss.reps) as volume_total
FROM sessions s
LEFT JOIN templates t ON t.id = s.template_id
LEFT JOIN session_sets ss ON ss.session_id = s.id
WHERE s.owner_id = 'UUID-DO-USUARIO' AND s.status = 'finished'
GROUP BY s.id, s.started_at, s.finished_at, t.name
ORDER BY s.finished_at DESC;

-- Ver progressão em um exercício específico
SELECT ss.created_at, ss.weight_kg, ss.reps, 
       (ss.weight_kg * ss.reps) as volume,
       s.started_at as session_date
FROM session_sets ss
JOIN sessions s ON s.id = ss.session_id
WHERE ss.exercise_id = 'UUID-DO-EXERCICIO'
  AND s.owner_id = 'UUID-DO-USUARIO'
  AND s.status = 'finished'
ORDER BY ss.created_at DESC;

-- ========================================
-- FIM - Comandos Rápidos
-- ========================================
