# 📋 Sistema de Logs - Guia Completo

## 📂 Estrutura de Arquivos

Após executar a aplicação, os seguintes arquivos de log serão criados automaticamente na pasta `logs/`:

```
API/
├── logs/
│   ├── combined.log    # Todos os logs (info, warn, error)
│   ├── error.log       # Apenas erros
│   └── debug.log       # Logs detalhados de debug
```

## 🎯 Níveis de Log

| Nível | Descrição | Quando usar |
|-------|-----------|-------------|
| `error` | Erros críticos | Falhas que impedem funcionalidade |
| `warn` | Avisos | Situações anormais mas não críticas |
| `info` | Informação | Fluxo normal da aplicação |
| `debug` | Debug | Informações detalhadas para desenvolvimento |

## ⚙️ Configuração

### Alterar Nível de Log

Crie/edite o arquivo `.env` na pasta `API/`:

```env
# Para ver todos os logs incluindo debug
LOG_LEVEL=debug

# Para ver apenas info, warn e error (padrão)
LOG_LEVEL=info

# Para ver apenas erros
LOG_LEVEL=error
```

### Windows
```cmd
set LOG_LEVEL=debug
npm start
```

### Linux/Mac
```bash
export LOG_LEVEL=debug
npm start
```

## 📖 Como Ler os Logs

### Console (Terminal)
Os logs aparecem coloridos no terminal:
- 🔴 **Vermelho**: Erros
- 🟡 **Amarelo**: Avisos  
- 🔵 **Azul**: Informações

Exemplo:
```
[2025-10-14 10:30:45] info: [AUTH] Tentativa de login {
  "method": "POST",
  "path": "/login",
  "ip": "::1"
}
```

### Arquivos de Log

#### combined.log (Todos os logs)
```json
{
  "level": "info",
  "message": "[AUTH] LOGIN",
  "userId": "abc123",
  "success": true,
  "userType": "aluno",
  "timestamp": "2025-10-14 10:30:45"
}
```

#### error.log (Apenas erros)
```json
{
  "level": "error",
  "message": "[AUTH - LOGIN] Invalid credentials",
  "stack": "Error: Invalid credentials\n    at login...",
  "name": "Error",
  "timestamp": "2025-10-14 10:31:20"
}
```

## 🔍 Debugging Passo a Passo

### 1. Problema de Login

**Windows:**
```cmd
cd API
type logs\combined.log | findstr "AUTH"
```

**Linux:**
```bash
cd API
grep "AUTH" logs/combined.log
```

### 2. Verificar Últimos Erros

**Windows:**
```cmd
type logs\error.log
```

**Linux:**
```bash
tail -n 50 logs/error.log
```

### 3. Monitorar Logs em Tempo Real

**Windows (PowerShell):**
```powershell
Get-Content logs\combined.log -Wait -Tail 20
```

**Linux:**
```bash
tail -f logs/combined.log
```

## 📊 Funções de Log Disponíveis

### 1. Log de Requisições HTTP
```javascript
logger.logRequest(req, 'Descrição da ação');
// Registra: método, caminho, IP, user-agent, body
```

### 2. Log de Erros
```javascript
logger.logError(error, 'CONTEXTO');
// Registra: mensagem, stack trace, código do erro
```

### 3. Log de Autenticação
```javascript
logger.logAuth('LOGIN', userId, true, { userType: 'aluno' });
// Registra: ação, userId, sucesso, detalhes
```

### 4. Log de Banco de Dados
```javascript
logger.logDatabase('CREATE', 'users', true, { userId: '123' });
// Registra: ação, coleção, sucesso, detalhes
```

## 🧹 Manutenção dos Logs

### Rotação Automática
Os arquivos de log têm:
- **Tamanho máximo**: 5MB por arquivo
- **Arquivos mantidos**: 
  - 5 arquivos de erro
  - 5 arquivos combinados
  - 3 arquivos de debug

Quando um arquivo atinge 5MB, é criado um novo automaticamente.

### Limpar Logs Manualmente

**Windows:**
```cmd
del logs\*.log
```

**Linux:**
```bash
rm logs/*.log
```

## 🐛 Troubleshooting

### Logs não aparecem em arquivos

1. Verifique se a pasta `logs/` existe:
```bash
ls -la API/logs/  # Linux
dir API\logs\     # Windows
```

2. Verifique permissões:
```bash
chmod 755 API/logs/  # Linux
```

3. Verifique se há espaço em disco:
```bash
df -h    # Linux
dir      # Windows
```

### Muito ruído nos logs

Configure `LOG_LEVEL=warn` ou `LOG_LEVEL=error` no `.env`

### Logs muito detalhados

Configure `LOG_LEVEL=debug` no `.env` e olhe `debug.log`

## 📌 Exemplos Práticos

### Debugar erro de CORS
```bash
grep "CORS" logs/combined.log
```

### Ver todos os logins do dia
```bash
grep "$(date +%Y-%m-%d)" logs/combined.log | grep "LOGIN"
```

### Contar erros por hora
```bash
grep "$(date +%Y-%m-%d)" logs/error.log | cut -d' ' -f2 | cut -d':' -f1 | sort | uniq -c
```

## 🆘 Suporte

Se encontrar problemas com os logs:
1. Verifique se winston está instalado: `npm list winston`
2. Verifique variáveis de ambiente: `echo $LOG_LEVEL` (Linux) ou `echo %LOG_LEVEL%` (Windows)
3. Reinicie a aplicação após mudanças no `.env`
