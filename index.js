// Registering Service Worker for making this as PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
    .then((registration) => {
      console.log(`[Main] ServiceWorker registration finished. Scope:${registration.scope}`);
    })
    .catch((reason) => {
      console.log(`[Main] ServiceWorker registratio failed. Reason:${reason}`);
    });
  });
}

document.addEventListener('DOMContentLoaded', (ev) => {
  /** @type {HTMLButtonElement} */
  const _emitButton = document.getElementById('emit');
  /** @type {HTMLInputElement} */
  const _phraseInput = document.getElementById('phrase');
  /** @type {HTMLInputElement} */
  const _speed = document.getElementById('speed');
  /** @type {HTMLInputElement} */
  const _loop = document.getElementById('loop');
  /** @type {HTMLDivElement} */
  const _message = document.getElementById('message');
  /** @type {HTMLDivElement} */
  const _app = document.getElementById('app');

  const STORAGE_KEY = "MorseEmit"

  /** @type {Config} */
  // let appConfig = loadConfig();
  // applyConfig(appConfig);

  // ========== ========== Configuration ========== ==========

  /**
   * @typedef Config
   * @property {number | undefined} speed unit period of Morse code [millisecond]
   * @property {number | undefined} loop loop delay [millisecond]
   */

  /**
   * Give default configuration
   * @returns {Config}
   */
  function getConfigDefault() {
    return {
      speed: 100,
      loop: 1000,
    };
  }

  /**
   * Save configuration
   * @param {Config} config configuration
   */
  function saveConfig(config) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    // console.log(`saved config : ${JSON.stringify(config)}`);
  }

  /**
   * Load configuration
   * @returns {Config} configuration
   */
  function loadConfig() {
    try {
      const text = localStorage.getItem(STORAGE_KEY);
      if (text != null) {
        const obj = JSON.parse(text);
        console.log(`[loadConfig] loaded config=${JSON.stringify(obj)}`)
        /** @type {Config} */
        const config = getConfigDefault();
        if (obj.speed != null && typeof obj.speed === 'number') {
          config.speed = obj.speed;
        }
        if (obj.loop != null && typeof obj.loop === 'number') {
          config.loop = obj.loop;
        }
        console.log(`config loaded : ${JSON.stringify(config)}`);
        return config;
      }
    } catch(err) {
      console.log(`error in config-load : ${err}`);
    }
    console.log('no config');
    return getConfigDefault();
  }

  /**
   * Apply configuration into this application
   * @param {Config} config 
   */
  function applyConfig(config) {
    if (config == null) return

    _speed.value = (Math.round(config.speed/100)).toString();
    _loop.value = (Math.round(config.loop/1000)).toString();
  }

  // ========== ========== (end of configuration) ========== ==========

  function setEventHandlers() {
    _emitButton.addEventListener('click', async (_ev) => {
      if (phrase.length < 1) {
        initEmitting();
        phrase = clearPhrase(_phraseInput.value);
        if (phrase.length > 0) {
          const cameraAvailable = await getCamera();
          if (cameraAvailable) {
            goEmitting();
            timerId = setTimeout(() => intervalHandler(), 0);
          }
        } else {
          stopEmitting();
        }
      } else {
        initEmitting();
        stopEmitting();
      }
    });

    _phraseInput.addEventListener('keyup', (ev) => {
      if (ev.code === 'Enter') {
        _emitButton.click();
      }
    });
  }

  function goEmitting() {
    _phraseInput.disabled = true;
    _emitButton.textContent = "停止";
    _app.style.backgroundColor = '#000000';
  }

  function stopEmitting() {
    _phraseInput.disabled = false;
    _emitButton.textContent = "発光！";
    _app.style.backgroundColor = '#000000';
    turnOff();
  }

  /**
   * 
   * @param {string} raw 
   */
  function clearPhrase(raw) {
    /** @type {string[]} */
    const resultArray = [];

    for (let ix=0; ix<raw.length; ix++) {
      const ch = raw.at(ix).toUpperCase();
      if (MORSE_CODES.has(ch)) {
        resultArray.push(ch);
      }
    }

    return resultArray.join('');
  }

  // ========== ========== Morse Code ========== ==========

  /** short mark */
  const S = 1;
  /** long mark */
  const L = 3;
  /** space (medium gap, word delimiter) */
  const G = -1;

  /** @type {Map<string, number[]>} */
  const MORSE_CODES = new Map([
    ["A", [S, L]],
    ["B", [L, S, S, S]],
    ["C", [L, S, L, S]],
    ["D", [L, S, S]],
    ["E", [S]],
    ["F", [S, S, L, S]],
    ["G", [L, L, S]],
    ["H", [S, S, S, S]],
    ["I", [S, S]],
    ["J", [S, L, L, L]],
    ["K", [L, S, L]],
    ["L", [S, L, S, S]],
    ["M", [L, L]],
    ["N", [L, S]],
    ["O", [L, L, L]],
    ["P", [S, L, L, S]],
    ["Q", [L, L, S, L]],
    ["R", [S, L, S]],
    ["S", [S, S, S]],
    ["T", [L]],
    ["U", [S, S, L]],
    ["V", [S, S, S, L]],
    ["W", [S, L, L]],
    ["X", [L, S, S, L]],
    ["Y", [L, S, L, L]],
    ["Z", [L, L, S, S]],
    ["0", [L, L, L, L, L]],
    ["1", [S, L, L, L, L]],
    ["2", [S, S, L, L, L]],
    ["3", [S, S, S, L, L]],
    ["4", [S, S, S, S, L]],
    ["5", [S, S, S, S, S]],
    ["6", [L, S, S, S, S]],
    ["7", [L, L, S, S, S]],
    ["8", [L, L, L, S, S]],
    ["9", [L, L, L, L, S]],
    [" ", [G]],
  ]);

  /** @type {number} */
  let timerId = -1;
  /** @type {string} */
  let phrase = "";
  /** @type {number} */
  let indexLetter = 0;
  /** @type {number} */
  let indexCode = 0;
  /** @type {boolean} */
  let isEmitting = false;
  /** @type {MediaStreamTrack | undefined} */
  let cameraTrack = undefined;

  function initEmitting() {
    phrase = "";
    indexLetter = 0;
    indexCode = 0;
    isEmitting = false;
  }

  function intervalHandler() {
    if (phrase.length < 1) {
      initEmitting();
      return;
    }

    let duration = S * getSpeed();

    if (indexLetter < phrase.length) {
      const codes = MORSE_CODES.get(phrase.at(indexLetter));
      if (codes == null) throw new Error(`"${phrase}"[${indexLetter}] is out of Morse code!`);

      if (isEmitting !== true) {
        kDelay = codes[indexCode];
        // when kDelay is negative, it's space (" ")
        duration = Math.abs(kDelay) * getSpeed();
        if (kDelay > 0) {
          turnOn();
        } else {
          turnOff();
        }
      } else {
        turnOff();
        if (indexCode < (codes.length - 1)) {
          indexCode++;
        } else {
          indexCode = 0;
          indexLetter++;
          duration = L * getSpeed(); // letter-gap
        }
      }
    } else {
      indexLetter = 0;
      indexCode = 0;
      duration = getLoop();
      turnOff();
    }

    timerId = setTimeout(() => {
      intervalHandler();
    }, duration);
  }

  function getSpeed() {
    const raw = _speed.value;
    const nRaw = Number(raw);
    const n = Number.isNaN(nRaw) ? 1 : nRaw;
    return 100 * Math.round(Math.max(Math.min(n, 10), 1));
  }

  function getLoop() {
    const raw = _loop.value;
    const nRaw = Number(raw);
    const n = Number.isNaN(nRaw) ? 1 : nRaw;
    return 1000 * Math.round(Math.max(Math.min(n, 10), 1));
  }

  // ========== ========== flashlight control ========== ==========

  function turnOn() {
    _app.style.backgroundColor = '#c0c0c0';
    cameraTrack.applyConstraints({
      advanced: [{torch: true}],
    });
    isEmitting = true;
  }

  function turnOff() {
    _app.style.backgroundColor = '#000000';
    cameraTrack.applyConstraints({
      advanced: [{torch: false}],
    });
    isEmitting = false;
  }

  async function getCamera() {
    if (cameraTrack != null) return true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
        },
      });
      cameraTrack = stream.getVideoTracks()[0];
      return true;
    } catch(err) {
      console.error(`[getCamera] error : ${err}`);
      _message.textContent = 'このブラウザではカメラが使えないようです。Chromeを使ってみてください';
      _message.style.backgroundColor = '#FF4040';
      return false;
    }
  }

  // ========== ========== main procedure in DOMContentLoaded ========== ==========

  setEventHandlers();
  _phraseInput.focus();
});