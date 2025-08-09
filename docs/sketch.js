// --- GameStateオブジェクトで状態を一元管理 ---
const GameState = {
  currentScreen: 'title',
  targetLabel: null,
  gameTimer: null,
  timeLeft: 60,
  isGameActive: false,
  isMatchingInProgress: false,
  exitCountdownTimer: null,
  exitCountdownTime: 60,
  matchingAnimationTimer: null,
  gameStartTime: null,
  room: null,
  rematchRequested: false,
  myName: '',
  opponentName: '',
  myIcon: '👤',
  opponentIcon: '👤',
  finished: false,
  selectedTopic: null, // お題選択モードで選択したお題を保持
  audioVolume: 0.7 // デフォルト音量70%
};
const GAME_TIME_LIMIT = 30; // 制限時間（秒）

// === 音声管理システム ===
const AudioManager = {
  context: null,
  sounds: {},
  
  // AudioContextを初期化
  init() {
    try {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      this.generateSounds();
      this.setupVolumeControl();
    } catch (e) {
      console.warn('Audio not supported:', e);
    }
  },
  
  // 効果音を生成
  generateSounds() {
    if (!this.context) return;
    
    // 勝利音（明るいファンファーレ）
    this.sounds.win = this.createMelody([
      {freq: 523, duration: 0.15}, // C5
      {freq: 659, duration: 0.15}, // E5
      {freq: 784, duration: 0.15}, // G5
      {freq: 1047, duration: 0.3}  // C6
    ], 'sawtooth');
    
    // 敗北音（下降音）
    this.sounds.lose = this.createMelody([
      {freq: 392, duration: 0.2}, // G4
      {freq: 349, duration: 0.2}, // F4
      {freq: 294, duration: 0.2}, // D4
      {freq: 262, duration: 0.4}  // C4
    ], 'sine');
    
    // 引き分け音（中性的な音）
    this.sounds.draw = this.createMelody([
      {freq: 523, duration: 0.2}, // C5
      {freq: 523, duration: 0.2}, // C5
      {freq: 523, duration: 0.3}  // C5
    ], 'triangle');
    
    // マッチング成功音
    this.sounds.matching = this.createMelody([
      {freq: 440, duration: 0.1}, // A4
      {freq: 554, duration: 0.1}, // C#5
      {freq: 659, duration: 0.2}  // E5
    ], 'sine');
    
    // ゲーム開始音
    this.sounds.start = this.createMelody([
      {freq: 659, duration: 0.1}, // E5
      {freq: 784, duration: 0.1}, // G5
      {freq: 1047, duration: 0.2} // C6
    ], 'square');
    
    // 完成音
    this.sounds.finish = this.createTone(880, 0.15, 'sine'); // A5
    
    // ボタン音
    this.sounds.button = this.createTone(523, 0.05, 'square'); // C5
  },
  
  // 単一トーン生成
  createTone(frequency, duration, waveType = 'sine') {
    if (!this.context) return null;
    
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);
    
    oscillator.frequency.setValueAtTime(frequency, this.context.currentTime);
    oscillator.type = waveType;
    
    gainNode.gain.setValueAtTime(0, this.context.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3 * GameState.audioVolume, this.context.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);
    
    return {
      play() {
        if (AudioManager.context && AudioManager.context.state === 'suspended') {
          AudioManager.context.resume();
        }
        oscillator.start(AudioManager.context.currentTime);
        oscillator.stop(AudioManager.context.currentTime + duration);
      }
    };
  },
  
  // メロディ生成
  createMelody(notes, waveType = 'sine') {
    if (!this.context) return null;
    
    return {
      play() {
        if (AudioManager.context && AudioManager.context.state === 'suspended') {
          AudioManager.context.resume();
        }
        
        let startTime = AudioManager.context.currentTime;
        notes.forEach((note, index) => {
          const oscillator = AudioManager.context.createOscillator();
          const gainNode = AudioManager.context.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(AudioManager.context.destination);
          
          oscillator.frequency.setValueAtTime(note.freq, startTime);
          oscillator.type = waveType;
          
          gainNode.gain.setValueAtTime(0, startTime);
          gainNode.gain.linearRampToValueAtTime(0.2 * GameState.audioVolume, startTime + 0.01);
          gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + note.duration);
          
          oscillator.start(startTime);
          oscillator.stop(startTime + note.duration);
          
          startTime += note.duration;
        });
      }
    };
  },
  
  // 音量コントロール設定
  setupVolumeControl() {
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeValue = document.getElementById('volumeValue');
    
    if (volumeSlider && volumeValue) {
      volumeSlider.addEventListener('input', (e) => {
        GameState.audioVolume = e.target.value / 100;
        volumeValue.textContent = e.target.value + '%';
        
        // テスト音再生
        if (this.sounds.button) {
          this.play('button');
        }
      });
    }
  },
  
  // 音声再生
  play(soundName) {
    if (GameState.audioVolume === 0) return; // 音量0なら再生しない
    
    if (this.sounds[soundName]) {
      try {
        // 新しいサウンドインスタンスを作成して再生
        if (soundName === 'win') {
          this.sounds.win = this.createMelody([
            {freq: 523, duration: 0.15},
            {freq: 659, duration: 0.15},
            {freq: 784, duration: 0.15},
            {freq: 1047, duration: 0.3}
          ], 'sawtooth');
        } else if (soundName === 'lose') {
          this.sounds.lose = this.createMelody([
            {freq: 392, duration: 0.2},
            {freq: 349, duration: 0.2},
            {freq: 294, duration: 0.2},
            {freq: 262, duration: 0.4}
          ], 'sine');
        } else if (soundName === 'draw') {
          this.sounds.draw = this.createMelody([
            {freq: 523, duration: 0.2},
            {freq: 523, duration: 0.2},
            {freq: 523, duration: 0.3}
          ], 'triangle');
        } else if (soundName === 'matching') {
          this.sounds.matching = this.createMelody([
            {freq: 440, duration: 0.1},
            {freq: 554, duration: 0.1},
            {freq: 659, duration: 0.2}
          ], 'sine');
        } else if (soundName === 'start') {
          this.sounds.start = this.createMelody([
            {freq: 659, duration: 0.1},
            {freq: 784, duration: 0.1},
            {freq: 1047, duration: 0.2}
          ], 'square');
        } else if (soundName === 'finish') {
          this.sounds.finish = this.createTone(880, 0.15, 'sine');
        } else if (soundName === 'button') {
          this.sounds.button = this.createTone(523, 0.05, 'square');
        }
        
        this.sounds[soundName].play();
      } catch (e) {
        console.warn('Sound playback failed:', e);
      }
    }
  }
};

// ゲーム画面のボタンを有効/無効にする関数
function setGameButtonsEnabled(enabledOrOptions) {
  // enabledOrOptions: true/false もしくは {exceptJudge: true}
  const buttons = [
    'judgeBtn',        // 完成ボタン（対戦ボタン）
    'resetTargetBtn',  // お題変更ボタン
    'clearBtn1',       // 消去ボタン
    'eraserBtn1',      // 消しゴムボタン
    'penBtn1',         // ペンボタン
    'clearBtn2',       // 右側消去ボタン（念のため）
    'eraserBtn2',      // 右側消しゴムボタン（念のため）
    'penBtn2',         // 右側ペンボタン（念のため）
    'backToTitleFromGameBtn'  // タイトルに戻るボタン
  ];
  let exceptJudge = false;
  let enabled = true;
  if (typeof enabledOrOptions === 'object' && enabledOrOptions.exceptJudge) {
    exceptJudge = true;
    enabled = true;
  } else {
    enabled = !!enabledOrOptions;
  }
  buttons.forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
      if (exceptJudge && btnId === 'judgeBtn') {
        btn.disabled = true;
      } else {
      btn.disabled = !enabled;
      }
    }
  });
  if (exceptJudge) {
    console.log('ゲームボタンを「完成」以外有効にしました');
  } else {
  console.log(`ゲームボタンを${enabled ? '有効' : '無効'}にしました`);
  }
}

// ROOMから退出する関数
function leaveRoom() {
  if (GameState.room) {
    console.log('ROOMから退出:', GameState.room);
    socket.emit('leave_room', { room: GameState.room });
    GameState.room = null;
  }
}

// ゲーム初期化関数
function init() {
  // お題をリセット
  GameState.targetLabel = null;
  const targetEl = document.getElementById('targetCategory');
  if (targetEl) {
    targetEl.innerText = 'お題：？';
  }
  
  // ゲーム状態をリセット
  GameState.isGameActive = false;
  GameState.isMatchingInProgress = false; // マッチング演出状態もリセット
  GameState.finished = false;
  
  // 制限時間をリセット
  GameState.timeLeft = typeof GAME_TIME_LIMIT !== 'undefined' ? GAME_TIME_LIMIT : 30;

  // タイマーを停止
  stopTimer();
  
  // 退出カウントダウンを停止
  stopExitCountdown();
  
  // マッチング演出を停止
  stopMatchingAnimation();
  
  // キャンバスをクリア
  if (window.clearCanvas1) window.clearCanvas1();
  if (window.clearCanvas2) window.clearCanvas2();
  
  // ボタンを「完成」以外有効化（マッチング待機中）
  setGameButtonsEnabled({exceptJudge:true});
  
  // マッチング効果を非表示
  const effect = document.getElementById('matchingEffect');
  if (effect) {
    effect.style.display = 'none';
    effect.style.opacity = 0;
  }
  
  // 結果画面のマッチング効果も非表示
  const resultEffect = document.getElementById('resultMatchingEffect');
  if (resultEffect) {
    resultEffect.style.display = 'none';
    resultEffect.style.opacity = 0;
  }
  
  // 待機メッセージを非表示
  showWaitingMessage(false);
  showOpponentRematchMsg(false, false);
  showOpponentFinishMsg(false, false);
  
  console.log('ゲームを初期化しました');
  // judgeBtn（完成ボタン）を必ず有効化
  const judgeBtn = document.getElementById('judgeBtn');
  if (judgeBtn) judgeBtn.disabled = false;
}

// === socket.io初期化 ===
let socket = io();

// 部屋割り
socket.on('waiting', () => {
  console.log('もう一人の参加を待っています...');
});
socket.on('room_joined', (data) => {
  GameState.room = data.room;
  console.log('部屋に参加:', GameState.room);
});

let waitingDotsInterval = null;

function showWaitingMessage(show) {
  const msg = document.getElementById('waitingMessage');
  if (!msg) return;
  const waves = msg.querySelectorAll('.wave');
  if (!waves.length) return;
  for (const span of waves) {
    span.style.visibility = show ? 'visible' : 'hidden';
  }
}

// --- 再戦希望通知メッセージ制御 ---
function showOpponentRematchMsg(show, waiting) {
  const msg = document.getElementById('opponentRematchMsg');
  const text = document.getElementById('rematchMsgText');
  if (!msg || !text) return;
  msg.style.visibility = show ? 'visible' : 'hidden';
  if (show) {
    text.textContent = waiting ? '相手の選択を待っています' : '相手が再戦を希望しています';
  }
}

// === 部屋選択画面ロジック ===
function requestRoomStatus() {
  socket.emit('get_rooms');
}
socket.on('room_status', (data) => {
  const roomList = document.getElementById('roomList');
  if (!roomList) return;
  roomList.innerHTML = '';
  
  // データ形式の互換性を保つ
  const status = data.status || data;
  const leavingStatus = data.leavingStatus || {};
  
  for (const roomName of ['room1', 'room2', 'room3', 'room4']) {
    const btn = document.createElement('button');
    btn.className = 'game-button room-btn';
    
    const isLeaving = leavingStatus[roomName] || false;
    const isFull = status[roomName] >= 2;
    const isDisabled = isFull || isLeaving;
    
    let buttonText = '';
    if (isFull) {
      buttonText = `${roomName}　対戦中: ${status[roomName]}人`;
    } else {
      buttonText = `${roomName}　待機中: ${status[roomName]}人`;
    }
    
    if (isLeaving) {
      buttonText += ' (退出処理中)';
    }
    
    btn.textContent = buttonText;
    btn.disabled = isDisabled;
    btn.onclick = () => {
      showTopicSelectModal(selectedTopic => {
        window._pendingSelectedTopic = selectedTopic;
        joinRoom(roomName);
      });
    };
    roomList.appendChild(btn);
  }
  
  // トレーニングルーム（完全一人用・お題選択なし）ボタン
  const trainingBtn = document.createElement('button');
  trainingBtn.className = 'game-button room-btn';
  trainingBtn.textContent = 'トレーニングルーム（お題なし）';
  trainingBtn.onclick = () => {
    // サーバーにjoinRoomせず、ローカルのみで画面遷移・状態管理
    GameState.room = 'solo_training';
    GameState.myName = getUserName();
    GameState.myIcon = getUserIcon();
    GameState.opponentName = '';
    GameState.opponentIcon = '';
    setPlayerTitles();
    showScreen('gameScreen');
    // お題表示エリアを完全に非表示
    const targetEl = document.getElementById('targetCategory');
    if (targetEl) {
      targetEl.style.display = 'none';
      if (targetEl.parentElement) targetEl.parentElement.style.display = 'none';
    }
    // 完成ボタンを消す
    const judgeBtn = document.getElementById('judgeBtn');
    if (judgeBtn) judgeBtn.style.display = 'none';
    // 描画操作ボタンのみ有効化
    ['clearBtn1','eraserBtn1','penBtn1'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = false;
    });
    // タイトルに戻るボタンは有効化
    const backBtn = document.getElementById('backToTitleFromGameBtn');
    if (backBtn) backBtn.disabled = false;
    // 他のボタンは無効化/非表示
    ['clearBtn2','eraserBtn2','penBtn2'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = true;
    });
    // キャンバスは自由に描ける
    if (window.clearCanvas1) window.clearCanvas1();
    if (window.clearCanvas2) window.clearCanvas2();
    // トレーニングバナー表示
    updateTrainingBanner();
  };
  roomList.appendChild(trainingBtn);

  // お題リクエストボタン・選択中お題表示は廃止
  
  // 自分が入っている部屋が2人になったら待機中メッセージを消す
  if (GameState.room && status[GameState.room] === 2) {
    showWaitingMessage(false);
  }
});
function joinRoom(roomName) {
  GameState.myName = getUserName();
  GameState.myIcon = getUserIcon();
  setPlayerTitles(); // ここで即時反映
  if (window._pendingSelectedTopic !== undefined) {
    GameState.selectedTopic = window._pendingSelectedTopic;
    window._pendingSelectedTopic = undefined;
    window._lastWasTopicSelectMode = true;
  } else {
    GameState.selectedTopic = null;
    window._lastWasTopicSelectMode = false;
  }
  socket.emit('join_room', { roomName, name: GameState.myName, icon: GameState.myIcon });
  showWaitingMessage(true);
}

// サーバーから入室成功
socket.on('room_joined', (data) => {
  GameState.room = data.room;
  setPlayerTitles(); // 入室直後にも反映
  showScreen('gameScreen');
  showWaitingMessage(false);
  updateTrainingBanner();
  if (GameState.room && GameState.room.startsWith('training_') && GameState.selectedTopic) {
    socket.emit('send_topic', { room: GameState.room, topic: GameState.selectedTopic });
    GameState.selectedTopic = null;
  }
});

// サーバーから入室失敗
socket.on('join_room_failed', (data) => {
  showWaitingMessage(false);
  let message = '';
  if (data.reason === 'leaving_in_progress') {
    message = '退出処理中のため入室できません。しばらく待ってから再度お試しください。';
  } else {
    message = '部屋が満室または対戦中のため入室できません。他の部屋をお試しください。';
  }
  alert(message);
});

// 退出リクエスト
function leaveRoom() {
  if (GameState.room) {
    socket.emit('leave_room', { room: GameState.room });
  }
}

// サーバーから退出成功
socket.on('leave_room_success', (data) => {
  GameState.room = null;
  updateTrainingBanner();
  // resetGameState() や showScreen('titleScreen') は1分後に行うのでここでは不要
});

// シーン遷移関数
function showScreen(screenId) {
  // 全ての画面を非表示
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
    screen.style.display = 'none'; // 明示的に非表示
  });

  // 指定された画面を表示
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
    target.style.display = 'flex'; // 明示的に表示
    console.log('表示中の画面:', screenId, target);
    // ゲーム画面に遷移したときはmatchingEffect帯を必ず非表示に
    if (screenId === 'gameScreen') {
      const effect = document.getElementById('matchingEffect');
      if (effect) {
        effect.style.display = 'none';
        effect.style.opacity = 0;
      }
    }
  } else {
    console.error('画面が見つかりません:', screenId);
  }
}

// お題をランダムに選択
function pickRandomCategory() {
  const category = categories[Math.floor(Math.random() * categories.length)];
  return category.en; // 英語名を返す
}

let rematchRequested = false;

// マッチング演出中かどうかを判定する関数
function isInMatchingPhase() {
  return GameState.isMatchingInProgress; // マッチング演出中のみ
}

// 帯のフェードイン・フェードアウトを安定制御
function showMatchingEffect(text) {
  const effect = document.getElementById('matchingEffect');
  if (!effect) return;
  // すでに表示中ならテキストだけ書き換え、opacityは維持
  if (effect.style.display !== '' && effect.style.display !== 'block') {
    effect.innerHTML = text; // 先に内容を切り替える
    effect.style.display = '';
    effect.style.opacity = 0;
    setTimeout(() => {
      effect.style.opacity = 1;
    }, 20);
  } else {
    effect.innerHTML = text;
    effect.style.opacity = 1;
  }
}

function hideMatchingEffect() {
  const effect = document.getElementById('matchingEffect');
  if (!effect) return;
  effect.style.opacity = 0;
  // トランジション終了後にdisplay:none
  setTimeout(() => {
    effect.style.display = 'none';
  }, 800); // CSSのtransitionと合わせる
}

// マッチング演出を中断する関数
function stopMatchingAnimation() {
  if (GameState.matchingAnimationTimer) {
    clearTimeout(GameState.matchingAnimationTimer);
    GameState.matchingAnimationTimer = null;
  }
  GameState.isMatchingInProgress = false;
  setGameButtonsEnabled(false);
  hideMatchingEffect();
}

// 結果画面用のメッセージ表示関数
function showResultMatchingEffect(text) {
  const effect = document.getElementById('resultMatchingEffect');
  if (!effect) return;
  // すでに表示中ならテキストだけ書き換え、opacityは維持
  if (effect.style.display !== '' && effect.style.display !== 'block') {
    effect.style.display = '';
    effect.style.opacity = 0;
    setTimeout(() => {
      effect.innerHTML = text;
      effect.style.opacity = 1;
    }, 20);
  } else {
    effect.innerHTML = text;
    effect.style.opacity = 1;
  }
}

function hideResultMatchingEffect() {
  const effect = document.getElementById('resultMatchingEffect');
  if (!effect) return;
  effect.style.opacity = 0;
  // トランジション終了後にdisplay:none
  setTimeout(() => {
    effect.style.display = 'none';
  }, 800); // CSSのtransitionと合わせる
}

// 退出カウントダウンを開始する関数
function startExitCountdown() {
  // 既存のタイマーをクリア
  if (GameState.exitCountdownTimer) {
    clearInterval(GameState.exitCountdownTimer);
  }
  
  GameState.exitCountdownTime = 60; // 60秒にリセット
  updateExitCountdownDisplay();
  
  GameState.exitCountdownTimer = setInterval(() => {
    GameState.exitCountdownTime--;
    updateExitCountdownDisplay();
    
    if (GameState.exitCountdownTime <= 0) {
      clearInterval(GameState.exitCountdownTimer);
      GameState.exitCountdownTimer = null;
      // 退出処理を実行
      leaveRoom();
      resetGameState();
      showScreen('titleScreen');
      socket.emit('leave_complete');
    }
  }, 1000);
}

// 退出カウントダウンを停止する関数
function stopExitCountdown() {
  if (GameState.exitCountdownTimer) {
    clearInterval(GameState.exitCountdownTimer);
    GameState.exitCountdownTimer = null;
  }
}

// 退出カウントダウンの表示を更新する関数
function updateExitCountdownDisplay() {
  const effect = document.getElementById('resultMatchingEffect');
  if (!effect) return;
  
  const minutes = Math.floor(GameState.exitCountdownTime / 60);
  const seconds = GameState.exitCountdownTime % 60;
  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  effect.innerHTML = `相手が退出しました。<br>${timeString}後にタイトル画面に戻ります。`;
}

// サーバーからお題を受信したときだけセット＆ゲーム開始
socket.on('receive_topic', (data) => {
  // サーバーから開始時刻を受信（今後は使わないが、互換のため残す）
  // GameState.gameStartTime = data && typeof data.startTime !== 'undefined' ? data.startTime : Date.now();
  const topic = data.topic || data;
  const effect = document.getElementById('matchingEffect');
  if (effect) {
    updateTimerDisplay();
    showMatchingEffect('マッチング成立！');
    // マッチング成功音を再生
    AudioManager.play('matching');
    GameState.matchingAnimationTimer = setTimeout(() => {
      const category = categories.find(cat => cat.en === topic);
      const japanese = category ? category.ja : topic;
      showMatchingEffect(`お題：<span style=\"color:#ffe066;\">${topic} (${japanese})</span>`);
      GameState.matchingAnimationTimer = setTimeout(() => {
        showMatchingEffect('<span style=\"letter-spacing:0.1em;\">ready?</span>');
        GameState.matchingAnimationTimer = setTimeout(() => {
          showMatchingEffect('<span style=\"letter-spacing:0.1em;\">GO!</span>');
          // ゲーム開始音を再生
          AudioManager.play('start');
          GameState.matchingAnimationTimer = setTimeout(() => {
            hideMatchingEffect();
            // ここで初めてタイマーを開始する
            GameState.gameStartTime = Date.now();
            startTimer();
            setTopic(topic);
            startGame();
            GameState.matchingAnimationTimer = null;
          }, 1500);
        }, 1500);
      }, 2000);
    }, 1500);
  } else {
    setTopic(topic);
    GameState.gameStartTime = Date.now();
    startTimer();
    startGame();
  }
});

// room_ready受信時、2秒間マッチング演出を表示し、その後ゲーム開始処理（ホスト判定・お題決定）を行うように修正。
socket.on('room_ready', (data) => {
  // 再戦時にお題選択モーダルの選択を必ず反映
  if (window._pendingSelectedTopic !== undefined) {
    GameState.selectedTopic = window._pendingSelectedTopic;
    window._pendingSelectedTopic = undefined;
  }
  init(); // ゲームを初期化
  resetTimerDisplay(); // タイマー表示もリセット（再戦時の残り時間引きずり防止）
  showScreen('gameScreen');
  GameState.room = data.room;
  showWaitingMessage(false);
  showOpponentRematchMsg(false, false);
  updateWaitingPrediction(); // 消す
  
  // マッチング演出開始
  GameState.isMatchingInProgress = true;
  
  // ユーザー名・アイコン情報があれば反映
  if (data.names && data.icons) {
    GameState.myName = data.names[socket.id] || GameState.myName;
    GameState.myIcon = data.icons[socket.id] || GameState.myIcon;
    const opponentEntry = Object.entries(data.names).find(([id, n]) => id !== socket.id);
    if (opponentEntry) {
      GameState.opponentName = opponentEntry[1];
      GameState.opponentIcon = data.icons[opponentEntry[0]] || '👤';
    }
    setPlayerTitles();
  }

  // ホスト・ゲスト問わず全員が自分のお題を送信
  let topic;
  if (GameState.selectedTopic === '__RANDOM__' || GameState.selectedTopic == null) {
    topic = pickRandomCategory();
  } else {
    topic = GameState.selectedTopic;
  }
  socket.emit('send_topic', { room: GameState.room, topic });
  GameState.selectedTopic = null;
});

// setTopicはお題を画面に表示し、targetLabelにセット
function setTopic(topic) {
  GameState.targetLabel = topic;
  const el = document.getElementById('targetCategory');
  if (el) {
    // カテゴリから日本語訳を取得
    const category = categories.find(cat => cat.en === topic);
    const japanese = category ? category.ja : topic;
    el.innerText = `お題：${topic} (${japanese})`;
    console.log('setTopicでお題を表示:', topic, japanese);
  } else {
    console.error('setTopic: targetCategoryが見つからない');
  }
}

// ゲーム画面遷移時にもタイトルを更新
function startGame() {
  showScreen('gameScreen');
  setPlayerTitles();
}

// タイマー機能
function startTimer() {
  clearInterval(GameState.gameTimer);
  GameState.isGameActive = true;
  GameState.isMatchingInProgress = false;
  updateWaitingPrediction(); // 消す
  // サーバーから受け取った開始時刻と現在時刻の差分で残り時間を計算
  function updateTime() {
    const now = Date.now();
    let elapsed = Math.floor((now - GameState.gameStartTime) / 1000);
    GameState.timeLeft = GAME_TIME_LIMIT - elapsed;
    if (GameState.timeLeft < 0) GameState.timeLeft = 0;
    updateTimerDisplay();
    if (GameState.timeLeft <= 0) {
      clearInterval(GameState.gameTimer);
      GameState.isGameActive = false;
      judgeGame();
    }
  }
  updateTime();
  GameState.gameTimer = setInterval(updateTime, 250); // 0.25秒ごとに更新しズレを抑制
}

function updateTimerDisplay() {
  const timerText = document.getElementById('timerText');
  const timerProgress = document.getElementById('timerProgress');
  timerText.innerText = `制限時間: ${GameState.timeLeft}秒`;
  const progressPercent = (GameState.timeLeft / GAME_TIME_LIMIT) * 100;
  timerProgress.style.width = `${progressPercent}%`;
  if (GameState.timeLeft <= 10) {
    timerProgress.style.background = 'linear-gradient(90deg, #dc3545, #c82333)';
  } else if (GameState.timeLeft <= 15) {
    timerProgress.style.background = 'linear-gradient(90deg, #ffc107, #e0a800)';
  } else {
    timerProgress.style.background = 'linear-gradient(90deg, #28a745, #20c997)';
  }
}

function stopTimer() {
  clearInterval(GameState.gameTimer);
  GameState.isGameActive = false;
}

// お題に対する予測度合いを計算する関数
function calculateTargetScore(results, targetLabel) {
  let targetScore = 0;

  // 結果の中からお題に一致するものを探す
  for (let i = 0; i < results.length; i++) {
    if (results[i] && results[i].label === targetLabel) {
      targetScore = results[i].confidence;
      break;
    }
  }

  return targetScore;
}

// ゲーム判定
function judgeGame() {
  GameState.finished = false;
  stopTimer();
  // サーバーに予測結果を送信
  if (GameState.room) {
    const userResults = window.getUser1Results ? window.getUser1Results() : [];
    socket.emit('submit_prediction', {
      room: GameState.room,
      userId: socket.id,
      results: userResults,
      targetLabel: GameState.targetLabel,
      userName: GameState.myName
    });
    // シングルプレイなら即時ローカルで結果画面に遷移
    if (GameState.room.startsWith('training_')) {
      // スコア計算
      let score = 0;
      for (let i = 0; i < userResults.length; i++) {
        if (userResults[i] && userResults[i].label === GameState.targetLabel) {
          score = userResults[i].confidence;
          break;
        }
      }
      // showResultScreen(winner, player1Score, player2Score, target, user1Results, user2Results)
      showResultScreen(
        GameState.myName,
        (score * 100).toFixed(2),
        '-',
        GameState.targetLabel,
        userResults,
        []
      );
    }
  }
  // 画面遷移はサーバーからのresult_readyで行う（2人対戦時）
}

// 結果画面を表示
function showResultScreen(winnerId, winnerName, player1Score, player2Score, target, user1Results, user2Results, myId, opponentId, myName, opponentName) {
  GameState.finished = false;
  GameState.rematchRequested = false;
  showOpponentRematchMsg(false, false);
  
  // 勝敗に応じて音声を再生
  const isSingleMode = GameState.room && (GameState.room === 'solo_training');
  if (!isSingleMode) {
    if (winnerId === 'draw' || winnerName === '引き分け' || winnerName === '🤝 引き分け！') {
      AudioManager.play('draw');
    } else if (winnerId === myId) {
      AudioManager.play('win');
    } else {
      AudioManager.play('lose');
    }
  }
  
  const finalResult = document.getElementById('finalResult');
  const player1Result = document.getElementById('player1Result');
  const player2Result = document.getElementById('player2Result');
  const resultTopic = document.getElementById('resultTopic');
  const player1Image = document.getElementById('player1Image');
  const player2Image = document.getElementById('player2Image');

  if (player2Result) player2Result.style.display = '';
  if (player1Result) {
    player1Result.style.margin = '';
    player1Result.style.float = '';
  }
  if (player1Image) player1Image.style.display = 'none';
  if (player2Image) player2Image.style.display = 'none';

  const isSingle = GameState.room && (GameState.room === 'solo_training');

  // 勝者名表示
  if (isSingle) {
    finalResult.innerHTML = `スコア: ${player1Score}！`;
  } else {
    if (winnerId === 'draw' || winnerName === '引き分け' || winnerName === '🤝 引き分け！') {
      finalResult.innerHTML = '🤝 引き分け！';
    } else if (winnerName.endsWith('の勝利！')) {
      finalResult.innerHTML = winnerName;
    } else {
      finalResult.innerHTML = `${winnerName}の勝利！`;
    }
  }

  // お題を一つだけ表示（日本語訳付き）
  const category = categories.find(cat => cat.en === target);
  const japanese = category ? category.ja : target;
  resultTopic.innerHTML = `<span>お題：${target} (${japanese})</span>`;

  player2Result.style.display = '';
  player1Result.style.margin = '';
  player1Result.style.float = '';
  const playAgainBtn = document.getElementById('playAgainBtn');
  if (isSingle && playAgainBtn) playAgainBtn.textContent = 'リトライ！';

  player1Result.querySelectorAll('h3, p, ul').forEach(e => e.remove());
  player2Result.querySelectorAll('h3, p, ul').forEach(e => e.remove());

  // プレイヤー1のh3, pをimgの前後に挿入
  const h3_1 = document.createElement('h3');
  let trophy1 = (!isSingle && winnerId !== 'draw' && winnerId === myId) ? ' 🏆' : '';
  h3_1.innerHTML = `${GameState.myIcon} ${myName}${trophy1}`;
  const p1 = document.createElement('p');
  p1.textContent = `スコア: ${(player1Score * 100).toFixed(2)}%`;
  player1Result.insertBefore(h3_1, player1Image);
  player1Result.insertBefore(p1, player1Image.nextSibling);
  // プレイヤー2のh3, pをimgの前後に挿入
  const h3_2 = document.createElement('h3');
  let trophy2 = (!isSingle && winnerId !== 'draw' && winnerId === opponentId) ? ' 🏆' : '';
  h3_2.innerHTML = `${GameState.opponentIcon} ${opponentName || '???'}${trophy2}`;
  const p2 = document.createElement('p');
  p2.textContent = isSingle ? 'スコア: -' : `${(player2Score * 100).toFixed(2)}%`;
  player2Result.insertBefore(h3_2, player2Image);
  player2Result.insertBefore(p2, player2Image.nextSibling);
  // プレイヤー1の絵を表示
  if (window.getUser1Canvas) {
    const dataUrl1 = window.getUser1Canvas();
    if (dataUrl1) {
      player1Image.src = dataUrl1;
      player1Image.style.display = "block";
    } else {
      player1Image.style.display = "none";
    }
  }
  // プレイヤー2の絵を表示（シングル時は空画像 or グレー画像）
  if (window.getUser2Canvas && (!isSingle || isSingle)) {
    const dataUrl2 = window.getUser2Canvas();
    if (dataUrl2 && !isSingle) {
      player2Image.src = dataUrl2;
      player2Image.style.display = "block";
    } else if (isSingle) {
      // シングル時はグレー画像を生成
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#e9ecef';
      ctx.fillRect(0, 0, 400, 400);
      ctx.font = 'bold 2rem Arial';
      ctx.fillStyle = '#aaa';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No Image', 200, 200);
      player2Image.src = canvas.toDataURL();
      player2Image.style.display = "block";
    } else {
      player2Image.style.display = "none";
    }
  }
  // プレイヤー1の予測上位3件を表示（日本語ラベル対応）
  if (user1Results && user1Results.length > 0) {
    const ul = document.createElement('ul');
    ul.style.margin = '0.5em 0 0 0';
    ul.style.padding = '0 0 0 1.2em';
    ul.style.fontSize = '1em';
    for (let i = 0; i < 3 && i < user1Results.length; i++) {
      const li = document.createElement('li');
      const cat = (typeof categories !== 'undefined' && categories.find(c => c.en === user1Results[i].label));
      const labelJa = cat ? cat.ja : user1Results[i].label;
      li.textContent = `${labelJa} (${Math.round(user1Results[i].confidence * 100)}%)`;
      ul.appendChild(li);
    }
    player1Result.appendChild(ul);
  }
  // プレイヤー2の予測上位3件を表示（日本語ラベル対応）
  if (!isSingle && user2Results && user2Results.length > 0) {
    const ul = document.createElement('ul');
    ul.style.margin = '0.5em 0 0 0';
    ul.style.padding = '0 0 0 1.2em';
    ul.style.fontSize = '1em';
    for (let i = 0; i < 3 && i < user2Results.length; i++) {
      const li = document.createElement('li');
      const cat = (typeof categories !== 'undefined' && categories.find(c => c.en === user2Results[i].label));
      const labelJa = cat ? cat.ja : user2Results[i].label;
      li.textContent = `${labelJa} (${Math.round(user2Results[i].confidence * 100)}%)`;
      ul.appendChild(li);
    }
    player2Result.appendChild(ul);
  } else if (isSingle) {
    // シングル時は空欄
    const ul = document.createElement('ul');
    ul.style.margin = '0.5em 0 0 0';
    ul.style.padding = '0 0 0 1.2em';
    ul.style.fontSize = '1em';
    for (let i = 0; i < 3; i++) {
      const li = document.createElement('li');
      li.textContent = '-';
      ul.appendChild(li);
    }
    player2Result.appendChild(ul);
  }

  showScreen('resultScreen');
}

// ゲーム状態リセット関数
function resetGameState() {
  // GameStateの全プロパティを初期値に戻す
  GameState.currentScreen = 'title';
  GameState.targetLabel = null;
  GameState.gameTimer = null;
  GameState.timeLeft = 60;
  GameState.isGameActive = false;
  GameState.isMatchingInProgress = false;
  GameState.exitCountdownTimer = null;
  GameState.exitCountdownTime = 60;
  GameState.matchingAnimationTimer = null;
  GameState.gameStartTime = null;
  GameState.room = null;
  GameState.rematchRequested = false;
  GameState.myName = '';
  GameState.opponentName = '';
  GameState.myIcon = '👤';
  GameState.opponentIcon = '👤';
  GameState.finished = false;
  GameState.selectedTopic = null;
  // 画面・タイマー・バナーもリセット
  init(); // ゲームを初期化
  resetTimerDisplay(); // タイマー表示もリセット
  updateTrainingBanner();
}

// タイマー表示をリセットする関数
function resetTimerDisplay() {
  const timerText = document.getElementById('timerText');
  const timerProgress = document.getElementById('timerProgress');
  if (timerText) timerText.innerText = `制限時間: ${GAME_TIME_LIMIT}秒`;
  if (timerProgress) {
    timerProgress.style.width = '100%';
    timerProgress.style.background = 'linear-gradient(90deg, #28a745, #20c997)';
  }
}

// --- イベントリスナー分割 ---
function setupTitleScreenListeners() {
  const startGameBtn = document.getElementById('startGameBtn');
  if (startGameBtn) {
    startGameBtn.addEventListener('click', () => {
      AudioManager.play('button');
      showScreen('roomSelectScreen');
      requestRoomStatus();
    });
  }
  const howToPlayBtn = document.getElementById('howToPlayBtn');
  if (howToPlayBtn) {
    howToPlayBtn.addEventListener('click', () => {
      AudioManager.play('button');
      showScreen('howToPlayScreen');
    });
  }
  }

function setupHowToPlayScreenListeners() {
  const backToTitleBtn = document.getElementById('backToTitleBtn');
  if (backToTitleBtn) {
    backToTitleBtn.addEventListener('click', () => {
      AudioManager.play('button');
      showScreen('titleScreen');
    });
  }
  }

function setupGameScreenListeners() {
  const resetTargetBtn = document.getElementById('resetTargetBtn');
  if (resetTargetBtn) {
    resetTargetBtn.style.display = 'none';
  }
  const backToTitleFromGameBtn = document.getElementById('backToTitleFromGameBtn');
  if (backToTitleFromGameBtn) {
    backToTitleFromGameBtn.addEventListener('click', () => {
      if (isInMatchingPhase()) {
        const effect = document.getElementById('matchingEffect');
        if (effect) {
          showMatchingEffect('マッチング演出中は退出できません');
          setTimeout(() => { hideMatchingEffect(); }, 2000);
        }
        return;
      }
      leaveRoom();
      resetGameState();
      showScreen('titleScreen');
    });
  }
  const judgeBtn = document.getElementById('judgeBtn');
  if (judgeBtn) {
    judgeBtn.addEventListener('click', () => {
      if (!GameState.isGameActive) return; // ゲーム中以外は無効
      if (GameState.finished) return;
      GameState.finished = true;
      judgeBtn.disabled = true;
      
      // 完成音を再生
      AudioManager.play('finish');
      
      // シングルプレイなら即時判定
      if (GameState.room && GameState.room.startsWith('training_')) {
        judgeGame();
        return;
      }
      showOpponentFinishMsg(true, true);
      if (GameState.room) {
        socket.emit('finish_request', GameState.room);
        // 予測結果も同時送信
        const userResults = window.getUser1Results ? window.getUser1Results() : [];
        socket.emit('submit_prediction', {
          room: GameState.room,
          userId: socket.id,
          results: userResults,
          targetLabel: GameState.targetLabel,
          userName: GameState.myName
        });
      } else {
        judgeGame();
      }
    });
  }
  }

function setupResultScreenListeners() {
  const playAgainBtn = document.getElementById('playAgainBtn');
  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', () => {
      AudioManager.play('button');
      // シングルプレイなら必ずルーム選択画面に遷移し、その後演出
      if (GameState.room && GameState.room.startsWith('training_')) {
        resetGameState();
        showScreen('roomSelectScreen');
        // お題選択モーダルを表示
        showTopicSelectModal(selectedTopic => {
          GameState.selectedTopic = selectedTopic;
          // お題決定後、ゲーム画面に遷移し、演出
          // --- 状態・演出を必ずリセット ---
          init();
          stopMatchingAnimation();
          let topic;
          if (GameState.selectedTopic === '__RANDOM__' || GameState.selectedTopic == null) {
            topic = pickRandomCategory();
          } else {
            topic = GameState.selectedTopic;
          }
          // matchingEffectの表示状態もリセット
          const effect = document.getElementById('matchingEffect');
          if (effect) {
            effect.style.display = 'none';
            effect.style.opacity = 0;
          }
          showScreen('gameScreen');
          showMatchingEffect('マッチング成立！');
          AudioManager.play('matching');
          setTimeout(() => {
            const category = categories.find(cat => cat.en === topic);
            const japanese = category ? category.ja : topic;
            showMatchingEffect(`お題：<span style=\"color:#ffe066;\">${topic} (${japanese})</span>`);
            setTimeout(() => {
              showMatchingEffect('<span style=\"letter-spacing:0.1em;\">ready?</span>');
              setTimeout(() => {
                showMatchingEffect('<span style=\"letter-spacing:0.1em;\">GO!</span>');
                AudioManager.play('start');
                setTimeout(() => {
                  hideMatchingEffect();
                  setTopic(topic);
                  GameState.selectedTopic = null;
                  GameState.gameStartTime = Date.now();
                  startTimer();
                  startGame();
                }, 1500);
              }, 1500);
            }, 2000);
          }, 1500);
        });
        return;
      }
      // お題選択モードだった場合は再度お題選択
      if (window._lastWasTopicSelectMode) {
        showTopicSelectModal(selectedTopic => {
          window._pendingSelectedTopic = selectedTopic;
          // お題選択後にrematch_request送信
          if (GameState.room && !GameState.rematchRequested) {
            const msg = document.getElementById('opponentRematchMsg');
            const text = document.getElementById('rematchMsgText');
            if (!(msg && text && text.textContent === '相手が再戦を希望しています' && msg.style.visibility === 'visible')) {
              showOpponentRematchMsg(true, true);
            }
            socket.emit('rematch_request', GameState.room);
            showWaitingMessage(true);
            GameState.rematchRequested = true;
          }
        });
        return;
      }
      // 通常の再戦
      if (GameState.room && !GameState.rematchRequested) {
        const msg = document.getElementById('opponentRematchMsg');
        const text = document.getElementById('rematchMsgText');
        if (!(msg && text && text.textContent === '相手が再戦を希望しています' && msg.style.visibility === 'visible')) {
          showOpponentRematchMsg(true, true);
        }
        socket.emit('rematch_request', GameState.room);
        showWaitingMessage(true);
        GameState.rematchRequested = true;
      }
    });
  }
  const backToTitleFromResultBtn = document.getElementById('backToTitleFromResultBtn');
  if (backToTitleFromResultBtn) {
    backToTitleFromResultBtn.addEventListener('click', () => {
      if (isInMatchingPhase()) {
        const effect = document.getElementById('matchingEffect');
        if (effect) {
          showMatchingEffect('マッチング演出中は退出できません');
          setTimeout(() => { hideMatchingEffect(); }, 2000);
        }
        return;
      }
      leaveRoom();
      resetGameState();
      showScreen('titleScreen');
      showOpponentRematchMsg(false, false);
    });
  }
  }

function setupRoomSelectScreenListeners() {
  const backToTitleFromRoomSelect = document.getElementById('backToTitleFromRoomSelect');
  if (backToTitleFromRoomSelect) {
    backToTitleFromRoomSelect.addEventListener('click', () => {
      showScreen('titleScreen');
    });
  }
}

function setupEventListeners() {
  setupTitleScreenListeners();
  setupHowToPlayScreenListeners();
  setupGameScreenListeners();
  setupResultScreenListeners();
  setupRoomSelectScreenListeners();
  // サーバーからのsocketイベントは既存通り
  // 部屋状態を監視
  socket.on('room_status', (data) => {
    const status = data.status || data;
    if (GameState.room && status[GameState.room] === 1) {
      showWaitingWaveMsg(true);
    } else {
      showWaitingWaveMsg(false);
    }
  });

  // 退出カウントダウントリガー
  socket.on('opponent_left', () => {
    if (GameState.room) {
      socket.emit('leave_room', { room: GameState.room });
    }
    showOpponentLeftOverlay();
  });
  socket.on('force_leave', () => {
    if (window._forceLeaveTimeout) return;
    showOpponentLeftOverlay();
  });

  // --- サーバーからのrematch_noticeを受信したら表示 ---
  socket.on('rematch_notice', () => {
    // すでに「相手の選択を待っています」が表示されている場合は上書きしない
    const msg = document.getElementById('opponentRematchMsg');
    const text = document.getElementById('rematchMsgText');
    if (msg && text && text.textContent === '相手の選択を待っています' && msg.style.visibility === 'visible') {
      // 何もしない（上書きせずそのまま）
    } else {
      showOpponentRematchMsg(true, false); // 通常通り「相手が再戦を希望しています」
    }
  });

  // --- room_readyやタイトル戻り時は非表示 ---
  socket.on('room_ready', (data) => {
    // 退出カウントダウンを停止（再戦が成立した場合）
    stopExitCountdown();
    
    showScreen('gameScreen');
    GameState.room = data.room;
    showWaitingMessage(false);
    showOpponentRematchMsg(false, false);
    startGame();
  });

  // サーバーから相手の完成通知
  socket.on('finish_notice', () => {
    // すでに「相手の完成を待っています」が表示されている場合は上書きしない
    const msg = document.getElementById('opponentFinishMsg');
    const text = document.getElementById('finishMsgText');
    if (msg && text && text.textContent === '相手の完成を待っています' && msg.style.visibility === 'visible') {
      // 何もしない
    } else {
      showOpponentFinishMsg(true, false); // 「相手が完成ボタンを押しました！」
    }
  });

  // サーバーから両者完成通知
  socket.on('result_ready', (data) => {
    // サーバーからの判定結果で結果画面に遷移
    // data: {scores, winner, userNames, targetLabel, user1Results, user2Results}
    const user1Id = Object.keys(data.scores)[0];
    const user2Id = Object.keys(data.scores)[1];
    const myScore = data.scores[socket.id];
    const opponentId = user1Id === socket.id ? user2Id : user1Id;
    const opponentScore = data.scores[opponentId];
    const myName = data.userNames[socket.id] || '自分';
    const opponentName = data.userNames[opponentId] || '相手';
    // 勝敗
    let winnerId = data.winner;
    let winnerName = '';
    if (data.winner === 'draw') {
      winnerName = 'draw';
    } else if (data.userNames && data.userNames[data.winner]) {
      winnerName = data.userNames[data.winner];
    } else {
      winnerName = data.winner;
    }
    // --- ここで自分と相手の予測結果を正しく割り当てる ---
    let myResults, opponentResults;
    if (user1Id === socket.id) {
      myResults = data.user1Results;
      opponentResults = data.user2Results;
    } else {
      myResults = data.user2Results;
      opponentResults = data.user1Results;
    }
    // 結果画面に反映
    showResultScreen(
      winnerId, // id
      winnerName, // ニックネーム
      myScore,
      opponentScore,
      data.targetLabel,
      myResults,
      opponentResults,
      socket.id,
      opponentId,
      myName,
      opponentName
    );
  });

  console.log('イベントリスナーの設定完了'); // デバッグログ
}

// DOMContentLoadedイベントでイベントリスナーを設定
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoadedイベントが発火しました'); // デバッグログ
  setupEventListeners();
  
  // 音声システム初期化（ユーザー操作後に実行）
  document.addEventListener('click', () => {
    AudioManager.init();
  }, { once: true });
});

// フォールバックとしてloadイベントでも設定
window.addEventListener('load', () => {
  console.log('loadイベントが発火しました'); // デバッグログ
  setupEventListeners();
  
  // 音声システム初期化（フォールバック）
  document.addEventListener('click', () => {
    AudioManager.init();
  }, { once: true });
});

// 左のキャンバス
new p5(p => {
  let classifier, canvas;
  let labelSpans = [], confidenceSpans = [];
  let currentResults = []; // 現在の結果を保存
  let isEraser = false;
  let penColor = 0;
  let penWeight = 16;

  p.preload = () => {
    classifier = ml5.imageClassifier('DoodleNet');
  };

  p.setup = () => {
    canvas = p.createCanvas(400, 400);
    canvas.parent('canvasContainer1');
    p.background(255);

    // スマホでのスワイプ・スクロール防止
    canvas.elt.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
    canvas.elt.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    canvas.elt.addEventListener('touchend', e => e.preventDefault(), { passive: false });

    // 予測結果の表示枠を非表示にする
    const predBox = document.querySelector('#canvasContainer1 .prediction-results');
    if (predBox) predBox.style.display = 'none';

    for (let i = 1; i <= 3; i++) {
      labelSpans.push(p.select(`#label1_${i}`));
      confidenceSpans.push(p.select(`#confidence1_${i}`));
    }

    p.select("#clearBtn1").mousePressed(() => {
      p.background(255);
      for (let i = 0; i < 3; i++) {
        labelSpans[i].html('');
        confidenceSpans[i].html('');
      }
      // 相手にも消去を通知
      if (GameState.room) socket.emit('draw', { room: GameState.room, type: 'clear' });
    });

    // 消しゴム・ペン切り替え
    p.select("#eraserBtn1").mousePressed(() => {
      isEraser = true;
      penColor = 255;
      penWeight = 32;
      document.getElementById('eraserBtn1').style.display = 'none';
      document.getElementById('penBtn1').style.display = 'inline-block';
    });
    p.select("#penBtn1").mousePressed(() => {
      isEraser = false;
      penColor = 0;
      penWeight = 16;
      document.getElementById('eraserBtn1').style.display = 'inline-block';
      document.getElementById('penBtn1').style.display = 'none';
    });

    classifier.classify(canvas.elt, gotResult);
  };

  p.draw = () => {
    // マッチング演出中は描画禁止
    if (typeof GameState !== 'undefined' && GameState.isMatchingInProgress) return;
    p.strokeWeight(penWeight);
    p.stroke(penColor);
    if (p.mouseIsPressed) {
      p.line(p.pmouseX, p.pmouseY, p.mouseX, p.mouseY);
      // 自分の描画データを送信
      if (GameState.room) {
        socket.emit('draw', {
          room: GameState.room,
          type: 'line',
          x1: p.pmouseX, y1: p.pmouseY, x2: p.mouseX, y2: p.mouseY,
          color: penColor, weight: penWeight
        });
      }
    }
  };

  function gotResult(error, results) {
    if (error) return console.error(error);
    currentResults = results; // 結果を保存

    // 予測結果の表示を無効化（左側キャンバス）
    // for (let i = 0; i < 3; i++) {
    //   if (results[i]) {
    //     labelSpans[i].html(results[i].label);
    //     confidenceSpans[i].html(p.floor(results[i].confidence * 100) + "%");
    //   }
    // }
    if (!GameState.isGameActive && !GameState.isMatchingInProgress) {
      updateWaitingPrediction();
    }
    classifier.classify(canvas.elt, gotResult);
  }

  // グローバルからアクセスできるように結果を公開
  window.getUser1Results = () => currentResults;
  window.clearCanvas1 = () => p.background(255);
  window.getUser1Canvas = () => {
    if (canvas) {
      return canvas.elt.toDataURL();
    }
    return null;
  };
});

// 右のキャンバス
new p5(p => {
  let classifier, canvas;
  let labelSpans = [], confidenceSpans = [];
  let currentResults = []; // 現在の結果を保存
  let buffer; // 描画バッファ

  p.preload = () => {
    classifier = ml5.imageClassifier('DoodleNet');
  };

  p.setup = () => {
    canvas = p.createCanvas(400, 400);
    canvas.parent('canvasContainer2');
    p.background(255);

    // バッファを作成
    buffer = p.createGraphics(400, 400);
    buffer.background(255);

    // 予測結果の表示枠を非表示にする
    const predBox = document.querySelector('#canvasContainer2 .prediction-results');
    if (predBox) predBox.style.display = 'none';

    for (let i = 1; i <= 3; i++) {
      labelSpans.push(p.select(`#label2_${i}`));
      confidenceSpans.push(p.select(`#confidence2_${i}`));
    }

    // 右側は自分で描画できないので、ボタンを無効化
    ["clearBtn2", "eraserBtn2", "penBtn2"].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = true;
    });

    classifier.classify(canvas.elt, gotResult);
  };

  // モザイク強度を決定する関数
  function getMosaicSize() {
    let elapsed = 30 - (typeof GameState.timeLeft === 'number' ? GameState.timeLeft : 30);
    if (elapsed < 5) return 8;
    if (elapsed < 10) return 12;
    if (elapsed < 15) return 20;
    if (elapsed < 20) return 32;
    if (elapsed < 25) return 50;
    return 80;
  }

  p.draw = () => {
    // マッチング演出中は描画禁止
    if (typeof GameState !== 'undefined' && GameState.isMatchingInProgress) return;
    let mosaicSize = getMosaicSize();
    p.drawingContext.imageSmoothingEnabled = false;
    p.noSmooth();
    if (mosaicSize > 1) {
      let small = buffer.get(0, 0, 400, 400);
      let w = Math.ceil(400 / mosaicSize);
      let h = Math.ceil(400 / mosaicSize);
      small.resize(w, h);
      p.image(small, 0, 0, 400, 400);
    } else {
      p.image(buffer, 0, 0, 400, 400);
    }
  };

  // 相手の描画データを受信して反映
  socket.on('draw', (data) => {
    if (!GameState.room || data.room !== GameState.room) return;
    if (data.type === 'clear') {
      buffer.background(255);
      for (let i = 0; i < 3; i++) {
        labelSpans[i].html('');
        confidenceSpans[i].html('');
      }
      return;
    }
    if (data.type === 'line') {
      buffer.strokeWeight(data.weight);
      buffer.stroke(data.color);
      buffer.line(data.x1, data.y1, data.x2, data.y2);
    }
  });

  function gotResult(error, results) {
    if (error) return console.error(error);
    currentResults = results; // 結果を保存

    // 予測結果の表示を無効化（右側キャンバス）
    // for (let i = 0; i < 3; i++) {
    //   if (results[i]) {
    //     labelSpans[i].html(results[i].label);
    //     confidenceSpans[i].html(p.floor(results[i].confidence * 100) + "%");
    //   }
    // }
    classifier.classify(canvas.elt, gotResult);
  }

  // グローバルからアクセスできるように結果を公開
  window.getUser2Results = () => currentResults;
  window.clearCanvas2 = () => {
    if (buffer) buffer.background(255);
    if (canvas) canvas.background(255);
  };
  window.getUser2Canvas = () => {
    if (buffer) {
      return buffer.elt.toDataURL();
    }
    return null;
  };
});

// --- 完成同期用メッセージ制御 ---
function showOpponentFinishMsg(show, waiting) {
  let msg = document.getElementById('opponentFinishMsg');
  let text = document.getElementById('finishMsgText');
  if (!msg) {
    msg = document.createElement('div');
    msg.id = 'opponentFinishMsg';
    msg.className = 'rematch-message';
    text = document.createElement('span');
    text.id = 'finishMsgText';
    msg.appendChild(text);
    // ゲーム画面の中央に追加
    const judgeSection = document.querySelector('.judge-inner');
    if (judgeSection) judgeSection.appendChild(msg);
  }
  if (!text) return;
  msg.style.visibility = show ? 'visible' : 'hidden';
  if (show) {
    text.textContent = waiting ? '相手はまだ！' : '相手が完成！';
  }
}

// --- ゲーム中の相手退出オーバーレイ表示 ---
function showOpponentLeftOverlay() {
  // どの画面か判定
  const isResultScreen = document.getElementById('resultScreen')?.classList.contains('active');
  if (isResultScreen) {
    // 結果画面ではバナーやカウントダウンは出さず、rematch-messageに表示
    const msg = document.getElementById('opponentRematchMsg');
    const text = document.getElementById('rematchMsgText');
    if (msg && text) {
      msg.style.visibility = 'visible';
      text.textContent = '相手が退出しました';
    }
    return;
  }
  // --- ゲーム画面用（従来通り全画面オーバーレイ） ---
  let overlay = document.getElementById('opponentLeftOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'opponentLeftOverlay';
    overlay.className = 'matching-effect';
    overlay.style.display = 'flex';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '2000';
    overlay.style.background = 'rgba(102,126,234,0.92)';
    overlay.style.fontSize = '2.2rem';
    overlay.style.fontWeight = 'bold';
    overlay.style.color = '#fff';
    overlay.style.textAlign = 'center';
    overlay.style.flexDirection = 'column';
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
  overlay.style.opacity = 1;
  let remaining = 60;
  // ボタン生成
  let btn = document.getElementById('opponentLeftBackBtn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'opponentLeftBackBtn';
    btn.textContent = 'タイトルに戻る';
    btn.className = 'game-button large secondary';
    btn.style.marginTop = '2.5rem';
    btn.style.fontSize = '1.3rem';
    btn.style.padding = '1rem 2.5rem';
    btn.style.borderRadius = '12px';
    btn.style.border = 'none';
    btn.style.cursor = 'pointer';
    btn.onclick = () => {
      if (window._opponentLeftTimeout) clearInterval(window._opponentLeftTimeout);
      overlay.style.opacity = 0;
      setTimeout(() => {
        overlay.style.display = 'none';
        resetGameState();
        showScreen('titleScreen');
      }, 400);
    };
    overlay.appendChild(btn);
  }
  function updateOverlayText() {
    overlay.innerHTML = `相手が退出しました。<br>${remaining}秒後にタイトル画面に戻ります。`;
    overlay.appendChild(btn);
  }
  updateOverlayText();
  if (window._opponentLeftTimeout) clearInterval(window._opponentLeftTimeout);
  window._opponentLeftTimeout = setInterval(() => {
    remaining--;
    if (remaining > 0) {
      updateOverlayText();
    } else {
      clearInterval(window._opponentLeftTimeout);
      window._opponentLeftTimeout = null;
      overlay.style.opacity = 0;
      setTimeout(() => {
        overlay.style.display = 'none';
        resetGameState();
        showScreen('titleScreen');
      }, 800);
    }
  }, 1000);
}

// === ユーザー名・アイコン管理 ===
// ユーザー名・アイコン入力欄の値を取得
function getUserName() {
  const input = document.getElementById('usernameInput');
  if (input) {
    return input.value.trim() || '名無し';
  }
  return '名無し';
}
function getUserIcon() {
  const sel = document.getElementById('iconSelect');
  if (sel) return sel.value;
  return '👤';
}

function setPlayerTitles() {
  const p1 = document.getElementById('player1Title');
  const p2 = document.getElementById('player2Title');
  if (p1) p1.innerText = `${GameState.myIcon} ${GameState.myName}`;
  if (p2) p2.innerText = `${GameState.opponentIcon} ${GameState.opponentName || '???'}`;
}

function showWaitingWaveMsg(show) {
  let container = document.getElementById('canvasContainer2');
  if (!container) return;
  let msg = document.getElementById('waitingWaveMsg');
  if (show) {
    if (!msg) {
      msg = document.createElement('div');
      msg.id = 'waitingWaveMsg';
      msg.innerHTML = '待機中<span class="wave">.</span><span class="wave">.</span><span class="wave">.</span>';
      container.appendChild(msg);
    } else {
      msg.style.display = '';
    }
  } else {
    if (msg) msg.style.display = 'none';
  }
}

// マッチング待機中の予測表示
function updateWaitingPrediction() {
  const predDiv = document.getElementById('waitingPrediction');
  if (!predDiv) return;
  // マッチング待機中のみ表示
  if (!GameState.room || GameState.isGameActive || GameState.isMatchingInProgress) {
    predDiv.innerHTML = '';
    return;
  }
  const results = window.getUser1Results ? window.getUser1Results() : [];
  if (results && results.length > 0) {
    let html = '';
    for (let i = 0; i < Math.min(3, results.length); i++) {
      const r = results[i];
      let labelJa = r.label;
      if (typeof categories !== 'undefined') {
        const cat = categories.find(c => c.en === r.label);
        if (cat) labelJa = cat.ja;
      }
      html += `<div style='font-size:1.1em; margin:0.1em 0;'>${labelJa} <span style='color:#28a745;'>${Math.round(r.confidence*100)}%</span></div>`;
    }
    predDiv.innerHTML = html;
  } else {
    predDiv.innerHTML = '';
  }
}

function updateTrainingBanner() {
  const container = document.getElementById('canvasContainer2');
  if (!container) return;
  let banner = document.getElementById('trainingModeBanner');
  const isTraining = GameState.room && (GameState.room.startsWith('training_') || GameState.room === 'solo_training');
  if (isTraining) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'trainingModeBanner';
      banner.style.position = 'absolute';
      banner.style.top = '50%';
      banner.style.left = '50%';
      banner.style.transform = 'translate(-50%, -50%)';
      banner.style.zIndex = '20';
      banner.style.background = 'rgba(255,255,255,0.96)';
      banner.style.borderRadius = '14px';
      banner.style.padding = '1.5rem 2.5rem 1.2rem 2.5rem';
      banner.style.boxShadow = '0 2px 12px rgba(102,126,234,0.10)';
      banner.style.textAlign = 'center';
      container.appendChild(banner);
    }
    if (GameState.room === 'solo_training') {
      banner.innerHTML = `
        <div style=\"font-size:1.3rem; font-weight:bold; color:#764ba2; margin-bottom:0.5em;\">ひたすら絵を描くモードです！</div>
        <div style=\"font-size:1.1rem; color:#495057; margin-bottom:0.2em;\">AIの特性を理解しよう！</div>
      `;
      // お題表示・完成ボタンを透明化（エリアごと）
      const targetEl = document.getElementById('targetCategory');
      if (targetEl) {
        targetEl.style.display = '';
        targetEl.style.opacity = '0';
        targetEl.style.visibility = 'hidden';
        targetEl.style.pointerEvents = 'none';
        if (targetEl.parentElement) {
          targetEl.parentElement.style.display = '';
          targetEl.parentElement.style.opacity = '0';
          targetEl.parentElement.style.visibility = 'hidden';
          targetEl.parentElement.style.pointerEvents = 'none';
        }
      }
      const judgeBtn = document.getElementById('judgeBtn');
      if (judgeBtn) judgeBtn.style.display = 'none';
      // 描画操作ボタンのみ有効化
      ['clearBtn1','eraserBtn1','penBtn1'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = false;
      });
      // タイトルに戻るボタンは有効化
      const backBtn = document.getElementById('backToTitleFromGameBtn');
      if (backBtn) backBtn.disabled = false;
      // 他のボタンは無効化/非表示
      ['clearBtn2','eraserBtn2','penBtn2'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = true;
      });
    } else {
      banner.innerHTML = `
        <div style=\"font-size:1.45rem; font-weight:bold; color:#764ba2; margin-bottom:0.5em;\">トレーニングモードです。</div>
        <div style=\"font-size:1.1rem; color:#495057; margin-bottom:0.2em;\">AIの特性を理解しよう！</div>
      `;
      // お題表示・完成ボタンを表示
      const targetEl = document.getElementById('targetCategory');
      if (targetEl) {
        targetEl.style.display = '';
        targetEl.style.opacity = '';
        targetEl.style.visibility = '';
        targetEl.style.pointerEvents = '';
        if (targetEl.parentElement) {
          targetEl.parentElement.style.display = '';
          targetEl.parentElement.style.opacity = '';
          targetEl.parentElement.style.visibility = '';
          targetEl.parentElement.style.pointerEvents = '';
        }
      }
      const judgeBtn = document.getElementById('judgeBtn');
      if (judgeBtn) judgeBtn.style.display = '';
      // 通常のボタン有効化
      setGameButtonsEnabled(true);
    }
    banner.style.display = '';
  } else {
    if (banner) banner.style.display = 'none';
    // お題表示・完成ボタンを表示
    const targetEl = document.getElementById('targetCategory');
    if (targetEl) {
      targetEl.style.display = '';
      targetEl.style.opacity = '';
      targetEl.style.visibility = '';
      targetEl.style.pointerEvents = '';
      if (targetEl.parentElement) {
        targetEl.parentElement.style.display = '';
        targetEl.parentElement.style.opacity = '';
        targetEl.parentElement.style.visibility = '';
        targetEl.parentElement.style.pointerEvents = '';
      }
    }
    const judgeBtn = document.getElementById('judgeBtn');
    if (judgeBtn) judgeBtn.style.display = '';
    // 通常のボタン有効化
    setGameButtonsEnabled(true);
  }
}

// お題選択モーダル生成
function showTopicSelectModal(onSelect) {
  if (document.getElementById('topicSelectModal')) return;
  const modal = document.createElement('div');
  modal.id = 'topicSelectModal';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100vw';
  modal.style.height = '100vh';
  modal.style.background = 'rgba(0,0,0,0.35)';
  modal.style.zIndex = '3000';
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';

  // 枠外クリック・タッチでキャンセル
  modal.addEventListener('mousedown', e => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
  modal.addEventListener('touchstart', e => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  }, {passive: false});

  const box = document.createElement('div');
  box.style.background = '#fff';
  box.style.borderRadius = '16px';
  box.style.padding = '2.2rem 2.5rem 1.5rem 2.5rem';
  box.style.boxShadow = '0 8px 32px rgba(102,126,234,0.18)';
  box.style.minWidth = '320px';
  box.style.maxWidth = '90vw';
  box.style.maxHeight = '80vh';
  box.style.overflowY = 'auto';
  box.style.textAlign = 'center';

  const title = document.createElement('h2');
  title.textContent = 'お題を選択してください';
  title.style.marginBottom = '1.2em';
  box.appendChild(title);

  // お題リスト
  const list = document.createElement('div');
  list.style.display = 'grid';
  list.style.gridTemplateColumns = '1fr 1fr 1fr';
  list.style.gap = '0.5em';
  list.style.marginBottom = '1.5em';
  let lastTap = null;
  // 一番上にランダム
  const randomBtn = document.createElement('button');
  randomBtn.textContent = 'ランダム';
  randomBtn.style.padding = '0.5em 1.2em';
  randomBtn.style.borderRadius = '8px';
  randomBtn.style.border = '1px solid #495057';
  randomBtn.style.background = '#f8f9fa';
  randomBtn.style.cursor = 'pointer';
  randomBtn.style.fontSize = '1.1em';
  randomBtn.style.gridColumn = '1 / span 3';
  randomBtn.onmouseenter = () => randomBtn.style.background = '#e9ecef';
  randomBtn.onmouseleave = () => randomBtn.style.background = '#f8f9fa';
  randomBtn.onclick = () => {
    AudioManager.play('button');
    if (list._selected === '__RANDOM__') {
      document.body.removeChild(modal);
      onSelect('__RANDOM__'); // 明示的にランダム
    } else {
      Array.from(list.children).forEach(b => b.style.background = '#f8f9fa');
      randomBtn.style.background = '#ffe066';
      list._selected = '__RANDOM__';
    }
  };
  list.appendChild(randomBtn);
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.textContent = `${cat.ja} (${cat.en})`;
    btn.style.padding = '0.5em 1.2em';
    btn.style.borderRadius = '8px';
    btn.style.border = '1px solid #764ba2';
    btn.style.background = '#f8f9fa';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '1.1em';
    btn.onmouseenter = () => btn.style.background = '#e9ecef';
    btn.onmouseleave = () => btn.style.background = '#f8f9fa';
    btn.onclick = () => {
      AudioManager.play('button');
      if (list._selected === cat.en) {
        document.body.removeChild(modal);
        onSelect(cat.en);
      } else {
        Array.from(list.children).forEach(b => b.style.background = '#f8f9fa');
        btn.style.background = '#ffe066';
        list._selected = cat.en;
      }
    };
    list.appendChild(btn);
  });
  box.appendChild(list);

  // キャンセル
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'キャンセル';
  cancelBtn.className = 'game-button secondary';
  cancelBtn.style.marginTop = '0.7em';
  cancelBtn.onclick = () => {
    AudioManager.play('button');
    document.body.removeChild(modal);
  };
  box.appendChild(cancelBtn);

  modal.appendChild(box);
  document.body.appendChild(modal);
}
