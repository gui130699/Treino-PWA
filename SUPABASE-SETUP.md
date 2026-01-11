# Configuração do Supabase - Treino PWA

## 📋 Passo a Passo para Configurar o Banco de Dados

### 1️⃣ Acessar o Supabase
Acesse o painel do seu projeto:
```
https://supabase.com/dashboard/project/urnfqiwgtloldzaovive
```

### 2️⃣ Executar o Script SQL
1. No menu lateral, clique em **SQL Editor**
2. Clique em **New Query**
3. Copie todo o conteúdo do arquivo `supabase-schema.sql`
4. Cole no editor
5. Clique em **Run** (ou pressione Ctrl+Enter)

⏱️ O script vai levar ~30 segundos para executar tudo.

### 3️⃣ Verificar se Deu Certo
Execute esta query no SQL Editor:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Você deve ver estas 8 tabelas:
- ✅ users
- ✅ settings
- ✅ exercises
- ✅ exercise_requests
- ✅ templates
- ✅ template_items
- ✅ sessions
- ✅ session_sets

### 4️⃣ Configurar Autenticação (Importante!)
1. No menu lateral, clique em **Authentication** → **Providers**
2. Habilite o **Email** provider
3. Desabilite "Confirm email" (para testes mais fáceis)
4. Salve as configurações

### 5️⃣ Criar Usuário de Teste

#### Opção A: Pelo Dashboard (Recomendado para Teste)
1. Vá em **Authentication** → **Users**
2. Clique em **Add user** → **Create new user**
3. Preencha:
   - Email: `teste@gmail.com`
   - Password: `123456789`
   - Auto Confirm User: ✅ (marcar)
4. Clique em **Create user**
5. Copie o **User UID** gerado

#### Opção B: Via SQL
```sql
-- Primeiro, crie o usuário no Auth (faça pela interface)
-- Depois, adicione na tabela users usando o UID:
INSERT INTO users (id, email, role, full_name)
VALUES ('COLE-O-UUID-AQUI', 'teste@gmail.com', 'admin', 'Usuário Teste');
```

### 6️⃣ Testar Conexão
Execute esta query para confirmar que os dados seed foram inseridos:
```sql
SELECT COUNT(*) as total_exercicios FROM exercises WHERE is_active = TRUE;
```

Deve retornar **16 exercícios** ou mais.

---

## 🔑 Chaves do Projeto

Suas credenciais (já configuradas no arquivo `supabase-config.js`):

- **URL**: `https://urnfqiwgtloldzaovive.supabase.co`
- **Anon Key**: (já configurada no arquivo)

⚠️ **Nunca commite a senha do banco** (9331077093.Gui) no Git!  
A senha é apenas para acesso ao dashboard admin do Supabase.

---

## 🔄 Próximos Passos (Integração com o App)

Depois de configurar o banco, você pode:

### Fase 1: Testar Manualmente
Execute queries no SQL Editor para inserir/ler dados e familiarizar-se com o schema.

### Fase 2: Integrar Supabase Auth
Substitua o "demo login" do app.js por autenticação real:

```javascript
// Em app.js, adicione no topo:
import { SUPABASE_CONFIG } from './supabase-config.js';
const supabase = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// Substituir demoLogin por:
async function supabaseLogin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email, password
  });
  if (error) throw error;
  return data.user;
}
```

### Fase 3: Sincronização Offline→Online
Implementar lógica para:
1. Salvar tudo no IndexedDB (já funciona)
2. Quando online, enviar para Supabase
3. Resolver conflitos (estratégia: "last write wins" ou manual)

---

## 📚 Documentação Útil

- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security (RLS)](https://supabase.com/docs/guides/auth/row-level-security)
- [Realtime Subscriptions](https://supabase.com/docs/guides/realtime)

---

## 🐛 Troubleshooting

### Erro: "permission denied for table X"
- Verifique se as RLS policies foram criadas corretamente
- Execute: `SELECT * FROM pg_policies;`

### Erro: "insert or update on table violates foreign key constraint"
- Certifique-se de criar um user na tabela `users` com o mesmo UUID do Auth

### Seed não inseriu exercícios
- Os exercícios seed não têm `created_by`, então não violam FK
- Execute manualmente o INSERT do final do arquivo SQL

---

## ✅ Checklist Final

- [ ] Script SQL executado sem erros
- [ ] 8 tabelas criadas
- [ ] Email provider habilitado no Auth
- [ ] Usuário de teste criado
- [ ] Query de verificação retornou dados
- [ ] Arquivo `supabase-config.js` revisado

Tudo pronto? Agora você pode começar a integrar o Supabase no app! 🚀
