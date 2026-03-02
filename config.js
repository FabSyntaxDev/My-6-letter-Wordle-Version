document.addEventListener('DOMContentLoaded', () => {
    let words = [];
    let secretWord = '';
    let currentAttempt = 0;
    let currentGuess = '';
    let gameOver = false;
    const maxAttempts = 5;
    const wordLength = 6;

    const board = document.getElementById('game-board');
    const currentRowElement = document.getElementById('current-row');
    const tileInputs = Array.from(currentRowElement.querySelectorAll('.tile-input'));
    const attemptsDisplay = document.getElementById('attempts-display');
    const historyList = document.getElementById('history-list');
    const keyboard = document.getElementById('virtual-keyboard');
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const closeModal = document.getElementById('close-modal');

    // Initialize keys (Exact Layout from Image)
    const keys = [
        ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
        ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'BACK'],
        ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'ENTER']
    ];



    const _u = 'aHR0cHM6Ly9hcGkubnBvaW50LmlvLzI5NzFjYWI5YTZjZjA1YTNmOGQz';
    const apiURL = atob(_u);

    function getDayKey() {
        const now = new Date();
        return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    }

    fetch(apiURL)
        .then(response => {
            if (!response.ok) throw new Error('Falha ao carregar API');
            return response.json();
        })
        .then(data => {
            words = Object.values(data.calendar_words);
            initGame();
        })
        .catch(err => {
            console.warn('Erro na API, usando reserva:', err);
            words = fallbackWords;
            initGame();
        });

    function initGame() {
        // Select word of the day
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 0);
        const diff = now - start;
        const oneDay = 1000 * 60 * 60 * 24;
        const dayOfYear = Math.floor(diff / oneDay);

        secretWord = (words[dayOfYear % words.length] || words[0] || 'BANANA').toUpperCase();

        createKeyboard();
        setupInputHandlers();
        loadGameState(); // Load progress or final state
        closeModal.onclick = () => modal.classList.add('hidden');
    }

    function loadGameState() {
        const saved = JSON.parse(localStorage.getItem('nano-banana-state'));
        const today = getDayKey();

        if (saved && saved.date === today) {
            currentAttempt = saved.attempts.length;
            attemptsDisplay.textContent = `${currentAttempt}/${maxAttempts}`;

            // Replay saved attempts
            saved.attempts.forEach((guess, index) => {
                const result = checkGuess(guess, secretWord);
                const row = document.createElement('div');
                row.className = 'row rendered-row';

                guess.split('').forEach((letter, i) => {
                    const tile = document.createElement('div');
                    tile.className = `tile ${result[i]}`;
                    tile.textContent = letter;
                    row.appendChild(tile);
                    updateKeyStatus(letter, result[i]);
                });

                board.insertBefore(row, currentRowElement);
                if (guess !== secretWord) {
                    addToHistory(guess, result);
                }
            });

            if (saved.gameOver) {
                gameOver = true;
                window.location.href = 'lockout.html';
                return;
            }
        } else {
            // New day or first time
            localStorage.removeItem('nano-banana-state');
            tileInputs[0].focus();
        }
    }

    function saveGameState(won = false) {
        const attempts = Array.from(board.querySelectorAll('.rendered-row')).map(row => {
            return Array.from(row.querySelectorAll('.tile')).map(tile => tile.textContent).join('');
        });

        const state = {
            date: getDayKey(),
            attempts: attempts,
            gameOver: gameOver,
            won: won
        };
        localStorage.setItem('nano-banana-state', JSON.stringify(state));
    }

    function disableInputs() {
        tileInputs.forEach(input => {
            input.disabled = true;
            input.value = '';
        });
    }

    function createKeyboard() {
        keyboard.innerHTML = '';
        keys.forEach(row => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'keyboard-row';
            row.forEach(key => {
                const btn = document.createElement('button');
                btn.className = 'key';
                if (key === 'BACK' || key === 'ENTER') {
                    btn.classList.add('wide');
                    if (key === 'BACK') {
                        btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path><line x1="18" y1="9" x2="12" y2="15"></line><line x1="12" y1="9" x2="18" y2="15"></line></svg>`;
                    } else {
                        btn.textContent = 'ENTER';
                    }
                } else {
                    btn.textContent = key;
                }
                btn.id = `key-${key}`;
                btn.onclick = () => handleInput(key);
                rowDiv.appendChild(btn);
            });
            keyboard.appendChild(rowDiv);
        });
    }

    function setupInputHandlers() {
        tileInputs.forEach((input, index) => {
            // Handle typing
            input.addEventListener('input', (e) => {
                const val = e.data?.toUpperCase() || e.target.value.slice(-1).toUpperCase();
                if (/^[A-Z]$/.test(val)) {
                    input.value = val;
                    if (index < wordLength - 1) tileInputs[index + 1].focus();
                } else {
                    input.value = '';
                }
                updateCurrentGuess();
            });

            // Handle backspace and navigation
            input.addEventListener('keydown', (e) => {
                if (gameOver) {
                    e.preventDefault();
                    return;
                }

                if (e.key === 'Backspace' && !input.value && index > 0) {
                    tileInputs[index - 1].focus();
                } else if (e.key === 'Enter') {
                    submitGuess();
                } else if (e.key === 'ArrowLeft' && index > 0) {
                    tileInputs[index - 1].focus();
                } else if (e.key === 'ArrowRight' && index < wordLength - 1) {
                    tileInputs[index + 1].focus();
                }
            });
        });
    }

    function handleInput(key) {
        if (gameOver) return;

        if (key === 'ENTER') {
            submitGuess();
        } else if (key === 'BACK') {
            const focused = document.activeElement;
            const index = tileInputs.indexOf(focused);

            if (index !== -1) {
                if (focused.value) {
                    focused.value = '';
                } else if (index > 0) {
                    tileInputs[index - 1].focus();
                    tileInputs[index - 1].value = '';
                }
            } else {
                // If nothing focused, start from end
                for (let i = wordLength - 1; i >= 0; i--) {
                    if (tileInputs[i].value) {
                        tileInputs[i].value = '';
                        tileInputs[i].focus();
                        break;
                    }
                }
            }
            updateCurrentGuess();
        } else {
            // Letter key
            const focused = document.activeElement;
            let index = tileInputs.indexOf(focused);

            if (index === -1) {
                // Find first empty slot
                index = tileInputs.findIndex(input => !input.value);
                if (index === -1) index = wordLength - 1;
            }

            tileInputs[index].value = key;
            if (index < wordLength - 1) tileInputs[index + 1].focus();
            updateCurrentGuess();
        }
    }

    function updateCurrentGuess() {
        currentGuess = tileInputs.map(input => input.value).join('');
    }

    function submitGuess() {
        updateCurrentGuess();
        if (currentGuess.length !== wordLength) {
            currentRowElement.classList.add('shake');
            setTimeout(() => currentRowElement.classList.remove('shake'), 500);
            return;
        }

        const result = checkGuess(currentGuess, secretWord);
        revealGuess(result);
    }

    function checkGuess(guess, secret) {
        const result = Array(wordLength).fill('absent');
        const secretArr = secret.split('');
        const guessArr = guess.split('');

        // First pass: Correct matches
        for (let i = 0; i < wordLength; i++) {
            if (guessArr[i] === secretArr[i]) {
                result[i] = 'correct';
                secretArr[i] = null;
                guessArr[i] = null;
            }
        }

        // Second pass: Present matches
        for (let i = 0; i < wordLength; i++) {
            if (guessArr[i] && secretArr.includes(guessArr[i])) {
                result[i] = 'present';
                const firstIndex = secretArr.indexOf(guessArr[i]);
                secretArr[firstIndex] = null;
            }
        }
        return result;
    }

    function revealGuess(result) {
        let completed = 0;
        const savedGuess = currentGuess;
        gameOver = true; // Lock during animation

        result.forEach((status, i) => {
            const input = tileInputs[i];
            const letter = savedGuess[i];

            setTimeout(() => {
                input.classList.add('flip');
                setTimeout(() => {
                    input.classList.remove('tile-input');
                    input.classList.add('tile', status);
                    input.disabled = true;
                    updateKeyStatus(letter, status);
                    completed++;
                    if (completed === wordLength) {
                        if (savedGuess !== secretWord && currentAttempt < maxAttempts - 1) {
                            gameOver = false; // Unlock if not end of game
                        }
                        finalizeTurn(savedGuess, result);
                    }
                }, 300);
            }, i * 100);
        });
    }

    function updateKeyStatus(letter, status) {
        const keyBtn = document.getElementById(`key-${letter}`);
        if (!keyBtn) return;

        if (status === 'correct') {
            keyBtn.className = 'key correct';
        } else if (status === 'present' && !keyBtn.classList.contains('correct')) {
            keyBtn.className = 'key present';
        } else if (status === 'absent' && !keyBtn.classList.contains('correct') && !keyBtn.classList.contains('present')) {
            keyBtn.className = 'key absent';
            keyBtn.disabled = true;
        }
    }

    function addToHistory(guess, result) {
        const item = document.createElement('div');
        item.className = 'history-item';

        // Add the word text
        const wordSpan = document.createElement('span');
        wordSpan.className = 'history-word';
        wordSpan.textContent = guess;
        item.appendChild(wordSpan);

        const tilesContainer = document.createElement('div');
        tilesContainer.className = 'history-tiles';
        result.forEach(status => {
            const tile = document.createElement('div');
            tile.className = `history-tile ${status}`;
            tilesContainer.appendChild(tile);
        });
        item.appendChild(tilesContainer);

        historyList.appendChild(item);
        historyList.scrollTop = historyList.scrollHeight;
    }

    function finalizeTurn(guess, result) {
        const won = guess === secretWord;
        currentAttempt++;
        attemptsDisplay.textContent = `${currentAttempt}/${maxAttempts}`;

        if (won) {
            gameOver = true;
            addToHistory(guess, result);
            saveGameState(true);
            showEndModal(true);
            disableInputs();
        } else if (currentAttempt >= maxAttempts) {
            gameOver = true;
            addToHistory(guess, result);
            saveGameState(false);
            showEndModal(false);
            disableInputs();
        } else {
            addToHistory(guess, result);
            prepareNextRow();
            currentGuess = '';
            saveGameState(false);
        }
    }

    function prepareNextRow() {
        // Move current tiles to a static row
        const oldRow = document.createElement('div');
        oldRow.className = 'row rendered-row';
        tileInputs.forEach(input => {
            const tile = document.createElement('div');
            tile.className = input.className;
            tile.classList.remove('flip');
            tile.textContent = input.value;
            oldRow.appendChild(tile);

            // Reset input for next guess
            input.className = 'tile-input';
            input.value = '';
            input.disabled = false;
        });
        board.insertBefore(oldRow, currentRowElement);
        tileInputs[0].focus();
    }

    function showEndModal(won) {
        modalTitle.textContent = won ? 'Você Venceu!' : '💥 Fim de Jogo';
        modalMessage.textContent = won
            ? `Parabéns! Você acertou a palavra`
            : `Que pena! A palavra era: ${secretWord}.`;

        modal.classList.remove('hidden');

        // Redirect after 3 seconds so they can see the result
        setTimeout(() => {
            window.location.href = 'lockout.html';
        }, 5000);
    }
});
