// rules js - handling change

window.addEventListener('load', ()=>{
    console.log("options.js")
    let formID = "rulesetForm"
    /**@type {HTMLFormElement} */
    let rulesetForm = document.forms[formID]

    const updateScript = ()=>{
        console.log(rulesetForm)
        /**@type {HTMLInputElement} */
        let tresh = rulesetForm['treshold_value']
        /**@type {HTMLInputElement} */
        let buff = rulesetForm['buffer_value']

        const treshValue = tresh.valueAsNumber
        // const buffValue = buff.valueAsNumber
        const buffValue = treshValue * 2;
        buff.value = buffValue;
        browser.runtime.sendMessage({"type":"updateSettings", "treshold":treshValue, "buffer": buffValue})
    }

    rulesetForm['treshold_value'].addEventListener("change", updateScript)
    rulesetForm['buffer_value'].addEventListener("change", updateScript)
    

    let hover = document.getElementById("hover")
    let hunder = document.getElementById("hunder")
    let hbuff = document.getElementById("hbuff")
    console.log("add heartbeat listener")
    browser.runtime.onMessage.addListener((msg)=>{
        if(msg['type'] != 'heartbeat') return;

        hover.textContent = msg["value"]
        hunder.textContent = msg["threshold"]
        hbuff.textContent = msg["bufferSize"]
    })

    /**@type {HTMLAnchorElement} */
    let redirectURLSpan = document.getElementById("redirect-url")
    let url = browser.identity.getRedirectURL()
    redirectURLSpan.innerText = url
    redirectURLSpan.href = url
})

