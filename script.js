
let currentSession = null;
let serversList = [];
let timerInterval = null;
let serversByCountryCache = {};

document.addEventListener('DOMContentLoaded', () => {
  checkCachedSession();
});

function checkCachedSession() {
  const cachedSession = localStorage.getItem('protonSession');
  const expires = localStorage.getItem('protonSessionExpires');
  if (cachedSession && expires) {
    const now = new Date().getTime();
    if (now < parseInt(expires)) {
      // Преобразуем сохраненную JSON-строку обратно в объект
                    try {
                        currentSession = JSON.parse(cachedSession);
                    } catch (e) {
                        // Фолбэк на случай, если это была обычная строка
                        currentSession = cachedSession;
                    }
                    
                    startTimer(parseInt(expires));
                    
                    // Загружаем серверы, используя восстановленную сессию
                    fetchAndRenderServers(currentSession).then(() => {
                        showAlert('Сессия восстановлена. Серверы загружены!');
                    }).catch(err => {
                        showAlert('Ошибка при загрузке серверов: ' + err.message, true);
                        clearSession(); // Сбрасываем битую сессию
                    });
                } else {
                    // Время истекло
                    clearSession();
                }
            }
        }

        function showAlert(msg, isError = false) {
            const box = document.getElementById('alertBox');
            box.textContent = msg;
            box.className = `mb-4 p-4 rounded text-sm font-semibold block ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
            setTimeout(() => { box.classList.add('hidden'); }, 5000);
        }

async function apiRequest(endpoint, body = null) {
            const baseUrl = 'https://proton-api-proxy.vercel.app'
            const headers = { 'Content-Type': 'application/json' };
            const options = {
                method: 'POST', 
                headers: headers
            };
            if (body !== null) options.body = JSON.stringify(body);

            const res = await fetch(`${baseUrl}${endpoint}`, options);
            const data = await res.json();
            
            if (!data.ok) {
                const errorMessage = data.error || 'Произошла неизвестная ошибка (см. консоль)';
                
                // Если API возвращает ошибку токена или авторизации, принудительно сбрасываем сессию
                const lowerError = errorMessage.toLowerCase();
                if (lowerError.includes('token') || lowerError.includes('session') || res.status === 401 || res.status === 403) {
                    // Вызываем clearSession, если она уже загружена
                    if (typeof clearSession === 'function') {
                        clearSession();
                    }
                    // Меняем текст ошибки на более понятный для пользователя
                    throw new Error('Сессия устарела или недействительна. Пожалуйста, подключитесь заново.');
                }
                
                throw new Error(errorMessage);
            }
            
            return data;
        }

function startTimer(expirationTime) {
            const btn = document.getElementById('btnConnect');
            const timerContainer = document.getElementById('timerContainer');
            const timerText = document.getElementById('timerText');
            btn.style.display = 'none';
            timerContainer.classList.remove('hidden');
            timerContainer.classList.add('flex'); 

            if (timerInterval) clearInterval(timerInterval);

            timerInterval = setInterval(() => {
                const now = new Date().getTime();
                const distance = expirationTime - now;

                if (distance <= 0) {
                    clearInterval(timerInterval);
                    clearSession();
                    showAlert('Время сессии истекло. Пожалуйста, подключитесь заново.', true);
                    return;
                }

                const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((distance % (1000 * 60)) / 1000);

                timerText.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }, 1000);
        }

function clearSession() {
            localStorage.removeItem('protonSession');
            localStorage.removeItem('protonSessionExpires');
            localStorage.removeItem('wgSeed'); // Очищаем seed ключей
            currentSession = null;
            
            if (timerInterval) clearInterval(timerInterval);
            
            const btn = document.getElementById('btnConnect');
            const timerContainer = document.getElementById('timerContainer');
            
            if (btn) btn.style.display = 'block';
            if (timerContainer) {
                timerContainer.classList.add('hidden');
                timerContainer.classList.remove('flex');
            }
            
            document.getElementById('step2').classList.add('hidden');
            document.getElementById('step3').classList.add('hidden');
        }

async function fetchAndRenderServers(session) {
            const serversData = await apiRequest('/api/proton/servers', { session: session });
            serversList = serversData.servers;

            // 1. Группируем серверы
            serversByCountryCache = serversList.reduce((acc, srv) => {
                const country = srv.exitCountry || 'Неизвестно';
                if (!acc[country]) acc[country] = [];
                acc[country].push(srv);
                return acc;
            }, {});

            // 2. Рендерим кнопки фильтров
            renderFilterButtons(Object.keys(serversByCountryCache).sort());

            // 3. Рендерим список (по умолчанию "Все")
            renderServersList('all');

            document.getElementById('step2').classList.remove('hidden');
        }

// Рендер радио-фильтров с использованием внешних CSS классов
function renderFilterButtons(countries) {
            const container = document.getElementById('filterContainer');
            container.innerHTML = '';
            
            const filterOptions = ['all', ...countries];

            filterOptions.forEach((country) => {
                const isAll = country === 'all';
                
                const label = document.createElement('label');
                // Присваиваем базовый класс, и active если это выбранный элемент
                label.className = isAll ? 'filter-option active' : 'filter-option';

                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'countryFilter';
                radio.value = country;
                radio.className = 'hidden';
                radio.checked = isAll;

                radio.onchange = () => {
                    renderServersList(country);
                    
                    // Убираем класс 'active' у всех остальных
                    container.querySelectorAll('.filter-option').forEach(l => {
                        l.classList.remove('active');
                    });
                    
                    // Добавляем 'active' текущему
                    label.classList.add('active');
                };

                const text = isAll ? '🌍 Все' : `${getFlagEmoji(country)} ${country}`;
                
                label.appendChild(radio);
                label.appendChild(document.createTextNode(text));
                container.appendChild(label);
            });
        }

// Рендер выпадающего списка
function renderServersList(countryFilter) {
            const select = document.getElementById('serverSelect');
            select.innerHTML = '';

            // Определяем, какие страны показывать
            const countriesToShow = (countryFilter === 'all') 
                ? Object.keys(serversByCountryCache).sort() 
                : [countryFilter];

            countriesToShow.forEach(country => {
                const optgroup = document.createElement('optgroup');
                const flag = getFlagEmoji(country);
                optgroup.label = flag ? `${flag} ${country}` : country;

                const servers = serversByCountryCache[country];
                
                // Сортировка по нагрузке
                servers.sort((a, b) => a.load - b.load || a.name.localeCompare(b.name));

                servers.forEach(srv => {
                    const option = document.createElement('option');
                    option.value = srv.id;
                    const cleanName = srv.name.replace('-FREE#', '_');
                    const loadSymbol = getLoadSymbol(srv.load);
                    
                    option.dataset.name = cleanName; 
                    option.textContent = `${loadSymbol} ${cleanName} (${srv.city}) [${srv.load}%]`;
                    optgroup.appendChild(option);
                });

                select.appendChild(optgroup);
            });
        }

async function connectProxy() {
            const btn = document.getElementById('btnConnect');
            btn.textContent = 'Загрузка...';
            btn.disabled = true;

            try {
                const sessionData = await apiRequest('/api/proton/session', {});
                currentSession = sessionData.session;
                const expires = new Date().getTime() + 24 * 60 * 60 * 1000;
                localStorage.setItem('protonSession', JSON.stringify(currentSession));
                localStorage.setItem('protonSessionExpires', expires.toString());
                startTimer(expires);
                await fetchAndRenderServers(currentSession);
                showAlert('Успешно подключено. Серверы загружены!');
} catch (error) {
                showAlert(error.message, true);
                console.error(error);
                // Возвращаем кнопку при ошибке через стиль
                btn.style.display = 'block'; 
            } finally {
                btn.textContent = 'Подключиться и получить серверы';
                btn.disabled = false;
            }
        }

async function generateConfig() {
            const btn = document.getElementById('btnGenerate');
            btn.textContent = 'Генерация...';
            btn.disabled = true;

            try {
                // 1. Получаем или генерируем Seed
                let seed;
                const cachedSeed = localStorage.getItem('wgSeed');
                
                if (cachedSeed) {
                    // Восстанавливаем из кэша
                    seed = nacl.util.decodeBase64(cachedSeed);
                } else {
                    // Генерируем новый и сохраняем
                    seed = nacl.randomBytes(32);
                    localStorage.setItem('wgSeed', nacl.util.encodeBase64(seed));
                }
                
                // 2. Создаем пару Ed25519 (для сертификата) из Seed
                const edKeyPair = nacl.sign.keyPair.fromSeed(seed);
                const edPubKeyBase64 = nacl.util.encodeBase64(edKeyPair.publicKey);
                const pemPublicKey = `-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA${edPubKeyBase64}\n-----END PUBLIC KEY-----\n`;

                // 3. Вычисляем приватный ключ X25519 (для WireGuard) из того же Seed
                const hash = nacl.hash(seed);
                const wgPrivKey = new Uint8Array(32);
                for (let i = 0; i < 32; i++) wgPrivKey[i] = hash[i];
                
                wgPrivKey[0] &= 248;
                wgPrivKey[31] &= 127;
                wgPrivKey[31] |= 64;

                const wgPrivKeyBase64 = nacl.util.encodeBase64(wgPrivKey);

                // 4. Регистрируем ключ (если сессия есть)
                const certData = await apiRequest('/api/proton/certificate', {
                    session: currentSession,
                    clientPublicKey: pemPublicKey,
                    persistent: false
                });

                // 5. Выбираем данные сервера
                const serverId = document.getElementById('serverSelect').value;
                const server = serversList.find(s => s.id === serverId);

                // 6. Формируем конфиг
                const configStr = `[Interface]
# ProtonVPN Certificate Valid Until: ${new Date(certData.certificate.expirationTime * 1000).toLocaleString()}
PrivateKey = ${wgPrivKeyBase64}
Address = 10.2.0.2/32
DNS = 10.2.0.1

[Peer]
# Server: ${server.name}
PublicKey = ${server.publicKey}
Endpoint = ${server.entryIp}:51820
AllowedIPs = 0.0.0.0/0, ::/0`;

                document.getElementById('wgConfigText').value = configStr;
                document.getElementById('step3').classList.remove('hidden');
                showAlert('Конфигурация успешно создана');
            } catch (error) {
                showAlert(error.message, true);
                console.error(error);
            } finally {
                btn.textContent = 'Сгенерировать конфиг';
                btn.disabled = false;
            }
        }

function downloadConfig() {
    const text = document.getElementById('wgConfigText').value;
    const select = document.getElementById('serverSelect');
    const selectedOption = select.options[select.selectedIndex];
    
    // Берем чистое имя сервера из data-атрибута (например, US-FREE#1)
    const serverName = selectedOption.dataset.name || selectedOption.value;
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${serverName}.conf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Эмодзи флага из двухбуквенного кода страны
function getFlagEmoji(countryCode) {
    if (!countryCode || countryCode.length !== 2) return '';
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

// Индикатор нагрузки
function getLoadSymbol(load) {
    if (load < 30) return '🟢'; 
    if (load < 60) return '🟡'; 
    if (load < 90) return '🟠'; 
    return '🔴';                
}