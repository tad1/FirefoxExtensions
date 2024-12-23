const handleAuthed = ()=>{
    document.getElementById("spotify-auth-btn").style.display = "none";
    document.getElementById("spotify-logout-btn").style.display = "inline-block";
    document.getElementById("spotify-logout-btn").addEventListener('click', async () => {
        await browser.runtime.sendMessage({"type":"spotify", "command":"logout"})
        window.location.reload()
    })

    document.getElementById("spotify-uri-play").addEventListener('click', async () => {
        browser.runtime.sendMessage({"type":"spotify", "command":"play"})
    })

    document.getElementById("spotify-auth-resp").textContent = "you are authed!";
    /** @type {HTMLSelectElement} */
    let deviceSelect = document.getElementById("device-select");
    /** @type {HTMLSelectElement} */
    let searchSelect = document.getElementById("search-select");
    
    browser.runtime.sendMessage({"type":"spotify", "command":"dispatch", "method":"GET", "endpoint":"v1/me/player/devices"}).then( async (v)=>{
        console.log(v)
        /**@type {Object[]} */
        let devices = v.devices;

        let default_device;
        let storaged = await browser.storage.local.get('selected_device');
        let match;
        if(storaged && storaged.selected_device){
            match = devices.filter(v => storaged.selected_device.id === v.id || storaged.selected_device.name === v.name)[0];
        }
        let active = devices.filter(v => v.is_active);
        if(match){
            default_device = match
            if(default_device.id !== storaged.selected_device.id){
                browser.storage.local.set({'selected_device': default_device})
            }

        } else if(active.length > 0) {
            default_device = active[0];
        } else {
            default_device = devices[0];
        }

        browser.storage.local.set({'temp_device': default_device})


        devices.forEach(device => {
            const option = document.createElement("option");
            option.value = device.id;
            option.text = device.name;
            if(device === default_device){
                option.selected = true;
            }
            deviceSelect.add(option);
        });
        deviceSelect.disabled = false;
        deviceSelect.addEventListener('change', (ev)=>{
            const id = ev.target.value
            const dev = devices.filter(v => v.id = id)[0]
            if(dev){
                browser.storage.local.set({'selected_device': dev})
            }
        })
    })

    browser.runtime.sendMessage({"type":"spotify", "command":"dispatch", "method":"GET", "endpoint":"v1/me/top/artists?limit=6&offset=0"}).then( async (v)=>{
        console.log(v)
        /**@type {{'images': {'url':string}[], 'name':string, 'uri': string}[]} */
        let items = v.items;
        // images[-1].url
        // name
        // uri
        let default_device;
        let storaged = await browser.storage.local.get('selected_uri');
   
        items.forEach(item => {
            const option = document.createElement("option");
            option.value = item.uri;
            option.text = item.name;
            searchSelect.add(option);
        });
        searchSelect.disabled = false;
        searchSelect.addEventListener('input', (ev)=>{
            const id = ev.target.value
            console.log(id)
            const dev = items.filter(v => v.uri = id)[0]
            if(dev){
                browser.storage.local.set({'selected_uri': dev.uri})
            }
            document.getElementById('spotify-uri').value = dev.uri;
        })
    })

    
    let default_device; //first check local storage (name/id match)
    // next, select  active one
    // otherwise the first one

    // Note on device selection
    // * the backend will validate if the device ID has updated
    // * if device is not avaliable, the extension will notify about that
    // * if there is selected device, set that one as default
    // *    if not, set the first one
    deviceSelect.addEventListener('select', (v)=>{
        console.log(v)
    })
}

window.addEventListener('load', async ()=>{
    if(document.readyState !== 'complete') return;
    const isAuthed = await browser.runtime.sendMessage({"type":"spotify", "command":"isAuthed"});
    console.log(isAuthed)
    const isClientSetup = await browser.runtime.sendMessage({"type":"spotify", "command":"isClientSetup"});
    console.log(`isClientSetup ${isClientSetup}`)

    browser.storage.local.get(['client_id', 'regex', 'selected_uri']).then(v=>{
        if(v.client_id)
            document.getElementById('spotify-client-id').value = v.client_id;
        if(v.regex)
            document.getElementById('url-regex').value = v.regex
        if(v.selected_uri)
            document.getElementById('spotify-uri').value = v.selected_uri

    })
    document.getElementById('url-regex-apply').addEventListener('click', ()=>{
        const value = document.getElementById('url-regex').value;
        browser.runtime.sendMessage({"type":"set", "regex": value});
    })
    document.getElementById('spotify-uri-apply').addEventListener('click', ()=>{
        const value = document.getElementById('spotify-uri').value;
        browser.runtime.sendMessage({"type":"set", "selected_uri": value});
    })

    document.getElementById("spotify-logout-btn").style.display = "none";

    if(isAuthed){
        handleAuthed();
        return;
    }

    if(!isClientSetup){
        /** @type{HTMLDivElement} */
        document.getElementById("spotify-auth").style.display = "none";
    }

    document.getElementById("spotify-auth-btn").style.display = "inline-block";;
    document.getElementById("spotify-auth-resp").textContent = "you are NOT authed";
    document.getElementById("spotify-auth-btn").addEventListener('click', async ()=>{
        const result = await browser.runtime.sendMessage({"type":"spotify", "command":"authorize"});
        window.location.reload()
    })

    document.getElementById('spotify-client-setup').addEventListener("click", async()=>{
        const value = document.getElementById('spotify-client-id').value;
        let res = await browser.runtime.sendMessage({"type":"spotify", "command":"setup", "client_id": value});
        window.location.reload()
    })
})