import {DEFAULT_TIME_BETWEEN_SAMPLES} from "./consts.js"
import { Spotify } from "./spotify.js";

// console.clear()

const storage = browser.storage.local;
async function storageGet(_key, _default){
    const res = await storage.get(_key)
    return res[_key] || _default
}
const timeBetweenSample = await storageGet("timeBetweenSample", DEFAULT_TIME_BETWEEN_SAMPLES);
var timeBufferSize = await storageGet("timeBufferSize", 120);
var timeTreshold = await storageGet("timeTreshold", 60);
var regex = await storageGet("regex", "www\.youtube\.com")
var client_id = await storageGet("client_id", null)

var buffer = []
var bufferMaxSize = timeBufferSize/timeBetweenSample;
var triggered = false;


const spotify = await new Spotify();
if(client_id){
    await spotify.init(client_id, browser.identity.getRedirectURL());
}

async function isPlaying(){
    const state = await spotify.dispatch("GET", "v1/me/player");
    console.log(state)
    const dev_id = await getSelectedDevice()
    const playing = state.is_playing;
    const onRightDevice = dev_id === state.device.id

    return playing && onRightDevice
}

async function getSelectedDevice(){
    const devices = await browser.storage.local.get(['selected_device', "temp_device"]);
    let dev_id;
    if(devices.selected_device){
        dev_id = devices.selected_device.id;
    } else {
        dev_id = devices.temp_device.id;
    }
    return dev_id;
}

async function exec(){
    if(await isPlaying()) return;

    const selected_uri = await storageGet("selected_uri", "spotify:artist:25b7eSZD64Sm8ReHZ1WDc7")
    const dev_id = await getSelectedDevice()

    spotify.dispatch("PUT", `v1/me/player/play?device_id=${dev_id}`,{
        context_uri: selected_uri
    });
}

async function sample(value){
    buffer.push(value)
    if(buffer.length > bufferMaxSize){
        buffer.shift()
    }
    const val = buffer.reduce((p,v) => p+v)*timeBetweenSample
    // console.log(`${val} of ${timeTreshold} in ${timeBufferSize}`)
    if(val >= timeTreshold){
        buffer = []
        await exec()
    }
}

async function heartbeat(){
    if(!spotify.isAuthed()){
        if(spotify.isClientSetup()){
            browser.alarms.clear()
            await authorizeSpotify()
        }
    } else if(spotify.isExpired()) {
        await spotify.refreshAuth()
        if(!spotify.isAuthed() || spotify.isExpired()){
            await authorizeSpotify()
        }
    }

    const focused = await browser.windows.getCurrent();
    const tabs = await browser.tabs.query({active: true, currentWindow: true})

    if(focused.focused && tabs && tabs.length > 0){
        const url = tabs[0].url;
        if(url.match(regex)){
            await sample(1)
        } else {
            await sample(0)
        }
    } else {
        await sample(0)
    }
    
    let val = 0
    if(buffer.length > 0)
        val = buffer.reduce((p,v) => p+v)*timeBetweenSample
    console.log(`hearbeat: ${val} of ${timeTreshold}`)
    browser.runtime.sendMessage({"type":"heartbeat", "value":val, "threshold":timeTreshold, "bufferSize": bufferMaxSize*timeBetweenSample})
}

function createAlarm(){
    var when = Date.now() + 5 * 1000;
    browser.alarms.create("heartbeat", {when: when})
}

browser.alarms.onAlarm.addListener(async (e)=> {
    if(e.name === "heartbeat"){
        await heartbeat()
        createAlarm()
    }
})

createAlarm()

//todo: combine that into new update interface
function updateSettings(treshold, bufferSize){
    if(!treshold || !bufferSize) return
    timeTreshold = treshold
    bufferMaxSize = bufferSize/timeBetweenSample
    if(timeBufferSize > bufferSize){
        buffer = buffer.slice(bufferMaxSize)
    }        
    timeBufferSize = bufferSize
}

function updateSettings2(message){
    if(message.regex){
        regex = message.regex;
        browser.storage.local.set({'regex': message.regex});
    }
    if(message.selected_uri){
        selected_uri = message.selected_uri;
        browser.storage.local.set({'selected_uri': message.selected_uri});
    }
}

// respond with promise is only Firefox/IOS thing
function dispatchSpotify (message){
    console.log("dispath spotify")
    console.log(message)
    switch (message.command){
        case 'setup':
            if(message.client_id){
                browser.storage.local.set({'client_id':message.client_id});
                spotify.init(message.client_id, browser.identity.getRedirectURL())
                return spotify.regenerate()
            }

        case 'regenerate':
            spotify.regenerate();
            return Promise.resolve("done");
        break;
        case 'authorize':
            return authorizeSpotify()
        break;
        case 'logout':
            spotify.logout();
            return Promise.resolve(spotify.isAuthed());
            break;
        case 'isAuthed':
            return Promise.resolve(spotify.isAuthed());
        break;
        case 'isClientSetup':
            return Promise.resolve(spotify.isClientSetup());
        break;
        case 'dispatch':
            return Promise.resolve(spotify.dispatch(message['method'], message['endpoint'], message['body']))
        case 'play':
            exec()
            return Promise.resolve()
        break;
    }
    return false
}

function authorizeSpotify(){
    return browser.identity.launchWebAuthFlow({
        url: spotify.getAuthURL(),
        interactive: true
    }).then(async (redirectUri)=>{
        let m = redirectUri.match(/[#?](.*)/);
        let params = new URLSearchParams(m[1].split("#")[0]);
        let code = params.get("code");
        return await spotify.authorize(code)
    });
}

function notify(message, sender) {
    if(message['type'] == 'updateSettings'){
        updateSettings(message['treshold'],message['buffer'])
    }
    if(message['type'] == 'set'){
        updateSettings2(message)
    }
    if(message['type'] == 'spotify'){
        return dispatchSpotify(message)
    }

    console.log("recieved messeaged")
    console.log(message)
    return true;
}


browser.runtime.onMessage.addListener(notify);

browser.runtime.openOptionsPage()

let ports = []
let recievers = []

browser.runtime.onConnect.addListener((p)=>{
    ports[p.sender.tab.id] = p
    p.onMessage.addListener((r)=>{
        if(r.type == "reciever"){
            recievers.push(p)
        }
        console.log(r)
    })
})