// Глобальное состояние
let currentSessionId = null;
let websocket = null;
let selectedFiles = {
    source: null,
    changes: null,
};
let availableUploads = [];

// DOM элементы
const elements = {
    // Шаг 1
    btnGenerateTestFiles: document.getElementById('btnGenerateTestFiles'),
    fileSource: document.getElementById('fileSource'),
    fileChanges: document.getElementById('fileChanges'),
    statusSource: document.getElementById('statusSource'),
    statusChanges: document.getElementById('statusChanges'),
    selectSourceFile: document.getElementById('selectSourceFile'),
    selectChangesFile: document.getElementById('selectChangesFile'),
    btnStartProcessing: document.getElementById('btnStartProcessing'),

    // Шаг 2
    progressBar: document.getElementById('progressBar'),
    progressText: document.getElementById('progressText'),
    statusLog: document.getElementById('statusLog'),
    changesList: document.getElementById('changesList'),

    // Шаг 3
    resultsSummary: document.getElementById('resultsSummary'),
    downloadList: document.getElementById('downloadList'),
    btnNewProcessing: document.getElementById('btnNewProcessing'),

    // Секции
    sectionUpload: document.getElementById('section-upload'),
    sectionProcessing: document.getElementById('section-processing'),
    sectionResults: document.getElementById('section-results'),

    // Шаги
    step1: document.getElementById('step1'),
    step2: document.getElementById('step2'),
    step3: document.getElementById('step3'),

    // Вкладки
    tabMain: document.getElementById('tabMain'),
    tabCheck: document.getElementById('tabCheck'),
    tabContentMain: document.getElementById('tabContentMain'),
    tabContentCheck: document.getElementById('tabContentCheck'),

    // Проверка инструкций
    fileCheck: document.getElementById('fileCheck'),
    statusCheckFile: document.getElementById('statusCheckFile'),
    selectCheckFile: document.getElementById('selectCheckFile'),
    btnCheckInstructions: document.getElementById('btnCheckInstructions'),
    checkResults: document.getElementById('checkResults'),
    checkSummary: document.getElementById('checkSummary'),
    checkDetails: document.getElementById('checkDetails'),
    btnExportResults: document.getElementById('btnExportResults'),
    btnNewCheck: document.getElementById('btnNewCheck'),
};

document.addEventListener('DOMContentLoaded', async () => {
    // Проверяем наличие элементов перед инициализацией
    if (!elements.tabMain || !elements.tabCheck) {
        console.error('Вкладки не найдены в DOM');
    }
    if (!elements.tabContentMain || !elements.tabContentCheck) {
        console.error('Контент вкладок не найден в DOM');
    }
    
    initializeEventListeners();
    await fetchAvailableFiles();
    initializeTabs();
    console.log('✓ Document Change Agent инициализирован');
});

function initializeEventListeners() {
    elements.btnGenerateTestFiles.addEventListener('click', generateTestFiles);

    elements.fileSource.addEventListener('change', (e) => handleFileUpload(e, 'source'));
    elements.fileChanges.addEventListener('change', (e) => handleFileUpload(e, 'changes'));

    setupDragAndDrop('uploadSource', elements.fileSource);
    setupDragAndDrop('uploadChanges', elements.fileChanges);

    elements.selectSourceFile.addEventListener('change', () => handleFileSelection('source'));
    elements.selectChangesFile.addEventListener('change', () => handleFileSelection('changes'));

    elements.btnStartProcessing.addEventListener('click', startProcessing);
    elements.btnNewProcessing.addEventListener('click', resetToUpload);

    // Проверка инструкций (проверяем наличие элементов)
    if (elements.fileCheck) {
        elements.fileCheck.addEventListener('change', (e) => handleCheckFileUpload(e));
        setupDragAndDrop('uploadCheckFile', elements.fileCheck);
    }
    if (elements.selectCheckFile) {
        elements.selectCheckFile.addEventListener('change', handleCheckFileSelection);
    }
    if (elements.btnCheckInstructions) {
        elements.btnCheckInstructions.addEventListener('click', checkInstructions);
    }
    if (elements.btnExportResults) {
        elements.btnExportResults.addEventListener('click', exportCheckResults);
    }
    if (elements.btnNewCheck) {
        elements.btnNewCheck.addEventListener('click', resetCheck);
    }
}

function initializeTabs() {
    if (!elements.tabMain || !elements.tabCheck || !elements.tabContentMain || !elements.tabContentCheck) {
        console.error('Не все элементы вкладок найдены:', {
            tabMain: !!elements.tabMain,
            tabCheck: !!elements.tabCheck,
            tabContentMain: !!elements.tabContentMain,
            tabContentCheck: !!elements.tabContentCheck
        });
        return;
    }
    
    elements.tabMain.addEventListener('click', () => switchTab('main'));
    elements.tabCheck.addEventListener('click', () => switchTab('check'));
    
    // Инициализация: показываем первую вкладку по умолчанию
    switchTab('main');
}

function switchTab(tabName) {
    if (!elements.tabMain || !elements.tabCheck || !elements.tabContentMain || !elements.tabContentCheck) {
        console.error('Элементы вкладок не найдены:', {
            tabMain: !!elements.tabMain,
            tabCheck: !!elements.tabCheck,
            tabContentMain: !!elements.tabContentMain,
            tabContentCheck: !!elements.tabContentCheck
        });
        return;
    }
    
    // Обновляем кнопки вкладок
    if (tabName === 'main') {
        elements.tabMain.classList.add('active');
        elements.tabCheck.classList.remove('active');
        elements.tabContentMain.classList.remove('hidden');
        elements.tabContentCheck.classList.add('hidden');
    } else if (tabName === 'check') {
        elements.tabMain.classList.remove('active');
        elements.tabCheck.classList.add('active');
        elements.tabContentMain.classList.add('hidden');
        elements.tabContentCheck.classList.remove('hidden');
    }
    
    console.log(`Переключено на вкладку: ${tabName}`, {
        tabMainActive: elements.tabMain.classList.contains('active'),
        tabCheckActive: elements.tabCheck.classList.contains('active'),
        contentMainHidden: elements.tabContentMain.classList.contains('hidden'),
        contentCheckHidden: elements.tabContentCheck.classList.contains('hidden')
    });
}

let selectedCheckFile = null;
let isCheckingInProgress = false; // Флаг для предотвращения повторных запросов

async function handleCheckFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.docx')) {
        showCheckFileStatus('Поддерживаются только .docx файлы', false);
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_type', 'check');

    try {
        const response = await fetch('/api/upload-file', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) throw new Error('Ошибка загрузки');

        const data = await response.json();
        selectedCheckFile = data.filename;
        elements.selectCheckFile.value = data.filename;
        showCheckFileStatus(
            `✓ Загружен ${data.original_filename} (${formatBytes(data.size)})`,
            true
        );
        elements.btnCheckInstructions.disabled = false;
        await fetchAvailableFiles();
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        showCheckFileStatus('✗ Ошибка загрузки файла', false);
    }
}

function handleCheckFileSelection() {
    selectedCheckFile = elements.selectCheckFile.value || null;
    showCheckFileStatus(
        selectedCheckFile ? `Выбран файл: ${selectedCheckFile}` : 'Файл не выбран',
        selectedCheckFile ? true : null
    );
    elements.btnCheckInstructions.disabled = !selectedCheckFile;
}

function showCheckFileStatus(message, state) {
    elements.statusCheckFile.textContent = message;
    elements.statusCheckFile.className = 'file-status';
    if (state === true) {
        elements.statusCheckFile.classList.add('success');
    } else if (state === false) {
        elements.statusCheckFile.classList.add('error');
    }
}

async function checkInstructions() {
    if (!selectedCheckFile) {
        showCheckFileStatus('Выберите файл для проверки', false);
        return;
    }

    // Защита от повторных запросов
    if (isCheckingInProgress || elements.btnCheckInstructions.disabled) {
        console.log('Проверка уже выполняется, пропускаем повторный запрос');
        return;
    }

    isCheckingInProgress = true;
    elements.btnCheckInstructions.disabled = true;
    elements.btnCheckInstructions.textContent = '⏳ Проверка...';
    elements.checkResults.classList.add('hidden');

    try {
        // Увеличенный timeout для проверки инструкций (5 минут)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 минут

        const response = await fetch(`/api/check-instructions?filename=${encodeURIComponent(selectedCheckFile)}`, {
            method: 'POST',
            signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: response.statusText }));
            throw new Error(errorData.detail || `Ошибка ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Проверяем структуру данных
        if (!data || typeof data !== 'object') {
            throw new Error('Некорректный формат ответа от сервера');
        }

        // Формируем сводку
        const totalChanges = data.total_changes || 0;
        const parserChanges = data.parser_changes || 0;
        const llmChanges = data.llm_changes || 0;
        const summary = data.summary || {};
        const byOperation = summary.by_operation || {};
        const massReplacements = summary.mass_replacements || [];
        
        const summaryHTML = `
            <h3>Результаты проверки</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-value">${totalChanges}</div>
                    <div class="summary-label">Всего инструкций</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">${parserChanges}</div>
                    <div class="summary-label">Парсером</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">${llmChanges}</div>
                    <div class="summary-label">LLM</div>
                </div>
            </div>
            <div style="margin-top: 20px;">
                <strong>По типам операций:</strong><br>
                ${Object.keys(byOperation).length > 0 
                    ? Object.entries(byOperation).map(([op, count]) => 
                        `${op}: ${count}`
                    ).join(', ')
                    : 'Нет операций'
                }
            </div>
            ${massReplacements.length > 0 ? `
                <div style="margin-top: 15px;">
                    <strong>Массовые замены:</strong><br>
                    ${massReplacements.map(mr => 
                        `"${(mr.old || '').substring(0, 50)}${mr.old && mr.old.length > 50 ? '...' : ''}" → "${(mr.new || '').substring(0, 50)}${mr.new && mr.new.length > 50 ? '...' : ''}"`
                    ).join('<br>')}
                </div>
            ` : ''}
        `;
        elements.checkSummary.innerHTML = summaryHTML;

        // Формируем детали
        const changes = data.changes || [];
        const detailsText = changes.length > 0 
            ? changes.map((change, idx) => {
                try {
                    const changeId = change.change_id || `CHG-${String(idx + 1).padStart(3, '0')}`;
                    const operation = change.operation || 'UNKNOWN';
                    let text = `${idx + 1}. ${changeId}: ${operation}\n`;
                    text += `   Описание: ${change.description || 'Нет описания'}\n`;
                    
                    if (operation === 'REPLACE_TEXT') {
                        const target = change.target || {};
                        const payload = change.payload || {};
                        const searchText = (target.text || '').substring(0, 100);
                        const replaceText = (payload.new_text || '').substring(0, 100);
                        text += `   Ищем: "${searchText}${target.text && target.text.length > 100 ? '...' : ''}"\n`;
                        text += `   Заменяем на: "${replaceText}${payload.new_text && payload.new_text.length > 100 ? '...' : ''}"\n`;
                        if (target.replace_all) {
                            text += `   Тип: МАССОВАЯ ЗАМЕНА\n`;
                        }
                    } else if (operation === 'DELETE_PARAGRAPH') {
                        const target = change.target || {};
                        const targetText = (target.text || '').substring(0, 100);
                        text += `   Удаляем: "${targetText}${target.text && target.text.length > 100 ? '...' : ''}"\n`;
                    } else if (operation === 'REPLACE_POINT_TEXT') {
                        const target = change.target || {};
                        const payload = change.payload || {};
                        const pointText = (target.text || '').substring(0, 50);
                        const newText = (payload.new_text || '').substring(0, 150);
                        text += `   Пункт: "${pointText}${target.text && target.text.length > 50 ? '...' : ''}"\n`;
                        text += `   Новый текст: "${newText}${payload.new_text && payload.new_text.length > 150 ? '...' : ''}"\n`;
                    } else if (operation === 'INSERT_PARAGRAPH') {
                        const target = change.target || {};
                        const payload = change.payload || {};
                        const afterText = (target.after_text || '').substring(0, 50);
                        const insertText = (payload.text || '').substring(0, 150);
                        text += `   После: "${afterText}${target.after_text && target.after_text.length > 50 ? '...' : ''}"\n`;
                        text += `   Вставляем: "${insertText}${payload.text && payload.text.length > 150 ? '...' : ''}"\n`;
                    } else if (operation === 'INSERT_SECTION') {
                        const payload = change.payload || {};
                        text += `   Заголовок: "${payload.heading_text || 'Нет заголовка'}"\n`;
                        text += `   Параграфов: ${(payload.paragraphs || []).length}\n`;
                    }
                    return text;
                } catch (err) {
                    console.error(`Ошибка обработки изменения ${idx + 1}:`, err, change);
                    return `${idx + 1}. Ошибка обработки изменения: ${err.message}`;
                }
            }).join('\n\n')
            : 'Изменения не найдены';

        elements.checkDetails.textContent = detailsText;
        elements.checkResults.classList.remove('hidden');
        showCheckFileStatus('✓ Проверка завершена успешно', true);
    } catch (error) {
        console.error('Ошибка проверки:', error);
        
        let errorMessage = error.message || 'Неизвестная ошибка при проверке файла';
        
        // Специальная обработка для timeout
        if (error.name === 'AbortError' || errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
            errorMessage = 'Превышено время ожидания ответа. Проверка может занять до 5 минут для больших файлов. Попробуйте еще раз.';
        }
        
        showCheckFileStatus(`✗ ${errorMessage}`, false);
        
        // Показываем ошибку в области результатов
        if (elements.checkResults) {
            elements.checkSummary.innerHTML = `
                <h3 style="color: #dc3545;">Ошибка проверки</h3>
                <p style="color: #721c24;">${errorMessage}</p>
                <p style="font-size: 0.9em; color: #6c757d;">Проверьте, что файл существует и доступен для чтения.</p>
            `;
            elements.checkDetails.textContent = `Ошибка: ${errorMessage}\n\nПопробуйте:\n1. Убедитесь, что файл загружен\n2. Проверьте формат файла (.docx)\n3. Попробуйте загрузить файл заново\n4. Если файл большой, подождите до 5 минут`;
            elements.checkResults.classList.remove('hidden');
        }
    } finally {
        isCheckingInProgress = false;
        elements.btnCheckInstructions.disabled = false;
        elements.btnCheckInstructions.textContent = '🔍 Проверить файл';
    }
}

function exportCheckResults() {
    if (!selectedCheckFile) return;
    
    const url = `/api/export-check-results?filename=${encodeURIComponent(selectedCheckFile)}`;
    window.open(url, '_blank');
}

function resetCheck() {
    selectedCheckFile = null;
    elements.selectCheckFile.value = '';
    elements.fileCheck.value = '';
    elements.checkResults.classList.add('hidden');
    showCheckFileStatus('Файл не выбран', null);
    elements.btnCheckInstructions.disabled = true;
}

async function fetchAvailableFiles(preferred = {}) {
    try {
        const response = await fetch('/api/files');
        if (!response.ok) throw new Error('Не удалось получить список файлов');

        const data = await response.json();
        availableUploads = data.uploads || [];

        const sourceCandidate = preferred.source ?? selectedFiles.source;
        const changesCandidate = preferred.changes ?? selectedFiles.changes;

        populateSelect(elements.selectSourceFile, availableUploads, sourceCandidate);
        populateSelect(elements.selectChangesFile, availableUploads, changesCandidate);
        if (elements.selectCheckFile) {
            populateSelect(elements.selectCheckFile, availableUploads, selectedCheckFile);
        }

        updateSelectedStatus('source');
        updateSelectedStatus('changes');
        checkFilesReady();
    } catch (error) {
        console.error('Ошибка получения списка файлов:', error);
        addLog('✗ Не удалось загрузить список файлов', 'error');
    }
}

function populateSelect(selectElement, files, selectedValue) {
    const currentValue = selectedValue && files.includes(selectedValue) ? selectedValue : '';
    selectElement.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— выберите файл —';
    selectElement.appendChild(placeholder);

    files
        .slice()
        .sort((a, b) => a.localeCompare(b))
        .forEach((filename) => {
            const option = document.createElement('option');
            option.value = filename;
            option.textContent = filename;
            selectElement.appendChild(option);
        });

    selectElement.value = currentValue;
    if (currentValue) {
        selectedFiles[selectElement === elements.selectSourceFile ? 'source' : 'changes'] =
            currentValue;
    }
}

function handleFileSelection(fileType) {
    const selectElement =
        fileType === 'source' ? elements.selectSourceFile : elements.selectChangesFile;
    const filename = selectElement.value || null;
    selectedFiles[fileType] = filename;
    updateSelectedStatus(fileType);
    checkFilesReady();
}

function updateSelectedStatus(fileType, messageOverride) {
    const filename = selectedFiles[fileType];
    if (filename) {
        showFileStatus(
            fileType,
            messageOverride ?? `Выбран файл: ${filename}`,
            true
        );
    } else {
        showFileStatus(
            fileType,
            messageOverride ?? 'Файл не выбран',
            null
        );
    }
}

function setSelectedFile(fileType, filename, message) {
    selectedFiles[fileType] = filename;
    const selectElement =
        fileType === 'source' ? elements.selectSourceFile : elements.selectChangesFile;
    if (filename && availableUploads.includes(filename)) {
        selectElement.value = filename;
    }
    updateSelectedStatus(fileType, message);
    checkFilesReady();
}

async function generateTestFiles() {
    elements.btnGenerateTestFiles.disabled = true;
    elements.btnGenerateTestFiles.textContent = '⏳ Генерация...';

    try {
        const response = await fetch('/api/generate-test-files', { method: 'POST' });
        if (!response.ok) throw new Error('Ошибка генерации');

        const data = await response.json();

        setSelectedFile('source', data.files.source, `✓ ${data.files.source} готов`);
        setSelectedFile('changes', data.files.changes, `✓ ${data.files.changes} готов`);
        await fetchAvailableFiles({
            source: data.files.source,
            changes: data.files.changes,
        });

        addLog('✓ Тестовые файлы сгенерированы', 'success');
    } catch (error) {
        console.error('Ошибка генерации:', error);
        addLog('✗ Ошибка генерации тестовых файлов', 'error');
    } finally {
        elements.btnGenerateTestFiles.disabled = false;
        elements.btnGenerateTestFiles.textContent = '🎲 Сгенерировать тестовые файлы';
    }
}

async function handleFileUpload(event, fileType) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.docx')) {
        showFileStatus(fileType, 'Поддерживаются только .docx файлы', false);
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_type', fileType);

    try {
        const response = await fetch('/api/upload-file', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) throw new Error('Ошибка загрузки');

        const data = await response.json();
        setSelectedFile(
            fileType,
            data.filename,
            `✓ Загружен ${data.original_filename} (${formatBytes(data.size)})`
        );
        await fetchAvailableFiles({ [fileType]: data.filename });

        addLog(`✓ Загружен файл ${data.original_filename}`, 'success');
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        showFileStatus(fileType, '✗ Ошибка загрузки файла', false);
    }
}

function setupDragAndDrop(areaId, inputElement) {
    const area = document.getElementById(areaId);

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
        area.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
        area.addEventListener(
            eventName,
            () => area.classList.add('drag-over'),
            false
        );
    });

    ['dragleave', 'drop'].forEach((eventName) => {
        area.addEventListener(
            eventName,
            () => area.classList.remove('drag-over'),
            false
        );
    });

    area.addEventListener(
        'drop',
        (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                inputElement.files = files;
                inputElement.dispatchEvent(new Event('change'));
            }
        },
        false
    );
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function showFileStatus(fileType, message = '', state = null) {
    const statusElement =
        fileType === 'source' ? elements.statusSource : elements.statusChanges;
    statusElement.textContent = message;
    statusElement.className = 'file-status';

    if (state === true) {
        statusElement.classList.add('success');
    } else if (state === false) {
        statusElement.classList.add('error');
    }
}

function checkFilesReady() {
    const ready = Boolean(selectedFiles.source) && Boolean(selectedFiles.changes);
    elements.btnStartProcessing.disabled = !ready;
}

async function startProcessing() {
    if (!selectedFiles.source || !selectedFiles.changes) {
        addLog('✗ Укажите файлы исходника и изменений', 'error');
        return;
    }

    try {
        switchToStep(2);
        elements.changesList.innerHTML = '';
        elements.statusLog.innerHTML = '<div class="log-entry info">Подготовка к обработке...</div>';

        const response = await fetch('/api/process-documents', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                source_filename: selectedFiles.source,
                changes_filename: selectedFiles.changes,
            }),
        });

        if (!response.ok) throw new Error('Ошибка запуска обработки');

        const data = await response.json();
        currentSessionId = data.session_id;

        addLog('✓ Обработка запущена', 'success');
        addLog(`Session ID: ${currentSessionId}`);

        connectWebSocket(currentSessionId);
        startStatusPolling(currentSessionId);
    } catch (error) {
        console.error('Ошибка запуска:', error);
        addLog('✗ Ошибка запуска обработки', 'error');
    }
}

function connectWebSocket(sessionId) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/${sessionId}`;

    websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
        console.log('✓ WebSocket подключен');
        addLog('✓ Real-time соединение установлено');
    };

    websocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
    };

    websocket.onerror = (error) => {
        console.error('WebSocket ошибка:', error);
    };

    websocket.onclose = () => {
        console.log('WebSocket закрыт');
    };
}

function handleWebSocketMessage(message) {
    switch (message.type) {
        case 'progress':
            updateProgress(message.data);
            break;

        case 'operation_completed':
            addChangeItem(message.data);
            break;

        case 'completed':
            handleCompletion(message.data);
            break;

        case 'error':
            handleError(message.data);
            break;
    }
}

async function startStatusPolling(sessionId) {
    const pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/session/${sessionId}/status`);
            if (!response.ok) {
                clearInterval(pollInterval);
                return;
            }

            const data = await response.json();

            if (data.status === 'completed') {
                clearInterval(pollInterval);
                handleCompletion(data.results);
            } else if (data.status === 'failed') {
                clearInterval(pollInterval);
                handleError(data);
            }
        } catch (error) {
            console.error('Ошибка polling:', error);
            clearInterval(pollInterval);
        }
    }, 2000);
}

function updateProgress(data) {
    if (data.progress !== undefined) {
        elements.progressBar.style.width = `${data.progress}%`;
        elements.progressText.textContent = `${data.progress}%`;
    }

    if (data.status) {
        addLog(data.status);
    }
}

function formatChangeDetails(details) {
    if (!details) return 'Выполнено успешно';
    if (typeof details === 'string') return details;
    if (details.success) {
        const { success, ...rest } = details;
        if (Object.keys(rest).length === 0) {
            return 'Выполнено успешно';
        }
        return `Выполнено успешно\n${JSON.stringify(rest, null, 2)}`;
    }
    if (details.message) return details.message;
    if (details.error) {
        const { error, message, ...rest } = details;
        const extra = Object.keys(rest).length ? `\n${JSON.stringify(rest, null, 2)}` : '';
        return `${error}${message ? `: ${message}` : ''}${extra}`;
    }
    try {
        return JSON.stringify(details, null, 2);
    } catch (error) {
        return String(details);
    }
}

function summarizeDetails(details) {
    if (!details) return '';
    if (typeof details === 'string') return details;
    if (details.message) return details.message;
    if (details.success && details.paragraph_index !== undefined) {
        return `параграф ${details.paragraph_index}`;
    }
    if (details.error) return details.error;
    return '';
}

function addChangeItem(data) {
    const item = document.createElement('div');
    item.className = `change-item ${data.status.toLowerCase()}`;

    const detailsText = formatChangeDetails(data.details);
    const summaryText = summarizeDetails(data.details);
    item.innerHTML = `
        <div class="change-header">
            <span class="change-id">${data.change_id}</span>
            <span class="change-status ${data.status.toLowerCase()}">${data.status}</span>
        </div>
        <div class="change-description">${data.description ?? ''}</div>
        <div class="change-operation">Операция: ${data.operation}</div>
        <div style="margin-top: 8px; font-size: 0.9em; white-space: pre-wrap;">
            ${detailsText}
        </div>
    `;

    elements.changesList.appendChild(item);
    const logMessage = `${data.change_id} • ${data.operation} — ${data.status}${
        summaryText ? ` (${summaryText})` : ''
    }`;
    addLog(logMessage, data.status.toLowerCase());
}

function handleCompletion(results) {
    if (!results) return;
    addLog('✓ Обработка завершена', 'success');

    setTimeout(() => {
        switchToStep(3);
        displayResults(results);
    }, 500);
}

function handleError(data) {
    const message = data?.error || 'Неизвестная ошибка';
    addLog(`✗ Ошибка: ${message}`, 'error');
}

function displayResults(results) {
    const summaryHTML = `
        <h3>✓ Обработка завершена</h3>
        <div class="summary-grid">
            <div class="summary-item">
                <div class="summary-value">${results.total_changes ?? 0}</div>
                <div class="summary-label">Всего изменений</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${results.successful ?? 0}</div>
                <div class="summary-label">Успешно</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${results.failed ?? 0}</div>
                <div class="summary-label">Ошибок</div>
            </div>
        </div>
    `;
    elements.resultsSummary.innerHTML = summaryHTML;

    const processedName =
        results.processed_filename || selectedFiles.source || 'processed.docx';
    const backupName =
        results.backup_filename ||
        (processedName.endsWith('.docx')
            ? `${processedName.replace(/\.docx$/i, '')}_backup.docx`
            : `${processedName}_backup.docx`);

    const downloadHTML = `
        <div class="download-item">
            <div class="download-icon">📄</div>
            <div class="download-name">${processedName}</div>
            <div class="download-size">Обработанный документ</div>
            <a href="/api/download/${processedName}" class="download-btn" download>Скачать</a>
        </div>
        <div class="download-item">
            <div class="download-icon">💾</div>
            <div class="download-name">${backupName}</div>
            <div class="download-size">Резервная копия</div>
            <a href="/api/download/${backupName}" class="download-btn" download>Скачать</a>
        </div>
    `;
    elements.downloadList.innerHTML = downloadHTML;
}

function switchToStep(stepNumber) {
    [elements.step1, elements.step2, elements.step3].forEach((step, index) => {
        step.classList.toggle('active', index + 1 === stepNumber);
    });

    elements.sectionUpload.classList.toggle('hidden', stepNumber !== 1);
    elements.sectionProcessing.classList.toggle('hidden', stepNumber !== 2);
    elements.sectionResults.classList.toggle('hidden', stepNumber !== 3);
}

function resetToUpload() {
    if (websocket) {
        websocket.close();
        websocket = null;
    }

    currentSessionId = null;
    elements.progressBar.style.width = '0%';
    elements.progressText.textContent = '0%';
    elements.statusLog.innerHTML = '<div class="log-entry">Инициализация...</div>';
    elements.changesList.innerHTML = '';

    switchToStep(1);
    fetchAvailableFiles();
}

function addLog(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `${new Date().toLocaleTimeString()} - ${message}`;

    elements.statusLog.appendChild(entry);
    elements.statusLog.scrollTop = elements.statusLog.scrollHeight;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

console.log('✓ app.js загружен');

