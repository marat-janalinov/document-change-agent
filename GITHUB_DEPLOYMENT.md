# 📤 Инструкция по загрузке проекта на GitHub

## Содержание

1. [Подготовка к загрузке](#подготовка-к-загрузке)
2. [Создание репозитория на GitHub](#создание-репозитория-на-github)
3. [Инициализация Git в проекте](#инициализация-git-в-проекте)
4. [Настройка .gitignore](#настройка-gitignore)
5. [Первый коммит и push](#первый-коммит-и-push)
6. [Работа с ветками](#работа-с-ветками)
7. [Настройка для работы в команде](#настройка-для-работы-в-команде)
8. [Структура репозитория](#структура-репозитория)
9. [Настройка GitHub Actions (опционально)](#настройка-github-actions-опционально)
10. [Рекомендации и best practices](#рекомендации-и-best-practices)

---

## Подготовка к загрузке

### 1. Проверка наличия Git

```bash
# Проверка установки Git
git --version

# Если Git не установлен, установите его:

# На Ubuntu/Debian:
sudo apt update
sudo apt install git -y

# На macOS:
brew install git

# На Windows:
# Скачайте Git с https://git-scm.com/download/win
```

### 2. Настройка Git (если еще не настроен)

```bash
# Настройка имени пользователя
git config --global user.name "Ваше Имя"

# Настройка email
git config --global user.email "your.email@example.com"

# Настройка редактора по умолчанию (опционально)
git config --global core.editor "nano"  # или "vim", "code --wait" для VS Code

# Проверка настроек
git config --list
```

### 3. Проверка структуры проекта

Убедитесь, что в проекте есть все необходимые файлы:

```bash
# Переход в директорию проекта
cd /path/to/document-change-agent

# Просмотр структуры
ls -la

# Должны быть видны:
# - docker-compose.yml
# - README.md
# - backend/
# - react/
# - mcp-server/
# - и другие файлы проекта
```

---

## Создание репозитория на GitHub

### Метод 1: Через веб-интерфейс GitHub

1. **Войдите в GitHub**
   - Перейдите на https://github.com
   - Войдите в свой аккаунт или создайте новый

2. **Создание нового репозитория**
   - Нажмите кнопку **"+"** в правом верхнем углу
   - Выберите **"New repository"**

3. **Настройка репозитория**
   - **Repository name:** `document-change-agent` (или другое имя)
   - **Description:** "Автоматизированная система применения изменений к Word документам"
   - **Visibility:** 
     - **Public** - для открытого проекта
     - **Private** - для приватного проекта
   - **НЕ** отмечайте "Initialize this repository with a README" (если у вас уже есть README)
   - **НЕ** выбирайте .gitignore и license (если они уже есть)

4. **Создание репозитория**
   - Нажмите кнопку **"Create repository"**

5. **Скопируйте URL репозитория**
   - После создания GitHub покажет URL репозитория
   - Пример: `https://github.com/yourusername/document-change-agent.git`
   - Или SSH: `git@github.com:yourusername/document-change-agent.git`

### Метод 2: Через GitHub CLI (gh)

```bash
# Установка GitHub CLI (если не установлен)
# На Ubuntu/Debian:
sudo apt install gh

# На macOS:
brew install gh

# Авторизация
gh auth login

# Создание репозитория
gh repo create document-change-agent \
  --public \
  --description "Автоматизированная система применения изменений к Word документам" \
  --clone=false
```

---

## Инициализация Git в проекте

### 1. Проверка существующего репозитория

```bash
# Проверка, есть ли уже Git репозиторий
cd /path/to/document-change-agent

if [ -d .git ]; then
    echo "Git репозиторий уже инициализирован"
    git remote -v  # Проверка существующих remote
else
    echo "Инициализация нового репозитория"
    git init
fi
```

### 2. Инициализация нового репозитория

```bash
# Переход в директорию проекта
cd /path/to/document-change-agent

# Инициализация Git репозитория
git init

# Проверка статуса
git status
```

### 3. Добавление remote репозитория

```bash
# Добавление remote (замените URL на ваш)
git remote add origin https://github.com/yourusername/document-change-agent.git

# Или для SSH:
git remote add origin git@github.com:yourusername/document-change-agent.git

# Проверка remote
git remote -v

# Если нужно изменить URL:
git remote set-url origin https://github.com/yourusername/document-change-agent.git
```

---

## Настройка .gitignore

### 1. Проверка существующего .gitignore

```bash
# Проверка наличия .gitignore
cat .gitignore
```

### 2. Создание/обновление .gitignore

Если файл `.gitignore` отсутствует или нужно его дополнить:

```bash
# Создание/редактирование .gitignore
nano .gitignore
```

### 3. Рекомендуемое содержимое .gitignore

Добавьте следующее содержимое в `.gitignore`:

```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg
venv/
env/
ENV/
.venv

# Node.js / React
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnp
.pnp.js
*.log
.DS_Store
dist/
build/
.cache/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
.env*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~
.project
.classpath
.settings/
*.iml

# Docker
.dockerignore

# Data directories (не загружайте данные пользователей!)
data/uploads/
data/outputs/
data/backups/
data/logs/
data/database/
data/prompts/

# Но сохраняйте структуру директорий
!data/uploads/.gitkeep
!data/outputs/.gitkeep
!data/backups/.gitkeep
!data/logs/.gitkeep
!data/prompts/.gitkeep

# OS
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
Desktop.ini

# Logs
*.log
logs/
*.log.*

# Temporary files
*.tmp
*.temp
*.bak
*.swp
*.swo

# Database
*.db
*.sqlite
*.sqlite3

# Secrets and keys
*.pem
*.key
*.cert
secrets/
.secrets

# Backup files
*_backup_*
*.backup

# Parlant data
parlant-data/
*.parlant

# Coverage reports
htmlcov/
.coverage
.coverage.*
coverage.xml
*.cover

# Jupyter Notebook
.ipynb_checkpoints

# pyenv
.python-version

# Celery
celerybeat-schedule
celerybeat.pid

# SageMath parsed files
*.sage.py

# Spyder project settings
.spyderproject
.spyproject

# Rope project settings
.ropeproject

# mkdocs documentation
/site

# mypy
.mypy_cache/
.dmypy.json
dmypy.json

# Pyre type checker
.pyre/
```

### 4. Создание .gitkeep файлов для пустых директорий

```bash
# Создание .gitkeep файлов для сохранения структуры директорий
mkdir -p data/{uploads,outputs,backups,logs,prompts}
touch data/uploads/.gitkeep
touch data/outputs/.gitkeep
touch data/backups/.gitkeep
touch data/logs/.gitkeep
touch data/prompts/.gitkeep
```

---

## Первый коммит и push

### 1. Проверка файлов перед коммитом

```bash
# Просмотр статуса
git status

# Просмотр изменений (если есть)
git diff
```

### 2. Добавление файлов

```bash
# Добавление всех файлов (кроме указанных в .gitignore)
git add .

# Или добавление файлов по одному
git add README.md
git add docker-compose.yml
git add backend/
git add react/
git add mcp-server/
git add .gitignore

# Проверка добавленных файлов
git status
```

### 3. Создание первого коммита

```bash
# Создание коммита
git commit -m "Initial commit: Document Change Agent project"

# Или более подробное сообщение
git commit -m "Initial commit

- Add Docker Compose configuration
- Add FastAPI backend with Parlant Agent
- Add React frontend
- Add MCP Word Server integration
- Add documentation and deployment guides"
```

### 4. Переименование ветки (если нужно)

```bash
# Переименование ветки в main (если используется master)
git branch -M main

# Проверка текущей ветки
git branch
```

### 5. Push на GitHub

```bash
# Push в репозиторий (первый раз)
git push -u origin main

# Или если ветка называется master
git push -u origin master

# В дальнейшем можно использовать просто:
git push
```

### 6. Проверка на GitHub

1. Откройте ваш репозиторий на GitHub
2. Убедитесь, что все файлы загружены
3. Проверьте, что `.env` файл **НЕ** загружен (он должен быть в .gitignore)

---

## Работа с ветками

### 1. Создание новой ветки

```bash
# Создание и переключение на новую ветку
git checkout -b feature/new-feature

# Или в Git 2.23+
git switch -c feature/new-feature

# Список всех веток
git branch -a
```

### 2. Работа с веткой

```bash
# Внесение изменений
# ... редактирование файлов ...

# Добавление изменений
git add .

# Коммит
git commit -m "Add new feature"

# Push ветки на GitHub
git push -u origin feature/new-feature
```

### 3. Создание Pull Request

1. Перейдите на GitHub
2. Нажмите **"Compare & pull request"**
3. Заполните описание изменений
4. Нажмите **"Create pull request"**
5. После ревью и одобрения выполните merge

### 4. Слияние веток

```bash
# Переключение на main ветку
git checkout main

# Обновление main ветки
git pull origin main

# Слияние feature ветки
git merge feature/new-feature

# Push изменений
git push origin main

# Удаление локальной ветки
git branch -d feature/new-feature

# Удаление удаленной ветки
git push origin --delete feature/new-feature
```

---

## Настройка для работы в команде

### 1. Клонирование репозитория

```bash
# Клонирование репозитория
git clone https://github.com/yourusername/document-change-agent.git

# Или через SSH
git clone git@github.com:yourusername/document-change-agent.git

# Переход в директорию
cd document-change-agent
```

### 2. Создание .env.example

```bash
# Создание примера файла .env
cp .env .env.example

# Редактирование .env.example (удалите реальные секреты)
nano .env.example
```

Пример `.env.example`:

```bash
# OpenAI API Key
OPENAI_API_KEY=sk-your-openai-api-key-here

# База данных PostgreSQL
POSTGRES_DB=document_agent
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-password-here

# JWT Secret Key
JWT_SECRET_KEY=your-very-secure-random-secret-key-min-32-chars

# MCP Server
MCP_SERVER_HOST=mcp-server
MCP_SERVER_PORT=8000

# Data directory
DATA_DIR=/data
```

```bash
# Добавление .env.example в репозиторий
git add .env.example
git commit -m "Add .env.example template"
git push
```

### 3. Создание CONTRIBUTING.md

```bash
# Создание файла с инструкциями для контрибьюторов
nano CONTRIBUTING.md
```

Пример содержимого:

```markdown
# Руководство по внесению вклада

## Процесс разработки

1. Создайте ветку для вашей функции
2. Внесите изменения
3. Создайте Pull Request
4. Дождитесь ревью

## Стандарты кода

- Следуйте стилю кода проекта
- Добавляйте комментарии к сложным участкам
- Пишите тесты для новой функциональности
```

### 4. Настройка защиты ветки main

На GitHub:

1. Перейдите в **Settings** → **Branches**
2. Добавьте правило для ветки `main`:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging

---

## Структура репозитория

### Рекомендуемая структура

```
document-change-agent/
│
├── 📄 README.md                    # Главная документация
├── 📄 LICENSE                      # Лицензия проекта
├── 📄 .gitignore                   # Игнорируемые файлы
├── 📄 .env.example                 # Пример конфигурации
├── 📄 docker-compose.yml           # Docker Compose конфигурация
├── 📄 start.sh                     # Скрипт запуска
│
├── 📁 backend/                     # Backend приложение
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app.py
│   └── ...
│
├── 📁 react/                       # React Frontend
│   ├── Dockerfile
│   ├── package.json
│   └── ...
│
├── 📁 mcp-server/                  # MCP Word Server
│   └── Dockerfile
│
├── 📁 docs/                        # Документация
│   ├── USER_GUIDE.md
│   ├── DEPLOYMENT_UBUNTU.md
│   └── ...
│
└── 📁 data/                        # Данные (в .gitignore)
    ├── uploads/
    ├── outputs/
    └── ...
```

### Создание структуры документации

```bash
# Создание директории для документации
mkdir -p docs

# Перемещение документации
mv USER_GUIDE.md docs/
mv DEPLOYMENT_UBUNTU.md docs/
mv GITHUB_DEPLOYMENT.md docs/

# Добавление в репозиторий
git add docs/
git commit -m "Add documentation"
git push
```

---

## Настройка GitHub Actions (опционально)

### 1. Создание директории для workflows

```bash
mkdir -p .github/workflows
```

### 2. Создание workflow для тестирования

```bash
nano .github/workflows/test.yml
```

Пример содержимого:

```yaml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: |
        cd backend
        pip install -r requirements.txt
    
    - name: Run tests
      run: |
        cd backend
        pytest
```

### 3. Создание workflow для Docker build

```bash
nano .github/workflows/docker-build.yml
```

```yaml
name: Docker Build

on:
  push:
    branches: [ main ]
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
    
    - name: Build backend
      uses: docker/build-push-action@v4
      with:
        context: ./backend
        push: false
        tags: document-change-agent-backend:latest
    
    - name: Build frontend
      uses: docker/build-push-action@v4
      with:
        context: ./react
        push: false
        tags: document-change-agent-frontend:latest
```

---

## Рекомендации и best practices

### 1. Коммиты

**✅ Хорошие практики:**

```bash
# Понятные сообщения коммитов
git commit -m "Add user authentication system"
git commit -m "Fix bug in file upload validation"
git commit -m "Update documentation for deployment"

# Использование conventional commits
git commit -m "feat: add search functionality"
git commit -m "fix: resolve memory leak in document processing"
git commit -m "docs: update user guide"
```

**❌ Плохие практики:**

```bash
# Избегайте таких сообщений
git commit -m "fix"
git commit -m "update"
git commit -m "changes"
```

### 2. Частота коммитов

- Делайте коммиты часто (после каждой логической единицы работы)
- Не накапливайте много изменений в одном коммите
- Каждый коммит должен быть работоспособным

### 3. Работа с секретами

**❌ НИКОГДА не коммитьте:**

- `.env` файлы с реальными ключами
- Пароли и токены
- Приватные ключи
- Данные пользователей

**✅ Всегда:**

- Используйте `.env.example` для примеров
- Проверяйте `.gitignore` перед коммитом
- Используйте GitHub Secrets для CI/CD

### 4. Проверка перед push

```bash
# Проверка статуса
git status

# Просмотр изменений
git diff

# Проверка, что .env не добавлен
git status | grep .env

# Если .env попал в staging, удалите его
git reset HEAD .env
```

### 5. Теги и релизы

```bash
# Создание тега для версии
git tag -a v1.0.0 -m "Release version 1.0.0"

# Push тега на GitHub
git push origin v1.0.0

# Список всех тегов
git tag

# Создание релиза на GitHub:
# 1. Перейдите в Releases
# 2. Нажмите "Create a new release"
# 3. Выберите тег
# 4. Добавьте описание
```

### 6. Обновление из удаленного репозитория

```bash
# Получение изменений
git fetch origin

# Просмотр изменений
git log HEAD..origin/main

# Слияние изменений
git pull origin main

# Или с rebase (для чистой истории)
git pull --rebase origin main
```

### 7. Откат изменений

```bash
# Отмена изменений в рабочей директории
git checkout -- filename

# Отмена всех изменений
git checkout -- .

# Отмена последнего коммита (сохраняя изменения)
git reset --soft HEAD~1

# Отмена последнего коммита (удаляя изменения)
git reset --hard HEAD~1

# ⚠️ Осторожно с --hard, изменения будут потеряны!
```

---

## Полезные команды

### Просмотр истории

```bash
# Краткая история коммитов
git log --oneline

# История с графиком веток
git log --oneline --graph --all

# История конкретного файла
git log -- filename

# Кто изменил строку
git blame filename
```

### Поиск в истории

```bash
# Поиск коммита по сообщению
git log --grep="search term"

# Поиск по содержимому файлов
git log -S "search term"

# Поиск по автору
git log --author="Author Name"
```

### Сравнение

```bash
# Сравнение с последним коммитом
git diff

# Сравнение с конкретным коммитом
git diff HEAD~1

# Сравнение веток
git diff main..feature-branch

# Сравнение файлов
git diff file1 file2
```

### Очистка

```bash
# Удаление неотслеживаемых файлов
git clean -n  # предпросмотр
git clean -f  # удаление

# Удаление неотслеживаемых директорий
git clean -fd
```

---

## Решение проблем

### Проблема: Конфликт при merge

```bash
# Просмотр конфликтов
git status

# Редактирование файлов с конфликтами
# ... разрешение конфликтов ...

# Добавление разрешенных файлов
git add .

# Завершение merge
git commit
```

### Проблема: Случайно закоммитили .env

```bash
# Удаление из истории (ОСТОРОЖНО!)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (только если уверены!)
git push origin --force --all
```

### Проблема: Забыли добавить файл в коммит

```bash
# Добавление файла в последний коммит
git add forgotten-file.txt
git commit --amend --no-edit
```

### Проблема: Нужно изменить сообщение последнего коммита

```bash
# Изменение сообщения
git commit --amend -m "New commit message"

# Force push (если уже был push)
git push --force origin main
```

---

## Дополнительные ресурсы

### Полезные ссылки

- [Официальная документация Git](https://git-scm.com/doc)
- [GitHub Guides](https://guides.github.com/)
- [Git Cheat Sheet](https://education.github.com/git-cheat-sheet-education.pdf)
- [Conventional Commits](https://www.conventionalcommits.org/)

### Книги и курсы

- "Pro Git" by Scott Chacon
- GitHub Learning Lab
- Atlassian Git Tutorials

---

## Чеклист перед первым push

- [ ] Git инициализирован
- [ ] .gitignore настроен правильно
- [ ] .env файл НЕ добавлен в репозиторий
- [ ] .env.example создан и добавлен
- [ ] README.md обновлен
- [ ] Все секреты удалены из кода
- [ ] Структура проекта организована
- [ ] Первый коммит создан
- [ ] Remote репозиторий добавлен
- [ ] Push выполнен успешно
- [ ] Файлы видны на GitHub

---

**Версия инструкции:** 1.0  
**Дата обновления:** 2025-11-24

---

*Успешной работы с Git и GitHub! 🚀*

