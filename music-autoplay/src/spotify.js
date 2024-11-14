// a JS module that wraps Spotify API into simple abstraction.

// helper functions
const sha256 = async (plain) => {
    const encoder = new TextEncoder()
    const data = encoder.encode(plain)
    return window.crypto.subtle.digest('SHA-256', data)
}

const base64encode = (input) => {
    return btoa(String.fromCharCode(...new Uint8Array(input)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
}

const generateRandomString = (length) => {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
  }

export class Spotify{

    /**@type {{token: string, type: string, scope: string[], expiration_time: number, refresh_token: string}} */
    _access_info;
    _clientId;
    _code_verifier; // private secret
    _code_challenge; // public mac
    required_scope;
    _scope = 'user-modify-playback-state user-read-playback-state';
    _redirectUri;

    constructor(){        
    }
    
    // note to interface, it should not be do the init, but promise isInited
    init = async (clientId, redirectUri) => {
        this._clientId = clientId;
        this._redirectUri = redirectUri;
        let res = await browser.storage.local.get('token');
        this._access_info = res.token;
        await this.regenerate();
    }

    isClientSetup = () =>{
        // todo, validate if clientId is correct?
        return this._clientId !== undefined && this._clientId !== null && this._clientId !== "";
    }

    regenerate = async () => {
        this._code_verifier  = generateRandomString(64);
        const hashed = await sha256(this._code_verifier)
        this._code_challenge = base64encode(hashed);
    }

    getAuthURL = () =>{
        const authUrl = new URL("https://accounts.spotify.com/authorize")
        const params =  {
            response_type: 'code',
            client_id: this._clientId,
            scope: this._scope,
            code_challenge_method: 'S256',
            code_challenge: this._code_challenge,
            redirect_uri: this._redirectUri,
        }
        authUrl.search = new URLSearchParams(params).toString();
        return authUrl.toString();
    }

    authorize = async (code) => {
        //TODO: convert to promise
        const payload = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
            client_id: this._clientId,
            grant_type: 'authorization_code',
            code,
            redirect_uri: this._redirectUri,
            code_verifier: this._code_verifier,
            }),
        }

        const body = await fetch("https://accounts.spotify.com/api/token", payload);
        const response =await body.json();
        if(response && response.access_token){
            this._access_token = response.access_token
            this._access_info = response;
            this._access_info.expiration_time = Date.now() + response.expires_in * 1000;
            browser.storage.local.set({'token': this._access_info})
        }
    }

    /**@returns {boolean} */
    isAuthed = ()=>{
        if(!this._access_info || !this._access_info.access_token) return false;
        if(Date.now() >= this._access_info.expiration_time) return false;
        return true;
    }

    /**@returns {object} */
    dispatch = async (method, endpoint, body)=>{
        const res = await fetch(`https://api.spotify.com/${endpoint}`, {
            headers: {
                Authorization: `Bearer ${this._access_info.access_token}`,
            },
            method,
            body: JSON.stringify(body)
        });
        console.log(res)
        return await res.json();
    }
};