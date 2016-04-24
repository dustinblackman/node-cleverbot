import Promise from 'bluebird';
import crypto from 'crypto';
import R from 'ramda';

const request = Promise.promisify(require('request'));

const RESPONSE_KEYS = [
  'message',
  'sessionid',
  'logurl',
  'vText8',
  'vText7',
  'vText6',
  'vText5',
  'vText4',
  'vText3',
  'vText2',
  'prevref',
  '',
  'emotionalhistory',
  'ttsLocMP3',
  'ttsLocTXT',
  'ttsLocTXT3',
  'ttsText',
  'lineref',
  'lineURL',
  'linePOST',
  'lineChoices',
  'lineChoicesAbbrev',
  'typingData',
  'divert'
];

const DEFAULT_PARAMS = {
  stimulus: '',
  start: 'y',
  sessionid: '',
  vText8: '',
  vText7: '',
  vText6: '',
  vText5: '',
  vText4: '',
  vText3: '',
  vText2: '',
  icognoid: 'wsf',
  icognocheck: '',
  fno: '0',
  prevref: '',
  emotionaloutput: '',
  emotionalhistory: '',
  asbotname: '',
  ttsvoice: '',
  typing: '',
  lineref: '',
  sub: 'Say',
  islearning: '1',
  cleanslate: 'false'
};

export default class Cleverbot {
  constructor() {
    this.params = R.clone(DEFAULT_PARAMS);
  }

  /**
   * Creates new instance of Cleverbot
   * @returns {class Cleverbot}
  */
  static create() {
    return new Cleverbot();
  }

  _digest(body) {
    const hash = crypto.createHash('md5');
    hash.update(body);
    return hash.digest('hex');
  }

  _encodeParams(params) {
    return R.join('&', R.map(key => {
      const val = params[key];
      if (R.is(Array, val)) {
        return `${key}=${encodeURIComponent(val.join(','))}`;
      } else if (R.is(Object, val)) {
        return this.encodeParams(val);
      }
      return `${key}=${encodeURIComponent(val)}`;
    }, R.keys(params)));
  }

  _createCookie() {
    console.log('Creating cookie');
    return request('http://www.cleverbot.com')
      .then(res => {
        if (!res.headers || !res.headers['set-cookie']) throw new Error('Cookie not set during response');

        this.cookies = {};
        R.forEach(cookies => {
          R.forEach(cookie => {
            cookie = cookie.split('=');
            this.cookies[cookie[0]] = cookie[1];
          }, cookies.split(';'));
        }, res.headers['set-cookie']);

        return this.cookies;
      });
  }

  /**
   * Returns current state (prefilled params and cookies)
   * @returns {Object}
  */
  getState() {
    return {
      cookies: this.cookies,
      params: this.params
    };
  }

  /**
   * Sets state to context
   * @param {Object} Contains `params` and `cookies` objects
   * @returns {Object}
  */
  setState(state) {
    this.cookies = state.cookies;
    this.params = state.parmas || R.clone(DEFAULT_PARAMS);
  }

  /**
   * Deletes state
  */
  deleteState() {
    delete this.cookies;
    this.params = R.clone(DEFAULT_PARAMS);
  }


  /**
   * Sends message to cleverbot. State can be passed optionally, as well as returning the new state along with the message
   * @param {String} Message to send to Cleverbot
   * @param {Object} Contains `params` and `cookies` objects
   * @param {Boolean} Set to true to return an object containing both the reply message and the state
   * @returns {Promise.<String|Object>}
  */
  sendMessage(message, state = {cookies: this.cookies, params: this.params}, return_state = false) {
    if (!state.cookies) return this._createCookie().then(() => this.sendMessage(message));

    const body = Object.assign({}, state.params, {stimulus: message});
    body.icognocheck = this._digest(this.encodeParams(body).substring(9, 35));
    const encoded_body = this._encodeParams(body);

    const params = {
      url: 'http://www.cleverbot.com/webservicemin',
      method: 'POST',
      form: body,
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Length': encoded_body.length,
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: R.join(';', R.map(key => `${key}=${state.cookies[key]}`, R.keys(state.cookies)))
      }
    };

    return request(params)
      .then(R.prop('body'))
      .then(res => {
        const results = res.split('\r');
        R.addIndex(R.forEach)((val, idx) => {
          state.params[RESPONSE_KEYS[idx]] = val;
        }, results);

        this.params = state.params;

        if (return_state) return {message: results[0], state};
        return results[0];
      });
  }
}
