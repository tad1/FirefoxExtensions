import {DEFAULT_TIME_BETWEEN_SAMPLES} from "./consts.js"
import { Spotify } from "./spotify.js";

console.clear()

const storage = browser.storage.local;
async function storageGet(_key, _default){
    const res = await storage.get(_key)
    return res[_key] || _default
}
const timeBetweenSample = await storageGet("timeBetweenSample", DEFAULT_TIME_BETWEEN_SAMPLES);
var timeBufferSize = await storageGet("timeBufferSize", 40);
var timeTreshold = await storageGet("timeTreshold", 30);
var regex = await storageGet("regex", "www\.youtube\.com")
var spotify_uri = await storageGet("spotify_uri", "spotify:artist:25b7eSZD64Sm8ReHZ1WDc7")
var client_id = await storageGet("client_id", "")

var buffer = []
var bufferMaxSize = timeBufferSize/timeBetweenSample;
var triggered = false;


const spotify = await new Spotify();
await spotify.init(client_id, 'https://tad1.dev/browser-autoplay');
if(spotify.isAuthed()){

}

async function exec(){
    const devices = await browser.storage.local.get(['selected_device', "temp_device"]);
    let dev_id;
    if(devices.selected_device){
        dev_id = devices.selected_device.id;
    } else {
        dev_id = devices.temp_device.id;
    }
    spotify.dispatch("PUT", `v1/me/player/play?device_id=${dev_id}`,{
        context_uri: spotify_uri
    });
}

async function sample(value){
    buffer.push(value)
    if(buffer.length > bufferMaxSize){
        buffer.shift()
    }
    const val = buffer.reduce((p,v) => p+v)*timeBetweenSample
    // console.log(`${val} of ${timeTreshold} in ${timeBufferSize}`)
    if(val >= timeTreshold && !triggered){
        triggered = true;
        exec()
    }
}

async function heartbeat(){
    const focused = await browser.windows.getCurrent();
    const tabs = await browser.tabs.query({active: true, currentWindow: true})

    if(focused.focused && tabs && tabs.length > 0){
        const url = tabs[0].url;
        if(url.match(regex)){
            sample(1)
        } else {
            sample(0)
        }
    } else {
        sample(0)
    }

    const val = buffer.reduce((p,v) => p+v)*timeBetweenSample
    browser.runtime.sendMessage({"type":"heartbeat", "value":val, "threshold":timeTreshold, "bufferSize": bufferMaxSize*timeBetweenSample})
}

function createAlarm(){
    var when = Date.now() + 5 * 1000;
    browser.alarms.create("heartbeat", {when: when})
}



browser.alarms.onAlarm.addListener((e)=> {
    if(e.name === "heartbeat"){
        heartbeat()
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
    if(message.spotify_uri){
        spotify_uri = message.spotify_uri;
        browser.storage.local.set({'spotify_uri': message.spotify_uri});
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
                spotify.init(message.client_id, 'https://tad1.dev/browser-autoplay')
                return spotify.regenerate()
            }

        case 'regenerate':
            spotify.regenerate();
            return Promise.resolve("done");
        break;
        case 'getAuthURL':
            return Promise.resolve(spotify.getAuthURL())
        break;
        case 'authorize':
            if (!message['code']) return Promise.resolve(null);
            let res = spotify.authorize(message['code'])
            return res;
        break;
        case 'isAuthed':
            return Promise.resolve(spotify.isAuthed());
        break;
        case 'dispatch':
            console.log("dispathch")
            return Promise.resolve(spotify.dispatch(message['method'], message['endpoint'], message['body']))
        break;
    }
    return false
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